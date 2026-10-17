/** SPO-149: a swapped-in lift gets the same break-aware target and warm-up as a built one. */
import { describe, expect, it } from 'vitest';
import { swapExercise } from './sessionSwap';
import type { Candidate, PlannedExercise } from './sessionBuilder';
import type { Workout } from './types';

const local = (daysBack: number, hour = 9): number =>
  new Date(2026, 5, 15 - daysBack, hour).getTime();
const now = local(0, 12);

const cand: Candidate = {
  name: 'Barbell Back Squat',
  primary: 'quads',
  secondary: [],
  equipment: 'barbell',
  compound: true,
  level: 'intermediate',
} as unknown as Candidate;
const slot = {
  name: 'Leg Press',
  sets: 3,
  repLow: 7,
  repHigh: 10,
  whyKey: 'fit',
  priority: 1,
} as unknown as PlannedExercise;

function squat(daysBack: number, kg: number): Workout {
  const startedAt = local(daysBack);
  return {
    id: `w${daysBack}`,
    startedAt,
    finishedAt: startedAt + 3_600_000,
    exercises: [
      {
        id: `e${daysBack}`,
        name: cand.name,
        kind: 'strength',
        position: 0,
        primaryMuscle: 'quads',
        secondaryMuscles: [],
        sets: [{ id: 's', reps: 10, weight: kg, isWarmup: false, type: 'working' as const }],
      },
    ],
  } as unknown as Workout;
}

describe('swapExercise', () => {
  it('after a 6-week break: lighter return target and one extra warm-up rung', () => {
    const swapped = swapExercise(cand, slot, [squat(42, 100)], now, 80);
    expect(swapped.progState).toBe('return');
    expect(swapped.targetWeight).toBe(90); // R2 (29-84 days): 100 x 0.9
    const recent = swapExercise(cand, slot, [squat(3, 100)], now, 80);
    expect(recent.progState).not.toBe('return');
    expect(swapped.warmup.length).toBe(recent.warmup.length + 1);
  });
});
