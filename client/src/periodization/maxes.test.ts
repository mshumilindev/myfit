import { afterEach, describe, expect, it, vi } from 'vitest';

const DAY = 86_400_000;
const w = vi.hoisted(() => ({ workouts: [] as unknown[] }));
vi.mock('../store', () => ({
  getStoreState: () => ({ workouts: w.workouts }),
  est1rm: (weight: number, reps: number) =>
    weight <= 0 || reps < 1 || reps > 10 ? 0 : Math.round(weight * (1 + reps / 30)),
}));
vi.mock('../firebase', () => ({ auth: { currentUser: null }, db: {} }));

import { maxFor, maxInfo } from './maxes';
import { EMPTY_MAXES, withMax } from './maxesData';
import { seedMaxes } from './maxesSync';

const NOW = 1_800_000_000_000;
const lift = (daysAgo: number, name: string, weight: number, reps: number) => ({
  id: `w${Math.random()}`,
  startedAt: NOW - daysAgo * DAY,
  exercises: [
    {
      id: 'e',
      name,
      kind: 'strength',
      position: 0,
      sets: [{ id: 's', reps, weight, isWarmup: false }],
    },
  ],
});

afterEach(() => {
  seedMaxes(EMPTY_MAXES);
  w.workouts = [];
});

describe('the max a percent is turned into kilograms against', () => {
  it('is what the history implies, with the set it comes from, when nothing was typed', () => {
    w.workouts = [lift(5, 'Back Squat', 120, 4)];
    expect(maxInfo('Back Squat', NOW)).toMatchObject({
      kg: 136,
      source: 'history',
      estimate: 136,
      older: false,
      typedAt: null,
      best: { weight: 120, reps: 4 },
    });
  });
  it('is none without history or a typed max', () => {
    expect(maxInfo('Weighted Pullups', NOW)).toMatchObject({
      kg: null,
      source: 'none',
      estimate: null,
    });
    expect(maxFor('Weighted Pullups')).toBeNull();
  });
  it('follows the training: a heavier set raises the estimate with nothing to refresh', () => {
    w.workouts = [lift(20, 'Back Squat', 100, 5)];
    expect(maxInfo('Back Squat', NOW).kg).toBe(117);
    w.workouts = [...w.workouts, lift(0, 'Back Squat', 110, 5)];
    expect(maxInfo('Back Squat', NOW).kg).toBe(128);
  });
  it('a typed max replaces the estimate, whatever the letter case, and the estimate stays known', () => {
    w.workouts = [lift(5, 'Back Squat', 120, 4)];
    seedMaxes(withMax(EMPTY_MAXES, 'back squat', 150, 77));
    expect(maxInfo('Back Squat', NOW)).toMatchObject({
      kg: 150,
      source: 'typed',
      estimate: 136,
      typedAt: 77,
    });
    expect(maxFor('Back Squat')).toBe(150);
  });
  it('a typed max works for an exercise with no history', () => {
    seedMaxes(withMax(EMPTY_MAXES, 'Weighted Pullups', 40, 1));
    expect(maxFor('Weighted Pullups')).toBe(40);
  });

  it('a set done after the max was typed that implies more takes over by itself, with nothing to confirm', () => {
    seedMaxes(withMax(EMPTY_MAXES, 'Back Squat', 150, NOW - 10 * DAY));
    w.workouts = [lift(2, 'Back Squat', 150, 3)]; // 165 > 150
    expect(maxInfo('Back Squat', NOW)).toMatchObject({
      kg: 165,
      source: 'history',
      typedAt: NOW - 10 * DAY,
    });
    expect(maxFor('Back Squat')).toBe(165);
  });
  it('sets from before the max was typed do not override it: a deliberately lower training max holds', () => {
    w.workouts = [lift(20, 'Back Squat', 150, 3)]; // 165, lifted before
    seedMaxes(withMax(EMPTY_MAXES, 'Back Squat', 140, NOW - 10 * DAY));
    expect(maxInfo('Back Squat', NOW)).toMatchObject({ kg: 140, source: 'typed', estimate: 165 });
  });
  it('a later set that does not beat the typed max leaves it alone', () => {
    seedMaxes(withMax(EMPTY_MAXES, 'Back Squat', 150, NOW - 10 * DAY));
    w.workouts = [lift(2, 'Back Squat', 120, 4)];
    expect(maxInfo('Back Squat', NOW)).toMatchObject({ kg: 150, source: 'typed' });
  });
});
