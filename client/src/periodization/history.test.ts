import { describe, expect, it, vi } from 'vitest';

vi.mock('../firebase', () => ({ auth: { currentUser: null }, db: {} }));

import { RECENT_DAYS, bestSetIn, historyMax } from './history';
import type { Workout } from '../types';

const DAY = 86_400_000;
const NOW = 1_800_000_000_000;

const set = (weight: number | null, reps: number, extra: Record<string, unknown> = {}) => ({
  id: `s${Math.random()}`,
  reps,
  weight,
  isWarmup: false,
  ...extra,
});
const workout = (
  daysAgo: number,
  sets: ReturnType<typeof set>[],
  name = 'Barbell Squat',
): Workout =>
  ({
    id: `w${daysAgo}${Math.random()}`,
    startedAt: NOW - daysAgo * DAY,
    finishedAt: NOW - daysAgo * DAY + 3_600_000,
    exercises: [{ id: 'e', name, kind: 'strength', position: 0, sets }],
  }) as unknown as Workout;

describe('the best set in history', () => {
  it('is the set with the highest estimated max (Epley), not the heaviest', () => {
    const w = [workout(3, [set(120, 4), set(130, 1), set(100, 10)])];
    // 120 × (1 + 4/30) = 136; 130 × (1 + 1/30) = 134; 100 × (1 + 10/30) = 133
    expect(bestSetIn(w, 'Barbell Squat')).toMatchObject({ weight: 120, reps: 4, e1rm: 136 });
  });
  it('ignores warm-ups, sets over 10 reps, and bodyweight sets', () => {
    const w = [workout(3, [set(200, 3, { isWarmup: true }), set(60, 15), set(null, 8)])];
    expect(bestSetIn(w, 'Barbell Squat')).toBeNull();
  });
  it('matches the exercise by name, ignoring case and spacing, and not another exercise', () => {
    const w = [workout(3, [set(100, 5)], 'Barbell Squat'), workout(2, [set(300, 1)], 'Leg Press')];
    expect(bestSetIn(w, '  barbell squat ')?.e1rm).toBe(117);
    expect(bestSetIn(w, 'Front Squat')).toBeNull();
    expect(bestSetIn(w, '')).toBeNull();
  });
  it('counts the parts of a drop set', () => {
    const w = [workout(3, [set(100, 5, { type: 'drop', drops: [{ weight: 120, reps: 4 }] })])];
    expect(bestSetIn(w, 'Barbell Squat')).toMatchObject({ weight: 120, reps: 4 });
  });
  it('remembers when it was logged', () => {
    const w = [workout(7, [set(100, 5)])];
    expect(bestSetIn(w, 'Barbell Squat')?.at).toBe(NOW - 7 * DAY);
  });
});

describe('the max history implies', () => {
  it('prefers the recent window over a heavier old set', () => {
    const w = [workout(10, [set(100, 5)]), workout(RECENT_DAYS + 30, [set(150, 5)])];
    expect(historyMax(w, 'Barbell Squat', NOW)).toMatchObject({ older: false });
    expect(historyMax(w, 'Barbell Squat', NOW)?.set.e1rm).toBe(117);
  });
  it('falls back to the best of all time, flagged older, when nothing was lifted lately', () => {
    const w = [workout(RECENT_DAYS + 30, [set(150, 5)])];
    const h = historyMax(w, 'Barbell Squat', NOW);
    expect(h?.older).toBe(true);
    expect(h?.set.e1rm).toBe(175);
  });
  it('follows a new set at once (nothing is cached)', () => {
    const w: Workout[] = [workout(10, [set(100, 5)])];
    expect(historyMax(w, 'Barbell Squat', NOW)?.set.e1rm).toBe(117);
    w.push(workout(0, [set(110, 5)]));
    expect(historyMax(w, 'Barbell Squat', NOW)?.set.e1rm).toBe(128);
  });
  it('is null without any lift', () => {
    expect(historyMax([], 'Barbell Squat', NOW)).toBeNull();
  });
});
