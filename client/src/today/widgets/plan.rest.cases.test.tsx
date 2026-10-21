import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { PLAN_WIDGETS } from './plan';
import { NOW, PRESETS, STATES, renderWidget, seed, setLocale } from '../__fixtures__/widgetHarness';
import type { WidgetSize } from '../../components/ui/Widget';
import type { StoreState } from '../../store';
import type { Exercise, Workout } from '../../types';

const rest = PLAN_WIDGETS.find((w) => w.id === 'rest-timer')!;

const mkSet = (id: string, reps: number, weight: number, extra: Record<string, unknown>) => ({
  id,
  reps,
  weight,
  isWarmup: false,
  ...extra,
});

function ex(
  id: string,
  name: string,
  position: number,
  sets: number,
  plannedSets?: number,
  lastAgo = 40_000,
): Exercise {
  return {
    id,
    name,
    kind: 'strength',
    position,
    primaryMuscle: 'chest',
    secondaryMuscles: [],
    ...(plannedSets === undefined ? {} : { plannedSets }),
    sets: Array.from({ length: sets }, (_, i) =>
      mkSet(`${id}-s${i}`, 8, 70 + i, { loggedAt: NOW - lastAgo - (sets - i) * 1000 } as never),
    ),
  } as unknown as Exercise;
}

function live(exercises: Exercise[], dayName?: string): StoreState {
  const base = STATES.rich();
  const w = {
    id: 'live',
    startedAt: NOW - 30 * 60_000,
    finishedAt: null,
    autoFinished: false,
    ...(dayName ? { dayName } : {}),
    exercises,
  } as unknown as Workout;
  return { ...base, workouts: [...base.workouts, w] } as StoreState;
}
const text = (size: WidgetSize) => {
  const r = renderWidget(rest, size);
  const out = r.container.textContent ?? '';
  r.unmount();
  return out;
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  localStorage.clear();
  setLocale('en');
  PRESETS.none();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('rest timer inside a live session', () => {
  it('XL names the day, the set progress and what is up next with its planned sets', () => {
    seed(
      live(
        [ex('a', 'Barbell Bench Press - Medium Grip', 0, 1, 3), ex('b', 'Barbell Squat', 1, 0, 4)],
        'Push day',
      ),
    );
    const out = text('XL');
    expect(out).toContain('Rest · Push day');
    expect(out).toContain('set 1/3');
    expect(out).toContain('Up next');
    expect(out).toContain('4 sets');
    expect(out).toContain('Last: 70 × 8');
  });

  it('without a day name the kicker falls back to the exercise', () => {
    seed(live([ex('a', 'Barbell Bench Press - Medium Grip', 0, 2)]));
    const out = text('XL');
    expect(out).toContain('Rest · ');
    expect(out).toContain('set 2/2');
    expect(out).not.toContain('Up next');
  });

  it('an exercise that already met its planned sets is not offered as up next', () => {
    seed(
      live(
        [ex('a', 'Barbell Bench Press - Medium Grip', 0, 1, 3), ex('b', 'Barbell Squat', 1, 3, 3)],
        'Push',
      ),
    );
    expect(text('XL')).not.toContain('Up next');
  });

  it('long after the last set the rest is over and counts upward', () => {
    seed(live([ex('a', 'Barbell Bench Press - Medium Grip', 0, 1, 3, 200_000)], 'Push'));
    for (const size of ['S', 'M', 'L', 'XL'] as const) {
      const out = text(size);
      expect(out, size).toMatch(/\+\d:\d\d/);
    }
    expect(text('S')).toContain('Rest is over');
  });

  it('after a quarter of an hour of silence the session timer gives way to the idle quick rest', () => {
    seed(live([ex('a', 'Barbell Bench Press - Medium Grip', 0, 1, 3, 15 * 60_000)], 'Push'));
    expect(text('XL')).toContain('Quick rest');
  });
});

describe('rest timer on its own', () => {
  it('a stored countdown still running is shown on every size', () => {
    seed(STATES.empty());
    localStorage.setItem(
      'spotter.tw.rest-timer',
      JSON.stringify({ at: 0, delta: 0, skip: false, endsAt: NOW + 45_000, total: 60_000 / 1000 }),
    );
    for (const size of ['S', 'M', 'L', 'XL'] as const) expect(text(size), size).toContain('0:45');
    expect(text('XL')).toContain('Quick rest');
  });

  it('a countdown that ended less than a minute ago shows as over; older ones fall back to idle', () => {
    seed(STATES.empty());
    localStorage.setItem(
      'spotter.tw.rest-timer',
      JSON.stringify({ at: 0, delta: 0, skip: false, endsAt: NOW - 20_000, total: 90 }),
    );
    expect(text('XL')).toContain('+0:20');
    localStorage.setItem(
      'spotter.tw.rest-timer',
      JSON.stringify({ at: 0, delta: 0, skip: false, endsAt: NOW - 120_000, total: 90 }),
    );
    expect(text('XL')).toContain('0:00');
    expect(text('XL')).not.toContain('+');
  });
});
