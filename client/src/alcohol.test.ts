import { describe, expect, it } from 'vitest';
import {
  ALCOHOL_EFFECT_KEYS,
  ALCOHOL_SETTINGS_VERSION,
  ALCOHOL_SURFACES,
  EXPERIMENTAL_SURFACES,
  NEUTRAL,
  RANGE_LOW_SHARE,
  SURFACE_COEFFS,
  alcoholEffects,
  alcoholEffectsFor,
  ALCOHOL_DISCLAIMER_EN,
  ALCOHOL_DISCLAIMER_KEY,
  ALCOHOL_SOURCES,
  CHECKIN_FROM_HOUR,
  MAX_CHECKIN_DAYS,
  addDays,
  alcoholLoad,
  alcoholWeekActual,
  cleanUsualDays,
  dayKey,
  eveningGrams,
  normalizeCheckins,
  pendingAlcoholCheckin,
  usualOccasionGrams,
  defaultAlcoholSettings,
  effectsForDay,
  effectsForLoad,
  emptyAlcoholState,
  hasAlcoholData,
  magnitude,
  newAlcoholEntry,
  normalizeAlcohol,
  normalizeAlcoholEntry,
  surfaceOn,
  surfacesOnCount,
  weekdayIndex,
  type AlcoholEffectKey,
} from './alcohol';
import type { AlcoholEntry, AlcoholState } from './types';

const beer = (servings: number, over: Partial<AlcoholEntry> = {}): AlcoholEntry => ({
  id: 'b',
  itemId: 'beerRegular',
  servingMl: 500,
  servingsPerWeek: servings,
  active: true,
  ...over,
});
/** Every surface on, whatever the placeholder defaults say. */
const allOn = (over: Partial<AlcoholState['settings']> = {}): AlcoholState['settings'] => {
  const s = defaultAlcoholSettings();
  for (const k of ALCOHOL_SURFACES) s.surfaces[k] = true;
  return { ...s, ...over };
};
const state = (entries: AlcoholEntry[], settings = allOn()): AlcoholState => ({
  entries,
  checkins: {},
  settings,
  updatedAt: 1,
});
const mid = (r: { low: number; high: number }) => (r.low + r.high) / 2;

// Monday 2026-09-28 ... Sunday 2026-10-04 (local days, as the app keys them).
const DAYS = [
  '2026-09-28',
  '2026-09-29',
  '2026-09-30',
  '2026-10-01',
  '2026-10-02',
  '2026-10-03',
  '2026-10-04',
];

describe('coefficient table', () => {
  it('every entry has a source, a confidence and a gating surface; placeholders are experimental', () => {
    for (const k of ALCOHOL_EFFECT_KEYS) {
      const c = SURFACE_COEFFS[k];
      expect(c.source.length).toBeGreaterThan(0);
      expect(['moderate', 'weak', 'none']).toContain(c.confidence);
      expect(ALCOHOL_SURFACES).toContain(c.surface);
      expect(c.cap).toBeGreaterThan(0);
      expect(c.halfScaleG).toBeGreaterThan(0);
      // Nothing without research may be switched on by default.
      if (c.confidence === 'none') expect(c.experimental).toBe(true);
    }
  });

  it('only the readiness and sleep numbers are next-day ones', () => {
    expect(
      ALCOHOL_EFFECT_KEYS.filter((k) => SURFACE_COEFFS[k].sessionHalfG !== null).sort(),
    ).toEqual(['readiness', 'sleepMin']);
  });
});

describe('weekly load', () => {
  it('is grams a week and the even daily share', () => {
    const l = alcoholLoad([beer(4)]);
    expect(l.gramsPerWeek).toBeCloseTo(78.9, 1);
    expect(l.gramsPerDay).toBeCloseTo(78.9 / 7, 1);
    expect(alcoholLoad([])).toEqual({ gramsPerWeek: 0, gramsPerDay: 0 });
  });
});

describe('effects curve', () => {
  it('is neutral at zero and strictly increasing without ever reaching the cap', () => {
    let prev = 0;
    for (const g of [0, 10, 50, 100, 200, 400, 800, 1600]) {
      const m = magnitude(1, 150, g);
      expect(m).toBeGreaterThanOrEqual(prev);
      if (g > 0) expect(m).toBeGreaterThan(prev);
      expect(m).toBeLessThan(1);
      prev = m;
    }
    expect(magnitude(1, 150, 0)).toBe(0);
    expect(magnitude(1, 150, 150)).toBeCloseTo(0.5, 6); // half scale = half the cap
    expect(magnitude(1, 150, -5)).toBe(0);
  });

  it('every key moves monotonically with the weekly grams (before saturation) and stays in its cap', () => {
    for (const k of ALCOHOL_EFFECT_KEYS) {
      const c = SURFACE_COEFFS[k];
      const dev = (g: number) =>
        Math.abs(
          mid(effectsForLoad({ gramsPerWeek: g, gramsPerDay: g / 7 }, allOn().surfaces)[k]) -
            NEUTRAL[c.mode],
        );
      const grid = [0, 20, 60, 120, 240];
      for (let i = 1; i < grid.length; i++)
        expect(dev(grid[i]), k).toBeGreaterThan(dev(grid[i - 1]));
      expect(dev(1e6), k).toBeLessThanOrEqual(c.cap);
    }
  });

  it('direction and range: readiness lowers, sleep need raises, low <= high, low is the milder end', () => {
    const fx = effectsForLoad({ gramsPerWeek: 150, gramsPerDay: 21 }, allOn().surfaces);
    expect(fx.readiness.high).toBeLessThan(1);
    expect(fx.readiness.low).toBeLessThan(fx.readiness.high);
    expect(fx.sleepMin.low).toBeGreaterThan(0);
    for (const k of ALCOHOL_EFFECT_KEYS) {
      expect(fx[k].low).toBeLessThanOrEqual(fx[k].high);
      const c = SURFACE_COEFFS[k];
      const full = Math.abs((c.sign === -1 ? fx[k].low : fx[k].high) - NEUTRAL[c.mode]);
      const mild = Math.abs((c.sign === -1 ? fx[k].high : fx[k].low) - NEUTRAL[c.mode]);
      expect(mild).toBeCloseTo(full * RANGE_LOW_SHARE, 3);
    }
  });

  it('a switched-off surface stays neutral', () => {
    const s = allOn().surfaces;
    s.sleep = false;
    const fx = effectsForLoad({ gramsPerWeek: 300, gramsPerDay: 43 }, s);
    expect(fx.sleepMin).toEqual({ low: 0, high: 0 });
    expect(fx.readiness.high).toBeLessThan(1);
  });
});

describe('alcoholEffects', () => {
  it('is null when the master switch is off, there is nothing active, or the state is missing', () => {
    expect(alcoholEffects(state([beer(4)], allOn({ useInCalculations: false })))).toBeNull();
    expect(alcoholEffects(state([]))).toBeNull();
    expect(alcoholEffects(state([beer(4, { active: false })]))).toBeNull();
    expect(alcoholEffects(state([beer(0)]))).toBeNull();
    expect(alcoholEffects(undefined)).toBeNull();
    expect(alcoholEffects(null)).toBeNull();
    expect(alcoholEffects({} as AlcoholState)).toBeNull();
    expect(alcoholEffectsFor(undefined, '2026-10-01')).toBeNull();
  });

  it('is on for an active drink, and a from-time-to-time drink gives a small effect', () => {
    const some = alcoholEffects(state([beer(4)]))!;
    const rare = alcoholEffects(state([beer(0, { occasional: true })]))!;
    expect(some.readiness.high).toBeLessThan(1);
    expect(rare.readiness.high).toBeLessThan(1);
    expect(rare.readiness.high).toBeGreaterThan(some.readiness.high);
    expect(1 - rare.readiness.high).toBeLessThan((1 - some.readiness.high) / 2);
  });
});

describe('usually drink on (day-aware)', () => {
  const FRIDAY = 4;
  const st = (days: number[], servings = 6) => state([beer(servings)], allOn({ usualDays: days }));

  it('weekday index: 0 = Monday ... 6 = Sunday, for strings, dates and timestamps', () => {
    expect(DAYS.map((d) => weekdayIndex(d))).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(weekdayIndex(new Date(2026, 9, 3, 23, 59))).toBe(5);
    expect(weekdayIndex(new Date(2026, 9, 4, 0, 1).getTime())).toBe(6);
    expect(weekdayIndex('not a date')).toBeNull();
    expect(weekdayIndex(Number.NaN)).toBeNull();
  });

  it('no usual days: the flat weekly effect on every day', () => {
    const flat = alcoholEffects(st([]))!;
    for (const d of DAYS) expect(alcoholEffectsFor(st([]), d)).toEqual(flat);
  });

  it('with Friday set, the next-day numbers move only on Saturday', () => {
    for (const d of DAYS) {
      const fx = alcoholEffectsFor(st([FRIDAY]), d)!;
      const isSaturday = d === '2026-10-03';
      expect(fx.readiness.high < 1, d).toBe(isSaturday);
      expect(fx.sleepMin.high > 0, d).toBe(isSaturday);
    }
  });

  it('non next-day numbers keep the flat weekly curve on every day', () => {
    const flat = alcoholEffects(st([FRIDAY]))!;
    for (const d of DAYS) {
      const fx = alcoholEffectsFor(st([FRIDAY]), d)!;
      expect(fx.deloadThreshold).toEqual(flat.deloadThreshold);
      expect(fx.progressionStep).toEqual(flat.progressionStep);
    }
  });

  it('the day after is bigger than the flat average, and Sunday wraps to Monday', () => {
    const flat = alcoholEffects(st([]))!;
    const sat = alcoholEffectsFor(st([FRIDAY]), '2026-10-03')!;
    expect(sat.readiness.high).toBeLessThan(flat.readiness.high);
    const sun = alcoholEffectsFor(st([6]), '2026-09-28')!; // Monday after a Sunday
    expect(sun.readiness.high).toBeLessThan(1);
    expect(alcoholEffectsFor(st([6]), '2026-10-04')!.readiness.high).toBe(1);
  });

  it('the same weekly grams over more days is a smaller hit on each day after', () => {
    const one = alcoholEffectsFor(st([4], 8), '2026-10-03')!;
    const two = alcoholEffectsFor(st([4, 5], 8), '2026-10-03')!; // Saturday follows Friday only
    expect(1 - two.readiness.high).toBeLessThan(1 - one.readiness.high);
  });

  it('more servings means a bigger day-after effect (monotonic) and stays within the cap', () => {
    let prev = 0;
    for (const n of [1, 2, 3, 6, 12, 150]) {
      // (the curve saturates, the 4-decimal rounding ties only far above 12 servings)
      if (n === 150) break;
      const fx = alcoholEffectsFor(st([FRIDAY], n), '2026-10-03')!;
      const d = 1 - fx.readiness.high;
      expect(d).toBeGreaterThan(prev);
      expect(d).toBeLessThanOrEqual(SURFACE_COEFFS.readiness.cap);
      prev = d;
    }
    const huge = alcoholEffectsFor(st([FRIDAY], 150), '2026-10-03')!;
    expect(1 - huge.readiness.high).toBeLessThanOrEqual(SURFACE_COEFFS.readiness.cap + 1e-9);
    expect(1 - huge.readiness.low).toBeLessThanOrEqual(SURFACE_COEFFS.readiness.cap + 1e-9);
  });

  it('a switched-off readiness surface stays neutral even on the day after', () => {
    const s = allOn({ usualDays: [FRIDAY] });
    s.surfaces.readiness = false;
    const fx = alcoholEffectsFor(state([beer(6)], s), '2026-10-03')!;
    expect(fx.readiness).toEqual({ low: 1, high: 1 });
    expect(fx.sleepMin.high).toBeGreaterThan(0);
  });

  it('an unreadable day falls back to the flat effect; effectsForDay is pure', () => {
    const load = alcoholLoad([beer(6)]);
    const s = allOn({ usualDays: [FRIDAY] });
    expect(effectsForDay(load, s, 'garbage')).toEqual(effectsForLoad(load, s.surfaces));
  });
});

describe('surfaces and defaults', () => {
  it('experimental surfaces are derived from the table and start off; the rest start on', () => {
    const d = defaultAlcoholSettings();
    expect(d.version).toBe(ALCOHOL_SETTINGS_VERSION);
    expect(d.useInCalculations).toBe(true);
    expect(d.sharing).toBe('off');
    expect(d.usualDays).toEqual([]);
    expect(d.regionOverride).toBeUndefined();
    for (const s of ALCOHOL_SURFACES)
      expect(d.surfaces[s]).toBe(!EXPERIMENTAL_SURFACES.includes(s));
    expect(d.surfaces.trends).toBe(true);
    expect(d.surfaces.afterWorkoutHints).toBe(true);
  });

  it('surfaceOn and surfacesOnCount', () => {
    const s = allOn();
    expect(surfaceOn(s, 'sleep')).toBe(true);
    s.surfaces.sleep = false;
    expect(surfaceOn(s, 'sleep')).toBe(false);
    expect(surfacesOnCount(s)).toBe(ALCOHOL_SURFACES.length - 1);
    expect(surfaceOn({ ...s, useInCalculations: false }, 'readiness')).toBe(false);
  });
});

describe('tolerant parsing (legacy and hostile states)', () => {
  it('garbage becomes an empty default state', () => {
    for (const raw of [null, undefined, 5, 'x', [], {}]) {
      const s = normalizeAlcohol(raw);
      expect(s.entries).toEqual([]);
      expect(s.settings).toEqual(defaultAlcoholSettings());
      expect(s.updatedAt).toBe(0);
    }
  });

  it('keeps valid entries, drops unknown drinks and duplicate ids, clamps numbers', () => {
    const s = normalizeAlcohol({
      entries: [
        { id: 'a', itemId: 'spWhisky', servingMl: 40, servingsPerWeek: 3, active: true },
        { id: 'a', itemId: 'beerLight', servingMl: 330, servingsPerWeek: 1 },
        { id: 'b', itemId: 'moonshine', servingMl: 40, servingsPerWeek: 3 },
        { id: '', itemId: 'beerLight' },
        { id: 'c', itemId: 'wineRed', servingMl: 99999, servingsPerWeek: -4, active: false },
        { id: 'd', itemId: 'beerLight', servingMl: 'x', servingsPerWeek: 2.26, occasional: true },
        null,
        7,
      ],
      updatedAt: 12,
    });
    expect(s.entries.map((e) => e.id)).toEqual(['a', 'c', 'd']);
    expect(s.entries[1]).toMatchObject({ servingMl: 2000, servingsPerWeek: 0, active: false });
    expect(s.entries[2]).toMatchObject({ servingMl: 500, servingsPerWeek: 2.3, occasional: true });
    expect(s.updatedAt).toBe(12);
  });

  it('settings: validates every field; a stray "full" sharing is the private default', () => {
    const s = normalizeAlcohol({
      entries: [],
      settings: {
        useInCalculations: false,
        sharing: 'full',
        surfaces: { sleep: false, readiness: 'yes', bogus: true },
        usualDays: [4, 4, 6, -1, 7, 2.5, 'x', 0],
        regionOverride: 'us',
      },
    });
    expect(s.settings.useInCalculations).toBe(false);
    expect(s.settings.sharing).toBe('off');
    expect(s.settings.surfaces.sleep).toBe(false);
    expect(s.settings.surfaces.readiness).toBe(defaultAlcoholSettings().surfaces.readiness);
    expect('bogus' in s.settings.surfaces).toBe(false);
    expect(s.settings.usualDays).toEqual([0, 4, 6]);
    expect(s.settings.regionOverride).toBe('us');
    expect(
      normalizeAlcohol({ settings: { regionOverride: 'mars' } }).settings.regionOverride,
    ).toBeUndefined();
    expect(normalizeAlcohol({ settings: { sharing: 'effects' } }).settings.sharing).toBe('effects');
  });

  it('an older document without usualDays or regionOverride loads with the defaults', () => {
    const s = normalizeAlcohol({
      entries: [
        { id: 'x', itemId: 'beerRegular', servingMl: 500, servingsPerWeek: 2, active: true },
      ],
      settings: { version: 1, useInCalculations: true, surfaces: {}, sharing: 'off' },
      updatedAt: 3,
    });
    expect(s.settings.usualDays).toEqual([]);
    expect(s.entries).toHaveLength(1);
  });

  it('normalizeAlcoholEntry / newAlcoholEntry / cleanUsualDays / hasAlcoholData', () => {
    expect(normalizeAlcoholEntry({ id: 'x', itemId: 'rtd' })).toMatchObject({
      servingMl: 440,
      servingsPerWeek: 0,
      active: true,
    });
    expect(newAlcoholEntry('spGin', 'g')).toMatchObject({
      itemId: 'spGin',
      servingMl: 40,
      active: true,
    });
    expect(newAlcoholEntry('spGin', 'g', 25).servingMl).toBe(25);
    expect(cleanUsualDays('x')).toEqual([]);
    expect(hasAlcoholData(emptyAlcoholState())).toBe(false);
    expect(hasAlcoholData(state([beer(1)]))).toBe(true);
    expect(hasAlcoholData(undefined)).toBe(false);
  });
});

describe('type of every effect key', () => {
  it('has exactly the keys the engines read', () => {
    const keys: AlcoholEffectKey[] = [
      'readiness',
      'sleepMin',
      'deloadThreshold',
      'progressionStep',
    ];
    expect([...ALCOHOL_EFFECT_KEYS].sort()).toEqual([...keys].sort());
  });
});

describe('evidence-based coefficients', () => {
  it('readiness and sleep are weak-evidence and on by default; deload and progression stay experimental', () => {
    for (const k of ['readiness', 'sleepMin'] as const) {
      expect(SURFACE_COEFFS[k].confidence).toBe('weak');
      expect(SURFACE_COEFFS[k].experimental).toBe(false);
      expect(SURFACE_COEFFS[k].source).toMatch(/Pietilä 2018|Ebrahim 2013/);
      expect(SURFACE_COEFFS[k].source).toMatch(/de Zambotti 2021/);
    }
    for (const k of ['deloadThreshold', 'progressionStep'] as const) {
      expect(SURFACE_COEFFS[k].confidence).toBe('none');
      expect(SURFACE_COEFFS[k].experimental).toBe(true);
    }
    expect(SURFACE_COEFFS.readiness.cap).toBe(0.1);
    expect(SURFACE_COEFFS.sleepMin.cap).toBe(30);
    expect([...EXPERIMENTAL_SURFACES].sort()).toEqual(['fatigue', 'progression']);
    const d = defaultAlcoholSettings().surfaces;
    expect([d.readiness, d.sleep, d.trends, d.afterWorkoutHints]).toEqual([true, true, true, true]);
    expect([d.fatigue, d.progression]).toEqual([false, false]);
  });

  it('one occasion lands inside the published prior ranges (20 g and 60 g)', () => {
    const at = (grams: number) =>
      effectsForDay(
        { gramsPerWeek: grams, gramsPerDay: grams / 7 },
        { surfaces: allOn().surfaces, usualDays: [4] },
        '2026-10-03',
      );
    const g20 = at(20);
    expect(1 - g20.readiness.high).toBeGreaterThan(0);
    expect(1 - g20.readiness.high).toBeLessThanOrEqual(0.03 + 0.01);
    expect(g20.sleepMin.high).toBeLessThanOrEqual(15);
    const g60 = at(60);
    expect(1 - g60.readiness.high).toBeGreaterThanOrEqual(0.03);
    expect(1 - g60.readiness.high).toBeLessThanOrEqual(0.1);
    expect(g60.sleepMin.high).toBeGreaterThanOrEqual(15);
    expect(g60.sleepMin.high).toBeLessThanOrEqual(30);
  });

  it('the flat weekly view is conservative: a weekly amount is read as an ordinary day', () => {
    const flat = effectsForLoad({ gramsPerWeek: 140, gramsPerDay: 20 }, allOn().surfaces);
    const night = effectsForDay(
      { gramsPerWeek: 140, gramsPerDay: 20 },
      { surfaces: allOn().surfaces, usualDays: [4] },
      '2026-10-03',
    );
    expect(1 - flat.readiness.high).toBeLessThan(1 - night.readiness.high);
  });

  it('lists the sources and the disclaimer for the UI', () => {
    expect(ALCOHOL_SOURCES.map((x) => x.topic)).toEqual(
      expect.arrayContaining(['readiness', 'heartRate', 'sleep', 'muscle', 'strength', 'review']),
    );
    for (const x of ALCOHOL_SOURCES) expect(x.cite.length).toBeGreaterThan(5);
    expect(ALCOHOL_DISCLAIMER_KEY).toBe('alcoholDisclaimer');
    expect(ALCOHOL_DISCLAIMER_EN).toMatch(/not medical advice/);
    expect(ALCOHOL_DISCLAIMER_EN).toMatch(/no proven safe level/);
  });
});

describe('day check-ins', () => {
  // Beer 0.5 L x 6 = about 118 g a week; Friday + Saturday = about 59 g an evening.
  const base = (usualDays: number[], checkins: AlcoholState['checkins'] = {}): AlcoholState => ({
    ...state([beer(6)], allOn({ usualDays, checkinsOn: true })),
    checkins,
  });
  const at = (day: string, h = 12) => new Date(`${day}T${String(h).padStart(2, '0')}:00:00`);

  it('dayKey / addDays', () => {
    expect(dayKey(new Date(2026, 9, 3, 23, 59))).toBe('2026-10-03');
    expect(dayKey('nope')).toBeNull();
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-10-03', -3)).toBe('2026-09-30');
  });

  it('usualOccasionGrams is the weekly grams over the usual days', () => {
    expect(usualOccasionGrams([beer(6)], [4, 5])).toBeCloseTo(59.2, 1);
    expect(usualOccasionGrams([beer(6)], [])).toBe(0);
  });

  it('a check-in replaces the usual assumption for the day after: none = neutral', () => {
    const st = base([4], { '2026-10-02': { drank: false } });
    const fx = alcoholEffectsFor(st, '2026-10-03')!;
    expect(fx.readiness).toEqual({ low: 1, high: 1 });
    expect(fx.sleepMin).toEqual({ low: 0, high: 0 });
    // The flat numbers do not follow the day.
    expect(fx.deloadThreshold.high).toBeLessThan(1);
  });

  it('usual = the usual per-occasion grams, custom = the typed grams (more grams, bigger effect)', () => {
    const none = alcoholEffectsFor(base([4]), '2026-10-03')!; // no answer: assumption
    const usual = alcoholEffectsFor(
      base([4], { '2026-10-02': { drank: true, grams: usualOccasionGrams([beer(6)], [4]) } }),
      '2026-10-03',
    )!;
    expect(usual).toEqual(none);
    const small = alcoholEffectsFor(
      base([4], { '2026-10-02': { drank: true, grams: 20 } }),
      '2026-10-03',
    )!;
    const big = alcoholEffectsFor(
      base([4], { '2026-10-02': { drank: true, grams: 300 } }),
      '2026-10-03',
    )!;
    expect(1 - small.readiness.high).toBeLessThan(1 - usual.readiness.high);
    expect(1 - big.readiness.high).toBeGreaterThan(1 - usual.readiness.high);
    // "drank" without grams = the usual evening.
    expect(alcoholEffectsFor(base([4], { '2026-10-02': { drank: true } }), '2026-10-03')).toEqual(
      none,
    );
  });

  it('an unplanned drinking day counts when answered; an unanswered non-usual day is neutral', () => {
    const st = base([4], { '2026-10-04': { drank: true, grams: 40 } }); // a Sunday, not usual
    expect(alcoholEffectsFor(st, '2026-10-05')!.readiness.high).toBeLessThan(1);
    expect(alcoholEffectsFor(st, '2026-10-04')!.readiness.high).toBe(1); // Saturday had nothing
    expect(eveningGrams('2026-10-03', [4], 50, {})).toBe(0);
    expect(eveningGrams('2026-10-02', [4], 50, {})).toBe(50);
  });

  it('defaults: check-ins off; normalize keeps a stored boolean and turns anything else off', () => {
    expect(defaultAlcoholSettings().checkinsOn).toBe(false);
    expect(normalizeAlcohol(undefined).settings.checkinsOn).toBe(false);
    expect(normalizeAlcohol({ settings: { usualDays: [4] } }).settings.checkinsOn).toBe(false);
    for (const bad of ['yes', 1, null, {}])
      expect(normalizeAlcohol({ settings: { checkinsOn: bad } }).settings.checkinsOn).toBe(false);
    expect(normalizeAlcohol({ settings: { checkinsOn: true } }).settings.checkinsOn).toBe(true);
    expect(normalizeAlcohol({ settings: { checkinsOn: false } }).settings.checkinsOn).toBe(false);
  });

  it('pending is null when "Ask me on Today" is off, however the rest is set', () => {
    const on = base([4]);
    expect(pendingAlcoholCheckin(at('2026-10-03', 9), on)).not.toBeNull();
    const off = { ...on, settings: { ...on.settings, checkinsOn: false } };
    expect(pendingAlcoholCheckin(at('2026-10-03', 9), off)).toBeNull();
    const legacy = { ...on, settings: { ...on.settings } } as AlcoholState;
    delete (legacy.settings as Partial<AlcoholState['settings']>).checkinsOn;
    expect(pendingAlcoholCheckin(at('2026-10-03', 9), legacy)).toBeNull();
  });

  it('check-ins are ignored without usual days (flat view)', () => {
    const st = base([], { '2026-10-02': { drank: false } });
    expect(alcoholEffectsFor(st, '2026-10-03')).toEqual(alcoholEffects(st));
  });

  it('pending: yesterday after a usual day; today only from the evening; one at a time, newest first', () => {
    const st = base([4]); // Friday
    // Saturday morning: ask about Friday.
    expect(pendingAlcoholCheckin(at('2026-10-03', 9), st)).toMatchObject({ date: '2026-10-02' });
    expect(pendingAlcoholCheckin(at('2026-10-03', 9), st)!.usualGrams).toBeCloseTo(118.4, 1);
    // Friday itself: not before the evening, then from CHECKIN_FROM_HOUR.
    expect(pendingAlcoholCheckin(at('2026-10-02', CHECKIN_FROM_HOUR - 1), st)).toBeNull();
    expect(pendingAlcoholCheckin(at('2026-10-02', CHECKIN_FROM_HOUR), st)).toMatchObject({
      date: '2026-10-02',
    });
    // Newest first, then an older one, never beyond 3 days.
    const two = base([3, 4]);
    expect(pendingAlcoholCheckin(at('2026-10-03', 9), two)!.date).toBe('2026-10-02');
    const answered = base([3, 4], { '2026-10-02': { drank: false } });
    expect(pendingAlcoholCheckin(at('2026-10-03', 9), answered)!.date).toBe('2026-10-01');
    expect(pendingAlcoholCheckin(at('2026-10-06', 9), st)).toBeNull(); // Friday is 4 days back
    expect(pendingAlcoholCheckin(at('2026-10-05', 9), st)!.date).toBe('2026-10-02'); // 3 days back
    // Answered: nothing pending.
    expect(
      pendingAlcoholCheckin(at('2026-10-03', 9), base([4], { '2026-10-02': { drank: true } })),
    ).toBeNull();
  });

  it('pending needs master on, usual days, an active drink and a non-zero amount', () => {
    const when = at('2026-10-03', 9);
    expect(pendingAlcoholCheckin(when, base([]))).toBeNull();
    expect(
      pendingAlcoholCheckin(when, {
        ...base([4]),
        settings: allOn({ usualDays: [4], useInCalculations: false }),
      }),
    ).toBeNull();
    expect(pendingAlcoholCheckin(when, { ...base([4]), entries: [] })).toBeNull();
    expect(
      pendingAlcoholCheckin(when, { ...base([4]), entries: [beer(6, { active: false })] }),
    ).toBeNull();
    expect(pendingAlcoholCheckin(when, undefined)).toBeNull();
    expect(pendingAlcoholCheckin('garbage', base([4]))).toBeNull();
  });

  it('week actual: sums the answers since the week start, counts unanswered usual days', () => {
    const st = base([4, 5], {
      '2026-09-28': { drank: true, grams: 30 }, // Monday
      '2026-10-02': { drank: true, grams: 70 }, // Friday
    });
    const w = alcoholWeekActual(st, at('2026-10-03', 12))!; // Saturday
    expect(w).toMatchObject({
      grams: 100,
      answeredDays: 2,
      drinkDays: 2,
      unansweredUsualDays: 1, // Saturday itself
      from: '2026-09-28',
      to: '2026-10-03',
    });
    expect(w.plannedGrams).toBeCloseTo(118.4, 1);
    // A Sunday-start week begins the day before.
    expect(alcoholWeekActual(st, at('2026-10-03', 12), 7)!.from).toBe('2026-09-27');
    expect(alcoholWeekActual(st, at('2026-10-03', 12), 7)!.grams).toBe(100);
    expect(alcoholWeekActual(st, 'nope')).toBeNull();
    expect(alcoholWeekActual(undefined, at('2026-10-03'))!.grams).toBe(0);
  });

  it('normalizeCheckins: valid keys only, grams clamped, zero grams = no alcohol, last 60 days kept', () => {
    const raw: Record<string, unknown> = {
      '2026-10-02': { drank: true, grams: 50.04, entryIds: ['a', 'a', '', 3] },
      '2026-10-01': { drank: true, grams: 0 },
      '2026-09-30': { drank: false, grams: 80 },
      '2026-09-29': { drank: true, grams: 99999 },
      '2026-02-31': { drank: true },
      'not-a-day': { drank: true },
      '2026-09-28': { drank: 'yes' },
      '2026-09-27': 5,
    };
    const c = normalizeCheckins(raw);
    expect(c).toEqual({
      '2026-10-02': { drank: true, grams: 50, entryIds: ['a'] },
      '2026-10-01': { drank: false },
      '2026-09-30': { drank: false },
      '2026-09-29': { drank: true, grams: 1000 },
    });
    const many: Record<string, unknown> = {};
    for (let i = 0; i < 90; i++) many[addDays('2026-10-02', -i)] = { drank: true };
    const kept = Object.keys(normalizeCheckins(many)).sort();
    expect(kept).toHaveLength(MAX_CHECKIN_DAYS);
    expect(kept.at(-1)).toBe('2026-10-02');
    expect(normalizeCheckins(null)).toEqual({});
    expect(normalizeCheckins([1])).toEqual({});
    expect(normalizeAlcohol({ checkins: { '2026-10-02': { drank: false } } }).checkins).toEqual({
      '2026-10-02': { drank: false },
    });
    expect(normalizeAlcohol({ entries: [] }).checkins).toEqual({});
  });
});
