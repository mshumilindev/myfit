import { describe, expect, it } from 'vitest';
import { starterPlan, SPLIT_SLOTS } from './starterPlan';
import { buildPickItems } from './picker';
import type { Workout } from './types';

const empty: Workout = {
  id: 'w',
  startedAt: 0,
  finishedAt: null,
  autoFinished: false,
  gymId: null,
  dayName: null,
  targetMuscles: [],
  exercises: [],
} as never;

describe('starterPlan', () => {
  const items = buildPickItems(empty, [], null);
  it('novices get full body on any day', () => {
    const p = starterPlan({ weekday: 1, finishedCount: 0, items, recovering: () => false });
    expect(p.day).toBe('full');
    expect(p.lifts.length).toBe(SPLIT_SLOTS.full.length);
  });
  it('trained lifters follow the weekday split, dodging recovering muscles', () => {
    expect(starterPlan({ weekday: 1, finishedCount: 20, items, recovering: () => false }).day).toBe(
      'push',
    );
    const p = starterPlan({
      weekday: 1,
      finishedCount: 20,
      items,
      recovering: (m) => m === 'chest' || m === 'shoulders' || m === 'triceps',
    });
    expect(['pull', 'legs', 'lower']).toContain(p.day);
  });
});
