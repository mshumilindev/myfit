import { describe, expect, it } from 'vitest';
import { computeMastery, MASTERY_RANKS, sublevelRoman } from './mastery';
import type { BodyMetrics, Workout } from './types';

const emptyBM: BodyMetrics = {
  heightCm: null,
  sex: undefined,
  weights: [],
} as unknown as BodyMetrics;

describe('mastery engine', () => {
  it('is calibrating with no history and never throws', () => {
    const r = computeMastery({ workouts: [], bodyMetrics: emptyBM }, Date.now());
    expect(r.calibrating).toBe(true);
    expect(r.rating).toBeGreaterThanOrEqual(0);
    expect(r.rating).toBeLessThanOrEqual(1000);
    expect(r.rank.id).toBe('foundation');
    expect(r.practice).toHaveLength(9);
    expect(r.confidence).toBe('low');
  });

  it('ranks ascend and thresholds are ordered', () => {
    for (let i = 1; i < MASTERY_RANKS.length; i++) {
      expect(MASTERY_RANKS[i].threshold).toBeGreaterThan(MASTERY_RANKS[i - 1].threshold);
    }
  });

  it('sublevelRoman maps 1..3', () => {
    expect(sublevelRoman(1)).toBe('I');
    expect(sublevelRoman(2)).toBe('II');
    expect(sublevelRoman(3)).toBe('III');
  });

  it('firms up confidence once enough sessions exist', () => {
    const now = Date.now();
    const workouts: Workout[] = Array.from({ length: 18 }, (_, i) => ({
      id: `w${i}`,
      startedAt: now - (18 - i) * 3 * 86400000,
      finishedAt: now - (18 - i) * 3 * 86400000 + 3600000,
      autoFinished: false,
      exercises: [],
    })) as unknown as Workout[];
    const r = computeMastery({ workouts, bodyMetrics: emptyBM }, now);
    expect(r.sessions).toBe(18);
    expect(r.confidence).toBe('high');
  });
});
