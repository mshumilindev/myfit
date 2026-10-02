/**
 * Supplements in the combined calculations (calcMods.ts): late caffeine adds to the SLEEP NEED
 * only. (1) Off (master, the sleep switch, nothing saved) = exactly neutral; (2) on = within the
 * caps (the supplements' own part at most 45 min, the combined sleep need at most 60 min);
 * (3) it stacks with nicotine and alcohol; (4) readiness, deload and progression never move
 * because of a supplement.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { __getStateForTests, __replaceStateForTests } from './store';
import {
  SLEEP_NEED_MAX_EXTRA_MIN,
  SUPPLEMENT_SLEEP_MAX_EXTRA_MIN,
  deloadMult,
  progressionMult,
  readinessMult,
  sleepNeedExtraMin,
} from './calcMods';
import { defaultSupplementSettings, emptySupplementState, newSupplementEntry } from './supplements';
import {
  ALCOHOL_SURFACES,
  defaultAlcoholSettings,
  emptyAlcoholState,
  newAlcoholEntry,
} from './alcohol';
import {
  NICOTINE_SURFACES,
  defaultNicotineSettings,
  emptyNicotineState,
  newNicotineProduct,
} from './nicotine';
import type { SupplementEntry, SupplementId } from './types';

const SAT_NOON = new Date(2026, 9, 3, 12).getTime();
const SAT_EARLY = new Date(2026, 9, 3, 7).getTime(); // the night ENDING here reads Friday
const T0 = new Date(2026, 8, 1, 10).getTime();
const ent = (id: SupplementId, over: Partial<SupplementEntry> = {}): SupplementEntry => ({
  ...newSupplementEntry(id, `e-${id}-${Object.keys(over).length}`, T0),
  ...over,
});
const lateCaffeine = (dose = 400) =>
  ent('caffeine', { timing: 'evening', schedule: 'daily', dose });

function setSup(entries: SupplementEntry[], master = true, sleepSwitch = true): void {
  const settings = defaultSupplementSettings();
  settings.useInCalculations = master;
  settings.surfaces.sleep = sleepSwitch;
  __replaceStateForTests({
    ...__getStateForTests(),
    supplements: { entries, checkins: {}, settings, updatedAt: 1 },
  });
}
function setNic(cig: number): void {
  const settings = defaultNicotineSettings();
  settings.useInCalculations = cig > 0;
  for (const s of NICOTINE_SURFACES) settings.surfaces[s] = true;
  __replaceStateForTests({
    ...__getStateForTests(),
    nicotine: {
      products: cig > 0 ? [{ ...newNicotineProduct('cigarettes', 'c'), amount: cig }] : [],
      settings,
      updatedAt: 1,
    },
  });
}
function setAlc(servings: number): void {
  const settings = defaultAlcoholSettings();
  settings.useInCalculations = servings > 0;
  for (const s of ALCOHOL_SURFACES) settings.surfaces[s] = true;
  __replaceStateForTests({
    ...__getStateForTests(),
    alcohol: {
      entries:
        servings > 0
          ? [{ ...newAlcoholEntry('beerRegular', 'b', 500), servingsPerWeek: servings }]
          : [],
      checkins: {},
      settings,
      updatedAt: 1,
    },
  });
}

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* no storage */
  }
  setSup([]);
  setNic(0);
  setAlc(0);
});
afterEach(() => {
  __replaceStateForTests({
    ...__getStateForTests(),
    supplements: emptySupplementState(),
    nicotine: emptyNicotineState(),
    alcohol: emptyAlcoholState(),
  });
});

describe('documented caps', () => {
  it('the combined sleep-need cap is 60 min, the supplements part 45 min', () => {
    expect(SLEEP_NEED_MAX_EXTRA_MIN).toBe(60);
    expect(SUPPLEMENT_SLEEP_MAX_EXTRA_MIN).toBe(45);
  });
});

describe('supplements off = no change', () => {
  it('nothing saved, the master off, or the sleep switch off: exactly neutral', () => {
    expect(sleepNeedExtraMin(SAT_NOON)).toBe(0);
    setSup([lateCaffeine()], false);
    expect(sleepNeedExtraMin(SAT_NOON)).toBe(0);
    setSup([lateCaffeine()], true, false);
    expect(sleepNeedExtraMin(SAT_NOON)).toBe(0);
  });

  it('items with no modelled effect (and non-late caffeine) add nothing', () => {
    setSup([ent('vitaminD'), ent('melatonin'), ent('creatine'), ent('whey')]);
    expect(sleepNeedExtraMin(SAT_NOON)).toBe(0);
    // A morning dose of caffeine is not "late".
    setSup([ent('caffeine', { timing: 'morning', schedule: 'daily', dose: 400 })]);
    expect(sleepNeedExtraMin(SAT_NOON)).toBe(0);
  });
});

describe('supplements on = within the caps', () => {
  it('late caffeine adds the midpoint of 0..45 min at the full dose', () => {
    setSup([lateCaffeine(400)]);
    expect(sleepNeedExtraMin(SAT_NOON)).toBe(22.5);
    // A smaller dose adds less.
    setSup([lateCaffeine(200)]);
    expect(sleepNeedExtraMin(SAT_NOON)).toBe(11.25);
  });

  it('a morning moment reads the evening before (the night ends there)', () => {
    setSup([lateCaffeine(400)]);
    expect(sleepNeedExtraMin(SAT_EARLY)).toBe(22.5);
  });

  it('a huge dose or several entries never pass the supplements part (45 min)', () => {
    setSup([
      lateCaffeine(800),
      ent('preWorkout', { timing: 'evening', schedule: 'daily', dose: 3 }),
    ]);
    expect(sleepNeedExtraMin(SAT_NOON)).toBeLessThanOrEqual(SUPPLEMENT_SLEEP_MAX_EXTRA_MIN);
    expect(sleepNeedExtraMin(SAT_NOON)).toBeGreaterThan(0);
  });

  it('a "None" check-in for the day takes it away', () => {
    setSup([lateCaffeine(400)]);
    const s = __getStateForTests();
    __replaceStateForTests({
      ...s,
      supplements: { ...s.supplements, checkins: { '2026-10-03': { taken: false } } },
    });
    expect(sleepNeedExtraMin(SAT_NOON)).toBe(0);
  });
});

describe('stacking with nicotine and alcohol', () => {
  it('adds up while below the combined cap', () => {
    setSup([lateCaffeine(400)]);
    const supOnly = sleepNeedExtraMin(SAT_NOON);
    setNic(10);
    const withNic = sleepNeedExtraMin(SAT_NOON);
    expect(withNic).toBeGreaterThan(supOnly);
    setSup([]);
    const nicOnly = sleepNeedExtraMin(SAT_NOON);
    expect(withNic).toBeCloseTo(nicOnly + supOnly, 4);
  });

  it('the three together never pass 60 min, even with huge amounts', () => {
    setNic(500);
    setAlc(400);
    setSup([lateCaffeine(800)]);
    const all = sleepNeedExtraMin(SAT_NOON);
    expect(all).toBeLessThanOrEqual(SLEEP_NEED_MAX_EXTRA_MIN);
    setSup([]);
    expect(all).toBeGreaterThanOrEqual(sleepNeedExtraMin(SAT_NOON));
  });
});

describe('supplements never touch the other engines', () => {
  it('readiness, deload and progression stay exactly neutral', () => {
    setSup([
      lateCaffeine(400),
      ent('creatine'),
      ent('whey'),
      ent('preWorkout', { schedule: 'daily' }),
    ]);
    expect(readinessMult(SAT_NOON)).toBe(1);
    expect(deloadMult()).toBe(1);
    expect(progressionMult()).toBe(1);
  });
});
