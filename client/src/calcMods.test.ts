/**
 * Nicotine and alcohol stacked (calcMods.ts) and fed to the engines: (1) both off = exactly
 * neutral, nothing changes; (2) alcohol on = the engines move, within the caps; (3) alcohol
 * is day-aware: with "usually drink on" the readiness and sleep numbers move only on the day
 * after a drinking day, or after a check-in; (4) both together stack without passing the
 * combined caps (readiness -15 %, sleep need +45 min).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { __getStateForTests, __replaceStateForTests } from './store';
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
import {
  READINESS_MIN_MULT,
  SLEEP_NEED_MAX_EXTRA_MIN,
  deloadMult,
  progressionMult,
  readinessMult,
  sleepNeedExtraMin,
} from './calcMods';
import { computeReadiness } from './recovery';
import { muscleFatigue } from './fatigue';
import { sleepReadinessBias } from './sleep';
import { nextTarget } from './progression';
import type { AlcoholCheckin, SleepNight, Workout } from './types';

const DAY = 24 * 3600 * 1000;
const FRI_NOON = new Date(2026, 9, 2, 12).getTime(); // Friday 2 Oct 2026
const SAT_NOON = FRI_NOON + DAY;
const SUN_NOON = SAT_NOON + DAY;

function setAlc(
  servings: number,
  opts: { usualDays?: number[]; checkins?: Record<string, AlcoholCheckin> } = {},
): void {
  const settings = defaultAlcoholSettings();
  settings.useInCalculations = servings > 0;
  for (const s of ALCOHOL_SURFACES) settings.surfaces[s] = true;
  settings.usualDays = opts.usualDays ?? [];
  const entries =
    servings > 0
      ? [{ ...newAlcoholEntry('beerRegular', 'b', 500), servingsPerWeek: servings }]
      : [];
  __replaceStateForTests({
    ...__getStateForTests(),
    alcohol: { entries, checkins: opts.checkins ?? {}, settings, updatedAt: 1 },
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

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* no storage */
  }
  setAlc(0);
  setNic(0);
});
afterEach(() => {
  __replaceStateForTests({
    ...__getStateForTests(),
    alcohol: emptyAlcoholState(),
    nicotine: emptyNicotineState(),
  });
});

describe('both off', () => {
  it('every combined value is exactly neutral', () => {
    expect(readinessMult(SAT_NOON)).toBe(1);
    expect(sleepNeedExtraMin(SAT_NOON)).toBe(0);
    expect(deloadMult()).toBe(1);
    expect(progressionMult()).toBe(1);
  });

  it('the engines give the same numbers as without the feature', () => {
    const r = computeReadiness(1.5, 7, 3, 14, 0, SAT_NOON);
    expect(r.readiness).toBeCloseTo(0.5, 6);
    expect(r.recoveryDays).toBeCloseTo(3, 6);
    expect(computeReadiness(1.5, 7, 3, 14).readiness).toBeCloseTo(0.5, 6);
  });
});

describe('alcohol on: day-aware', () => {
  it('flat weekly smoothing without usual days: the same every day, within the cap', () => {
    setAlc(8);
    const a = readinessMult(FRI_NOON);
    expect(a).toBeLessThan(1);
    expect(a).toBeGreaterThanOrEqual(0.9);
    expect(readinessMult(SUN_NOON)).toBe(a);
    expect(sleepNeedExtraMin(SAT_NOON)).toBeGreaterThan(0);
    expect(sleepNeedExtraMin(SAT_NOON)).toBeLessThanOrEqual(30);
  });

  it('with usual days: readiness and sleep need move only the day after (Friday usual)', () => {
    setAlc(6, { usualDays: [4] });
    expect(readinessMult(FRI_NOON)).toBe(1);
    expect(readinessMult(SAT_NOON)).toBeLessThan(1);
    expect(readinessMult(SUN_NOON)).toBe(1);
    expect(sleepNeedExtraMin(FRI_NOON)).toBe(0);
    expect(sleepNeedExtraMin(SAT_NOON)).toBeGreaterThan(0);
    expect(sleepNeedExtraMin(SUN_NOON)).toBe(0);
    // The engine sees the same day: Saturday recovers slower than Friday / Sunday.
    const fri = computeReadiness(1.5, 7, 3, 14, 0, FRI_NOON);
    const sat = computeReadiness(1.5, 7, 3, 14, 0, SAT_NOON);
    const sun = computeReadiness(1.5, 7, 3, 14, 0, SUN_NOON);
    expect(sat.readiness).toBeLessThan(fri.readiness);
    expect(sat.recoveryDays).toBeGreaterThan(fri.recoveryDays);
    expect(sun.readiness).toBe(fri.readiness);
  });

  it('a check-in wins over the usual assumption', () => {
    setAlc(6, { usualDays: [4], checkins: { '2026-10-02': { drank: false } as AlcoholCheckin } });
    expect(readinessMult(SAT_NOON)).toBe(1);
    setAlc(6, {
      usualDays: [4],
      checkins: { '2026-10-03': { drank: true, grams: 60 } as AlcoholCheckin },
    });
    expect(readinessMult(SUN_NOON)).toBeLessThan(1);
    expect(readinessMult(SAT_NOON)).toBeLessThan(1); // Friday still assumed (usual)
  });

  it('the same night counts for less on the day after drinking', () => {
    const bed = SAT_NOON - 12 * 3600_000;
    const night = {
      id: 'n',
      date: '2026-10-03',
      bedtime: bed,
      wake: bed + 480 * 60_000,
      source: 'backfill',
    } as SleepNight;
    setAlc(6, { usualDays: [4] });
    const base = sleepReadinessBias([night], SAT_NOON, 480, 0);
    const sat = sleepReadinessBias([night], SAT_NOON, 480, sleepNeedExtraMin(SAT_NOON));
    const fri = sleepReadinessBias([night], SAT_NOON, 480, sleepNeedExtraMin(FRI_NOON));
    expect(sat).toBeLessThan(base);
    expect(fri).toBe(base);
  });
});

describe('experimental numbers (deload, progression)', () => {
  const chestWeek = (sets: number): Workout[] => [
    {
      id: 'w',
      startedAt: SAT_NOON - DAY,
      finishedAt: SAT_NOON - DAY + 3600_000,
      exercises: [
        {
          id: 'e',
          name: 'Barbell Bench Press - Medium Grip',
          position: 0,
          kind: 'strength',
          sets: Array.from({ length: sets }, (_, i) => ({
            id: `s${i}`,
            position: i,
            reps: 8,
            weight: 80,
            type: 'working',
          })),
        },
      ],
    } as unknown as Workout,
  ];
  // 11 sets against a sweep of MRVs: the score runs through every fatigue line.
  const levels = () =>
    Array.from(
      { length: 60 },
      (_, i) =>
        muscleFatigue(
          chestWeek(11),
          SAT_NOON,
          new Map([['chest' as const, { mev: 4, mav: 8, mrv: 8 + i * 0.1 }]]),
        ).get('chest')!.level,
    );

  it('off: unchanged; on: the lines to "high" and "fried" move down a little', () => {
    const off = levels();
    setAlc(40);
    expect(deloadMult()).toBeLessThan(1);
    expect(deloadMult()).toBeGreaterThanOrEqual(0.94);
    const on = levels();
    expect(on).not.toEqual(off);
    // Only ever one way: a level can get worse, never better.
    const rank = { fresh: 0, moderate: 1, high: 2, fried: 3 } as const;
    on.forEach((l, i) => expect(rank[l]).toBeGreaterThanOrEqual(rank[off[i]]));
    setAlc(0);
    expect(levels()).toEqual(off);
  });

  it('progression: off unchanged; on a 5 kg step can only shrink, never grow', () => {
    const hist = (kg: number, ts: number) => ({ ts, weight: kg, reps: 8 }) as never;
    const h = [hist(100, 1), hist(100, 2), hist(100, 3)];
    const off = nextTarget(h as never);
    setAlc(80);
    expect(progressionMult()).toBeLessThan(1);
    const on = nextTarget(h as never);
    if (off.state === 'progress' && on.state === 'progress') {
      expect(on.deltaKg).toBeLessThanOrEqual(off.deltaKg);
    }
  });
});

describe('nicotine and alcohol together', () => {
  it('stack: more than either alone, never past the combined caps', () => {
    setAlc(0);
    setNic(40);
    const nicOnly = readinessMult(SAT_NOON);
    const nicSleep = sleepNeedExtraMin(SAT_NOON);
    setNic(0);
    setAlc(60);
    const alcOnly = readinessMult(SAT_NOON);
    const alcSleep = sleepNeedExtraMin(SAT_NOON);
    setNic(40);
    const both = readinessMult(SAT_NOON);
    expect(both).toBeLessThan(Math.min(nicOnly, alcOnly));
    expect(both).toBeCloseTo(nicOnly * alcOnly, 4);
    expect(both).toBeGreaterThanOrEqual(READINESS_MIN_MULT);
    expect(sleepNeedExtraMin(SAT_NOON)).toBeCloseTo(nicSleep + alcSleep, 4);
    expect(sleepNeedExtraMin(SAT_NOON)).toBeLessThanOrEqual(SLEEP_NEED_MAX_EXTRA_MIN);
  });

  it('with huge amounts the combined values stay inside the caps', () => {
    setNic(500);
    setAlc(400);
    expect(readinessMult(SAT_NOON)).toBeGreaterThanOrEqual(READINESS_MIN_MULT);
    expect(sleepNeedExtraMin(SAT_NOON)).toBeLessThanOrEqual(SLEEP_NEED_MAX_EXTRA_MIN);
  });

  it('nicotine alone keeps its old behaviour when alcohol is off', () => {
    setNic(40);
    expect(readinessMult(SAT_NOON)).toBe(readinessMult(FRI_NOON));
    expect(readinessMult(SAT_NOON)).toBeLessThan(1);
  });
});
