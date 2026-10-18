/** SPO-149: every target call site agrees on the load type (an assisted lift after a break gets MORE help). */
import { describe, expect, it } from 'vitest';
import { finishedLiftTarget } from './liftTarget';
import { pickTarget } from './progression';
import type { Workout } from './types';

const BM = { weights: [{ at: 1, weight: 75 }] } as never;
const local = (daysBack: number): number => new Date(2026, 5, 15 - daysBack, 9).getTime();

function assisted(daysBack: number, kg: number): Workout {
  const startedAt = local(daysBack);
  return {
    id: `a${daysBack}`,
    startedAt,
    finishedAt: startedAt + 3_600_000,
    exercises: [
      {
        id: `e${daysBack}`,
        name: 'Assisted Pull-up',
        kind: 'strength',
        position: 0,
        primaryMuscle: 'lats',
        secondaryMuscles: [],
        sets: [{ id: 's', reps: 8, weight: kg, isWarmup: false, type: 'working' as const }],
      },
    ],
  } as unknown as Workout;
}

describe('finishedLiftTarget', () => {
  it('assisted lift after 6 weeks: more help (more negative), not a delta-0 cut', () => {
    const t = finishedLiftTarget([assisted(42, -30)], 'Assisted Pull-up', local(0), BM);
    expect(t).toMatchObject({ state: 'return', returnKind: 'cut' });
    expect(t.weight).toBeLessThan(-30);
    expect(t.deltaKg).toBeLessThan(0);
  });
  it('an explicit load type wins over the derived one', () => {
    const t = finishedLiftTarget([assisted(42, -30)], 'Assisted Pull-up', local(0), BM, {
      loadType: 'band',
    });
    // A band keeps its colour (weight) and cuts reps instead.
    expect(t.weight).toBe(-30);
    expect(t.reps).toBeLessThan(8);
  });
});

describe('pickTarget with an assisted lift', () => {
  it('suggests more help after a break', () => {
    const t = pickTarget(
      {
        name: 'Assisted Pull-up',
        timesDone: 3,
        equipment: null,
        primary: 'lats',
        last: { weight: -30 },
      },
      [assisted(42, -30)],
      local(0),
    );
    expect(t?.weight).toBeLessThan(-30);
  });
});
