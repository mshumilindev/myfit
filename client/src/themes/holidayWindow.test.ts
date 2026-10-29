import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getHolidayTheme,
  getHolidayWindowTheme,
  initTheme,
  setTheme,
  syncHolidayTheme,
  wearHoliday,
} from './registry';

const at = (m: number, d: number, h = 12) => new Date(2026, m - 1, d, h);

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.lang = 'en';
  vi.useFakeTimers({ toFake: ['Date'] });
});
afterEach(() => vi.useRealTimers());

describe('holiday window (owner, 29.10: the holiday theme stays offered while the holiday lasts)', () => {
  it('Halloween is open from 24 to 31 October, not before or after', () => {
    expect(getHolidayWindowTheme(at(10, 23))).toBeNull();
    expect(getHolidayWindowTheme(at(10, 24))).toBe('halloween');
    expect(getHolidayWindowTheme(at(10, 31, 23))).toBe('halloween');
    expect(getHolidayWindowTheme(at(11, 1))).toBeNull();
  });

  it('is open even after the person chose their own theme; wearing is not', () => {
    vi.setSystemTime(at(10, 29));
    initTheme();
    expect(getHolidayTheme()).toBe('halloween');
    setTheme('cyberpunk'); // the person's own pick skips the holiday for this year
    expect(getHolidayTheme()).toBeNull();
    expect(getHolidayWindowTheme()).toBe('halloween');
    expect(document.documentElement.getAttribute('data-theme')).toBe('cyberpunk');
  });

  it('wearHoliday puts the holiday theme back and forgets the skip, so the schedule keeps it on', () => {
    vi.setSystemTime(at(10, 29));
    initTheme();
    setTheme('cyberpunk');
    wearHoliday();
    expect(getHolidayTheme()).toBe('halloween');
    expect(document.documentElement.getAttribute('data-theme')).toBe('halloween');
    expect(syncHolidayTheme()).toBe(false); // nothing left to change: the skip is gone
    expect(localStorage.getItem('gym.theme')).toBe('cyberpunk'); // the saved theme is untouched
  });

  it('wearHoliday does nothing outside a window', () => {
    vi.setSystemTime(at(6, 15));
    initTheme();
    wearHoliday();
    expect(getHolidayTheme()).toBeNull();
  });
});
