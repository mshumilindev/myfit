import { afterEach, describe, expect, it } from 'vitest';
import { coachClock, coachDate, coachEyebrow, coachMoment, setCoachTimeZone } from './format';

const T = Date.UTC(2026, 9, 9, 18, 0); // Fri 9 Oct 18:00 UTC

afterEach(() => setCoachTimeZone('UTC'));

describe('coach/format', () => {
  it('English is lab style, 24h, day-month', () => {
    expect(coachDate(T, 'en')).toBe('Fri 9 Oct');
    expect(coachMoment(T, 'en')).toBe('Fri 9 Oct, 18:00');
    expect(coachEyebrow(T, 'en')).toBe('FRI 9 OCT');
  });
  it('uses the world time zone, not the browser one', () => {
    setCoachTimeZone('Europe/Kyiv');
    expect(coachClock(T)).toBe('21:00');
    setCoachTimeZone('Not/AZone');
    expect(coachClock(T)).toBe('18:00');
  });
  it('other locales stay 24h', () => {
    for (const l of ['uk', 'pl', 'lt', 'et'] as const) expect(coachMoment(T, l)).toMatch(/18:00$/);
  });
});
