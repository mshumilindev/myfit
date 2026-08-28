import { describe, expect, it } from 'vitest';
import { computeReadiness } from './recovery';

describe('computeReadiness', () => {
  it('reads 0 right after a normal session, then climbs to ready over the window', () => {
    const mav = 14; // quads-ish; base 3, dose = half MAV → factor 1 → effDays 3
    const fresh = computeReadiness(0, 7, 3, mav);
    expect(fresh.readiness).toBe(0);
    expect(fresh.state).toBe('recovering');
    const mid = computeReadiness(1.5, 7, 3, mav);
    expect(mid.readiness).toBeCloseTo(0.5, 2);
    expect(mid.state).toBe('nearly');
    const done = computeReadiness(3, 7, 3, mav);
    expect(done.readiness).toBe(1);
    expect(done.state).toBe('ready');
  });

  it('a bigger dose stretches the window, a lighter one shortens it', () => {
    const big = computeReadiness(3, 20, 3, 14); // heavy session
    const light = computeReadiness(3, 3, 3, 14); // easy session
    expect(big.recoveryDays).toBeGreaterThan(light.recoveryDays);
    expect(light.readiness).toBe(1); // recovered by day 3
    expect(big.readiness).toBeLessThan(1); // still cooking
  });

  it('small muscles recover faster (shorter base)', () => {
    const biceps = computeReadiness(2, 6, 2, 12); // base 2 → ready at day 2
    const quads = computeReadiness(2, 7, 3, 14); // base 3 → not yet
    expect(biceps.readiness).toBe(1);
    expect(quads.readiness).toBeLessThan(1);
  });

  it('long past the window and understimulated reads stale', () => {
    const stale = computeReadiness(9, 7, 3, 14); // effDays 3, 9 > 3*2.2
    expect(stale.state).toBe('stale');
  });

  it('never trained in the window is stale and fully ready', () => {
    const r = computeReadiness(null, 0, 3, 14);
    expect(r.readiness).toBe(1);
    expect(r.state).toBe('stale');
  });

  it('a recovery boost lifts readiness', () => {
    const base = computeReadiness(1, 7, 3, 14);
    const boosted = computeReadiness(1, 7, 3, 14, 1);
    expect(boosted.readiness).toBeGreaterThan(base.readiness);
  });
});
