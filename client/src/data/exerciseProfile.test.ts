import { describe, expect, it } from 'vitest';
import RICH from './exercises.rich.json';
import {
  EXERCISE_PROFILES,
  defaultMeasure,
  exerciseProfile,
  type ExerciseLoad,
  type ExerciseMeasure,
} from './exerciseProfile';

const MEASURES: ExerciseMeasure[] = ['reps', 'hold', 'time', 'distance'];
const LOADS: ExerciseLoad[] = ['weight', 'bodyweight', 'bw_plus', 'assist', 'band', 'none'];

describe('exercise profiles', () => {
  it('covers every catalog move with valid values', () => {
    for (const e of RICH as { id: string }[]) {
      const p = EXERCISE_PROFILES[e.id];
      expect(p, e.id).toBeTruthy();
      expect(MEASURES).toContain(p.m);
      expect(LOADS).toContain(p.l);
    }
  });

  it('puts holds on the stopwatch and lifts on reps', () => {
    expect(exerciseProfile('Plank')).toEqual({ m: 'hold', l: 'none' });
    expect(exerciseProfile('Side Bridge').m).toBe('hold');
    expect(exerciseProfile('Pushups').m).toBe('reps');
    expect(exerciseProfile('Pullups').l).toBe('bw_plus');
    expect(exerciseProfile('Bench Press - Powerlifting').l).toBe('weight');
    expect(exerciseProfile('Running, Treadmill').m).toBe('time');
    expect(exerciseProfile("Farmer's Walk").m).toBe('distance');
  });

  it('derives own moves from the name', () => {
    expect(exerciseProfile('My wall sit').m).toBe('hold');
    expect(exerciseProfile('Plank jack').m).toBe('reps');
    expect(exerciseProfile('Assisted dip').l).toBe('assist');
    expect(exerciseProfile('Something new')).toEqual({ m: 'reps', l: 'weight' });
    expect(exerciseProfile(null).m).toBe('reps');
  });

  it('only defaults to a stopwatch for holds', () => {
    expect(defaultMeasure('Plank')).toBe('hold');
    expect(defaultMeasure('Running, Treadmill')).toBe('reps');
    expect(defaultMeasure("Farmer's Walk")).toBe('reps');
    expect(defaultMeasure('Squat')).toBe('reps');
  });
});
