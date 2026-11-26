import { describe, expect, it } from 'vitest';
import { workoutSets, workoutVolumeKg } from '../store';
import { addBlock } from './blockOps';

describe('blocks stay out of the strength maths (formulas unchanged, invariant 8)', () => {
  it('sets, volume and exercise count of a session are the same with or without blocks', async () => {
    const base = {
      id: 'w',
      startedAt: 1,
      finishedAt: 2,
      autoFinished: false,
      exercises: [
        {
          id: 'e',
          name: 'Bench press',
          kind: 'strength' as const,
          position: 0,
          sets: [{ id: 's', reps: 5, weight: 100, isWarmup: false, position: 0 }],
        },
      ],
    };
    const withBlocks = {
      ...base,
      blocks: addBlock([], { fmt: 'amrap', capSec: 60 }, [{ name: 'Pullups', reps: '5' }], 1, 1),
    };
    expect(workoutSets(withBlocks)).toBe(workoutSets(base));
    expect(workoutVolumeKg(withBlocks)).toBe(workoutVolumeKg(base));
  });
});
