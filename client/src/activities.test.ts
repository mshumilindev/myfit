import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_TYPES,
  activityType,
  activityCategory,
  durationMin,
  estimateCalories,
  activityWeek,
  activityRecoveryBias,
} from './activities';
import type { Activity } from './types';

const DAY = 24 * 3600 * 1000;

const act = (over: Partial<Activity>): Activity => ({
  id: Math.random().toString(36).slice(2),
  type: 'run',
  category: 'conditioning',
  startedAt: 0,
  finishedAt: null,
  durationMin: 30,
  ...over,
});

describe('catalog', () => {
  it('includes the required recovery types (massage, sauna, recovery)', () => {
    const recovery = ACTIVITY_TYPES.filter((t) => t.category === 'recovery').map((t) => t.key);
    expect(recovery).toContain('massage');
    expect(recovery).toContain('sauna');
    expect(recovery).toContain('mobility');
    expect(recovery).toContain('cold');
  });
  it('has conditioning cardio types with sane MET values', () => {
    const run = activityType('run');
    expect(run?.category).toBe('conditioning');
    expect(run?.met).toBeGreaterThan(5);
  });
  it('returns null for an unknown key', () => {
    expect(activityType('teleport')).toBeNull();
  });
});

describe('estimateCalories', () => {
  it('uses kcal ≈ MET · kg · hours', () => {
    const run = activityType('run')!; // met 9.8
    // 30 min at 80 kg, moderate: 9.8 * 80 * 0.5 = 392
    expect(estimateCalories(run, 30, 80, 'moderate')).toBe(392);
  });
  it('scales with effort', () => {
    const run = activityType('run')!;
    const light = estimateCalories(run, 30, 80, 'light')!;
    const hard = estimateCalories(run, 30, 80, 'hard')!;
    expect(hard).toBeGreaterThan(light);
  });
  it('degrades to null without a body weight or time', () => {
    const run = activityType('run')!;
    expect(estimateCalories(run, 30, null)).toBeNull();
    expect(estimateCalories(run, 30, 0)).toBeNull();
    expect(estimateCalories(run, 0, 80)).toBeNull();
  });
});

describe('durationMin & category', () => {
  it('prefers stored duration, else start→finish', () => {
    expect(durationMin(act({ durationMin: 45 }))).toBe(45);
    expect(durationMin(act({ durationMin: 0, startedAt: 0, finishedAt: 20 * 60000 }))).toBe(20);
  });
  it('reads category from the record then the type', () => {
    expect(activityCategory(act({ type: 'sauna', category: 'recovery' }))).toBe('recovery');
  });
});

describe('weekly rollup & recovery bias', () => {
  const now = 10 * DAY;
  it('splits conditioning vs recovery minutes', () => {
    const list = [
      act({ type: 'run', category: 'conditioning', startedAt: now - DAY, durationMin: 40 }),
      act({ type: 'sauna', category: 'recovery', startedAt: now - 2 * DAY, durationMin: 20 }),
      act({ type: 'run', category: 'conditioning', startedAt: now - 30 * DAY, durationMin: 99 }),
    ];
    const w = activityWeek(list, now, 80);
    expect(w.conditioningMin).toBe(40);
    expect(w.recoveryMin).toBe(20);
    expect(w.count).toBe(2); // the 30-day-old one is outside the window
    expect(w.conditioningKcal).toBeGreaterThan(0);
  });
  it('tilts positive for recovery-dominant weeks, negative for conditioning-heavy', () => {
    const recovery = [
      act({ type: 'massage', category: 'recovery', startedAt: now - DAY, durationMin: 120 }),
    ];
    const conditioning = [
      act({ type: 'run', category: 'conditioning', startedAt: now - DAY, durationMin: 120 }),
    ];
    expect(activityRecoveryBias(recovery, now)).toBeGreaterThan(0);
    expect(activityRecoveryBias(conditioning, now)).toBeLessThan(0);
  });
});
