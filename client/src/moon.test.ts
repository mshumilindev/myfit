import { describe, it, expect } from 'vitest';
import { moonInfo, illumPct } from './moon';

describe('moon phase', () => {
  it('reads ~new at the reference new moon', () => {
    const m = moonInfo(new Date(Date.UTC(2000, 0, 6, 18, 14)));
    expect(m.illum).toBeLessThan(0.03);
    expect(m.name).toBe('new');
  });
  it('reads ~full about half a synodic month later', () => {
    const m = moonInfo(new Date(Date.UTC(2000, 0, 21, 4, 0)));
    expect(m.illum).toBeGreaterThan(0.9);
    expect(m.name).toBe('full');
    expect(illumPct(m)).toBeGreaterThanOrEqual(90);
  });
  it('mirrors the lit limb in the southern hemisphere', () => {
    const d = new Date(Date.UTC(2000, 0, 11, 0, 0)); // waxing
    expect(moonInfo(d, 50).litOnRight).toBe(true);
    expect(moonInfo(d, -34).litOnRight).toBe(false);
  });

  it('names real 2026 syzygies from illumination, even across midnight', () => {
    // Astronomical new/full moons of 2026 (UTC). Illumination is the truth; the
    // label must agree with the disc drawn even when syzygy is near a day edge.
    const full = ['2026-01-03', '2026-04-02', '2026-09-26', '2026-12-24'];
    const neu = ['2026-01-18', '2026-06-15', '2026-09-11'];
    for (const d of full) {
      const m = moonInfo(new Date(d + 'T21:00:00'));
      expect(illumPct(m), d).toBeGreaterThanOrEqual(97);
      expect(m.name, d).toBe('full');
    }
    for (const d of neu) {
      const m = moonInfo(new Date(d + 'T21:00:00'));
      expect(illumPct(m), d).toBeLessThanOrEqual(3);
      expect(m.name, d).toBe('new');
    }
  });
});
