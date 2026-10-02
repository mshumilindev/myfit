import { describe, expect, it } from 'vitest';
import {
  ABSORPTION,
  EVIDENCE_SURFACES,
  EXPERIMENTAL_SURFACES,
  NICOTINE_SOURCES,
  DEFAULT_ML_PER_POD,
  ML_PER_PUFF,
  ML_PER_VAPE_SESSION,
  NICOTINE_KINDS,
  NICOTINE_SURFACES,
  OCCASIONAL_ML_PER_DAY,
  OCCASIONAL_UNITS_PER_DAY,
  NO_SOURCE,
  SURFACE_COEFFS,
  convertAmount,
  defaultNicotineSettings,
  effectsForLoad,
  emptyNicotineState,
  newNicotineProduct,
  nicotineEffects,
  magnitude,
  nicotineAbsorbedMgPerDay,
  nicotineLoad,
  nicotineMgPerDay,
  nicotineSummaryText,
  normalizeNicotine,
  normalizeNicotineProduct,
  productAbsorbedMgPerDay,
  productMgPerDay,
  summaryHints,
  surfacesOnCount,
  unitsFor,
  withoutNicotine,
} from './nicotine';
import type { NicotineEffectKey } from './nicotine';
import type { NicotineProduct, NicotineState } from './types';

const P = (over: Partial<NicotineProduct> & Pick<NicotineProduct, 'kind'>): NicotineProduct => ({
  ...newNicotineProduct(over.kind, over.id ?? over.kind),
  ...over,
});
const vape = P({ kind: 'vape', unit: 'ml', amount: 1.5, strengthMg: 20 }); // 30 mg
const heated = P({ kind: 'heated', unit: 'sticks', amount: 8, strengthMg: 1 }); // 8 mg
const state = (
  products: NicotineProduct[],
  over: Partial<NicotineState['settings']> = {},
): NicotineState => ({
  products,
  settings: { ...defaultNicotineSettings(), ...over },
  updatedAt: 1,
});

describe('catalog', () => {
  it('has the 10 tiles of board 2A, each with a unit and a default', () => {
    expect(NICOTINE_KINDS.map((k) => k.kind)).toEqual([
      'cigarettes',
      'cigars',
      'pipe',
      'heated',
      'vape',
      'pouches',
      'snus',
      'chew',
      'hookah',
      'other',
    ]);
    for (const k of NICOTINE_KINDS) {
      expect(k.units.length).toBeGreaterThan(0);
      expect(newNicotineProduct(k.kind, 'x').unit).toBe(k.units[0]);
    }
    expect(unitsFor('vape')).toEqual(['ml', 'pods', 'puffs', 'sessions']);
  });
});

describe('nicotineMgPerDay', () => {
  it('is the plain sum of mg per day: vape 30 + heated 8 = 38', () => {
    expect(nicotineMgPerDay([vape, heated])).toBe(38);
    expect(nicotineMgPerDay([])).toBe(0);
  });

  it('converts packs to 20 pieces', () => {
    expect(
      productMgPerDay(P({ kind: 'cigarettes', unit: 'packs', amount: 1, strengthMg: 1 })),
    ).toBe(20);
    expect(productMgPerDay(P({ kind: 'heated', unit: 'packs', amount: 0.5, strengthMg: 1 }))).toBe(
      10,
    );
  });

  it('converts vape units to ml times mg/ml', () => {
    const v = (
      unit: NicotineProduct['unit'],
      amount: number,
      extra: Partial<NicotineProduct> = {},
    ) => productMgPerDay(P({ kind: 'vape', unit, amount, strengthMg: 20, ...extra }));
    expect(v('ml', 2)).toBe(40);
    expect(v('pods', 1)).toBeCloseTo(DEFAULT_ML_PER_POD * 20);
    expect(v('pods', 1, { mlPerPod: 0.7 })).toBeCloseTo(14);
    expect(v('puffs', 100)).toBeCloseTo(100 * ML_PER_PUFF * 20);
    expect(v('sessions', 5)).toBeCloseTo(5 * ML_PER_VAPE_SESSION * 20);
  });

  it('leaves out inactive, zero, negative, NaN and wrong-unit products', () => {
    expect(nicotineMgPerDay([{ ...vape, active: false }, heated])).toBe(8);
    expect(nicotineMgPerDay([{ ...vape, amount: 0 }])).toBe(0);
    expect(nicotineMgPerDay([{ ...vape, amount: -3 }])).toBe(0);
    expect(nicotineMgPerDay([{ ...vape, amount: Number.NaN }])).toBe(0);
    expect(nicotineMgPerDay([{ ...vape, strengthMg: Number.POSITIVE_INFINITY }])).toBe(0);
    expect(nicotineMgPerDay([{ ...heated, unit: 'ml' }])).toBe(0);
  });

  it('keeps the daily amount when the unit changes', () => {
    const c = P({ kind: 'cigarettes', unit: 'pieces', amount: 40 });
    expect(convertAmount(c, 'packs')).toBe(2);
    const v = P({ kind: 'vape', unit: 'ml', amount: 4 });
    expect(convertAmount(v, 'pods')).toBe(2);
  });
});

describe('from time to time (occasional)', () => {
  it('counts a small fixed amount a day times the strength, whatever the amount field holds', () => {
    const stick = P({ kind: 'heated', unit: 'sticks', amount: 8, strengthMg: 1, occasional: true });
    expect(productMgPerDay(stick)).toBeCloseTo(OCCASIONAL_UNITS_PER_DAY * 1);
    expect(productMgPerDay(stick)).toBeCloseTo(1 / 7);
    expect(productMgPerDay({ ...stick, amount: 400 })).toBeCloseTo(1 / 7);
    expect(productMgPerDay({ ...stick, amount: Number.NaN })).toBeCloseTo(1 / 7);
    expect(productMgPerDay({ ...stick, strengthMg: 6 })).toBeCloseTo(6 / 7);
  });

  it('a vape counts one session of liquid a week', () => {
    const v = { ...vape, occasional: true as const };
    expect(OCCASIONAL_ML_PER_DAY).toBeCloseTo(ML_PER_VAPE_SESSION / 7);
    expect(productMgPerDay(v)).toBeCloseTo((ML_PER_VAPE_SESSION / 7) * 20);
  });

  it('inactive or zero-strength stays 0; it joins the plain sum', () => {
    const o = { ...heated, id: 'h2', occasional: true as const };
    expect(productMgPerDay({ ...o, active: false })).toBe(0);
    expect(productMgPerDay({ ...o, strengthMg: 0 })).toBe(0);
    expect(nicotineMgPerDay([vape, o])).toBeCloseTo(30.1, 1);
  });

  it('a product without the flag (older documents) stays daily', () => {
    expect('occasional' in heated).toBe(false);
    expect(productMgPerDay(heated)).toBe(8);
  });

  it('normalises: true is kept; an old perDays above 1 means occasional; the rest is daily', () => {
    const base = { id: 'a', kind: 'cigarettes', unit: 'pieces', amount: 5, strengthMg: 1 };
    expect(normalizeNicotineProduct({ ...base, occasional: true })?.occasional).toBe(true);
    for (const old of [7, 14, 30]) {
      const p = normalizeNicotineProduct({ ...base, perDays: old })!;
      expect(p.occasional).toBe(true);
      expect('perDays' in p).toBe(false);
    }
    for (const bad of [{ perDays: 1 }, { perDays: 0 }, { perDays: '7' }, { occasional: 1 }, {}]) {
      const p = normalizeNicotineProduct({ ...base, ...bad })!;
      expect('occasional' in p).toBe(false);
      expect('perDays' in p).toBe(false);
    }
  });

  it('the summary text keeps the names and shows a small amount with one decimal', () => {
    const o = P({ kind: 'heated', strengthMg: 1, occasional: true });
    expect(nicotineSummaryText([o], (k) => k)).toBe('heated · ≈ 0.1 mg a day');
    expect(nicotineSummaryText([vape, heated], (k) => k)).toBe('vape + heated · ≈ 38 mg a day');
  });
});

describe('absorption', () => {
  it('has a factor and a source slot for every kind', () => {
    for (const k of NICOTINE_KINDS) {
      const e = ABSORPTION[k.kind];
      expect(e, k.kind).toBeDefined();
      expect(Number.isFinite(e.factor)).toBe(true);
      expect(e.factor).toBeGreaterThan(0);
      expect(e.factor).toBeLessThanOrEqual(1);
      expect(['moderate', 'weak', 'none']).toContain(e.confidence);
      // A number without research says so; a cited one carries its citation.
      if (e.confidence === 'none') expect(e.source).toBe(NO_SOURCE);
      else expect(e.source.length).toBeGreaterThan(10);
      if (e.confidence !== 'none') expect(e.source).not.toBe(NO_SOURCE);
    }
    expect(ABSORPTION.cigarettes.confidence).toBe('weak'); // reference unit, mg per cigarette not verified
    expect(ABSORPTION.heated.factor).toBe(0.6);
    expect(ABSORPTION.snus.factor).toBe(0.3);
    expect(ABSORPTION.snus.confidence).toBe('moderate');
    expect(ABSORPTION.pouches.confidence).toBe('moderate');
    expect(JSON.stringify(ABSORPTION) + JSON.stringify(SURFACE_COEFFS)).not.toMatch(/Goniewicz/);
    expect(ABSORPTION.heated.confidence).toBe('moderate');
    expect(ABSORPTION.vape.confidence).toBe('weak');
    expect(Object.keys(ABSORPTION).sort()).toEqual(NICOTINE_KINDS.map((k) => k.kind).sort());
    expect(ABSORPTION.cigarettes.factor).toBe(1);
  });

  it('absorbed is below labelled for a vape and for heated tobacco', () => {
    expect(productAbsorbedMgPerDay(vape)).toBeLessThan(productMgPerDay(vape));
    expect(productAbsorbedMgPerDay(heated)).toBeLessThan(productMgPerDay(heated));
    expect(productAbsorbedMgPerDay(vape)).toBeCloseTo(30 * ABSORPTION.vape.factor);
    expect(productAbsorbedMgPerDay(heated)).toBeCloseTo(8 * ABSORPTION.heated.factor);
  });

  it('a cigarette is 1 mg absorbed: a pack a day is 20 cig-eq', () => {
    const pack = P({ kind: 'cigarettes', unit: 'packs', amount: 1, strengthMg: 1 });
    expect(productAbsorbedMgPerDay(pack)).toBe(20);
    expect(nicotineLoad([pack]).cigEq).toBe(20);
  });

  it('keeps the occasional product handling, absorbed too', () => {
    const o = { ...heated, id: 'h2', occasional: true as const };
    expect(productAbsorbedMgPerDay(o)).toBeCloseTo((1 / 7) * ABSORPTION.heated.factor);
    expect(productAbsorbedMgPerDay({ ...o, active: false })).toBe(0);
  });
});

describe('load and scenarios', () => {
  it('keeps the labelled sum for display and builds the load on the absorbed sum', () => {
    const abs = 30 * ABSORPTION.vape.factor + 8 * ABSORPTION.heated.factor;
    expect(nicotineAbsorbedMgPerDay([vape, heated])).toBeCloseTo(abs, 3);
    const load = nicotineLoad([vape, heated]);
    expect(load.mgPerDay).toBe(38);
    expect(load.absorbedMgPerDay).toBeCloseTo(abs, 3);
    expect(load.cigEq).toBeCloseTo(abs, 3); // 1 mg absorbed = 1 cig-eq
    expect(load.cigEq).toBeLessThan(load.mgPerDay);
  });

  it('withoutNicotine scales every field by 0.5 and 0', () => {
    const load = nicotineLoad([vape, heated]);
    const less = withoutNicotine(load, 'less');
    expect(less.mgPerDay).toBe(19);
    expect(less.absorbedMgPerDay).toBeCloseTo(load.absorbedMgPerDay / 2, 3);
    expect(less.cigEq).toBeCloseTo(load.cigEq / 2, 3);
    expect(withoutNicotine(load, 'none')).toEqual({ mgPerDay: 0, absorbedMgPerDay: 0, cigEq: 0 });
  });
});

describe('effects: ranges and caps', () => {
  const L = (cigEq: number) => ({ mgPerDay: cigEq, absorbedMgPerDay: cigEq, cigEq });
  const huge = L(5000);

  it('every range is ordered and neutral at zero load', () => {
    const none = effectsForLoad(L(0));
    for (const k of Object.keys(none) as (keyof typeof none)[]) {
      expect(none[k].low).toBeLessThanOrEqual(none[k].high);
    }
    expect(none.readiness).toEqual({ low: 1, high: 1 });
    expect(none.sleepMin).toEqual({ low: 0, high: 0 });
    const mid = effectsForLoad(nicotineLoad([vape, heated]));
    for (const k of Object.keys(mid) as (keyof typeof mid)[])
      expect(mid[k].low).toBeLessThanOrEqual(mid[k].high);
  });

  it('never exceeds the documented caps, however large the load', () => {
    const e = effectsForLoad(huge);
    expect(e.readiness.low).toBeGreaterThanOrEqual(0.95); // at most -5 %
    expect(e.sleepMin.high).toBeLessThanOrEqual(15); // at most +15 min
    expect(e.restPct.high).toBeLessThanOrEqual(1.1); // at most +10 %
    expect(e.warmupMin.high).toBeLessThanOrEqual(2); // at most +2 min
    expect(e.rpe.low).toBeGreaterThanOrEqual(-0.5); // at most -0.5
    expect(e.deloadThreshold.low).toBeGreaterThanOrEqual(0.9);
    expect(e.progressionStep.low).toBeGreaterThanOrEqual(1 - SURFACE_COEFFS.progressionStep.cap);
    // The strong end only approaches the cap.
    expect(e.readiness.low).toBeCloseTo(0.95);
    expect(e.sleepMin.high).toBeCloseTo(15, 3);
  });

  it('grows with the load and moves in the documented direction', () => {
    const small = effectsForLoad(L(4));
    const big = effectsForLoad(L(20));
    expect(big.readiness.low).toBeLessThan(small.readiness.low);
    expect(big.sleepMin.high).toBeGreaterThan(small.sleepMin.high);
    expect(big.rpe.low).toBeLessThan(small.rpe.low);
    expect(big.restPct.high).toBeGreaterThan(1);
    expect(big.readiness.high).toBeLessThan(1);
  });

  const KEYS = Object.keys(SURFACE_COEFFS) as NicotineEffectKey[];
  const mag = (k: NicotineEffectKey, cigEq: number) => {
    const r = effectsForLoad(L(cigEq))[k];
    const neutral = SURFACE_COEFFS[k].mode === 'mult' ? 1 : 0;
    return Math.abs(r.high - neutral) > Math.abs(r.low - neutral) ? r.high : r.low;
  };
  const change = (k: NicotineEffectKey, cigEq: number) =>
    Math.abs(mag(k, cigEq) - (SURFACE_COEFFS[k].mode === 'mult' ? 1 : 0));

  it('is monotonic in the load for every surface', () => {
    for (const k of KEYS) {
      let prev = -1;
      for (const x of [0, 0.5, 1, 2, 5, 10, 15, 20, 30, 40, 80, 160]) {
        const c = change(k, x);
        expect(c, `${k} @ ${x}`).toBeGreaterThanOrEqual(prev);
        if (x > 0 && x <= 80) expect(c, `${k} strictly @ ${x}`).toBeGreaterThan(prev);
        prev = c;
      }
    }
  });

  it('does not saturate: 5, 10, 20 and 40 cig-eq are clearly different and below the cap', () => {
    for (const k of KEYS) {
      const cap = SURFACE_COEFFS[k].cap;
      const v = [5, 10, 20, 40].map((x) => change(k, x));
      for (let i = 1; i < v.length; i++) expect(v[i] - v[i - 1]).toBeGreaterThan(cap * 0.05);
      expect(v[3], k).toBeLessThan(cap * 0.95);
      expect(v[3]).toBeGreaterThan(v[2] * 1.2); // 20 vs 40 is not the same
    }
  });

  it('a pack a day (20 cig-eq) is about 60 to 70 % of the cap', () => {
    for (const k of KEYS) {
      const share = magnitude(SURFACE_COEFFS[k], 20) / SURFACE_COEFFS[k].cap;
      expect(share, k).toBeGreaterThan(0.6);
      expect(share, k).toBeLessThan(0.7);
    }
  });

  it('never exceeds the cap, for any load, and is 0 at no load', () => {
    for (const k of KEYS) {
      const c = SURFACE_COEFFS[k];
      expect(magnitude(c, 0)).toBe(0);
      expect(magnitude(c, -5)).toBe(0);
      for (const x of [0.001, 1, 20, 100, 1000, 1e6, 1e9]) {
        expect(magnitude(c, x)).toBeLessThanOrEqual(c.cap);
      }
      expect(magnitude(c, 40)).toBeLessThan(c.cap);
    }
  });

  it('x0.5 and x0 always differ from the current value for any non-zero load', () => {
    const loads = [0.1, 0.14, 1, 5, 10, 20, 40, 100, 1000].map(L);
    for (const load of loads) {
      const now = effectsForLoad(load);
      const less = effectsForLoad(withoutNicotine(load, 'less'));
      const none = effectsForLoad(withoutNicotine(load, 'none'));
      for (const k of KEYS) {
        // Compare the strong end (the one that carries the full estimate).
        const neutral = SURFACE_COEFFS[k].mode === 'mult' ? 1 : 0;
        const dist = (r: { low: number; high: number }) =>
          Math.max(Math.abs(r.low - neutral), Math.abs(r.high - neutral));
        if (load.cigEq >= 1000) {
          expect(dist(less[k])).toBeLessThanOrEqual(dist(now[k])); // saturated at the cap
        } else {
          expect(dist(less[k]), `${k} less @ ${load.cigEq}`).toBeLessThan(dist(now[k]));
        }
        expect(dist(none[k])).toBe(0);
        expect(dist(none[k])).toBeLessThan(dist(less[k]) || 1);
      }
    }
  });

  it('the example vape 1.5 ml x 20 mg/ml + 8 heated sticks lands between the extremes', () => {
    const load = nicotineLoad([vape, heated]);
    expect(load.cigEq).toBeLessThan(38);
    for (const k of KEYS) {
      const now = change(k, load.cigEq);
      const less = change(k, load.cigEq / 2);
      expect(now).toBeGreaterThan(less);
      expect(now).toBeLessThan(SURFACE_COEFFS[k].cap);
    }
  });

  it('a switched-off surface stays neutral', () => {
    const load = nicotineLoad([vape, heated]);
    const e = effectsForLoad(load, { sleep: false, rpe: false });
    expect(e.sleepMin).toEqual({ low: 0, high: 0 });
    expect(e.rpe).toEqual({ low: 0, high: 0 });
    expect(e.readiness.high).toBeLessThan(1);
  });

  it('nicotineEffects is null when the master is off or nothing is active', () => {
    expect(nicotineEffects(state([vape, heated]))).not.toBeNull();
    expect(nicotineEffects(state([vape, heated], { useInCalculations: false }))).toBeNull();
    expect(nicotineEffects(state([]))).toBeNull();
    expect(nicotineEffects(state([{ ...vape, active: false }]))).toBeNull();
  });
});

describe('summaryHints', () => {
  const base = { recoveryGapHours: 48, avgSleepMin: 420 };

  it('is null when the master or the hints switch is off, or there is nothing active', () => {
    expect(summaryHints(state([vape, heated], { useInCalculations: false }), base)).toBeNull();
    const s = defaultNicotineSettings();
    s.surfaces.afterWorkoutHints = false;
    expect(summaryHints({ products: [vape, heated], settings: s }, base)).toBeNull();
    expect(summaryHints(state([]), base)).toBeNull();
    expect(summaryHints(state([{ ...vape, active: false }]), base)).toBeNull();
  });

  it('is null when no baseline is known', () => {
    expect(summaryHints(state([vape, heated]), {})).toBeNull();
    expect(
      summaryHints(state([vape, heated]), { recoveryGapHours: 0, avgSleepMin: null }),
    ).toBeNull();
  });

  it('expresses both scenarios in the user own baselines; none is at least as big as less', () => {
    const h = summaryHints(state([vape, heated]), base)!;
    expect(h.mgPerDay).toBe(38);
    expect(h.absorbedMgPerDay).toBeLessThan(h.mgPerDay);
    expect(h.cigEq).toBe(h.absorbedMgPerDay);
    for (const key of ['recoveryGapShorterHours', 'sleepNeedLessMin'] as const) {
      const less = h.less[key]!;
      const none = h.none[key]!;
      expect(less.low).toBeGreaterThanOrEqual(0);
      expect(less.low).toBeLessThanOrEqual(less.high);
      expect(none.high).toBeGreaterThanOrEqual(less.high);
    }
    // Bounded by the caps: the gap is at most ~5 % of 48 h, sleep at most 15 min.
    expect(h.none.recoveryGapShorterHours!.high).toBeLessThanOrEqual(48 * 0.06);
    expect(h.none.sleepNeedLessMin!.high).toBeLessThanOrEqual(15);
    expect(h.baselines).toEqual({ recoveryGapHours: 48, avgSleepMin: 420 });
    expect('e1rmGainKg' in h.none).toBe(false); // no research behind a top-set number
  });

  it('skips a hint whose baseline or switch is missing', () => {
    const only = summaryHints(state([vape, heated]), { avgSleepMin: 400 })!;
    expect(only.none.recoveryGapShorterHours).toBeNull();
    expect(only.none.sleepNeedLessMin).not.toBeNull();
    const s = defaultNicotineSettings();
    s.surfaces.readiness = false;
    const noReady = summaryHints({ products: [vape, heated], settings: s }, base)!;
    expect(noReady.none.recoveryGapShorterHours).toBeNull();
    expect(noReady.none.sleepNeedLessMin).not.toBeNull();
  });
});

describe('nicotineSummaryText', () => {
  const label = (k: string) => (k === 'vape' ? 'Vape' : k === 'heated' ? 'Heated tobacco' : k);
  it('lists products by size with the rounded daily mg', () => {
    expect(nicotineSummaryText([heated, vape], label)).toBe(
      'Vape + Heated tobacco · ≈ 38 mg a day',
    );
    expect(nicotineSummaryText([vape], label, (mg) => `${mg} мг`)).toBe('Vape · ≈ 30 мг');
  });
  it('is null with nothing active', () => {
    expect(nicotineSummaryText([], label)).toBeNull();
    expect(nicotineSummaryText([{ ...vape, active: false }], label)).toBeNull();
  });
});

describe('defaults and parsing', () => {
  it('defaults: master on, research surfaces on, experimental surfaces off, sharing off', () => {
    const s = defaultNicotineSettings();
    expect(s.useInCalculations).toBe(true);
    expect(s.sharing).toBe('off');
    expect(EVIDENCE_SURFACES.every((k) => s.surfaces[k] === true)).toBe(true);
    expect(EXPERIMENTAL_SURFACES.every((k) => s.surfaces[k] === false)).toBe(true);
    expect([...EVIDENCE_SURFACES, ...EXPERIMENTAL_SURFACES].sort()).toEqual(
      [...NICOTINE_SURFACES].sort(),
    );
    expect(surfacesOnCount(s)).toBe(EVIDENCE_SURFACES.length);
    expect(emptyNicotineState().updatedAt).toBe(0);
  });

  it('normalizeNicotine survives junk and fixes bad fields', () => {
    expect(normalizeNicotine(null)).toEqual(emptyNicotineState());
    expect(normalizeNicotine('x')).toEqual(emptyNicotineState());
    const n = normalizeNicotine({
      products: [
        { id: 'a', kind: 'vape', unit: 'cigs', amount: 1.5, strengthMg: 20, active: true },
        { id: 'a', kind: 'vape', unit: 'ml', amount: 9, strengthMg: 20 }, // duplicate id
        { id: 'b', kind: 'nope' },
        { kind: 'vape' },
        { id: 'c', kind: 'cigarettes', unit: 'packs', amount: 1e9, strengthMg: -4, active: false },
      ],
      settings: {
        useInCalculations: false,
        sharing: 'bogus',
        surfaces: { sleep: false, rpe: 'x' },
      },
      updatedAt: 7,
    });
    expect(n.products.map((p) => p.id)).toEqual(['a', 'c']);
    expect(n.products[0].unit).toBe('ml'); // invalid unit falls back to the kind's first
    expect(n.products[1]).toMatchObject({ amount: 500, strengthMg: 0, active: false });
    expect(n.settings.useInCalculations).toBe(false);
    expect(n.settings.sharing).toBe('off');
    expect(n.settings.surfaces.sleep).toBe(false);
    expect(n.settings.surfaces.rpe).toBe(false); // junk falls back to the default: experimental = off
    expect(n.settings.surfaces.readiness).toBe(true);
    expect(n.updatedAt).toBe(7);
  });

  it('a legacy document without explicit surface values gets the experimental ones off', () => {
    for (const settings of [undefined, {}, { useInCalculations: true }, { surfaces: {} }]) {
      const n = normalizeNicotine({ products: [{ ...vape }], settings, updatedAt: 3 });
      expect(n.settings.useInCalculations).toBe(true); // the master default stays
      for (const k of EXPERIMENTAL_SURFACES) expect(n.settings.surfaces[k], k).toBe(false);
      for (const k of EVIDENCE_SURFACES) expect(n.settings.surfaces[k], k).toBe(true);
      // So nothing experimental is applied until the user switches it on.
      const fx = nicotineEffects(n)!;
      expect(fx.warmupMin).toEqual({ low: 0, high: 0 });
      expect(fx.rpe).toEqual({ low: 0, high: 0 });
      expect(fx.readiness.high).toBeLessThan(1);
    }
  });

  it('an explicit value the user set is kept, either way (current version)', () => {
    const n = normalizeNicotine({
      products: [{ ...vape }],
      settings: { version: 2, surfaces: { rpe: true, warmup: true, readiness: false } },
    });
    expect(n.settings.surfaces.rpe).toBe(true);
    expect(n.settings.surfaces.warmup).toBe(true);
    expect(n.settings.surfaces.readiness).toBe(false);
    expect(n.settings.surfaces.rest).toBe(false);
    const fx = nicotineEffects(n)!;
    expect(fx.rpe.high).toBeLessThan(0 + 1e-9);
    expect(fx.rpe.low).toBeLessThan(0); // functional once on
    expect(fx.warmupMin.high).toBeGreaterThan(0);
  });

  it('a document below version 2 (or without one) resets the experimental surfaces once, even when every key was explicit', () => {
    const allOn = Object.fromEntries(NICOTINE_SURFACES.map((k) => [k, true]));
    for (const version of [undefined, 1, 0, 'x', Number.NaN]) {
      const n = normalizeNicotine({
        products: [{ ...vape }],
        settings: { version, useInCalculations: false, surfaces: { ...allOn, sleep: false } },
      });
      expect(n.settings.version).toBe(2);
      for (const k of EXPERIMENTAL_SURFACES) expect(n.settings.surfaces[k], k).toBe(false);
      // The other choices survive.
      expect(n.settings.surfaces.sleep).toBe(false);
      expect(n.settings.surfaces.readiness).toBe(true);
      expect(n.settings.useInCalculations).toBe(false);
    }
  });

  it('a document already at version 2 keeps its explicit experimental choices; saving again is stable', () => {
    const allOn = Object.fromEntries(NICOTINE_SURFACES.map((k) => [k, true]));
    const n = normalizeNicotine({ products: [], settings: { version: 2, surfaces: allOn } });
    for (const k of NICOTINE_SURFACES) expect(n.settings.surfaces[k], k).toBe(true);
    const again = normalizeNicotine(JSON.parse(JSON.stringify(n)));
    expect(again.settings).toEqual(n.settings);
    // A migrated legacy document, read again, is at the current version and stays as it is.
    const m = normalizeNicotine({ settings: { surfaces: allOn } });
    m.settings.surfaces.rpe = true;
    expect(normalizeNicotine(JSON.parse(JSON.stringify(m))).settings.surfaces.rpe).toBe(true);
    expect(defaultNicotineSettings().version).toBe(2);
  });

  it('experimental surfaces are exactly the ones with no research (confidence none)', () => {
    const fromTable = [
      ...new Set(
        (Object.keys(SURFACE_COEFFS) as NicotineEffectKey[])
          .filter((k) => SURFACE_COEFFS[k].confidence === 'none')
          .map((k) => SURFACE_COEFFS[k].surface),
      ),
    ].sort();
    expect(fromTable).toEqual([...EXPERIMENTAL_SURFACES].sort());
    for (const k of Object.keys(SURFACE_COEFFS) as NicotineEffectKey[])
      expect(SURFACE_COEFFS[k].experimental).toBe(SURFACE_COEFFS[k].confidence === 'none');
  });
});

describe('SURFACE_COEFFS table shape', () => {
  const KEYS = Object.keys(SURFACE_COEFFS) as NicotineEffectKey[];
  it('has the 7 numeric surfaces, each with the same fields and a source slot', () => {
    expect(KEYS.sort()).toEqual(
      [
        'deloadThreshold',
        'progressionStep',
        'readiness',
        'restPct',
        'rpe',
        'sleepMin',
        'warmupMin',
      ].sort(),
    );
    for (const k of KEYS) {
      const c = SURFACE_COEFFS[k];
      expect(Object.keys(c).sort()).toEqual(
        [
          'cap',
          'confidence',
          'experimental',
          'halfScale',
          'mode',
          'sign',
          'source',
          'surface',
        ].sort(),
      );
      expect(c.cap).toBeGreaterThan(0);
      expect(c.halfScale).toBeGreaterThan(0);
      expect(['mult', 'add']).toContain(c.mode);
      expect([-1, 1]).toContain(c.sign);
      expect(NICOTINE_SURFACES).toContain(c.surface);
      expect(['moderate', 'weak', 'none']).toContain(c.confidence);
      expect(typeof c.experimental).toBe('boolean');
      if (c.confidence === 'none') expect(c.source).toBe(NO_SOURCE);
      else expect(c.source.length).toBeGreaterThan(10);
    }
  });

  it('readiness and sleep are weak-evidence surfaces with caps from the research priors', () => {
    expect(SURFACE_COEFFS.readiness).toMatchObject({ cap: 0.05, confidence: 'weak' });
    expect(SURFACE_COEFFS.sleepMin).toMatchObject({ cap: 15, confidence: 'weak' });
    expect(SURFACE_COEFFS.readiness.source).toMatch(/Dinas/);
    expect(SURFACE_COEFFS.sleepMin.source).toMatch(/Catoire/);
  });
});

describe('sources list', () => {
  it('has a short citation per topic and nothing is marked approx. any more', () => {
    expect(NICOTINE_SOURCES.map((x) => x.topic).sort()).toEqual([
      'absorb',
      'heated',
      'hrv',
      'sleep',
      'vape',
    ]);
    for (const x of NICOTINE_SOURCES) expect(x.cite.length).toBeGreaterThan(10);
    expect(NICOTINE_SOURCES.some((x) => x.approx)).toBe(false);
    expect(NICOTINE_SOURCES.find((x) => x.topic === 'hrv')!.cite).toMatch(/systematic review/);
    expect(NICOTINE_SOURCES.find((x) => x.topic === 'sleep')!.cite).toMatch(/Zhang/);
  });
});
