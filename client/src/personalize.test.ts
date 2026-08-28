import { describe, expect, it } from 'vitest';
import { tuneLandmark } from './personalize';
import type { Landmark } from './volume';

const chest: Landmark = { mev: 8, mav: 14, mrv: 22 };
const weeks = (n: number, sets: number) => new Array(n).fill(sets);
const monotonic = (l: { mev: number; mav: number; mrv: number }) =>
  l.mev <= l.mav && l.mav <= l.mrv;

describe('tuneLandmark', () => {
  it('stays on the default until there are enough weeks of data', () => {
    const l = tuneLandmark(chest, weeks(5, 20), false);
    expect(l.source).toBe('default');
    expect(l.mrv).toBe(chest.mrv);
    expect(l.confidence).toBe(0);
  });

  it('raises the ceiling for a tolerant athlete (sustained high volume, no stall)', () => {
    const l = tuneLandmark(chest, weeks(10, 22), false);
    expect(l.source).toBe('tuned');
    expect(l.mrv).toBeGreaterThan(chest.mrv);
    expect(monotonic(l)).toBe(true);
  });

  it('lowers the ceiling when big volume comes with a stall', () => {
    const l = tuneLandmark(chest, weeks(10, 20), true);
    expect(l.source).toBe('tuned');
    expect(l.mrv).toBeLessThan(chest.mrv);
    expect(monotonic(l)).toBe(true);
  });

  it('makes no move without a clear signal (low volume, no stall)', () => {
    const l = tuneLandmark(chest, weeks(8, 6), false);
    expect(l.source).toBe('default');
    expect(l.mrv).toBe(chest.mrv);
  });

  it('never runs away from the default — bounded to ±35%', () => {
    const high = tuneLandmark(chest, weeks(12, 40), false);
    expect(high.mrv).toBeLessThanOrEqual(Math.round(chest.mrv * 1.35));
    const low = tuneLandmark(chest, weeks(12, 24), true);
    expect(low.mrv).toBeGreaterThanOrEqual(Math.round(chest.mrv * 0.7));
    expect(monotonic(high)).toBe(true);
  });

  it('keeps the floor (MEV) moving less than the ceiling (MRV)', () => {
    const l = tuneLandmark(chest, weeks(12, 24), false);
    const mrvShift = (l.mrv - chest.mrv) / chest.mrv;
    const mevShift = (l.mev - chest.mev) / chest.mev;
    expect(Math.abs(mevShift)).toBeLessThanOrEqual(Math.abs(mrvShift) + 1e-9);
  });
});
