import { describe, expect, it } from 'vitest';
import {
  EMPTY_SLEEP_PREFS,
  hasCustomSleepPrefs,
  normalizeSleepPrefs,
  reconcileSleepPrefs,
  type SleepPrefs,
} from './sleepPrefsSync';

// SPO-397: the sleep schedule and the sleep switches follow the account instead of the device.
const custom: SleepPrefs = {
  schedule: { sameEveryNight: true, every: { bedMin: 1380, wakeMin: 420 }, byDay: {} },
  settings: { autoDim: true, autoLog: true, goalMin: 450 },
};

describe('normalizeSleepPrefs: only known shapes get in', () => {
  it('empty or junk gives the defaults', () => {
    expect(normalizeSleepPrefs(undefined)).toEqual(EMPTY_SLEEP_PREFS);
    expect(normalizeSleepPrefs('x')).toEqual(EMPTY_SLEEP_PREFS);
    expect(normalizeSleepPrefs([1])).toEqual(EMPTY_SLEEP_PREFS);
  });
  it('keeps valid values and drops the rest', () => {
    const p = normalizeSleepPrefs({
      schedule: {
        sameEveryNight: false,
        every: null,
        byDay: {
          1: { bedMin: 1400, wakeMin: 400 },
          2: { bedMin: 'x', wakeMin: 1 },
          9: { bedMin: 1, wakeMin: 2 },
        },
      },
      settings: { autoDim: true, autoLog: 'yes', goalMin: 300, lastDimDay: '2026-10-01' },
    });
    expect(p.schedule.sameEveryNight).toBe(false);
    expect(p.schedule.byDay).toEqual({ 1: { bedMin: 1400, wakeMin: 400 } });
    expect(p.settings).toEqual({ autoDim: true, autoLog: false, goalMin: 300 });
  });
  it('a nonsense goal falls back to 8 h, never to a guess', () => {
    for (const goalMin of [0, -5, 'x', Infinity, 99999]) {
      expect(normalizeSleepPrefs({ settings: { goalMin } }).settings.goalMin).toBe(480);
    }
  });
  it('a plan outside a day (minutes out of range) is dropped', () => {
    const p = normalizeSleepPrefs({
      schedule: { sameEveryNight: true, every: { bedMin: -1, wakeMin: 400 }, byDay: {} },
    });
    expect(p.schedule.every).toBeNull();
  });
});

describe('hasCustomSleepPrefs', () => {
  it('defaults: no; any set plan, switch or goal: yes', () => {
    expect(hasCustomSleepPrefs(EMPTY_SLEEP_PREFS)).toBe(false);
    expect(hasCustomSleepPrefs(custom)).toBe(true);
    expect(
      hasCustomSleepPrefs({
        ...EMPTY_SLEEP_PREFS,
        settings: { ...EMPTY_SLEEP_PREFS.settings, goalMin: 420 },
      }),
    ).toBe(true);
  });
});

describe('reconcileSleepPrefs', () => {
  it('no document in the account: keep this device and send it once (only if it is not all defaults)', () => {
    expect(reconcileSleepPrefs({ at: 0, prefs: custom }, null)).toEqual({ push: true });
    expect(reconcileSleepPrefs({ at: 0, prefs: EMPTY_SLEEP_PREFS }, null)).toEqual({});
  });
  it('a new device takes the account values (the account wins)', () => {
    const r = reconcileSleepPrefs({ at: 0, prefs: EMPTY_SLEEP_PREFS }, { at: 500, raw: custom });
    expect(r.apply).toEqual({ at: 500, prefs: custom });
    expect(r.push).toBeUndefined();
  });
  it('first contact with different values on both sides: the account stands, nothing is pushed', () => {
    const other: SleepPrefs = {
      ...custom,
      settings: { autoDim: false, autoLog: false, goalMin: 400 },
    };
    const r = reconcileSleepPrefs({ at: 0, prefs: other }, { at: 500, raw: custom });
    expect(r.apply).toEqual({ at: 500, prefs: custom });
    expect(r.push).toBeUndefined();
  });
  it('first contact: an empty or junk account document does not wipe values this device set', () => {
    for (const raw of [{}, { settings: { goalMin: 'x' } }, 'junk', EMPTY_SLEEP_PREFS]) {
      expect(reconcileSleepPrefs({ at: 0, prefs: custom }, { at: 1, raw })).toEqual({ push: true });
    }
    // a device that did edit (has a stamp) still follows a newer account value, even a default one
    expect(
      reconcileSleepPrefs({ at: 100, prefs: custom }, { at: 200, raw: EMPTY_SLEEP_PREFS }).apply
        ?.prefs,
    ).toEqual(EMPTY_SLEEP_PREFS);
  });
  it('a newer local edit that has not echoed back wins and is re-sent if the account still differs', () => {
    expect(
      reconcileSleepPrefs({ at: 900, prefs: custom }, { at: 500, raw: EMPTY_SLEEP_PREFS }),
    ).toEqual({
      push: true,
    });
    expect(reconcileSleepPrefs({ at: 900, prefs: custom }, { at: 500, raw: custom })).toEqual({});
  });
  it('an older or equal local stamp takes the account', () => {
    const r = reconcileSleepPrefs({ at: 500, prefs: EMPTY_SLEEP_PREFS }, { at: 500, raw: custom });
    expect(r.apply?.prefs).toEqual(custom);
  });
  it('the account document is read through the normaliser (junk never reaches the state)', () => {
    const r = reconcileSleepPrefs(
      { at: 0, prefs: EMPTY_SLEEP_PREFS },
      { at: 5, raw: { settings: { goalMin: 'x' } } },
    );
    expect(r.apply?.prefs).toEqual(EMPTY_SLEEP_PREFS);
  });
});
