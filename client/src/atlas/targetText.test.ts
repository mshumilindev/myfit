/** SPO-149: Atlas explains the return target and never caps a weight twice. */
import { describe, expect, it } from 'vitest';
import { liftTargetOf, nextWeightText, soreWeight, whyWeightBit } from './targetText';
import type { AskCtx, Tr } from './intentKit';
import type { Target } from '../progression';
import type { Workout } from '../types';

const local = (daysBack: number): number => new Date(2026, 5, 15 - daysBack, 9).getTime();
const L: Tr = (en) => en;

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
const ctx = (workouts: Workout[]): AskCtx =>
  ({
    s: { workouts, bodyMetrics: { weights: [] } },
    now: local(0),
    fmt: { exercise: (n: string) => n, kg: (n: number) => `${n} kg` },
  }) as unknown as AskCtx;

describe('Atlas next weight after a break', () => {
  it('the target is the return target and the words say so', () => {
    const c = ctx([squat(60, 100)]);
    expect(liftTargetOf(c, 'Barbell Back Squat')).toMatchObject({ state: 'return', weight: 90 });
    expect(nextWeightText(c, 'Barbell Back Squat', 'Squat', L)).toContain('Start lighter');
    expect(whyWeightBit(c, 'Barbell Back Squat', L)).toContain(
      '8 weeks since your last Barbell Back Squat',
    );
  });
  it('without a break the old wording stays', () => {
    const c = ctx([squat(3, 100)]);
    expect(whyWeightBit(c, 'Barbell Back Squat', L)).toContain('top of the rep range');
  });
});

describe('soreWeight', () => {
  const base: Target = {
    state: 'progress',
    weight: 105,
    reps: 7,
    deltaKg: 5,
    repLow: 7,
    repHigh: 10,
    prevWeight: 100,
    prevReps: 10,
  };
  it('a normal target is capped on its own weight (20% lighter, 2.5 steps)', () => {
    expect(soreWeight(base)).toBe(85);
  });
  it('after a break the cap works on the last weight and the lower of the two wins', () => {
    const cut: Target = { ...base, state: 'return', returnKind: 'cut', weight: 90, deltaKg: -10 };
    expect(soreWeight(cut)).toBe(80); // 100 x 0.8 = 80 < 90, never 90 x 0.8 = 72.5
    const ease: Target = { ...base, state: 'return', returnKind: 'ease', weight: 100, deltaKg: 0 };
    expect(soreWeight(ease)).toBe(80);
  });
});
