/**
 * Nicotine applied quietly in the engines (placeholder coefficients; see nicotine.ts).
 * Three promises, per surface: (1) nicotine off = nothing changes, (2) on = it changes, and
 * stays within the cap of the coefficient table, (3) that surface switched off = neutral.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { __getStateForTests, __replaceStateForTests } from './store';
import {
  NICOTINE_SURFACES,
  SURFACE_COEFFS,
  defaultNicotineSettings,
  emptyNicotineState,
  newNicotineProduct,
  type NicotineEffectKey,
} from './nicotine';
import { nicMid, nicRpeShift } from './nicotineApply';
import { computeReadiness, carryOverSets } from './recovery';
import { muscleFatigue } from './fatigue';
import { sleepReadinessBias } from './sleep';
import { nextTarget } from './progression';
import { planRest, type RestInputs } from './restTimer';
import { buildDay, type BuildContext } from './sessionBuilder';
import type { NicotineSurface, SleepNight, Workout } from './types';

/** 40 cigarettes a day = 40 cigarette-equivalents: every surface is near, but below, its cap. */
const HEAVY = 40;
/** Where a 5 kg progression step first drops below 5 (half-kilo rounding up hides less). */
const VERY_HEAVY = 80;

function setNic(cig: number, opts: { master?: boolean; off?: NicotineSurface[] } = {}): void {
  const settings = defaultNicotineSettings();
  settings.useInCalculations = opts.master ?? true;
  // Experimental surfaces start off; these engine tests switch every surface on.
  for (const s of NICOTINE_SURFACES) settings.surfaces[s] = true;
  for (const s of opts.off ?? []) settings.surfaces[s] = false;
  const products = cig > 0 ? [{ ...newNicotineProduct('cigarettes', 'c'), amount: cig }] : [];
  __replaceStateForTests({
    ...__getStateForTests(),
    nicotine: { products, settings, updatedAt: 1 },
  });
}

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* no storage */
  }
  setNic(0);
});
afterEach(() => {
  __replaceStateForTests({ ...__getStateForTests(), nicotine: emptyNicotineState() });
});

const DAY = 24 * 3600 * 1000;
const AT = Date.UTC(2026, 8, 30, 12);

describe('nicMid', () => {
  it('is neutral for every key when nicotine is off, master off, or the surface is off', () => {
    const keys = Object.keys(SURFACE_COEFFS) as NicotineEffectKey[];
    const neutral = (k: NicotineEffectKey) => (SURFACE_COEFFS[k].mode === 'mult' ? 1 : 0);
    for (const k of keys) expect(nicMid(k)).toBe(neutral(k));
    setNic(HEAVY, { master: false });
    for (const k of keys) expect(nicMid(k)).toBe(neutral(k));
    setNic(HEAVY, { off: [...NICOTINE_SURFACES] });
    for (const k of keys) expect(nicMid(k)).toBe(neutral(k));
    expect(nicRpeShift()).toBe(0);
  });

  it('sits inside its cap when on', () => {
    setNic(HEAVY);
    for (const k of Object.keys(SURFACE_COEFFS) as NicotineEffectKey[]) {
      const c = SURFACE_COEFFS[k];
      const change = Math.abs(nicMid(k) - (c.mode === 'mult' ? 1 : 0));
      expect(change).toBeGreaterThan(0);
      expect(change).toBeLessThanOrEqual(c.cap + 1e-9);
    }
    expect(nicRpeShift()).toBeLessThan(0);
    expect(nicRpeShift()).toBeGreaterThanOrEqual(-SURFACE_COEFFS.rpe.cap);
  });
});

describe('readiness (recovery window)', () => {
  const at = () => computeReadiness(1.5, 7, 3, 14);

  it('off: unchanged', () => {
    const r = at();
    expect(r.readiness).toBeCloseTo(0.5, 6);
    expect(r.recoveryDays).toBeCloseTo(3, 6);
  });

  it('on: a little slower, never more than the cap; its switch off = neutral', () => {
    const off = at();
    setNic(HEAVY);
    const on = at();
    expect(on.readiness).toBeLessThan(off.readiness);
    expect(on.readiness).toBeGreaterThanOrEqual(
      off.readiness * (1 - SURFACE_COEFFS.readiness.cap) - 1e-9,
    );
    expect(on.recoveryDays).toBeGreaterThan(off.recoveryDays);
    setNic(HEAVY, { off: ['readiness'] });
    expect(at()).toEqual(off);
  });

  it('a muscle not trained in the window stays fully ready', () => {
    setNic(HEAVY);
    expect(computeReadiness(null, 0, 3, 14).readiness).toBe(1);
  });

  it('carry-over fades over the same longer window', () => {
    const bench = (startedAt: number): Workout =>
      ({
        id: 'w',
        startedAt,
        finishedAt: startedAt + 3600_000,
        exercises: [
          {
            id: 'e',
            name: 'Barbell Bench Press - Medium Grip',
            position: 0,
            kind: 'strength',
            sets: Array.from({ length: 10 }, (_, i) => ({
              id: `s${i}`,
              position: i,
              reps: 8,
              weight: 80,
              type: 'working',
            })),
          },
        ],
      }) as unknown as Workout;
    const off = carryOverSets([bench(AT - DAY)], AT).get('chest') ?? 0;
    setNic(HEAVY);
    const on = carryOverSets([bench(AT - DAY)], AT).get('chest') ?? 0;
    expect(on).toBeGreaterThan(off);
    setNic(HEAVY, { off: ['readiness'] });
    expect(carryOverSets([bench(AT - DAY)], AT).get('chest') ?? 0).toBe(off);
  });
});

describe('fatigue (deload threshold)', () => {
  const chestWeek = (sets: number): Workout[] => [
    {
      id: 'w',
      startedAt: AT - DAY,
      finishedAt: AT - DAY + 3600_000,
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
  // mrv 10: 11 sets -> score 0.667 (just under 'fried' at 0.7); 10.5 mrv: 11 sets -> 0.579.
  const lm = (mrv: number) => new Map([['chest' as const, { mev: 4, mav: 8, mrv }]]);
  const level = (sets: number, mrv: number) =>
    muscleFatigue(chestWeek(sets), AT, lm(mrv)).get('chest')!.level;

  it('off: unchanged', () => {
    expect(level(11, 10)).toBe('high');
  });

  it('on: the line to "fried" moves down by at most the cap', () => {
    setNic(HEAVY);
    expect(level(11, 10)).toBe('fried'); // 0.667 >= 0.7 x 0.925
    expect(level(11, 10.5)).toBe('high'); // 0.579 < 0.7 x 0.9 (the strongest possible shift)
    setNic(HEAVY, { off: ['fatigue'] });
    expect(level(11, 10)).toBe('high');
  });
});

describe('sleep need', () => {
  const night = (daysAgo: number): SleepNight => {
    const bed = AT - daysAgo * DAY - 12 * 3600_000;
    return {
      id: `n${daysAgo}`,
      date: new Date(bed + 8 * 3600_000).toISOString().slice(0, 10),
      bedtime: bed,
      wake: bed + 480 * 60_000,
      source: 'backfill',
    } as SleepNight;
  };
  const bias = (extra = 0) => sleepReadinessBias([night(0)], AT, 480, extra);

  it('off: the extra minutes are zero and nothing changes', () => {
    expect(nicMid('sleepMin')).toBe(0);
    expect(bias(nicMid('sleepMin'))).toBe(bias());
  });

  it('on: the same night counts for less, within the cap', () => {
    setNic(HEAVY);
    const extra = nicMid('sleepMin');
    expect(extra).toBeGreaterThan(0);
    expect(extra).toBeLessThanOrEqual(SURFACE_COEFFS.sleepMin.cap);
    expect(bias(extra)).toBeLessThan(bias());
    setNic(HEAVY, { off: ['sleep'] });
    expect(nicMid('sleepMin')).toBe(0);
  });
});

describe('rest between sets', () => {
  const base: RestInputs = {
    compound: true,
    equipment: ['barbell'],
    primary: 'chest',
    lastType: 'working',
    intensity: 0.9,
    reps: 5,
    failure: false,
    rpe: 8,
    muscleFatigue: 0,
    illness: false,
    shortSleep: false,
    midRound: false,
  };
  it('off: a scale of 1 (or none) changes nothing; the plan gets no new reason', () => {
    const a = planRest(base);
    expect(planRest({ ...base, nicotineRestScale: 1 })).toEqual(a);
    expect(nicMid('restPct')).toBe(1);
  });
  it('on: a little longer, within the cap (before the 15 s rounding), and silent', () => {
    const a = planRest(base);
    setNic(HEAVY);
    const k = nicMid('restPct');
    const b = planRest({ ...base, nicotineRestScale: k });
    expect(k).toBeGreaterThan(1);
    expect(k).toBeLessThanOrEqual(1 + SURFACE_COEFFS.restPct.cap);
    expect(b.sec).toBeGreaterThan(a.sec);
    expect(b.sec).toBeLessThanOrEqual(
      Math.ceil((a.sec * (1 + SURFACE_COEFFS.restPct.cap)) / 15) * 15,
    );
    expect(b.reasons).toEqual(a.reasons);
    setNic(HEAVY, { off: ['rest'] });
    expect(nicMid('restPct')).toBe(1);
  });
  it('never touches a warm-up rest or a superset hand-off', () => {
    expect(planRest({ ...base, lastType: 'warmup', nicotineRestScale: 1.1 }).sec).toBe(60);
    expect(planRest({ ...base, midRound: true, nicotineRestScale: 1.1 }).sec).toBe(0);
  });
});

describe('warm-up length', () => {
  const ctx = (): BuildContext => ({
    finished: [],
    activities: [],
    body: null,
    goals: undefined,
    gym: null,
    now: AT,
    intent: 'muscle',
    targetMuscles: ['chest', 'shoulders', 'triceps'],
    warmup: true,
    cardio: false,
    cooldown: false,
    bodyKg: 82,
    sex: 'male',
  });
  const mins = () => buildDay(ctx()).warmup[0].durationMin;

  it('off: 5 minutes as before', () => {
    expect(mins()).toBe(5);
  });
  it('on: a little longer, within the cap; its switch off = 5', () => {
    setNic(HEAVY);
    const m = mins() as number;
    expect(m).toBeGreaterThan(5);
    expect(m - 5).toBeLessThanOrEqual(SURFACE_COEFFS.warmupMin.cap);
    setNic(HEAVY, { off: ['warmup'] });
    expect(mins()).toBe(5);
  });
});

describe('progression step', () => {
  const hist = [{ ts: AT - 3 * DAY, weight: 100, reps: 10 }];
  const opts = { plannedReps: 10, equipment: ['barbell'], primary: 'quads' as const };

  it('off: +5 kg on a big barbell lift', () => {
    const t = nextTarget(hist, opts);
    expect(t.deltaKg).toBe(5);
    expect(t.weight).toBe(105);
  });
  it('on: the jump shrinks within the cap; 2.5 kg steps are left alone; switch off = neutral', () => {
    setNic(VERY_HEAVY);
    const t = nextTarget(hist, opts);
    expect(t.deltaKg).toBeLessThan(5);
    expect(t.deltaKg).toBeGreaterThanOrEqual(5 * (1 - SURFACE_COEFFS.progressionStep.cap));
    expect(t.weight).toBe(100 + t.deltaKg);
    expect(
      nextTarget(hist, { plannedReps: 10, equipment: ['dumbbell'], primary: 'biceps' }).deltaKg,
    ).toBe(2.5);
    setNic(HEAVY);
    expect(nextTarget(hist, opts).deltaKg).toBe(5); // half-kilo rounding up hides a small cut
    setNic(VERY_HEAVY, { off: ['progression'] });
    expect(nextTarget(hist, opts).deltaKg).toBe(5);
  });
  it('a hold is still a hold', () => {
    setNic(HEAVY);
    expect(nextTarget([{ ts: AT, weight: 100, reps: 7 }], opts).state).toBe('hold');
  });
});

describe('RPE zone shift', () => {
  it('off: 0; on: a lower zone by whole half-points within the cap; switch off = 0', () => {
    expect(nicRpeShift()).toBe(0);
    setNic(HEAVY);
    const s = nicRpeShift();
    expect(s).toBeLessThan(0);
    expect(s).toBeGreaterThanOrEqual(-SURFACE_COEFFS.rpe.cap);
    expect(Math.abs((s * 2) % 1)).toBe(0);
    setNic(HEAVY, { off: ['rpe'] });
    expect(nicRpeShift()).toBe(0);
  });
});
