/** SPO-149: the picker's "Try ..." target knows about a break. */
import { describe, expect, it } from 'vitest';
import { pickTarget } from './pickerTarget';
import type { Workout } from './types';

const local = (daysBack: number): number => new Date(2026, 5, 15 - daysBack, 9).getTime();

function bench(daysBack: number, kg: number): Workout {
  const startedAt = local(daysBack);
  return {
    id: `w${daysBack}`,
    startedAt,
    finishedAt: startedAt + 3_600_000,
    exercises: [
      {
        id: `e${daysBack}`,
        name: 'Barbell Bench Press',
        kind: 'strength',
        position: 0,
        primaryMuscle: 'chest',
        secondaryMuscles: [],
        sets: [{ id: 's', reps: 10, weight: kg, isWarmup: false, type: 'working' as const }],
      },
    ],
  } as unknown as Workout;
}
const item = {
  name: 'Barbell Bench Press',
  timesDone: 3,
  equipment: 'barbell' as const,
  primary: 'chest' as const,
  last: { weight: 80 },
};

describe('pickTarget', () => {
  it('never done: no target', () => {
    expect(pickTarget({ ...item, timesDone: 0 }, [bench(60, 80)], local(0))).toBeNull();
  });
  it('trained last week: the normal step up', () => {
    expect(pickTarget(item, [bench(7, 80)], local(0))).toMatchObject({ state: 'progress' });
  });
  it('six weeks off: the lighter return target (R2: x0.9), at the moment of the suggestion', () => {
    expect(pickTarget(item, [bench(42, 80)], local(0))).toMatchObject({
      state: 'return',
      returnKind: 'cut',
      weight: 72.5,
    });
    // The same history seen from two weeks after the last session: no break yet.
    expect(pickTarget(item, [bench(42, 80)], local(28))).toMatchObject({ state: 'progress' });
  });
});
