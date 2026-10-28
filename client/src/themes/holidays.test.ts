import { describe, expect, it } from 'vitest';
import {
  LEAD_DAYS,
  activeHoliday,
  addDays,
  daysBetween,
  dayOf,
  msToNextDay,
  orthodoxEaster,
  skipKey,
  westernEaster,
  type DayDate,
} from './holidays';

const D = (y: number, m: number, d: number): DayDate => ({ y, m, d });

describe('Easter', () => {
  it('Western dates match the published calendar', () => {
    expect(westernEaster(2025)).toEqual(D(2025, 4, 20));
    expect(westernEaster(2026)).toEqual(D(2026, 4, 5));
    expect(westernEaster(2027)).toEqual(D(2027, 3, 28));
    expect(westernEaster(2028)).toEqual(D(2028, 4, 16));
  });
  it('Orthodox dates match the published calendar', () => {
    expect(orthodoxEaster(2025)).toEqual(D(2025, 4, 20));
    expect(orthodoxEaster(2026)).toEqual(D(2026, 4, 12));
    expect(orthodoxEaster(2027)).toEqual(D(2027, 5, 2));
    expect(orthodoxEaster(2028)).toEqual(D(2028, 4, 16));
  });
});

describe('day arithmetic', () => {
  it('adds and counts days across month and year ends', () => {
    expect(addDays(D(2026, 12, 31), 1)).toEqual(D(2027, 1, 1));
    expect(addDays(D(2026, 3, 1), -1)).toEqual(D(2026, 2, 28));
    expect(daysBetween(D(2026, 10, 24), D(2026, 10, 31))).toBe(7);
    expect(daysBetween(D(2026, 10, 31), D(2026, 10, 24))).toBe(-7);
  });
  it('reads the device-local calendar day', () => {
    expect(dayOf(new Date(2026, 9, 31, 23, 59))).toEqual(D(2026, 10, 31));
  });
});

describe('the window: a week before through the holiday, off the day after', () => {
  it('Halloween: 24 Oct … 31 Oct on, 23 Oct and 1 Nov off', () => {
    expect(LEAD_DAYS).toBe(7);
    expect(activeHoliday(D(2026, 10, 23), 'en')).toBeNull();
    expect(activeHoliday(D(2026, 10, 24), 'en')?.id).toBe('halloween');
    expect(activeHoliday(D(2026, 10, 31), 'en')?.id).toBe('halloween');
    expect(activeHoliday(D(2026, 11, 1), 'en')).toBeNull();
  });
  it('reports the window and the skip key', () => {
    const w = activeHoliday(D(2026, 10, 28), 'en');
    expect(w).toEqual({
      id: 'halloween',
      day: D(2026, 10, 31),
      from: D(2026, 10, 24),
      to: D(2026, 10, 31),
    });
    expect(skipKey(w!)).toBe('halloween:2026');
  });
  it('Valentine and Christmas', () => {
    expect(activeHoliday(D(2027, 2, 7), 'en')?.id).toBe('valentine');
    expect(activeHoliday(D(2027, 2, 15), 'en')).toBeNull();
    expect(activeHoliday(D(2026, 12, 18), 'pl')?.id).toBe('christmas');
    // Christmas runs through 1 January (owner, 28.10), off on the 2nd
    expect(activeHoliday(D(2026, 12, 17), 'pl')).toBeNull();
    expect(activeHoliday(D(2026, 12, 26), 'pl')?.id).toBe('christmas');
    expect(activeHoliday(D(2027, 1, 1), 'pl')?.id).toBe('christmas');
    expect(activeHoliday(D(2027, 1, 2), 'pl')).toBeNull();
    const w = activeHoliday(D(2027, 1, 1), 'en')!;
    expect(w.to).toEqual(D(2027, 1, 1));
    expect(skipKey(w)).toBe('christmas:2026');
  });
  it("St Patrick's Day: 17 March, on a week before", () => {
    expect(activeHoliday(D(2027, 3, 9), 'en')).toBeNull();
    expect(activeHoliday(D(2027, 3, 10), 'en')?.id).toBe('stpatrick');
    expect(activeHoliday(D(2027, 3, 17), 'en')?.id).toBe('stpatrick');
    expect(activeHoliday(D(2027, 3, 18), 'en')).toBeNull();
  });
  it('Easter is computed for every year, never a fixed date (Western and Orthodox)', () => {
    const w = (y: number) => westernEaster(y);
    const o = (y: number) => orthodoxEaster(y);
    // known dates: 2024 31 Mar / 5 May, 2025 20 Apr / 20 Apr, 2026 5 Apr / 12 Apr, 2027 28 Mar / 2 May, 2028 16 Apr / 16 Apr
    expect([w(2024), o(2024)]).toEqual([D(2024, 3, 31), D(2024, 5, 5)]);
    expect([w(2025), o(2025)]).toEqual([D(2025, 4, 20), D(2025, 4, 20)]);
    expect([w(2026), o(2026)]).toEqual([D(2026, 4, 5), D(2026, 4, 12)]);
    expect([w(2027), o(2027)]).toEqual([D(2027, 3, 28), D(2027, 5, 2)]);
    expect([w(2028), o(2028)]).toEqual([D(2028, 4, 16), D(2028, 4, 16)]);
    // it moves: the window follows it
    expect(activeHoliday(D(2027, 3, 24), 'en')?.id).toBe('easter');
    expect(activeHoliday(D(2027, 4, 26), 'uk')?.id).toBe('easter');
  });
  it('Easter follows the language: Western by default, Orthodox for uk', () => {
    // 2026: Western 5 Apr, Orthodox 12 Apr
    expect(activeHoliday(D(2026, 3, 29), 'en')?.id).toBe('easter');
    expect(activeHoliday(D(2026, 3, 29), 'uk')).toBeNull();
    expect(activeHoliday(D(2026, 4, 6), 'en')).toBeNull();
    expect(activeHoliday(D(2026, 4, 6), 'uk')?.id).toBe('easter');
    expect(activeHoliday(D(2026, 4, 13), 'uk')).toBeNull();
    expect(activeHoliday(D(2026, 4, 4), 'uk-UA')).toBeNull();
    expect(activeHoliday(D(2026, 4, 5), 'uk-UA')?.id).toBe('easter');
  });
  it('a paused holiday never comes on', () => {
    expect(activeHoliday(D(2026, 8, 20), 'uk')).toBeNull();
    expect(activeHoliday(D(2026, 8, 24), 'uk')).toBeNull();
  });
  it('only holidays that have a theme count', () => {
    expect(activeHoliday(D(2026, 10, 28), 'en', (id) => id !== 'halloween')).toBeNull();
    expect(activeHoliday(D(2026, 10, 28), 'en', (id) => id === 'halloween')?.id).toBe('halloween');
  });
});

describe('next read of the schedule', () => {
  it('is the next local midnight', () => {
    const ms = msToNextDay(new Date(2026, 9, 28, 23, 0, 0));
    expect(ms).toBeGreaterThan(3_599_000);
    expect(ms).toBeLessThanOrEqual(3_601_000);
  });
});
