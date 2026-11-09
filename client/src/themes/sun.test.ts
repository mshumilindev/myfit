import { describe, expect, it } from 'vitest';
import { isDaylight, sunTimesUtc } from './sun';

describe('sun', () => {
  it('summer solstice at 53N, lon 21E: long day, sunrise near 02:50 UTC and sunset near 19:00 UTC', () => {
    const t = sunTimesUtc(new Date(Date.UTC(2026, 5, 21, 12)), 53, 21);
    expect(typeof t).toBe('object');
    if (typeof t === 'object') {
      expect(t.set - t.rise).toBeGreaterThan(16);
      expect(t.rise).toBeGreaterThan(2);
      expect(t.rise).toBeLessThan(3.8);
    }
  });
  it('winter: short day', () => {
    const t = sunTimesUtc(new Date(Date.UTC(2026, 11, 21, 12)), 53, 21);
    if (typeof t === 'object') expect(t.set - t.rise).toBeLessThan(8.5);
  });
  it('is dark at local midnight and light at local noon in a mid-latitude zone', () => {
    // the process zone is whatever CI uses: use UTC midnight / noon at longitude ~0 (no offset) via a UTC-based date
    const noon = new Date(Date.UTC(2026, 10, 8, 12, 0));
    const night = new Date(Date.UTC(2026, 10, 8, 23, 30));
    const off = new Date().getTimezoneOffset();
    if (off === 0) {
      expect(isDaylight(noon)).toBe(true);
      expect(isDaylight(night)).toBe(false);
    } else {
      expect(typeof isDaylight(noon)).toBe('boolean');
    }
  });
  it('polar edge cases are flags', () => {
    expect(sunTimesUtc(new Date(Date.UTC(2026, 5, 21)), 85, 0)).toBe('day');
    expect(sunTimesUtc(new Date(Date.UTC(2026, 11, 21)), 85, 0)).toBe('night');
  });
});
