import { describe, expect, it } from 'vitest';
import {
  CAFFEINE_DAILY_LIMIT_MG,
  CHECKIN_FROM_HOUR,
  CHECKIN_MAX_AGE_DAYS,
  EXPERIMENTAL_SURFACES,
  HABIT_MIN_DAYS,
  LATE_CAFFEINE_FROM_MIN,
  MAX_CHECKIN_DAYS,
  MAX_SUPPLEMENT_ENTRIES,
  NO_TRAINING_CONTEXT,
  SUPPLEMENT_COEFFS,
  SUPPLEMENT_EFFECT_KEYS,
  SUPPLEMENT_NEUTRAL,
  SUPPLEMENT_SETTINGS_VERSION,
  SUPPLEMENT_SURFACES,
  addDays,
  countedSupplementEntries,
  defaultSupplementSettings,
  dueSupplementEntries,
  emptySupplementState,
  habitWeekdays,
  hasSupplementData,
  isSupplementSharing,
  newSupplementEntry,
  normalizeSupplementCheckin,
  normalizeSupplementCheckins,
  normalizeSupplementEntry,
  normalizeSupplements,
  pendingSupplementCheckin,
  rampAt,
  supplementEffectsFor,
  supplementEffectsTypical,
  supplementProteinGramsFor,
  supplementSurfaceOn,
  supplementSurfacesOnCount,
  supplementWarnings,
  trainingDayResolver,
  usualTrainingStartMin,
  weeksSince,
  type SupplementContext,
} from './supplements';
import type { SupplementEntry, SupplementId, SupplementState } from './types';

// Fixed calendar: Fri 2026-10-02, Sat 10-03, Sun 10-04, Mon 10-05 ... (local time).
const T0 = new Date(2026, 8, 1, 10).getTime(); // 2026-09-01 10:00, the day the entries were saved
const ent = (itemId: SupplementId, over: Partial<SupplementEntry> = {}): SupplementEntry => ({
  ...newSupplementEntry(itemId, `e-${itemId}`, T0),
  ...over,
});
const state = (
  entries: SupplementEntry[],
  over: Partial<SupplementState['settings']> = {},
  checkins: SupplementState['checkins'] = {},
): SupplementState => ({
  entries,
  checkins,
  settings: { ...defaultSupplementSettings(), checkinsOn: true, ...over },
  updatedAt: 1,
});
const ctxOf = (
  trainingDays: string[],
  extra: Partial<SupplementContext> = {},
): SupplementContext => ({ isTrainingDay: (k) => trainingDays.includes(k), ...extra });
const ALL: SupplementContext = ctxOf([], { isTrainingDay: () => true });
const fx = (s: SupplementState, day: string, ctx: SupplementContext = ALL) =>
  supplementEffectsFor(s, day, ctx);

describe('coefficient table', () => {
  it('every entry has a source, a confidence, a gating surface and sane caps', () => {
    for (const k of SUPPLEMENT_EFFECT_KEYS) {
      const c = SUPPLEMENT_COEFFS[k];
      expect(c.source.length).toBeGreaterThan(20);
      expect(['strong', 'moderate', 'weak', 'none']).toContain(c.confidence);
      expect(SUPPLEMENT_SURFACES).toContain(c.surface);
      expect(c.lowCap).toBeLessThanOrEqual(c.highCap);
      expect(c.experimental).toBe(false);
    }
    expect([...SUPPLEMENT_EFFECT_KEYS].sort()).toEqual([
      'caffeineRpe',
      'caffeineSleepMin',
      'creatineBodyweightKg',
      'creatineStrength',
      'proteinGrams',
    ]);
  });

  it('cites the research and says so when a source is not re-verified', () => {
    expect(SUPPLEMENT_COEFFS.creatineStrength.source).toMatch(/Kreider 2017.*Lanhers 2017/);
    expect(SUPPLEMENT_COEFFS.caffeineRpe.source).toMatch(/Guest 2021/);
    expect(SUPPLEMENT_COEFFS.caffeineSleepMin.source).toMatch(/Gardiner 2023/);
    expect(SUPPLEMENT_COEFFS.caffeineSleepMin.source).toMatch(/not re-verified/);
    expect(SUPPLEMENT_COEFFS.proteinGrams.source).toMatch(/Jäger 2017.*Morton 2018/);
  });

  it('the published ranges: strength 0..+8 %, bodyweight +0.5..2 kg, RPE -0.5..-0.2, sleep 0..45 min', () => {
    const c = SUPPLEMENT_COEFFS;
    expect([c.creatineStrength.lowCap, c.creatineStrength.highCap]).toEqual([0, 0.08]);
    expect([c.creatineBodyweightKg.lowCap, c.creatineBodyweightKg.highCap]).toEqual([0.5, 2]);
    expect([c.caffeineRpe.lowCap, c.caffeineRpe.highCap, c.caffeineRpe.sign]).toEqual([
      0.2, 0.5, -1,
    ]);
    expect([c.caffeineSleepMin.lowCap, c.caffeineSleepMin.highCap]).toEqual([0, 45]);
  });

  it('no surface is experimental, so every switch starts on', () => {
    expect(EXPERIMENTAL_SURFACES).toEqual([]);
    const s = defaultSupplementSettings();
    for (const k of SUPPLEMENT_SURFACES) expect(s.surfaces[k]).toBe(true);
    expect(supplementSurfacesOnCount(s)).toBe(6);
    expect(supplementSurfaceOn(s, 'protein')).toBe(true);
    expect(supplementSurfaceOn({ ...s, useInCalculations: false }, 'protein')).toBe(false);
    expect(supplementSurfaceOn({ ...s, surfaces: { ...s.surfaces, rpe: false } }, 'rpe')).toBe(
      false,
    );
  });

  it('rampAt: linear up to the full weeks, flat after; no ramp = always full', () => {
    expect(rampAt({ rampFullWeeks: 12 }, 0)).toBe(0);
    expect(rampAt({ rampFullWeeks: 12 }, 6)).toBe(0.5);
    expect(rampAt({ rampFullWeeks: 12 }, 40)).toBe(1);
    expect(rampAt({ rampFullWeeks: 0 }, 0)).toBe(1);
  });
});

describe('creatine: strength expectation and bodyweight note', () => {
  const s = state([ent('creatine')]);

  it('ramps from startedAt: days in is small, 8 weeks is two thirds, 12+ weeks is the full +8 %', () => {
    const at = (day: string) => fx(s, day)!.creatineStrength;
    const week1 = at('2026-09-08');
    const week8 = at('2026-10-27');
    const week20 = at('2027-01-19');
    expect(week1.low).toBe(0);
    expect(week1.high).toBeGreaterThan(0);
    expect(week1.high).toBeLessThan(0.01);
    expect(week8.high).toBeCloseTo((0.08 * 8) / 12, 2);
    expect(week20).toEqual({ low: 0, high: 0.08 });
    expect(week1.high).toBeLessThan(week8.high);
    expect(week8.high).toBeLessThan(week20.high);
    expect(fx(s, '2030-01-01')!.creatineStrength.high).toBe(0.08); // never above the ceiling
  });

  it('is measured from the moment the entry was saved, not a chosen date', () => {
    const later = state([ent('creatine', { startedAt: new Date(2026, 9, 20, 9).getTime() })]);
    expect(fx(later, '2026-10-27')!.creatineStrength.high).toBeLessThan(
      fx(s, '2026-10-27')!.creatineStrength.high,
    );
    expect(weeksSince(T0, '2026-09-08')).toBeCloseTo(1, 1);
    expect(weeksSince(T0, '2026-08-01')).toBe(0);
  });

  it('does not count on days before the entry was saved', () => {
    expect(fx(s, '2026-08-31')).toBeNull();
    expect(fx(s, '2026-09-01')).not.toBeNull();
  });

  it('bodyweight note: about 0 at the start, +0.5..2 kg after two weeks, then stays', () => {
    expect(fx(s, '2026-09-01')!.creatineBodyweightKg.high).toBeLessThan(0.1);
    expect(fx(s, '2026-09-15')!.creatineBodyweightKg).toEqual({ low: 0.5, high: 2 });
    expect(fx(s, '2027-03-01')!.creatineBodyweightKg).toEqual({ low: 0.5, high: 2 });
  });

  it('a dose below 3 g scales the range down; 3 g and above is the full range', () => {
    expect(fx(state([ent('creatine', { dose: 1.5 })]), '2027-03-01')!.creatineStrength.high).toBe(
      0.04,
    );
    expect(fx(state([ent('creatine', { dose: 3 })]), '2027-03-01')!.creatineStrength.high).toBe(
      0.08,
    );
    expect(fx(state([ent('creatine', { dose: 5 })]), '2027-03-01')!.creatineStrength.high).toBe(
      0.08,
    );
  });

  it('only on days its schedule counts: training-day creatine is silent on a rest day', () => {
    const t = state([ent('creatine', { schedule: 'trainingDays' })]);
    const ctx = ctxOf(['2026-10-05']);
    expect(fx(t, '2026-10-05', ctx)!.creatineStrength.high).toBeGreaterThan(0);
    expect(fx(t, '2026-10-06', ctx)).toBeNull();
    expect(fx(s, '2026-10-06', ctx)).not.toBeNull(); // daily counts on both
  });

  it('is an expectation only: the low end is never above zero, every key is a plain range', () => {
    for (const day of ['2026-09-01', '2026-10-01', '2027-01-01'])
      expect(fx(s, day)!.creatineStrength.low).toBe(0);
    expect(Object.keys(fx(s, '2027-01-01')!).sort()).toEqual([...SUPPLEMENT_EFFECT_KEYS].sort());
  });

  it('two creatine entries do not add up: the best one sets the range', () => {
    const two = state([ent('creatine'), ent('creatine', { id: 'c2', dose: 5 })]);
    expect(fx(two, '2027-03-01')!.creatineStrength.high).toBe(0.08);
  });
});

describe('caffeine: RPE, late sleep and the pre-workout blend', () => {
  const caff = (over: Partial<SupplementEntry> = {}) => ent('caffeine', over);

  it('pre-workout caffeine on a training day: RPE 0.2 to 0.5 points lower', () => {
    expect(fx(state([caff({ dose: 300 })]), '2026-10-05')!.caffeineRpe).toEqual({
      low: -0.5,
      high: -0.2,
    });
  });

  it('scales with the dose per kg when the weight is known (3 mg/kg is the full effect)', () => {
    const r = fx(state([caff({ dose: 100 })]), '2026-10-05', {
      ...ALL,
      bodyWeightKg: 100,
    })!.caffeineRpe; // 1 mg/kg
    expect(r.high).toBeCloseTo(-0.2 / 3, 2);
    expect(r.low).toBeCloseTo(-0.5 / 3, 2);
    expect(fx(state([caff({ dose: 200 })]), '2026-10-05')!.caffeineRpe).toEqual({
      low: -0.5,
      high: -0.2,
    }); // unknown weight: 200 mg is the full effect
    expect(fx(state([caff({ dose: 100 })]), '2026-10-05')!.caffeineRpe.high).toBeCloseTo(-0.1, 2);
  });

  it('only on a training day, and only for a pre-workout timing', () => {
    expect(fx(state([caff({ schedule: 'daily' })]), '2026-10-05', ctxOf([]))).toBeNull();
    const morning = state([caff({ timing: 'morning', schedule: 'daily' })]);
    expect(fx(morning, '2026-10-05')).toBeNull(); // no RPE, not late: nothing moves
  });

  it('a pre-workout blend counts its assumed 200 mg of caffeine', () => {
    expect(fx(state([ent('preWorkout')]), '2026-10-05')!.caffeineRpe).toEqual({
      low: -0.5,
      high: -0.2,
    });
    expect(
      fx(state([ent('preWorkout', { dose: 0.5 })]), '2026-10-05')!.caffeineRpe.high,
    ).toBeCloseTo(-0.1, 2);
  });

  it('an evening dose costs sleep: up to 45 min at 400 mg, half at 200 mg, any day', () => {
    const evening = (mg: number) =>
      state([caff({ timing: 'evening', schedule: 'daily', dose: mg })]);
    const r = (mg: number) => fx(evening(mg), '2026-10-06', NO_TRAINING_CONTEXT)!;
    expect(r(400).caffeineSleepMin).toEqual({ low: 0, high: 45 });
    expect(r(200).caffeineSleepMin.high).toBe(22.5);
    expect(r(400).caffeineRpe).toEqual({ low: 0, high: 0 });
  });

  it('a pre-workout dose is late only for an evening trainer (usual start 15:00 or later)', () => {
    const s = state([caff({ dose: 400 })]);
    const at = (usual: number | null | undefined) =>
      fx(s, '2026-10-05', { ...ALL, usualTrainingStartMin: usual })!.caffeineSleepMin;
    expect(at(18 * 60).high).toBe(45);
    expect(at(LATE_CAFFEINE_FROM_MIN).high).toBe(45);
    expect(at(LATE_CAFFEINE_FROM_MIN - 15).high).toBe(0);
    expect(at(null).high).toBe(0); // unknown time: only the evening label counts
    expect(at(undefined).high).toBe(0);
    expect(fx(s, '2026-10-06', ctxOf(['2026-10-05'], { usualTrainingStartMin: 1080 }))).toBeNull();
  });

  it('a late dose from two entries adds up to the cap', () => {
    const s = state([
      caff({ timing: 'evening', schedule: 'daily', dose: 300 }),
      ent('preWorkout', { id: 'p', timing: 'evening', schedule: 'daily' }),
    ]);
    expect(fx(s, '2026-10-06', NO_TRAINING_CONTEXT)!.caffeineSleepMin.high).toBe(45);
  });
});

describe('protein from supplements', () => {
  it('whey counts its declared protein as extra grams, as a point range', () => {
    const s = state([ent('whey')]);
    expect(fx(s, '2026-10-06', NO_TRAINING_CONTEXT)!.proteinGrams).toEqual({ low: 20, high: 20 });
    expect(supplementProteinGramsFor(s, '2026-10-06', NO_TRAINING_CONTEXT)).toBe(20);
  });

  it('adds up across protein items and ignores the rest (BCAA, collagen)', () => {
    const s = state([
      ent('whey'),
      ent('casein'),
      ent('plantProtein'),
      ent('bcaa'),
      ent('collagen'),
    ]);
    expect(supplementProteinGramsFor(s, '2026-10-06', ALL)).toBe(20 + 24 + 22);
  });

  it('counts only on the days the entry counts: training-day protein skips rest days', () => {
    const s = state([ent('whey', { schedule: 'trainingDays' }), ent('casein')]);
    const ctx = ctxOf(['2026-10-05']);
    expect(supplementProteinGramsFor(s, '2026-10-05', ctx)).toBe(44);
    expect(supplementProteinGramsFor(s, '2026-10-06', ctx)).toBe(24);
  });

  it('a day answered "nothing taken" adds nothing; a subset adds that subset; "taken" adds all due', () => {
    const base = [ent('whey'), ent('casein')];
    const none = state(base, {}, { '2026-10-06': { taken: false } });
    expect(supplementProteinGramsFor(none, '2026-10-06', ALL)).toBe(0);
    const some = state(base, {}, { '2026-10-06': { taken: true, entryIds: ['e-casein'] } });
    expect(supplementProteinGramsFor(some, '2026-10-06', ALL)).toBe(24);
    const all = state(base, {}, { '2026-10-06': { taken: true } });
    expect(supplementProteinGramsFor(all, '2026-10-06', ALL)).toBe(44);
  });

  it('is zero with the master switch off, the protein surface off, or an unreadable day', () => {
    const base = [ent('whey')];
    expect(
      supplementProteinGramsFor(state(base, { useInCalculations: false }), '2026-10-06', ALL),
    ).toBe(0);
    const off = defaultSupplementSettings();
    off.surfaces.protein = false;
    expect(
      supplementProteinGramsFor(state(base, { surfaces: off.surfaces }), '2026-10-06', ALL),
    ).toBe(0);
    expect(supplementProteinGramsFor(state(base), 'not-a-day', ALL)).toBe(0);
    expect(supplementProteinGramsFor(null, '2026-10-06', ALL)).toBe(0);
  });
});

describe('effectsFor: off, none and neutral', () => {
  it('is null for a missing state, the master switch off, no entries, inactive entries', () => {
    expect(fx(null as never, '2026-10-06')).toBeNull();
    expect(fx(state([ent('creatine')], { useInCalculations: false }), '2026-10-06')).toBeNull();
    expect(fx(state([]), '2026-10-06')).toBeNull();
    expect(fx(state([ent('creatine', { active: false })]), '2026-10-06')).toBeNull();
    expect(fx(state([ent('creatine')]), 'garbage')).toBeNull();
  });

  it('a tracked item with no estimated effect moves nothing (null)', () => {
    const s = state([
      ent('magnesium'),
      ent('melatonin'),
      ent('betaAlanine'),
      ent('bicarbonate'),
      ent('vitaminD'),
      ent('omega3'),
    ]);
    expect(fx(s, '2026-10-06')).toBeNull();
  });

  it('a switched-off surface stays neutral while the others still work', () => {
    const off = defaultSupplementSettings();
    off.surfaces.strength = false;
    const r = fx(state([ent('creatine')], { surfaces: off.surfaces }), '2027-03-01')!;
    expect(r.creatineStrength).toEqual({ low: SUPPLEMENT_NEUTRAL, high: SUPPLEMENT_NEUTRAL });
    expect(r.creatineBodyweightKg.high).toBe(2);
    off.surfaces.trends = false;
    expect(fx(state([ent('creatine')], { surfaces: off.surfaces }), '2027-03-01')).toBeNull();
  });

  it('typical training day: counts daily and training-day entries, ignores check-ins', () => {
    const s = state(
      [ent('whey', { schedule: 'trainingDays' }), ent('caffeine')],
      {},
      { '2026-10-06': { taken: false } },
    );
    const r = supplementEffectsTypical(s, '2026-10-06', NO_TRAINING_CONTEXT)!;
    expect(r.proteinGrams.high).toBe(20);
    expect(r.caffeineRpe.high).toBe(-0.2);
    expect(supplementEffectsTypical(null, '2026-10-06', ALL)).toBeNull();
  });
});

describe('training days: how the app knows them', () => {
  const T = '2026-10-07'; // a Wednesday ("today")

  it('a day with a finished workout is a training day, planned or not', () => {
    const r = trainingDayResolver({
      todayKey: T,
      plannedWeekdays: [1, 3, 5],
      trainedDays: ['2026-10-06'],
    });
    expect(r('2026-10-06')).toBe(true); // Tuesday, not planned, but trained
  });

  it('a past day with no workout is not, even if the plan had it', () => {
    const r = trainingDayResolver({ todayKey: T, plannedWeekdays: [1, 3, 5], trainedDays: [] });
    expect(r('2026-10-05')).toBe(false); // Monday, planned but missed
  });

  it('today and the future follow the plan weekdays (ISO 1 = Monday)', () => {
    const r = trainingDayResolver({ todayKey: T, plannedWeekdays: [1, 3, 5], trainedDays: [] });
    expect(r('2026-10-07')).toBe(true); // Wed, today
    expect(r('2026-10-08')).toBe(false); // Thu
    expect(r('2026-10-09')).toBe(true); // Fri
    expect(r('2026-10-12')).toBe(true); // next Mon
    expect(r('not-a-day')).toBe(false);
  });

  it('with no plan the habit applies: weekdays trained at least twice in the last 8 weeks', () => {
    const trained = ['2026-09-14', '2026-09-21', '2026-09-30', '2026-09-23', '2026-10-01']; // Mon x2, Wed x2, Thu x1
    expect(habitWeekdays(trained, T)).toEqual([1, 3]);
    const r = trainingDayResolver({ todayKey: T, plannedWeekdays: null, trainedDays: trained });
    expect(r('2026-10-12')).toBe(true);
    expect(r('2026-10-14')).toBe(true);
    expect(r('2026-10-15')).toBe(false);
    expect(HABIT_MIN_DAYS).toBe(2);
  });

  it('old days fall out of the habit, and a plan with no days is a plan with no training days', () => {
    expect(habitWeekdays(['2026-06-01', '2026-06-08'], T)).toEqual([]);
    const r = trainingDayResolver({ todayKey: T, plannedWeekdays: [], trainedDays: [] });
    expect(r('2026-10-09')).toBe(false);
  });

  it('usual training time: the median start of the last 8 weeks, to 15 min, needs 3 workouts', () => {
    const now = new Date(2026, 9, 7, 12).getTime();
    const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).getTime();
    expect(usualTrainingStartMin([at(1, 18), at(2, 18, 10)], now)).toBeNull();
    expect(usualTrainingStartMin([at(1, 18), at(2, 18, 10), at(3, 19)], now)).toBe(18 * 60 + 15);
    expect(usualTrainingStartMin([at(1, 7), at(2, 7), at(3, 18)], now)).toBe(7 * 60);
    expect(usualTrainingStartMin([], now)).toBeNull();
  });
});

describe('day check-ins', () => {
  const fri = (hour: number) => new Date(2026, 9, 2, hour).getTime(); // Fri 2026-10-02
  const daily = [ent('creatine'), ent('magnesium')];

  it('asks about today only from the evening, otherwise about yesterday', () => {
    const s = state(daily);
    expect(pendingSupplementCheckin(fri(CHECKIN_FROM_HOUR - 1), s, ALL)!.date).toBe('2026-10-01');
    expect(pendingSupplementCheckin(fri(CHECKIN_FROM_HOUR), s, ALL)!.date).toBe('2026-10-02');
    expect(pendingSupplementCheckin('2026-10-02', s, ALL)!.date).toBe('2026-10-01'); // a bare day is midnight
  });

  it('one grouped card per day: it lists every entry due that day', () => {
    const p = pendingSupplementCheckin(fri(20), state([...daily, ent('caffeine')]), ALL)!;
    expect(p.entries.map((e) => e.itemId)).toEqual(['creatine', 'magnesium', 'caffeine']);
  });

  it('training-day entries are asked about only on training days', () => {
    const s = state([...daily, ent('caffeine')]);
    const rest = pendingSupplementCheckin(fri(20), s, ctxOf([]))!;
    expect(rest.entries.map((e) => e.itemId)).toEqual(['creatine', 'magnesium']);
    const train = pendingSupplementCheckin(fri(20), s, ctxOf(['2026-10-02']))!;
    expect(train.entries.map((e) => e.itemId)).toEqual(['creatine', 'magnesium', 'caffeine']);
    // Only training-day entries and a rest day: nothing to ask today, so it looks back.
    const only = state([ent('caffeine')]);
    expect(pendingSupplementCheckin(fri(20), only, ctxOf([]))).toBeNull();
    expect(pendingSupplementCheckin(fri(20), only, ctxOf(['2026-10-01']))!.date).toBe('2026-10-01');
  });

  it('newest first, one at a time, answered days skipped, never further back than 2 days', () => {
    const at = (c: SupplementState['checkins']) =>
      pendingSupplementCheckin(fri(20), state(daily, {}, c), ALL);
    expect(at({})!.date).toBe('2026-10-02');
    expect(at({ '2026-10-02': { taken: true } })!.date).toBe('2026-10-01');
    expect(at({ '2026-10-02': { taken: true }, '2026-10-01': { taken: false } })!.date).toBe(
      '2026-09-30',
    );
    expect(
      at({
        '2026-10-02': { taken: true },
        '2026-10-01': { taken: false },
        '2026-09-30': { taken: true },
      }),
    ).toBeNull();
    expect(CHECKIN_MAX_AGE_DAYS).toBe(2);
  });

  it('is off with the master switch, with "Ask on Today" off, with nothing saved, or a bad day', () => {
    expect(
      pendingSupplementCheckin(fri(20), state(daily, { useInCalculations: false }), ALL),
    ).toBeNull();
    expect(pendingSupplementCheckin(fri(20), state(daily, { checkinsOn: false }), ALL)).toBeNull();
    expect(pendingSupplementCheckin(fri(20), state([]), ALL)).toBeNull();
    expect(
      pendingSupplementCheckin(fri(20), state([ent('zinc', { active: false })]), ALL),
    ).toBeNull();
    expect(pendingSupplementCheckin(fri(20), null, ALL)).toBeNull();
    expect(pendingSupplementCheckin(Number.NaN, state(daily), ALL)).toBeNull();
    expect(defaultSupplementSettings().checkinsOn).toBe(false);
  });

  it('does not ask about days before an entry was saved', () => {
    const e = ent('creatine', { startedAt: fri(19) });
    expect(pendingSupplementCheckin(fri(20), state([e]), ALL)!.date).toBe('2026-10-02');
    expect(
      pendingSupplementCheckin(fri(20), state([e], {}, { '2026-10-02': { taken: true } }), ALL),
    ).toBeNull();
  });

  it('due and counted entries: no answer = all due; none = nothing; ids = only those', () => {
    const list = [ent('creatine'), ent('whey'), ent('caffeine')];
    const rest = ctxOf([]);
    const day = '2026-10-06';
    expect(dueSupplementEntries(state(list), day, rest).map((e) => e.itemId)).toEqual([
      'creatine',
      'whey',
    ]);
    expect(countedSupplementEntries(state(list), day, rest)).toHaveLength(2);
    expect(
      countedSupplementEntries(state(list, {}, { [day]: { taken: false } }), day, rest),
    ).toEqual([]);
    expect(
      countedSupplementEntries(
        state(list, {}, { [day]: { taken: true, entryIds: ['e-whey', 'e-caffeine'] } }),
        day,
        rest,
      ).map((e) => e.itemId),
    ).toEqual(['whey']); // the caffeine is not due on a rest day, whatever the ids say
  });

  it('a "nothing taken" answer removes the day from the effects', () => {
    const s = state([ent('creatine'), ent('whey')], {}, { '2026-10-06': { taken: false } });
    expect(fx(s, '2026-10-06')).toBeNull();
    expect(fx(s, '2026-10-07')).not.toBeNull();
  });

  it('normalizeSupplementCheckin(s): valid shapes, empty selection = nothing taken, last 60 days', () => {
    expect(normalizeSupplementCheckin({ taken: true })).toEqual({ taken: true });
    expect(normalizeSupplementCheckin({ taken: false, entryIds: ['a'] })).toEqual({ taken: false });
    expect(normalizeSupplementCheckin({ taken: true, entryIds: ['a', 'a', '', 3, 'b'] })).toEqual({
      taken: true,
      entryIds: ['a', 'b'],
    });
    expect(normalizeSupplementCheckin({ taken: true, entryIds: [] })).toEqual({ taken: false });
    expect(normalizeSupplementCheckin({ taken: 'yes' })).toBeNull();
    expect(normalizeSupplementCheckin(null)).toBeNull();
    expect(normalizeSupplementCheckin([])).toBeNull();
    const many: Record<string, unknown> = {
      'bad-key': { taken: true },
      '2026-13-40': { taken: true },
    };
    for (let i = 0; i < 80; i++) many[addDays('2026-01-01', i)] = { taken: i % 2 === 0 };
    const out = normalizeSupplementCheckins(many);
    expect(Object.keys(out)).toHaveLength(MAX_CHECKIN_DAYS);
    expect(out[addDays('2026-01-01', 79)]).toBeDefined();
    expect(out[addDays('2026-01-01', 0)]).toBeUndefined();
    expect(normalizeSupplementCheckins('x')).toEqual({});
    expect(normalizeSupplementCheckins([1, 2])).toEqual({});
  });
});

describe('safety checks', () => {
  const keys = (s: SupplementState, ctx?: SupplementContext) =>
    supplementWarnings(s, ctx).map((w) => `${w.key}:${w.level}`);

  it('nothing to warn about with no entries or only harmless ones', () => {
    expect(supplementWarnings(state([]))).toEqual([]);
    expect(supplementWarnings(null)).toEqual([]);
    expect(supplementWarnings(state([ent('glycine'), ent('probiotics')]))).toEqual([]);
  });

  it('caffeine over 400 mg a day (daily + training-day entries) is a warning', () => {
    const over = state([
      ent('caffeine', { id: 'a', schedule: 'daily', dose: 300 }),
      ent('preWorkout', { id: 'b' }),
    ]);
    const w = supplementWarnings(over).find((x) => x.key === 'caffeineDailyLimit')!;
    expect(w.level).toBe('warn');
    expect(w.itemIds).toEqual(['caffeine', 'preWorkout']);
    expect(CAFFEINE_DAILY_LIMIT_MG).toBe(400);
  });

  it('exactly 400 mg is fine; a 300 mg dose is a caution above 3 mg/kg, only with a known weight', () => {
    expect(keys(state([ent('caffeine', { dose: 400 })]))).not.toContain('caffeineDailyLimit:warn');
    const s = state([ent('caffeine', { dose: 300 })]);
    expect(keys(s)).not.toContain('caffeineSingleDose:caution'); // weight unknown
    expect(keys(s, { ...ALL, bodyWeightKg: 70 })).toContain('caffeineSingleDose:caution'); // 4.3 mg/kg
    expect(keys(s, { ...ALL, bodyWeightKg: 100 })).not.toContain('caffeineSingleDose:caution'); // 3.0 mg/kg
  });

  it('late caffeine is an info: the evening label, or a pre-workout dose for an evening trainer', () => {
    expect(keys(state([ent('caffeine', { timing: 'evening' })]))).toContain('caffeineLate:info');
    expect(keys(state([ent('caffeine')]), { ...ALL, usualTrainingStartMin: 1080 })).toContain(
      'caffeineLate:info',
    );
    expect(keys(state([ent('caffeine')]), { ...ALL, usualTrainingStartMin: 600 })).not.toContain(
      'caffeineLate:info',
    );
    expect(keys(state([ent('caffeine')]))).not.toContain('caffeineLate:info');
  });

  it('item flags: kidney, hypertension, anticoagulants, WADA, pregnancy, minors', () => {
    const w = supplementWarnings(
      state([
        ent('creatine'),
        ent('preWorkout'),
        ent('omega3'),
        ent('bicarbonate'),
        ent('melatonin'),
      ]),
    );
    const get = (k: string) => w.find((x) => x.key === k)!;
    expect(get('kidney').itemIds).toEqual(['creatine', 'bicarbonate']);
    expect(get('hypertension').itemIds).toEqual(['preWorkout', 'bicarbonate']);
    expect(get('anticoagulants').itemIds).toEqual(['omega3']);
    expect(get('wada').itemIds).toEqual(['preWorkout']);
    expect(get('pregnancy').itemIds).toEqual(['preWorkout', 'melatonin']);
    expect(get('minors').level).toBe('caution');
    expect(get('giUpset').level).toBe('info');
  });

  it('antioxidants: vitamin C / E always carry a warning, a "warn" at high doses', () => {
    expect(keys(state([ent('vitaminC', { dose: 500 })]))).toEqual(['antioxidantBlunt:caution']);
    expect(keys(state([ent('vitaminC', { dose: 1000 })]))).toEqual(['antioxidantBlunt:warn']);
    expect(keys(state([ent('vitaminE', { dose: 200 })]))).toContain('antioxidantBlunt:warn');
    expect(
      keys(state([ent('vitaminC', { id: 'c1', dose: 250 }), ent('vitaminE', { dose: 200 })])),
    ).toContain('antioxidantBlunt:warn'); // the highest level wins
  });

  it('ashwagandha is a warning; vitamin D and iron are "only if deficient" notes', () => {
    const w = keys(state([ent('vitaminD'), ent('iron'), ent('ashwagandha')]));
    expect(w[0]).toBe('ashwagandha:warn'); // most serious first
    expect(w).toContain('deficiencyOnly:info');
  });

  it('is sorted warn, caution, info; inactive entries add nothing; safety ignores the master switch', () => {
    const s = state(
      [ent('ashwagandha'), ent('magnesium'), ent('iron'), ent('melatonin', { active: false })],
      { useInCalculations: false },
    );
    const rank = ['warn', 'caution', 'info'];
    const w = supplementWarnings(s);
    const levels = w.map((x) => rank.indexOf(x.level));
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
    expect(w[0].level).toBe('warn');
    expect(w.find((x) => x.key === 'pregnancy')!.itemIds).toEqual(['ashwagandha']);
  });
});

describe('tolerant parsing (legacy and hostile states)', () => {
  it('garbage becomes an empty default state', () => {
    for (const bad of [null, undefined, 5, 'x', [], true]) {
      const s = normalizeSupplements(bad);
      expect(s).toEqual(emptySupplementState());
      expect(s.settings.version).toBe(SUPPLEMENT_SETTINGS_VERSION);
    }
  });

  it('keeps valid entries, drops unknown items and duplicate ids, clamps and defaults every field', () => {
    const s = normalizeSupplements({
      updatedAt: 500,
      entries: [
        {
          id: 'a',
          itemId: 'creatine',
          dose: 99,
          schedule: 'trainingDays',
          timing: 'evening',
          startedAt: 77,
          active: true,
        },
        { id: 'a', itemId: 'whey', dose: 25 },
        { id: 'b', itemId: 'beerRegular', dose: 1 },
        { id: '', itemId: 'creatine' },
        {
          id: 'c',
          itemId: 'whey',
          dose: 'lots',
          schedule: 'weekends',
          timing: 'whenever',
          active: false,
        },
        { id: 'd', itemId: 'caffeine', dose: Number.NaN, startedAt: -5 },
        null,
        7,
      ],
    });
    expect(s.entries.map((e) => e.id)).toEqual(['a', 'c', 'd']);
    expect(s.entries[0]).toEqual({
      id: 'a',
      itemId: 'creatine',
      dose: 20,
      schedule: 'trainingDays',
      timing: 'evening',
      startedAt: 77,
      active: true,
    });
    expect(s.entries[1]).toMatchObject({
      dose: 25,
      schedule: 'daily',
      timing: 'postWorkout',
      active: false,
    });
    // A missing / invalid startedAt takes the document's stamp (never a date that gives a full ramp).
    expect(s.entries[1].startedAt).toBe(500);
    expect(s.entries[2]).toMatchObject({ dose: 200, schedule: 'trainingDays', startedAt: 500 });
  });

  it('a missing startedAt in a document with no stamp becomes "now", not the start of time', () => {
    const before = Date.now();
    const s = normalizeSupplements({ entries: [{ id: 'a', itemId: 'creatine' }] });
    expect(s.entries[0].startedAt).toBeGreaterThanOrEqual(before);
  });

  it('caps the number of entries', () => {
    const entries = Array.from({ length: 200 }, (_, i) => ({
      id: `e${i}`,
      itemId: 'zinc',
      startedAt: 1,
    }));
    expect(normalizeSupplements({ entries }).entries).toHaveLength(MAX_SUPPLEMENT_ENTRIES);
  });

  it('settings: validates every field; a stray sharing level is the private default', () => {
    const s = normalizeSupplements({
      settings: {
        version: 99,
        useInCalculations: false,
        checkinsOn: false,
        sharing: 'full',
        surfaces: { strength: false, sleep: 'no', bogus: false },
      },
    });
    expect(s.settings).toMatchObject({
      version: SUPPLEMENT_SETTINGS_VERSION,
      useInCalculations: false,
      checkinsOn: false,
      sharing: 'full',
    });
    expect(s.settings.surfaces.strength).toBe(false);
    expect(s.settings.surfaces.sleep).toBe(true);
    expect('bogus' in s.settings.surfaces).toBe(false);
    for (const bad of ['everything', 'Effects', 3, null, {}])
      expect(normalizeSupplements({ settings: { sharing: bad } }).settings.sharing).toBe('off');
    expect(
      normalizeSupplements({ settings: { checkinsOn: 'yes', useInCalculations: 1 } }).settings,
    ).toMatchObject({ checkinsOn: false, useInCalculations: true });
    expect(normalizeSupplements({ settings: { checkinsOn: true } }).settings.checkinsOn).toBe(true);
    expect(normalizeSupplements({ settings: { checkinsOn: false } }).settings.checkinsOn).toBe(
      false,
    );
    for (const raw of [undefined, {}, { settings: {} }, { settings: { checkinsOn: null } }])
      expect(normalizeSupplements(raw).settings.checkinsOn).toBe(false);
    expect(isSupplementSharing('effects')).toBe(true);
    expect(isSupplementSharing('Full')).toBe(false);
  });

  it('an older document without settings or check-ins loads with the defaults; check-ins are cleaned', () => {
    const s = normalizeSupplements({ entries: [], updatedAt: 3 });
    expect(s.settings).toEqual(defaultSupplementSettings());
    expect(s.checkins).toEqual({});
    expect(s.updatedAt).toBe(3);
    const c = normalizeSupplements({
      checkins: { '2026-10-02': { taken: true }, x: { taken: true }, '2026-10-03': 'no' },
    });
    expect(c.checkins).toEqual({ '2026-10-02': { taken: true } });
    expect(normalizeSupplements({ updatedAt: -1 }).updatedAt).toBe(0);
    expect(normalizeSupplements({ updatedAt: '5' }).updatedAt).toBe(0);
  });

  it('normalizeSupplementEntry / newSupplementEntry / hasSupplementData', () => {
    expect(normalizeSupplementEntry({ id: 'x', itemId: 'moonshine' })).toBeNull();
    expect(normalizeSupplementEntry('x')).toBeNull();
    const e = newSupplementEntry('whey', 'w', 1234);
    expect(e).toEqual({
      id: 'w',
      itemId: 'whey',
      dose: 25,
      schedule: 'daily',
      timing: 'postWorkout',
      startedAt: 1234,
      active: true,
    });
    expect(newSupplementEntry('whey', 'w', 1, 9999).dose).toBe(100);
    expect(normalizeSupplementEntry(e)).toEqual(e);
    expect(hasSupplementData(null)).toBe(false);
    expect(hasSupplementData(emptySupplementState())).toBe(false);
    expect(hasSupplementData(state([e]))).toBe(true);
  });

  it('the default settings are private and check-ins start off', () => {
    expect(defaultSupplementSettings()).toMatchObject({
      version: 1,
      useInCalculations: true,
      sharing: 'off',
      checkinsOn: false,
    });
    expect(emptySupplementState().updatedAt).toBe(0);
  });
});
