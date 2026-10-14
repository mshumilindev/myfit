import { describe, expect, it } from 'vitest';
import { relativeTo, relativeWhen } from './relative';
import { tsOf } from './time';

const words = { inProgress: 'In progress' };
const D = 20_000; // some day key
const at = (day: number, h: number, m = 0) => tsOf(day, h * 60 + m, 'UTC');
const now = at(D, 12, 0);

describe('relativeWhen', () => {
  it('minutes, then hours, on the same day', () => {
    expect(relativeWhen(at(D, 12, 30), at(D, 13, 30), now, 'en', words)).toBe('in 30 minutes');
    expect(relativeWhen(at(D, 14, 0), at(D, 15, 0), now, 'en', words)).toBe('in 2 hours');
    expect(relativeWhen(at(D, 9, 0), at(D, 10, 0), now, 'en', words)).toBe('3 hours ago');
    expect(relativeWhen(at(D, 11, 50), at(D, 11, 55), now, 'en', words)).toBe('10 minutes ago');
  });
  it('calendar days otherwise: tomorrow, yesterday, in 3 days', () => {
    expect(relativeWhen(at(D + 1, 8), at(D + 1, 9), now, 'en', words)).toBe('tomorrow');
    expect(relativeWhen(at(D - 1, 18), at(D - 1, 19), now, 'en', words)).toBe('yesterday');
    expect(relativeWhen(at(D + 3, 8), at(D + 3, 9), now, 'en', words)).toBe('in 3 days');
  });
  it('tomorrow is the next calendar day even a few minutes before midnight', () => {
    const late = at(D, 23, 55);
    expect(relativeWhen(at(D + 1, 0, 10), at(D + 1, 1, 10), late, 'en', words)).toBe('tomorrow');
  });
  it('a running session says so', () => {
    expect(relativeWhen(at(D, 11, 30), at(D, 12, 30), now, 'en', words)).toBe('In progress');
  });
  it('speaks the active locale', () => {
    expect(relativeWhen(at(D + 1, 8), at(D + 1, 9), now, 'uk', words)).toMatch(/завтра/i);
    expect(relativeWhen(at(D - 1, 8), at(D - 1, 9), now, 'pl', words)).toMatch(/wczoraj/i);
  });
});

describe('relativeTo (expiry)', () => {
  it('has no in-progress state', () => {
    expect(relativeTo(at(D + 2, 12), now, 'en')).toBe('in 2 days');
    expect(relativeTo(at(D, 12, 0), now, 'en')).toBe('this minute');
  });
});
