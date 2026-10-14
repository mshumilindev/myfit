import { afterEach, describe, expect, it } from 'vitest';
import { setCoachTimeZone } from '../format';
import { tsOf } from './time';
import {
  DEFAULT_DURATION,
  dragSpan,
  formatDraft,
  parseDraft,
  draftStartTs,
  lastDuration,
  lastGym,
  rememberDuration,
  rememberGym,
  snapMinutes,
} from './grid';
import { dayOfTs, minOfTs } from './time';

afterEach(() => {
  setCoachTimeZone('UTC');
  window.localStorage.clear();
});

describe('snapMinutes: the clicked y becomes a 15-minute row', () => {
  // a column of 1000 px for 07:00 (420) to 21:00 (1260): 0.84 min per px
  const at = (y: number) => snapMinutes(y, 1000, 420, 1260);
  it('snaps DOWN to the row under the pointer', () => {
    expect(at(0)).toBe(420);
    expect(at(17)).toBe(420); // 07:14.3
    expect(at(18)).toBe(435); // 07:15.1
    expect(at(470)).toBe(810); // 13:34.8 -> 13:30
  });
  it('never leaves the visible hours, and always has room for one row', () => {
    expect(at(-50)).toBe(420);
    expect(at(1000)).toBe(1245); // 20:45, the last row
    expect(at(5000)).toBe(1245);
  });
  it('a column with no height or range gives the first minute instead of NaN', () => {
    expect(snapMinutes(10, 0, 420, 1260)).toBe(420);
    expect(snapMinutes(10, 100, 600, 600)).toBe(600);
  });
  it('other steps work too (5 minutes)', () => {
    expect(snapMinutes(480, 1000, 420, 1260, 5)).toBe(820);
  });
});

describe('dragSpan: a drag from one row to another', () => {
  it('includes both rows, in either direction', () => {
    expect(dragSpan(810, 855)).toEqual({ start: 810, dur: 60 });
    expect(dragSpan(855, 810)).toEqual({ start: 810, dur: 60 });
  });
  it('one row is one step; a long drag is capped', () => {
    expect(dragSpan(810, 810)).toEqual({ start: 810, dur: 15 });
    expect(dragSpan(420, 1245).dur).toBe(240);
  });
});

describe('draftStartTs: the click is a wall-clock time in the COACH zone', () => {
  const day = (y: number, m: number, d: number) => dayOfTs(Date.UTC(y, m, d, 12));
  it('Kyiv in autumn is UTC+3, New York is UTC-4: the same 13:30 is a different instant', () => {
    const d = day(2026, 9, 11);
    expect(draftStartTs({ day: d, start: 810 }, 'Europe/Kyiv')).toBe(Date.UTC(2026, 9, 11, 10, 30));
    expect(draftStartTs({ day: d, start: 810 }, 'America/New_York')).toBe(
      Date.UTC(2026, 9, 11, 17, 30),
    );
    expect(draftStartTs({ day: d, start: 810 }, 'UTC')).toBe(Date.UTC(2026, 9, 11, 13, 30));
  });
  it('uses the configured coach zone by default and reads back as the same wall time', () => {
    setCoachTimeZone('Asia/Kolkata');
    const d = day(2026, 9, 11);
    const ts = draftStartTs({ day: d, start: 9 * 60 + 15 });
    expect(ts).toBe(Date.UTC(2026, 9, 11, 3, 45)); // +05:30
    expect(minOfTs(ts)).toBe(9 * 60 + 15);
    expect(dayOfTs(ts)).toBe(d);
  });
  it('a time inside the spring-forward gap shifts forward (Warsaw 2026-03-29, 02:30 does not exist)', () => {
    const spring = day(2026, 2, 29);
    expect(draftStartTs({ day: spring, start: 2 * 60 + 30 }, 'Europe/Warsaw')).toBe(
      Date.UTC(2026, 2, 29, 1, 30),
    );
  });
});

describe('tsOf: DST edges', () => {
  const day = (y: number, m: number, d: number) => dayOfTs(Date.UTC(y, m, d, 12));
  it('the autumn repeat takes the FIRST occurrence (Warsaw 2026-10-25 02:30 happens twice; Kyiv 03:30)', () => {
    expect(tsOf(day(2026, 9, 25), 2 * 60 + 30, 'Europe/Warsaw')).toBe(Date.UTC(2026, 9, 25, 0, 30));
    expect(tsOf(day(2026, 9, 25), 3 * 60 + 30, 'Europe/Kyiv')).toBe(Date.UTC(2026, 9, 25, 0, 30));
  });
  it('around the repeat the neighbours are unaffected and round-trip to the same wall time', () => {
    const d = day(2026, 9, 25);
    expect(tsOf(d, 1 * 60 + 30, 'Europe/Warsaw')).toBe(Date.UTC(2026, 9, 24, 23, 30));
    expect(tsOf(d, 3 * 60 + 30, 'Europe/Warsaw')).toBe(Date.UTC(2026, 9, 25, 2, 30));
  });
  it('the spring gap still shifts forward and ordinary days are exact', () => {
    expect(tsOf(day(2026, 2, 29), 2 * 60 + 30, 'Europe/Warsaw')).toBe(Date.UTC(2026, 2, 29, 1, 30));
    expect(tsOf(day(2026, 6, 1), 9 * 60, 'Europe/Kyiv')).toBe(Date.UTC(2026, 6, 1, 6, 0));
  });
});

describe('last used values', () => {
  it('default to 60 minutes and no gym', () => {
    expect(lastDuration()).toBe(DEFAULT_DURATION);
    expect(lastGym()).toBeNull();
  });
  it('remember what was used, and ignore junk', () => {
    rememberDuration(90);
    rememberGym('fithub');
    expect(lastDuration()).toBe(90);
    expect(lastGym()).toBe('fithub');
    window.localStorage.setItem('sc.quick.dur', 'abc');
    expect(lastDuration()).toBe(DEFAULT_DURATION);
    window.localStorage.setItem('sc.quick.dur', '5000');
    expect(lastDuration()).toBe(DEFAULT_DURATION);
  });
  it('blocked storage never throws', () => {
    const real = window.localStorage;
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('blocked');
      },
    });
    try {
      expect(lastDuration()).toBe(DEFAULT_DURATION);
      expect(() => rememberDuration(45)).not.toThrow();
      expect(lastGym()).toBeNull();
    } finally {
      Object.defineProperty(window, 'localStorage', { configurable: true, value: real });
    }
  });
});

describe('the create form in the hash', () => {
  it('round-trips with and without a duration', () => {
    expect(formatDraft({ day: 20737, start: 810, dur: null })).toBe('20737.810');
    expect(formatDraft({ day: 20737, start: 810, dur: 90 })).toBe('20737.810.90');
    expect(parseDraft('20737.810')).toEqual({ day: 20737, start: 810, dur: null });
    expect(parseDraft('20737.810.90')).toEqual({ day: 20737, start: 810, dur: 90 });
  });
  it('ignores junk', () => {
    expect(parseDraft(null)).toBeNull();
    expect(parseDraft('abc')).toBeNull();
    expect(parseDraft('20737.2000')).toBeNull();
    expect(parseDraft('20737.810.5000')).toEqual({ day: 20737, start: 810, dur: null });
  });
});
