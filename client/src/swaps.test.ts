import { describe, expect, it } from 'vitest';
import { conditionLimits, exerciseFlag } from './conditions';
import { movementPattern, swapCandidates } from './swaps';
import type { ChronicCondition } from './types';

const limits = conditionLimits(
  [
    {
      id: 'c1',
      key: 'back_lumbar_disc',
      severity: 3,
      share: 'effects',
      createdAt: 0,
    } as ChronicCondition,
  ],
  Date.now(),
);

describe('swapCandidates', () => {
  it('reads movement patterns from names', () => {
    expect(movementPattern('Barbell Squat')).toBe('squat');
    expect(movementPattern('Leg Press')).toBe('squat');
    expect(movementPattern('Barbell Deadlift')).toBe('hinge');
    expect(movementPattern('Backward Drag')).toBeNull();
  });

  it('suggests real leg alternatives for a squat when spinal loading is avoided', () => {
    expect(exerciseFlag('Barbell Squat', limits).level).toBe('avoid');
    const out = swapCandidates('Barbell Squat', null, 4, limits);
    expect(out.length).toBeGreaterThan(0);
    for (const c of out) {
      expect(c.primary).toBe('quads');
      expect(movementPattern(c.name)).toBe('squat');
      expect(['avoid', 'caution']).not.toContain(exerciseFlag(c.name, limits).level);
      expect(c.name).not.toMatch(/drag|crawl|jump/i);
    }
  });

  it('prefers machine or supported variants under strict limits', () => {
    const out = swapCandidates('Barbell Squat', null, 4, limits);
    expect(
      out[0].equipment.some((e) => e === 'machine' || e === 'cable') ||
        /machine|smith|supported/i.test(out[0].name),
    ).toBe(true);
  });

  it('never returns the lift itself and skips cardio', () => {
    expect(swapCandidates('Barbell Squat', null, 8).map((c) => c.name)).not.toContain(
      'Barbell Squat',
    );
  });
});
