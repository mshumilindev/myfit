import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_QUIET,
  loadQuiet,
  quietIsManual,
  resetQuietForTests,
  saveQuiet,
} from './quietHours';
import { applySleepQuiet, sleepQuietWindow } from './sleepQuiet';
import type { SleepSchedule } from './types';

const every = (bedMin: number, wakeMin: number): SleepSchedule => ({
  sameEveryNight: true,
  every: { bedMin, wakeMin },
  byDay: {},
});
const none = () => null;

beforeEach(() => {
  localStorage.clear();
  resetQuietForTests();
});

describe('quiet hours follow the Sleep add-on', () => {
  it('uses bedtime to wake time when Sleep is installed and nothing was set by hand', () => {
    applySleepQuiet(true, every(1410, 390), [], none);
    expect(loadQuiet()).toEqual({ on: true, from: 1410, to: 390 });
    expect(quietIsManual()).toBe(false);
  });
  it('keeps the default when Sleep is not installed', () => {
    applySleepQuiet(false, every(1410, 390), [], none);
    expect(loadQuiet()).toEqual(DEFAULT_QUIET);
  });
  it('falls back to the learned usual night, then to the default', () => {
    expect(sleepQuietWindow(true, null, () => ({ bedMin: 60, wakeMin: 480 }))).toEqual({
      from: 60,
      to: 480,
    });
    expect(sleepQuietWindow(true, null, none)).toBeNull();
    expect(
      sleepQuietWindow(true, null, () => {
        throw new Error('not provided');
      }),
    ).toBeNull();
  });
  it('never moves hours the person set by hand', () => {
    saveQuiet({ on: true, from: 1200, to: 300 });
    applySleepQuiet(true, every(1410, 390), [], none);
    expect(loadQuiet()).toEqual({ on: true, from: 1200, to: 300 });
    expect(quietIsManual()).toBe(true);
  });
  it('goes back to the default when Sleep is removed', () => {
    applySleepQuiet(true, every(1410, 390), [], none);
    applySleepQuiet(false, every(1410, 390), [], none);
    expect(loadQuiet()).toEqual(DEFAULT_QUIET);
  });
  it('can still be changed by hand afterwards', () => {
    applySleepQuiet(true, every(1410, 390), [], none);
    saveQuiet({ ...loadQuiet(), on: false });
    expect(loadQuiet()).toEqual({ on: false, from: 1410, to: 390 });
  });
});
