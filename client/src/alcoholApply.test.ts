/**
 * Alcohol applied quietly (placeholder coefficients; see alcohol.ts). Per number: (1) off =
 * nothing changes, (2) on = it changes within the cap, (3) that surface off = neutral, and
 * (4) with "usually drink on", readiness and sleep need only move the day after.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { __getStateForTests, __replaceStateForTests } from './store';
import {
  ALCOHOL_EFFECT_KEYS,
  ALCOHOL_SURFACES,
  NEUTRAL,
  SURFACE_COEFFS,
  defaultAlcoholSettings,
  emptyAlcoholState,
  newAlcoholEntry,
} from './alcohol';
import { alcMid } from './alcoholApply';
import type { AlcoholSurface } from './types';

function setAlc(
  servings: number,
  opts: { master?: boolean; off?: AlcoholSurface[]; usualDays?: number[] } = {},
): void {
  const settings = defaultAlcoholSettings();
  settings.useInCalculations = opts.master ?? true;
  // Placeholder numbers are experimental (off by default); these tests switch every surface on.
  for (const s of ALCOHOL_SURFACES) settings.surfaces[s] = true;
  for (const s of opts.off ?? []) settings.surfaces[s] = false;
  settings.usualDays = opts.usualDays ?? [];
  const entries =
    servings > 0
      ? [{ ...newAlcoholEntry('beerRegular', 'b', 500), servingsPerWeek: servings }]
      : [];
  __replaceStateForTests({
    ...__getStateForTests(),
    alcohol: { entries, checkins: {}, settings, updatedAt: 1 },
  });
}

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* no storage */
  }
  setAlc(0);
});
afterEach(() => {
  __replaceStateForTests({ ...__getStateForTests(), alcohol: emptyAlcoholState() });
});

describe('alcMid', () => {
  it('is neutral for every key with no drinks, master off, or the surface off', () => {
    for (const k of ALCOHOL_EFFECT_KEYS) {
      const n = NEUTRAL[SURFACE_COEFFS[k].mode];
      setAlc(0);
      expect(alcMid(k)).toBe(n);
      setAlc(10, { master: false });
      expect(alcMid(k)).toBe(n);
      setAlc(10, { off: [SURFACE_COEFFS[k].surface] });
      expect(alcMid(k)).toBe(n);
      expect(alcMid(k, '2026-10-03')).toBe(n);
    }
  });

  it('moves in the right direction and stays within the cap when on', () => {
    setAlc(30);
    for (const k of ALCOHOL_EFFECT_KEYS) {
      const c = SURFACE_COEFFS[k];
      const v = alcMid(k);
      expect(v, k).not.toBe(NEUTRAL[c.mode]);
      expect(Math.sign(v - NEUTRAL[c.mode]), k).toBe(c.sign);
      expect(Math.abs(v - NEUTRAL[c.mode]), k).toBeLessThanOrEqual(c.cap);
    }
  });

  it('a bigger week moves it further (before saturation)', () => {
    setAlc(2);
    const small = alcMid('readiness');
    setAlc(8);
    expect(alcMid('readiness')).toBeLessThan(small);
  });

  it('with "usually drink on", readiness and sleep move only the day after; the rest stay flat', () => {
    setAlc(6, { usualDays: [4] }); // Friday
    expect(alcMid('readiness', '2026-10-02')).toBe(1); // Friday itself
    expect(alcMid('readiness', '2026-10-03')).toBeLessThan(1); // Saturday
    expect(alcMid('sleepMin', '2026-10-02')).toBe(0);
    expect(alcMid('sleepMin', '2026-10-03')).toBeGreaterThan(0);
    expect(alcMid('deloadThreshold', '2026-10-02')).toBe(alcMid('deloadThreshold', '2026-10-03'));
    expect(alcMid('deloadThreshold')).toBeLessThan(1);
    // No day given: the flat weekly smoothing.
    expect(alcMid('readiness')).toBeLessThan(1);
  });
});
