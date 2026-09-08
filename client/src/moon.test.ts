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
});
