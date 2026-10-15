import { describe, expect, it } from 'vitest';
import { LANDMARKS, classifyZone, weeklyMuscleSets } from './volume';
import { personalLandmarks } from './personalize';
import type { Workout } from './types';

const DAY = 24 * 3600 * 1000;
const now = Date.UTC(2026, 9, 15, 12);
const chestDay = (startedAt: number, n: number) =>
  ({
    id: `w${startedAt}`,
    startedAt,
    finishedAt: startedAt + 3600_000,
    exercises: [
      {
        id: 'e',
        name: 'Barbell Bench Press - Medium Grip',
        position: 0,
        kind: 'strength',
        sets: Array.from({ length: n }, (_, i) => ({
          id: `s${i}`,
          position: i,
          reps: 8,
          weight: 80,
          type: 'working',
        })),
      },
    ],
  }) as unknown as Workout;

describe('classifyZone boundaries (SPO-114)', () => {
  const lm = { mev: 6, mav: 12, mrv: 20 };
  it('zero sets is none', () => expect(classifyZone(0, lm)).toBe('none'));
  it('below MEV is under, MEV itself is productive', () => {
    expect(classifyZone(5.9, lm)).toBe('under');
    expect(classifyZone(6, lm)).toBe('productive');
  });
  it('MAV is high, MRV is still high, above MRV is over', () => {
    expect(classifyZone(12, lm)).toBe('high');
    expect(classifyZone(20, lm)).toBe('high');
    expect(classifyZone(20.1, lm)).toBe('over');
  });
});

describe('weeklyMuscleSets window', () => {
  it('counts a session exactly 7 days old, drops one older', () => {
    const edge = chestDay(now - 7 * DAY, 4);
    const old = chestDay(now - 7 * DAY - 1, 4);
    expect(weeklyMuscleSets([edge], now).get('chest')).toBeGreaterThan(0);
    expect(weeklyMuscleSets([old], now).get('chest') ?? 0).toBe(0);
  });
});

describe('personalLandmarks', () => {
  it('stays ordered and positive with no history', () => {
    const lm = personalLandmarks([], now).get('chest')!;
    expect(lm.mev).toBeGreaterThan(0);
    expect(lm.mev).toBeLessThanOrEqual(lm.mav);
    expect(lm.mav).toBeLessThanOrEqual(lm.mrv);
  });
  it('never drops below a floor of the base range after zero-set weeks', () => {
    const lm = personalLandmarks([chestDay(now - 30 * DAY, 1)], now).get('chest')!;
    expect(lm.mrv).toBeGreaterThanOrEqual(LANDMARKS.chest!.mev);
  });
});
