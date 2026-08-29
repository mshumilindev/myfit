import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_TYPES,
  activityType,
  activityCategory,
  durationMin,
  estimateCalories,
  workoutCalories,
  activityWeek,
  activityRecoveryBias,
} from './activities';
import type { Activity, Exercise, SetEntry, Workout } from './types';

const DAY = 24 * 3600 * 1000;

const set = (reps: number, over: Partial<SetEntry> = {}): SetEntry => ({
  id: Math.random().toString(36).slice(2),
  reps,
  weight: 60,
  isWarmup: false,
  position: 0,
  ...over,
});

const workout = (mins: number, sets: SetEntry[]): Workout => {
  const ex: Exercise = { id: 'e1', name: 'Squat', position: 0, sets };
  return {
    id: 'w1',
    startedAt: 0,
    finishedAt: mins * 60000,
    autoFinished: false,
    exercises: [ex],
  };
};

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

describe('workoutCalories', () => {
  it('splits work from rest, so a set-dense session outburns a lazy one of equal length', () => {
    const busy = workout(
      45,
      Array.from({ length: 24 }, () => set(10)),
    );
    const lazy = workout(45, [set(10), set(10), set(10), set(10), set(10)]);
    const busyKcal = workoutCalories(busy, 80)!;
    const lazyKcal = workoutCalories(lazy, 80)!;
    expect(busyKcal).toBeGreaterThan(lazyKcal);
  });
  it('counts a timed hold by its own duration', () => {
    const held = workout(20, [set(0, { durationMin: 5 })]);
    // 5 min work @ 7.5 MET + 15 min gym-floor recovery @ 3.5 MET, 80 kg
    // = 80 * (7.5 * 5/60 + 3.5 * 15/60) = 80 * (0.625 + 0.875) = 120
    expect(workoutCalories(held, 80)).toBe(120);
  });
  it('lands a heavy 90-minute lifting session in a realistic range', () => {
    const heavy = workout(
      90,
      Array.from({ length: 30 }, () => set(8)),
    );
    const kcal = workoutCalories(heavy, 100)!;
    expect(kcal).toBeGreaterThanOrEqual(560);
    expect(kcal).toBeLessThanOrEqual(650);
  });
  it('never lets work seconds exceed the wall-clock', () => {
    // 100 sets but only 1 min elapsed — capped at the minute of rest+work.
    const impossible = workout(
      1,
      Array.from({ length: 100 }, () => set(12)),
    );
    const kcal = workoutCalories(impossible, 80)!;
    // Whole minute counts as work @ 7.5 MET: 80 * 7.5 * (1/60) = 10
    expect(kcal).toBe(10);
  });
  it('degrades to null without a body weight or an end time', () => {
    expect(workoutCalories(workout(45, [set(10)]), null)).toBeNull();
    const live: Workout = { ...workout(45, [set(10)]), finishedAt: null };
    expect(workoutCalories(live, 80)).toBeNull();
    expect(workoutCalories(live, 80, 45 * 60000)).not.toBeNull();
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
