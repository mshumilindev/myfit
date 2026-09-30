import { describe, expect, it } from 'vitest';
import { carryOverSets, computeReadiness } from './recovery';
import type { Workout } from './types';

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

describe('carryOverSets', () => {
  const DAYMS = 24 * 3600 * 1000;
  const at = Date.UTC(2026, 8, 30, 12);
  const bench = (startedAt: number, n: number) =>
    ({
      id: `w${startedAt}`,
      startedAt,
      finishedAt: startedAt + 3600_000,
      exercises: [
        {
          id: 'e',
          name: 'Barbell Bench Press - Medium Grip',
          position: 0,
          kind: 'strength',
          sets: Array.from({ length: n }, (_, i) => ({
            id: `s${i}`,
            position: i,
            reps: 8,
            weight: 80,
            type: 'working',
          })),
        },
      ],
    }) as unknown as Workout;

  it('yesterday leaves a head start on the meter, and it fades with time', () => {
    const yesterday = carryOverSets([bench(at - 1 * DAYMS, 10)], at).get('chest') ?? 0;
    const twoDays = carryOverSets([bench(at - 2 * DAYMS, 10)], at).get('chest') ?? 0;
    expect(yesterday).toBeGreaterThan(1);
    expect(twoDays).toBeLessThan(yesterday);
    expect(carryOverSets([bench(at - 9 * DAYMS, 10)], at).get('chest') ?? 0).toBe(0);
  });

  it('ignores sessions that start at or after the reference time', () => {
    expect(carryOverSets([bench(at + DAYMS, 10)], at).size).toBe(0);
  });
});
