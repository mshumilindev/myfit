import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { MUSCLES_WIDGETS } from './muscles';
import { NOW, PRESETS, STATES, renderWidget, seed, setLocale } from '../__fixtures__/widgetHarness';
import type { WidgetSize } from '../../components/ui/Widget';
import type { StoreState } from '../../store';
import type { Exercise, Workout } from '../../types';

const byId = (id: string) => MUSCLES_WIDGETS.find((w) => w.id === id)!;

function workout(id: string, startedAt: number, chestSets = 3): Workout {
  const exercise = {
    id: `${id}-e`,
    name: 'Barbell Bench Press - Medium Grip',
    kind: 'strength',
    position: 0,
    primaryMuscle: 'chest',
    secondaryMuscles: [],
    sets: Array.from({ length: chestSets }, (_, i) => ({
      id: `${id}-s${i}`,
      reps: 8,
      weight: 60,
      isWarmup: false,
    })),
  } as unknown as Exercise;
  return {
    id,
    startedAt,
    finishedAt: startedAt + 3_600_000,
    autoFinished: false,
    dayName: 'Push',
    exercises: [exercise],
  } as unknown as Workout;
}
const put = (workouts: Workout[]) => seed({ ...STATES.empty(), workouts } as StoreState);
const render = (id: string, size: WidgetSize) => renderWidget(byId(id), size);
const day = (m: number, d: number) => new Date(2026, m, d, 18, 0).getTime();

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

// The map reads the fading recent load (about 0.7 of the raw sets for a session that just happened), so the raw
// set counts below are chosen to land well inside each tint.
describe('muscle map: heat colour follows the weekly sets', () => {
  const colours = (sets: number) => {
    put([workout('a', NOW - 3_600_000, sets)]);
    const r = render('muscle-map', 'S');
    const html = r.container.innerHTML;
    r.unmount();
    return new Set(html.match(/accent-\d+/g));
  };
  it('under 5 sets is the darkest tint', () => {
    expect(colours(3).has('accent-800')).toBe(true);
    expect(colours(3).has('accent-500')).toBe(false);
  });
  it('5-9 sets is the second tint', () => {
    const c = colours(7);
    expect(c.has('accent-600')).toBe(true);
    expect(c.has('accent-500')).toBe(false);
  });
  it('10-14 sets is the third tint', () => {
    expect(colours(17).has('accent-500')).toBe(true);
  });
  it('15 or more sets is the brightest', () => {
    expect(colours(30).has('accent-300')).toBe(true);
  });
});

describe('sessions this month: change against last month', () => {
  const sep = [day(8, 5), day(8, 12), day(8, 19)];
  const aug = (n: number) => Array.from({ length: n }, (_, i) => day(7, 3 + i * 7));
  const run = (cur: number[], prev: number[]) => {
    put([...cur, ...prev].map((t, i) => workout(`w${i}`, t)));
    const r = render('sessions-month', 'M');
    const delta = r.container.querySelector('.uiw-delta')!;
    return { text: r.container.textContent ?? '', delta };
  };
  it('more sessions than last month is a good +N', () => {
    const { text, delta } = run(sep, aug(1));
    expect(text).toContain('3 sessions in September');
    expect(delta.textContent).toBe('+2');
    expect(delta.className).toContain('is-good');
  });
  it('fewer sessions is a bad minus-N', () => {
    const { delta } = run(sep.slice(0, 1), aug(3));
    expect(delta.textContent).toBe('−2');
    expect(delta.className).toContain('is-bad');
  });
  it('the same number is a neutral ±0', () => {
    const { delta } = run(sep.slice(0, 2), aug(2));
    expect(delta.textContent).toBe('±0');
    expect(delta.className).toContain('ut-muted');
  });
});
