/** SPO-149: the strength widgets' plan preview knows about a break. */
import { describe, expect, it } from 'vitest';
import { targetFor } from './strengthTarget';
import type { Workout } from '../../types';

const local = (daysBack: number): number => new Date(2026, 5, 15 - daysBack, 9).getTime();

function squat(daysBack: number, kg: number): Workout {
  const startedAt = local(daysBack);
  return {
    id: `w${daysBack}`,
    startedAt,
    finishedAt: startedAt + 3_600_000,
    exercises: [
      {
        id: `e${daysBack}`,
        name: 'Barbell Back Squat',
        kind: 'strength',
        position: 0,
        primaryMuscle: 'quads',
        secondaryMuscles: [],
        sets: [{ id: 's', reps: 10, weight: kg, isWarmup: false, type: 'working' as const }],
      },
    ],
  } as unknown as Workout;
}

describe('targetFor (plan preview)', () => {
  it('after a long break the preview shows the return target, not "+5 kg"', () => {
    const t = targetFor([squat(60, 100)], 'Barbell Back Squat', 10, ['barbell'], local(0), 80);
    expect(t).toMatchObject({ state: 'return', returnKind: 'cut', weight: 90, deltaKg: -10 });
  });
  it('a recent session: the normal step', () => {
    const t = targetFor([squat(3, 100)], 'Barbell Back Squat', 10, ['barbell'], local(0), 80);
    expect(t).toMatchObject({ state: 'progress' });
  });
});
