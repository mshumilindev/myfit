import { describe, expect, it } from 'vitest';
import {
  EMPTY_EXERCISE_PREFS,
  hasCustomExercisePrefs,
  normalizeExercisePrefs,
  reconcileExercisePrefs,
  type ExercisePrefs,
} from './exercisePrefsSync';

// SPO-385 (T2): the weight unit and the per-exercise / rest settings follow the account instead of the device.
const custom: ExercisePrefs = {
  ...EMPTY_EXERCISE_PREFS,
  weightUnit: 'lb',
  exerciseUnits: { 'leg press': 'kg' },
  exerciseRest: { squat: 150 },
};

describe('normalizeExercisePrefs: only known shapes get in', () => {
  it('empty or junk gives the defaults', () => {
    expect(normalizeExercisePrefs(undefined)).toEqual(EMPTY_EXERCISE_PREFS);
    expect(normalizeExercisePrefs('x')).toEqual(EMPTY_EXERCISE_PREFS);
    expect(normalizeExercisePrefs([1])).toEqual(EMPTY_EXERCISE_PREFS);
  });
  it('keeps valid entries and drops the rest', () => {
    const p = normalizeExercisePrefs({
      weightUnit: 'lb',
      exerciseUnits: { a: 'lb', b: 'stone', c: 5 },
      exerciseLoadTypes: { a: 'band', b: 'plate' },
      exerciseSides: { a: 'one', b: 'both', c: 'left' },
      exerciseRest: { a: 90, b: -5, c: 'x', d: Infinity },
      restPrefs: { vibrate: false, sound: 'no', extra: true },
    });
    expect(p.weightUnit).toBe('lb');
    expect(p.exerciseUnits).toEqual({ a: 'lb' });
    expect(p.exerciseLoadTypes).toEqual({ a: 'band' });
    expect(p.exerciseSides).toEqual({ a: 'one', b: 'both' });
    expect(p.exerciseRest).toEqual({ a: 90 });
    expect(p.restPrefs).toEqual({ vibrate: false, sound: true, keepAwake: true, notify: false });
  });
  it('an unknown unit falls back to kg (never a wrong guess)', () => {
    expect(normalizeExercisePrefs({ weightUnit: 'stone' }).weightUnit).toBe('kg');
  });
});

describe('hasCustomExercisePrefs', () => {
  it('defaults: no; any pinned value or switch: yes', () => {
    expect(hasCustomExercisePrefs(EMPTY_EXERCISE_PREFS)).toBe(false);
    expect(hasCustomExercisePrefs(custom)).toBe(true);
    expect(
      hasCustomExercisePrefs({
        ...EMPTY_EXERCISE_PREFS,
        restPrefs: { ...EMPTY_EXERCISE_PREFS.restPrefs, sound: false },
      }),
    ).toBe(true);
  });
});

describe('reconcileExercisePrefs', () => {
  it('account has none and this device is on defaults: nothing to do', () => {
    expect(reconcileExercisePrefs({ at: 0, prefs: EMPTY_EXERCISE_PREFS }, null)).toEqual({});
  });
  it('account has none but this device has settings: they are saved to the account', () => {
    expect(reconcileExercisePrefs({ at: 0, prefs: custom }, null)).toEqual({ push: true });
  });
  it('a new device (defaults, no stamp) takes the account values', () => {
    const d = reconcileExercisePrefs(
      { at: 0, prefs: EMPTY_EXERCISE_PREFS },
      { at: 100, raw: { weightUnit: 'lb', exerciseRest: { squat: 150 } } },
    );
    expect(d.apply?.at).toBe(100);
    expect(d.apply?.prefs.weightUnit).toBe('lb');
    expect(d.apply?.prefs.exerciseRest).toEqual({ squat: 150 });
    expect(d.push).toBeUndefined();
  });
  it('a newer local edit not yet echoed keeps winning over the stale snapshot, and is sent when the account differs', () => {
    expect(reconcileExercisePrefs({ at: 200, prefs: custom }, { at: 100, raw: {} })).toEqual({
      push: true,
    });
    expect(reconcileExercisePrefs({ at: 200, prefs: custom }, { at: 100, raw: custom })).toEqual(
      {},
    );
  });
  it('an equal stamp is the echo of our own write: applied, harmlessly', () => {
    const d = reconcileExercisePrefs({ at: 100, prefs: custom }, { at: 100, raw: custom });
    expect(d.apply?.prefs).toEqual(custom);
  });
  it('a damaged account document never breaks the app: it reads as defaults', () => {
    const d = reconcileExercisePrefs({ at: 0, prefs: custom }, { at: 5, raw: 'garbage' });
    expect(d.apply?.prefs).toEqual(EMPTY_EXERCISE_PREFS);
  });
  it('first contact with settings on both sides: the account wins every conflict, this device only adds what is missing', () => {
    const mine = normalizeExercisePrefs({
      weightUnit: 'lb',
      exerciseRest: { squat: 60, bench: 90 },
    });
    const d = reconcileExercisePrefs(
      { at: 0, prefs: mine },
      { at: 100, raw: { weightUnit: 'kg', exerciseRest: { squat: 150 } } },
    );
    expect(d.apply?.prefs.weightUnit).toBe('kg');
    expect(d.apply?.prefs.exerciseRest).toEqual({ squat: 150, bench: 90 });
    expect(d.push).toBe(true);
    expect(d.apply?.at).toBeGreaterThan(100); // a fresh stamp, never the account's own
  });
  it('first contact with nothing to add: no write back at all', () => {
    const mine = normalizeExercisePrefs({ exerciseRest: { squat: 60 } });
    const d = reconcileExercisePrefs(
      { at: 0, prefs: mine },
      { at: 100, raw: { exerciseRest: { squat: 150 } } },
    );
    expect(d.push).toBeUndefined();
    expect(d.apply?.prefs.exerciseRest).toEqual({ squat: 150 });
  });
});
