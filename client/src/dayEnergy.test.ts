import { describe, it, expect } from 'vitest';
import { NEAT_FACTOR, autoLifestyle, restingDayKcal, dayElapsedFraction } from './dayEnergy';
import type { Activity, Workout } from './types';

const DAY = 24 * 3600 * 1000;
const now = new Date(2025, 5, 15, 12, 0, 0).getTime(); // noon, June 15 2025

function workout(daysAgo: number, finished = true): Workout {
  const startedAt = now - daysAgo * DAY;
  return {
    id: `w${daysAgo}-${Math.random()}`,
    startedAt,
    finishedAt: finished ? startedAt + 3600_000 : null,
    exercises: [],
  } as unknown as Workout;
}

function activity(daysAgo: number, type: string, min = 30): Activity {
  const startedAt = now - daysAgo * DAY;
  return {
    id: `a${daysAgo}-${type}-${Math.random()}`,
    type,
    startedAt,
    finishedAt: startedAt + min * 60000,
    durationMin: min,
    effort: 'moderate',
  } as unknown as Activity;
}

describe('restingDayKcal', () => {
  it('multiplies BMR by the NEAT factor', () => {
    expect(restingDayKcal(1800, 1.2)).toBe(2160);
    expect(restingDayKcal(1800, 1.4)).toBe(2520);
  });
  it('prorates a partial day', () => {
    expect(restingDayKcal(2400, 1, 0.5)).toBe(1200);
    expect(restingDayKcal(2400, 1, 1)).toBe(2400);
  });
  it('caps the fraction at 1 and rejects dishonest inputs', () => {
    expect(restingDayKcal(2000, 1, 2)).toBe(2000);
    expect(restingDayKcal(null, 1.3)).toBeNull();
    expect(restingDayKcal(0, 1.3)).toBeNull();
    expect(restingDayKcal(1800, 1.3, 0)).toBeNull();
  });
});

describe('dayElapsedFraction', () => {
  it('is the elapsed share of the local day', () => {
    const midnight = new Date(2025, 5, 15, 0, 0, 0).getTime();
    expect(dayElapsedFraction(midnight, now)).toBeCloseTo(0.5, 5);
  });
  it('clamps past and future days', () => {
    const yesterdayMidnight = new Date(2025, 5, 14, 0, 0, 0).getTime();
    expect(dayElapsedFraction(yesterdayMidnight, now)).toBe(1);
    const tomorrowMidnight = new Date(2025, 5, 16, 0, 0, 0).getTime();
    expect(dayElapsedFraction(tomorrowMidnight, now)).toBe(0);
  });
});

describe('autoLifestyle', () => {
  it('is sedentary with no training', () => {
    const ls = autoLifestyle([], [], now);
    expect(ls.level).toBe('sedentary');
    expect(ls.factor).toBe(NEAT_FACTOR.sedentary);
    expect(ls.perWeek).toBe(0);
  });
  it('counts finished workouts + conditioning over 28 days as per-week', () => {
    // 8 workouts in 28 days = 2/wk -> light
    const ws = [0, 3, 6, 9, 12, 15, 18, 21].map((d) => workout(d));
    const ls = autoLifestyle(ws, [], now);
    expect(ls.perWeek).toBeCloseTo(2, 5);
    expect(ls.level).toBe('light');
  });
  it('ignores unfinished workouts and recovery-only activities', () => {
    const ws = [workout(1, false), workout(2, false)];
    const acts = [activity(1, 'sauna'), activity(2, 'massage'), activity(3, 'mobility')];
    const ls = autoLifestyle(ws, acts, now);
    expect(ls.level).toBe('sedentary');
  });
  it('conditioning activities lift the band', () => {
    // 16 runs in 28 days = 4/wk -> moderate
    const acts = Array.from({ length: 16 }, (_, i) => activity(i, 'run'));
    const ls = autoLifestyle([], acts, now);
    expect(ls.perWeek).toBeCloseTo(4, 5);
    expect(ls.level).toBe('moderate');
  });
  it('reaches active at high frequency', () => {
    // 24 sessions in 28 days = 6/wk -> active
    const ws = Array.from({ length: 24 }, (_, i) => workout(i));
    const ls = autoLifestyle(ws, [], now);
    expect(ls.level).toBe('active');
    expect(ls.factor).toBe(NEAT_FACTOR.active);
  });
  it('excludes sessions outside the window', () => {
    const ws = [workout(30), workout(40)];
    expect(autoLifestyle(ws, [], now).level).toBe('sedentary');
  });
});
