import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { LOCALES, setLocale } from '../i18n';
import { __getStateForTests, __replaceStateForTests } from '../store';
import { BUILT_IN_CATALOG } from '../data/exercises';
import type { Workout } from '../types';
import { MuscleStatePanel } from './MuscleStatePanel';
import { fatigueByGroup } from '../picker';

// SPO-352: the session muscle drawer says why the weekly fatigue reads as it does, consistent with the picker.
const NOW = new Date(2026, 9, 26, 12, 0).getTime();
const DAY = 86400000;
const bench = BUILT_IN_CATALOG.find((c) => c.muscle === 'chest' && /bench press/i.test(c.names[0]))!
  .names[0];
const session = (id: string, startedAt: number, sets: number): Workout => ({
  id,
  startedAt,
  finishedAt: startedAt + 3600000,
  autoFinished: false,
  exercises: [
    {
      id: `${id}-e`,
      name: bench,
      position: 0,
      sets: Array.from({ length: sets }, (_, i) => ({
        id: `${id}-s${i}`,
        reps: 8,
        weight: 60,
        isWarmup: false,
      })),
    } as never,
  ],
});
const cur: Workout = {
  id: 'cur',
  startedAt: NOW - 600000,
  finishedAt: null,
  autoFinished: false,
  exercises: [],
};
const setWorkouts = (workouts: Workout[]) =>
  __replaceStateForTests({ ...__getStateForTests(), workouts } as never);
const show = () =>
  render(<MuscleStatePanel muscle="chest" workout={cur} todaySets={0} plateau={6} />);

beforeEach(() => {
  setLocale('en');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('MuscleStatePanel fatigue reason', () => {
  it('rested for 9 days: Fresh, with "last trained 9 d ago"', () => {
    setWorkouts([9, 12, 15].map((d) => session(`r${d}`, NOW - d * DAY, 3)));
    const { container } = show();
    expect(container.textContent).toContain(LOCALES.en.fatLevel.fresh);
    expect(container.textContent).not.toContain(LOCALES.en.fatLevel.high);
    expect(container.querySelector('.mss-why')!.textContent).toBe(LOCALES.en.fatWhy.idle(9));
  });

  it('a loaded week shows the sets against the limit', () => {
    setWorkouts([session('h', NOW - DAY, 24)]);
    const { container } = show();
    expect(container.querySelector('.mss-why')!.textContent).toBe(LOCALES.en.fatWhy.load(24, 22));
  });

  it('agrees with the picker card for the same muscle (same ceilings)', () => {
    const ws = [session('a', NOW - DAY, 18), session('b', NOW - 3 * DAY, 14)];
    setWorkouts(ws);
    const card = fatigueByGroup(ws, NOW).get('chest')!;
    const { container } = show();
    expect(container.textContent).toContain(LOCALES.en.fatLevel[card.level]);
    expect(container.querySelector('.mss-why')!.textContent).toBe(
      LOCALES.en.fatWhy.load(Math.round(card.sets * 10) / 10, card.mrv),
    );
  });
});
