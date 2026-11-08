/**
 * SPO-500 I7b: the lifestyle models do not run or show without their add-on (the data stays stored). Formulas are not
 * touched: this only proves the contract "add-on missing = exactly neutral, add-on installed = the model moves".
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { __getStateForTests, __replaceStateForTests } from '../store';
import { addonsPref } from './enabledSet';
import { HEALTH_ADDONS } from './testSetup';
import {
  ALCOHOL_SURFACES,
  defaultAlcoholSettings,
  emptyAlcoholState,
  newAlcoholEntry,
} from '../alcohol';
import {
  NICOTINE_SURFACES,
  defaultNicotineSettings,
  emptyNicotineState,
  newNicotineProduct,
} from '../nicotine';
import { deloadMult, progressionMult, readinessMult, sleepNeedExtraMin } from '../calcMods';
import { nicRpeShift } from '../nicotineApply';
import { computeReadiness } from '../recovery';

const SAT_NOON = new Date(2026, 9, 3, 12).getTime();

function seed(): void {
  const a = defaultAlcoholSettings();
  a.useInCalculations = true;
  for (const s of ALCOHOL_SURFACES) a.surfaces[s] = true;
  const n = defaultNicotineSettings();
  n.useInCalculations = true;
  for (const s of NICOTINE_SURFACES) n.surfaces[s] = true;
  __replaceStateForTests({
    ...__getStateForTests(),
    alcohol: {
      entries: [{ ...newAlcoholEntry('beerRegular', 'b', 500), servingsPerWeek: 8 }],
      checkins: {},
      settings: a,
      updatedAt: 1,
    },
    nicotine: {
      products: [{ ...newNicotineProduct('cigarettes', 'c'), amount: 30 }],
      settings: n,
      updatedAt: 1,
    },
  });
}

beforeEach(() => {
  addonsPref.set([...HEALTH_ADDONS]);
  seed();
});
afterEach(() => {
  __replaceStateForTests({
    ...__getStateForTests(),
    alcohol: emptyAlcoholState(),
    nicotine: emptyNicotineState(),
  });
  addonsPref.set([...HEALTH_ADDONS]);
});

describe('nicotine and alcohol models follow their add-ons', () => {
  it('installed: the combined values move', () => {
    expect(readinessMult(SAT_NOON)).toBeLessThan(1);
    expect(sleepNeedExtraMin(SAT_NOON)).toBeGreaterThan(0);
    expect(deloadMult()).not.toBe(1);
    expect(progressionMult()).not.toBe(1);
  });

  it('neither installed: every value is exactly neutral, the data is still stored', () => {
    addonsPref.set(HEALTH_ADDONS.filter((id) => id !== 'nicotine' && id !== 'alcohol'));
    expect(readinessMult(SAT_NOON)).toBe(1);
    expect(sleepNeedExtraMin(SAT_NOON)).toBe(0);
    expect(deloadMult()).toBe(1);
    expect(progressionMult()).toBe(1);
    expect(nicRpeShift()).toBe(0);
    expect(__getStateForTests().nicotine.products).toHaveLength(1);
    expect(__getStateForTests().alcohol.entries).toHaveLength(1);
  });

  it('only alcohol installed: nicotine contributes nothing', () => {
    addonsPref.set(HEALTH_ADDONS.filter((id) => id !== 'nicotine'));
    expect(nicRpeShift()).toBe(0);
    expect(readinessMult(SAT_NOON)).toBeLessThan(1);
  });

  it('the recovery engine gives the plain number without the add-ons', () => {
    const withAddons = computeReadiness(1.5, 7, 3, 14, 0, SAT_NOON);
    addonsPref.set(HEALTH_ADDONS.filter((id) => id !== 'nicotine' && id !== 'alcohol'));
    const without = computeReadiness(1.5, 7, 3, 14, 0, SAT_NOON);
    expect(without.readiness).toBeCloseTo(0.5, 6);
    expect(without.recoveryDays).toBeCloseTo(3, 6);
    expect(withAddons.readiness).toBeLessThan(without.readiness);
  });
});
