import { describe, expect, it } from 'vitest';
import { est1rm, topSet, workoutSets, workoutVolumeKg } from './store';
import type { SetEntry, Workout } from './types';

const set = (over: Partial<SetEntry>): SetEntry => ({
  id: over.id ?? Math.random().toString(36).slice(2),
  reps: 8,
  weight: 80,
  isWarmup: false,
  position: 0,
  ...over,
});

describe('topSet', () => {
  it('should pick the heaviest working set and ignore warm-ups', () => {
    const s = topSet([
      set({ weight: 40, isWarmup: true, position: 0 }),
      set({ weight: 80, position: 1 }),
      set({ weight: 85, reps: 8, position: 2 }),
    ]);
    expect(s?.weight).toBe(85);
  });

  it('should break weight ties by reps', () => {
    const s = topSet([
      set({ weight: 85, reps: 6, position: 0 }),
      set({ weight: 85, reps: 9, position: 1 }),
    ]);
    expect(s?.reps).toBe(9);
  });

  it('should return undefined when only warm-ups exist', () => {
    expect(topSet([set({ isWarmup: true })])).toBeUndefined();
  });
});

describe('est1rm', () => {
  it('should follow the Epley formula, rounded', () => {
    expect(est1rm(90, 8)).toBe(114);
    expect(est1rm(100, 1)).toBe(103);
    expect(est1rm(85, 8)).toBe(108);
  });
});

describe('workout aggregates', () => {
  const w: Workout = {
    id: 'w1',
    startedAt: 0,
    finishedAt: 1000,
    autoFinished: false,
    exercises: [
      {
        id: 'e1',
        name: 'Back Squat',
        position: 0,
        sets: [set({ reps: 12, weight: 40 }), set({ reps: 8, weight: 80, position: 1 })],
      },
      {
        id: 'e2',
        name: 'RDL',
        position: 1,
        sets: [set({ reps: 10, weight: 70 })],
      },
    ],
  };

  it('should count sets across exercises', () => {
    expect(workoutSets(w)).toBe(3);
  });

  it('should sum volume as Σ reps × weight (warm-ups included)', () => {
    expect(workoutVolumeKg(w)).toBe(12 * 40 + 8 * 80 + 10 * 70);
  });
});
