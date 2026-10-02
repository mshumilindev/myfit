/**
 * Supplements: pure data model + estimation math. No React, no store, no I/O.
 *
 * Product: the user picks supplements from a bundled catalog (`supplementCatalog.ts`), each
 * with a dose, a timing label and a schedule: every day, or only on TRAINING days (the app
 * decides which days those are, see `trainingDayResolver`). Nothing is logged by time.
 *
 * Only three kinds of item feed a number (`SUPPLEMENT_COEFFS`); everything else is tracked
 * with no estimated effect:
 *  - creatine: a strength EXPECTATION range (0 to +8 %) that ramps up over 12 weeks measured
 *    from the moment the entry was first saved (`startedAt`), plus a bodyweight note
 *    (+0.5..2 kg, mostly water, in the first two weeks). Display only: this module and the
 *    app NEVER raise a load because of it;
 *  - caffeine (and a pre-workout blend, by an assumed caffeine content): RPE a little lower on
 *    a training day with a pre-workout dose, and extra sleep need (0..45 min) when it is taken
 *    late (the `evening` label, or a pre-workout dose for someone who usually trains from
 *    15:00);
 *  - protein (whey, casein, plant protein, EAA): the declared protein of the serving counts as
 *    extra grams toward the day's protein, only on days the entry counts. Nutrition logs track
 *    FOOD; a shake logged as food there is not detected, so a user who logs it in both places
 *    counts it twice (the UI says so).
 *
 * Every number lives in one table (`SUPPLEMENT_COEFFS`) with a `source`, a `confidence` and an
 * `experimental` flag; every effect is a range (`low`..`high`), never a promise. Positive
 * effects ARE shown. Nothing here is medical advice (`SUPPLEMENT_DISCLAIMER_EN`).
 *
 * Day check-ins: with check-ins on, Today asks once a day, in one grouped card, whether the
 * due supplements were taken; the answer replaces the "everything due was taken" assumption.
 */
import {
  addDays,
  dayKey,
  MAX_CHECKIN_DAYS,
  weekdayIndex,
  type DayInput,
  type Range,
} from './alcohol';
import {
  activeSupplementEntries,
  caffeineMgOf,
  caffeineMgOfEntries,
  clampDose,
  isCountedEntry,
  isSupplementId,
  proteinGramsOfEntries,
  supplementItem,
  SCHEDULES,
  TIMINGS,
  type SupplementWarningKey,
} from './supplementCatalog';
import type {
  SupplementCheckin,
  SupplementEntry,
  SupplementId,
  SupplementSettings,
  SupplementState,
  SupplementSurface,
} from './types';

export { dayKey, addDays, weekdayIndex, MAX_CHECKIN_DAYS };
export type { DayInput, Range };

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
const round = (n: number, d = 2): number => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
const isDayKey = (k: unknown): k is string =>
  typeof k === 'string' && DAY_KEY.test(k) && dayKey(k) === k;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type SupplementConfidence = 'strong' | 'moderate' | 'weak' | 'none';

// --- Context ---------------------------------------------------------------------------------------

/** What the model needs to know about the user's training and body (the bridge supplies it). */
export interface SupplementContext {
  /** Is this calendar day ('YYYY-MM-DD') a training day (plan or actual)? */
  isTrainingDay: (key: string) => boolean;
  /** Latest body weight, kg (null / absent = unknown). */
  bodyWeightKg?: number | null;
  /** Usual start of a workout, minutes after local midnight (null / absent = unknown). */
  usualTrainingStartMin?: number | null;
}

/** No plan and no workouts known: no day is a training day. */
export const NO_TRAINING_CONTEXT: SupplementContext = { isTrainingDay: () => false };

export interface TrainingFacts {
  /** Today as 'YYYY-MM-DD'. */
  todayKey: string;
  /**
   * ISO weekdays (1 = Monday ... 7 = Sunday, the program's numbering) the training plan
   * prescribes; null = no plan, the user's own habit (`habitWeekdays`) is used instead.
   */
  plannedWeekdays: readonly number[] | null;
  /** Days with a finished workout / activity ('YYYY-MM-DD'). */
  trainedDays: Iterable<string>;
}

/** Days of history that define a habit, and the number of trained days a weekday needs. */
export const HABIT_WINDOW_DAYS = 56;
export const HABIT_MIN_DAYS = 2;

/** ISO weekdays with at least two trained days in the last 8 weeks: the habit with no plan. */
export function habitWeekdays(trainedDays: Iterable<string>, todayKey: string): number[] {
  const from = addDays(todayKey, -HABIT_WINDOW_DAYS);
  const count = new Map<number, number>();
  for (const k of new Set(trainedDays)) {
    if (!isDayKey(k) || k < from || k > todayKey) continue;
    const wd = (weekdayIndex(k) ?? 0) + 1;
    count.set(wd, (count.get(wd) ?? 0) + 1);
  }
  return [...count]
    .filter(([, n]) => n >= HABIT_MIN_DAYS)
    .map(([wd]) => wd)
    .sort((a, b) => a - b);
}

/**
 * How the app knows a training day, in one rule set:
 *  1. a day with a finished workout / activity is a training day, always;
 *  2. a day before today with none is not (it is over, nothing was trained);
 *  3. today and later follow the training plan's weekdays, or, with no plan, the habit.
 */
export function trainingDayResolver(f: TrainingFacts): (key: string) => boolean {
  const trained = new Set(f.trainedDays);
  const plan = new Set(f.plannedWeekdays ?? habitWeekdays(trained, f.todayKey));
  return (key) => {
    if (trained.has(key)) return true;
    if (!isDayKey(key) || key < f.todayKey) return false;
    return plan.has((weekdayIndex(key) ?? 0) + 1);
  };
}

/** Workouts needed before a "usual training time" is claimed. */
export const USUAL_TIME_MIN_WORKOUTS = 3;

/**
 * The usual start of a workout, minutes after local midnight (median of the last 8 weeks,
 * rounded to 15), or null with too few workouts.
 */
export function usualTrainingStartMin(startedAt: readonly number[], now: number): number | null {
  const since = now - HABIT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const mins = startedAt
    .filter((t) => finite(t) && t >= since && t <= now)
    .map((t) => {
      const d = new Date(t);
      return d.getHours() * 60 + d.getMinutes();
    })
    .sort((a, b) => a - b);
  if (mins.length < USUAL_TIME_MIN_WORKOUTS) return null;
  const mid = mins.length >> 1;
  const median = mins.length % 2 ? mins[mid] : (mins[mid - 1] + mins[mid]) / 2;
  return Math.round(median / 15) * 15;
}

// --- Schedule and day logic ---------------------------------------------------------------------

/** Does the entry's schedule include this day? (daily always; training days only on one.) */
export const isDueOn = (e: SupplementEntry, key: string, ctx: SupplementContext): boolean =>
  e.schedule === 'daily' || ctx.isTrainingDay(key);

/** Was the entry already saved by the end of this day? (Effects start at `startedAt`.) */
export const startedBy = (e: SupplementEntry, key: string): boolean => {
  const k = dayKey(e.startedAt);
  return k !== null && k <= key;
};

type DayState = Pick<SupplementState, 'entries' | 'settings'> &
  Partial<Pick<SupplementState, 'checkins'>>;

/** The counted entries due on a day, before any check-in is applied (also what Today asks about). */
export function dueSupplementEntries(
  state: DayState | null | undefined,
  key: string,
  ctx: SupplementContext,
): SupplementEntry[] {
  return activeSupplementEntries(state?.entries ?? []).filter(
    (e) => startedBy(e, key) && isDueOn(e, key, ctx),
  );
}

/**
 * The entries that count on a day: those due, minus what a check-in says was not taken. No
 * check-in = everything due counts; "taken" with no ids = everything due; with ids = those.
 */
export function countedSupplementEntries(
  state: DayState | null | undefined,
  key: string,
  ctx: SupplementContext,
): SupplementEntry[] {
  const due = dueSupplementEntries(state, key, ctx);
  const c = state?.checkins?.[key];
  if (!c) return due;
  if (!c.taken) return [];
  const ids = c.entryIds;
  return ids ? due.filter((e) => ids.includes(e.id)) : due;
}

/** Protein grams the supplements add on a day (0 when off, none counted, or that surface is off). */
export function supplementProteinGramsFor(
  state: DayState | null | undefined,
  day: DayInput,
  ctx: SupplementContext,
): number {
  if (!state?.settings?.useInCalculations || state.settings.surfaces?.protein === false) return 0;
  const key = dayKey(day);
  if (!key) return 0;
  return proteinGramsOfEntries(
    countedSupplementEntries(state, key, ctx).filter(
      (e) => supplementItem(e.itemId).effect === 'protein',
    ),
  );
}

// --- Coefficients -------------------------------------------------------------------------------------

/** The numeric effects (`trends` and `afterWorkoutHints` carry no number of their own). */
export type SupplementEffectKey =
  'creatineStrength' | 'creatineBodyweightKg' | 'caffeineRpe' | 'caffeineSleepMin' | 'proteinGrams';

export interface SupplementCoeff {
  /** Which switch gates it. */
  surface: SupplementSurface;
  /** The unit of the range: a fraction (0.08 = +8 %), kg, RPE points, minutes, or grams. */
  unit: 'fraction' | 'kg' | 'rpe' | 'min' | 'g';
  /** The range at the full dose and the full ramp (magnitudes; the sign applies below). */
  lowCap: number;
  highCap: number;
  /** -1 lowers the number (RPE), +1 raises it. */
  sign: -1 | 1;
  /** Ramp from `startedAt`: 0 up to `rampFullWeeks` weeks, linearly (0 = no ramp). */
  rampFullWeeks: number;
  /** The dose at which the full range applies (caffeine: mg/kg and mg; creatine: g). */
  fullDose: { perKg?: number; fixed: number } | null;
  source: string;
  confidence: SupplementConfidence;
  /** True when there is no research behind it at all: off by default, shown as "Experimental". */
  experimental: boolean;
}

const CREATINE_SOURCE =
  'Kreider 2017, JISSN 14:18 (doi 10.1186/s12970-017-0173-z); Lanhers 2017, Sports Med 47:163 (doi 10.1007/s40279-016-0571-4): about +5 to +8 % maximal strength against placebo, together with training, over 4 to 12 weeks; lean mass about +1 kg; bodyweight +0.5 to 2 kg (water) in the first 1 to 2 weeks. Shown as an expectation range of 0 to +8 % ramping over 12 weeks from the day the entry was saved; the ramp shape is a guess. Display only, never used to raise a load';
const CAFFEINE_RPE_SOURCE =
  'Guest 2021, JISSN 18:1 (doi 10.1186/s12970-020-00383-4): 3 to 6 mg/kg 30 to 60 min before training; Grgic 2020, BJSM (performance +2 to 4 %); Doherty & Smith 2005 (RPE about 0.2 to 0.5 points lower). Shown only on a training day with a pre-workout dose; full effect at 3 mg/kg (200 mg when the body weight is unknown)';
const CAFFEINE_SLEEP_SOURCE =
  'Gardiner 2023, Sleep Med Rev (late caffeine shortens total sleep time, up to about 45 min); Drake 2013 (400 mg six hours before bed, not re-verified). Half-life about 5 h, so a cutoff of 8 to 9 h before bed. Shown for an evening dose, or a pre-workout dose when the usual training starts at 15:00 or later; full effect at 400 mg';
const PROTEIN_SOURCE =
  'Jäger 2017, JISSN 14:20; Morton 2018, BJSM 52:376 (doi 10.1136/bjsports-2017-097608): total daily protein matters, 1.4 to 2.0 g/kg/day. The protein of a serving (an assumed share of the powder, see the catalog) counts like food, on the days the entry counts';

export const SUPPLEMENT_COEFFS: Record<SupplementEffectKey, SupplementCoeff> = {
  // Strength expectation: 0 to +8 % after 12 weeks of daily creatine with training.
  creatineStrength: {
    surface: 'strength',
    unit: 'fraction',
    lowCap: 0,
    highCap: 0.08,
    sign: 1,
    rampFullWeeks: 12,
    fullDose: { fixed: 3 },
    source: CREATINE_SOURCE,
    confidence: 'strong',
    experimental: false,
  },
  // Bodyweight note: +0.5 to 2 kg (water), within two weeks.
  creatineBodyweightKg: {
    surface: 'trends',
    unit: 'kg',
    lowCap: 0.5,
    highCap: 2,
    sign: 1,
    rampFullWeeks: 2,
    fullDose: { fixed: 3 },
    source: CREATINE_SOURCE,
    confidence: 'moderate',
    experimental: false,
  },
  // RPE on a training day with a pre-workout dose: 0.2 to 0.5 points lower.
  caffeineRpe: {
    surface: 'rpe',
    unit: 'rpe',
    lowCap: 0.2,
    highCap: 0.5,
    sign: -1,
    rampFullWeeks: 0,
    fullDose: { perKg: 3, fixed: 200 },
    source: CAFFEINE_RPE_SOURCE,
    confidence: 'moderate',
    experimental: false,
  },
  // Sleep need after late caffeine: 0 to +45 min.
  caffeineSleepMin: {
    surface: 'sleep',
    unit: 'min',
    lowCap: 0,
    highCap: 45,
    sign: 1,
    rampFullWeeks: 0,
    fullDose: { fixed: 400 },
    source: CAFFEINE_SLEEP_SOURCE,
    confidence: 'moderate',
    experimental: false,
  },
  // Extra protein grams: the declared grams of the serving (low = high).
  proteinGrams: {
    surface: 'protein',
    unit: 'g',
    lowCap: 1,
    highCap: 1,
    sign: 1,
    rampFullWeeks: 0,
    fullDose: null,
    source: PROTEIN_SOURCE,
    confidence: 'strong',
    experimental: false,
  },
};

export const SUPPLEMENT_EFFECT_KEYS = Object.keys(SUPPLEMENT_COEFFS) as SupplementEffectKey[];

/** Neutral value of every effect (all are plain offsets). */
export const SUPPLEMENT_NEUTRAL = 0;
const neutralRange = (): Range => ({ low: SUPPLEMENT_NEUTRAL, high: SUPPLEMENT_NEUTRAL });

export type SupplementEffects = Record<SupplementEffectKey, Range>;

export const emptySupplementEffects = (): SupplementEffects =>
  Object.fromEntries(SUPPLEMENT_EFFECT_KEYS.map((k) => [k, neutralRange()])) as SupplementEffects;

/** Is a range neutral (no change)? */
export const isNeutralRange = (r: Range): boolean =>
  r.low === SUPPLEMENT_NEUTRAL && r.high === SUPPLEMENT_NEUTRAL;

/** The ramp 0..1 of a coefficient `weeks` after the entry was saved. */
export function rampAt(c: Pick<SupplementCoeff, 'rampFullWeeks'>, weeks: number): number {
  if (c.rampFullWeeks <= 0) return 1;
  return clamp(weeks / c.rampFullWeeks, 0, 1);
}

/** Weeks from `startedAt` to the middle of a day (never negative). */
export function weeksSince(startedAt: number, key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Math.max(0, (new Date(y, m - 1, d, 12).getTime() - startedAt) / WEEK_MS);
}

function rangeOf(c: SupplementCoeff, scale: number): Range {
  const lo = c.sign * c.lowCap * scale;
  const hi = c.sign * c.highCap * scale;
  return { low: round(Math.min(lo, hi), 4), high: round(Math.max(lo, hi), 4) };
}

/** Minutes after local midnight from which a pre-/post-workout dose counts as "late". */
export const LATE_CAFFEINE_FROM_MIN = 15 * 60;

/** Is this caffeine entry taken late enough to cost sleep, on this day? */
export function isLateCaffeine(e: SupplementEntry, key: string, ctx: SupplementContext): boolean {
  if (e.timing === 'evening') return true;
  if (e.timing !== 'preWorkout' && e.timing !== 'postWorkout') return false;
  const t = ctx.usualTrainingStartMin;
  return finite(t) && t >= LATE_CAFFEINE_FROM_MIN && ctx.isTrainingDay(key);
}

const hasKind = (e: SupplementEntry, kind: 'creatine' | 'caffeine' | 'protein'): boolean =>
  supplementItem(e.itemId).effect === kind;

/**
 * Effects for ONE calendar day (what was taken on that day; the sleep number is for the night
 * after it). Null when the master switch is off or nothing that day moves a number. A switched-
 * off surface stays neutral. Pure.
 */
export function supplementEffectsFor(
  state: DayState | null | undefined,
  day: DayInput,
  ctx: SupplementContext,
): SupplementEffects | null {
  if (!state?.settings?.useInCalculations) return null;
  const key = dayKey(day);
  if (!key) return null;
  const counted = countedSupplementEntries(state, key, ctx);
  if (!counted.length) return null;
  const on = (k: SupplementEffectKey): boolean =>
    state.settings.surfaces?.[SUPPLEMENT_COEFFS[k].surface] !== false;
  const out = emptySupplementEffects();

  // Creatine: the best (most ramped, best dosed) counted entry sets the range.
  const creatine = counted.filter((e) => hasKind(e, 'creatine'));
  if (creatine.length) {
    let best = 0;
    let bestWater = 0;
    for (const e of creatine) {
      const w = weeksSince(e.startedAt, key);
      const dose = clamp(e.dose / SUPPLEMENT_COEFFS.creatineStrength.fullDose!.fixed, 0, 1);
      best = Math.max(best, rampAt(SUPPLEMENT_COEFFS.creatineStrength, w) * dose);
      bestWater = Math.max(bestWater, rampAt(SUPPLEMENT_COEFFS.creatineBodyweightKg, w) * dose);
    }
    if (on('creatineStrength'))
      out.creatineStrength = rangeOf(SUPPLEMENT_COEFFS.creatineStrength, best);
    if (on('creatineBodyweightKg'))
      out.creatineBodyweightKg = rangeOf(SUPPLEMENT_COEFFS.creatineBodyweightKg, bestWater);
  }

  // Caffeine: RPE on a training day with a pre-workout dose; sleep need for a late dose.
  const caffeine = counted.filter((e) => hasKind(e, 'caffeine'));
  if (caffeine.length) {
    const kg = finite(ctx.bodyWeightKg) && ctx.bodyWeightKg > 0 ? ctx.bodyWeightKg : null;
    const pre = caffeine.filter((e) => e.timing === 'preWorkout');
    if (on('caffeineRpe') && pre.length && ctx.isTrainingDay(key)) {
      const full = SUPPLEMENT_COEFFS.caffeineRpe.fullDose!;
      const ref = kg && full.perKg ? full.perKg * kg : full.fixed;
      out.caffeineRpe = rangeOf(
        SUPPLEMENT_COEFFS.caffeineRpe,
        clamp(caffeineMgOfEntries(pre) / ref, 0, 1),
      );
    }
    const late = caffeine.filter((e) => isLateCaffeine(e, key, ctx));
    if (on('caffeineSleepMin') && late.length)
      out.caffeineSleepMin = rangeOf(
        SUPPLEMENT_COEFFS.caffeineSleepMin,
        clamp(caffeineMgOfEntries(late) / SUPPLEMENT_COEFFS.caffeineSleepMin.fullDose!.fixed, 0, 1),
      );
  }

  // Protein: the declared grams, counted like food.
  if (on('proteinGrams')) {
    const g = proteinGramsOfEntries(counted.filter((e) => hasKind(e, 'protein')));
    if (g > 0) out.proteinGrams = { low: g, high: g };
  }

  return SUPPLEMENT_EFFECT_KEYS.every((k) => isNeutralRange(out[k])) ? null : out;
}

/**
 * The effects of a typical TRAINING day (every daily entry and every training-day entry, no
 * check-in applied): what a coach is shown, and what the app can say without knowing the day.
 */
export function supplementEffectsTypical(
  state: DayState | null | undefined,
  day: DayInput,
  ctx: SupplementContext,
): SupplementEffects | null {
  return supplementEffectsFor(state ? { ...state, checkins: {} } : state, day, {
    ...ctx,
    isTrainingDay: () => true,
  });
}

// --- Safety ------------------------------------------------------------------------------------------

export type SupplementWarningLevel = 'info' | 'caution' | 'warn';
export type SupplementWarningId =
  SupplementWarningKey | 'caffeineDailyLimit' | 'caffeineSingleDose' | 'caffeineLate';

export interface SupplementWarning {
  key: SupplementWarningId;
  level: SupplementWarningLevel;
  /** The entries' items behind it, in the order saved (no duplicates). */
  itemIds: SupplementId[];
}

/** EFSA 2015: up to 400 mg a day (200 mg in pregnancy) and up to 3 mg/kg in one dose. */
export const CAFFEINE_DAILY_LIMIT_MG = 400;
export const CAFFEINE_PREGNANCY_LIMIT_MG = 200;
export const CAFFEINE_SINGLE_DOSE_MG_PER_KG = 3;
/** Vitamin C / E doses (mg) from which the antioxidant warning is a "warn", not a "caution" (Paulsen 2014 used 1000 / 235). */
export const ANTIOXIDANT_HIGH_MG: Partial<Record<SupplementId, number>> = {
  vitaminC: 1000,
  vitaminE: 200,
};

const STATIC_LEVEL: Record<SupplementWarningKey, SupplementWarningLevel> = {
  kidney: 'caution',
  hypertension: 'caution',
  anticoagulants: 'caution',
  wada: 'caution',
  pregnancy: 'caution',
  minors: 'caution',
  antioxidantBlunt: 'caution',
  ashwagandha: 'warn',
  deficiencyOnly: 'info',
  giUpset: 'info',
};
const LEVEL_ORDER: Record<SupplementWarningLevel, number> = { warn: 0, caution: 1, info: 2 };

/**
 * The safety flags of the active entries (independent of the master switch: safety is not a
 * calculation), most serious first. The caffeine daily limit is checked against a training
 * day (every daily and every training-day entry), the worst case. Pure.
 */
export function supplementWarnings(
  state: Pick<SupplementState, 'entries'> | null | undefined,
  ctx: SupplementContext = NO_TRAINING_CONTEXT,
): SupplementWarning[] {
  const entries = activeSupplementEntries(state?.entries ?? []);
  const found = new Map<SupplementWarningId, SupplementWarning>();
  const add = (key: SupplementWarningId, level: SupplementWarningLevel, id: SupplementId) => {
    const w = found.get(key);
    if (!w) found.set(key, { key, level, itemIds: [id] });
    else {
      if (LEVEL_ORDER[level] < LEVEL_ORDER[w.level]) w.level = level;
      if (!w.itemIds.includes(id)) w.itemIds.push(id);
    }
  };
  for (const e of entries) {
    for (const k of supplementItem(e.itemId).warnings) {
      const high = ANTIOXIDANT_HIGH_MG[e.itemId];
      add(
        k,
        k === 'antioxidantBlunt' && high !== undefined && e.dose >= high ? 'warn' : STATIC_LEVEL[k],
        e.itemId,
      );
    }
  }
  const caffeine = entries.filter((e) => caffeineMgOf(e) > 0);
  if (caffeineMgOfEntries(caffeine) > CAFFEINE_DAILY_LIMIT_MG)
    for (const e of caffeine) add('caffeineDailyLimit', 'warn', e.itemId);
  const kg = ctx.bodyWeightKg;
  if (finite(kg) && kg > 0)
    for (const e of caffeine)
      if (caffeineMgOf(e) / kg > CAFFEINE_SINGLE_DOSE_MG_PER_KG)
        add('caffeineSingleDose', 'caution', e.itemId);
  for (const e of caffeine)
    if (e.timing === 'evening' || isLateCaffeine(e, '', { ...ctx, isTrainingDay: () => true }))
      add('caffeineLate', 'info', e.itemId);
  return [...found.values()].sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
}

// --- Check-ins ---------------------------------------------------------------------------------------

/** Hour (local) from which TODAY may be asked about: most of the day's doses are taken. */
export const CHECKIN_FROM_HOUR = 17;
/** A check-in is never asked for a day older than this many days. */
export const CHECKIN_MAX_AGE_DAYS = 2;

export interface PendingSupplementCheckin {
  /** The day being asked about, 'YYYY-MM-DD'. */
  date: string;
  /** The entries due that day: the one grouped card lists them. */
  entries: SupplementEntry[];
}

/**
 * The one check-in to ask on Today, or null. One card per day, grouped: it lists every entry
 * due that day (daily entries; training-day entries only on a training day). Rules:
 *  - only with the master switch on, "Ask on Today" on, and something due;
 *  - candidates are the last 3 days (today only from 17:00, otherwise yesterday and the day
 *    before) with no answer yet;
 *  - one at a time, the MOST RECENT first.
 */
export function pendingSupplementCheckin(
  now: DayInput,
  state: DayState | null | undefined,
  ctx: SupplementContext,
): PendingSupplementCheckin | null {
  if (!state?.settings?.useInCalculations || state.settings.checkinsOn === false) return null;
  const todayKey = dayKey(now);
  if (!todayKey) return null;
  // A bare 'YYYY-MM-DD' is read as midnight (like alcohol): today is not asked yet.
  const hour =
    now instanceof Date ? now.getHours() : typeof now === 'number' ? new Date(now).getHours() : 0;
  for (let back = hour >= CHECKIN_FROM_HOUR ? 0 : 1; back <= CHECKIN_MAX_AGE_DAYS; back++) {
    const key = addDays(todayKey, -back);
    if (state.checkins?.[key]) continue;
    const entries = dueSupplementEntries(state, key, ctx);
    if (entries.length) return { date: key, entries };
  }
  return null;
}

/** Sanity ceiling of the ids kept in one answer. */
export const MAX_CHECKIN_ENTRIES = 50;

export function normalizeSupplementCheckin(raw: unknown): SupplementCheckin | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.taken !== 'boolean') return null;
  if (!r.taken) return { taken: false };
  if (!Array.isArray(r.entryIds)) return { taken: true };
  const ids = r.entryIds.filter((x): x is string => typeof x === 'string' && x.length > 0);
  // An explicit empty selection is "nothing taken".
  if (!ids.length) return { taken: false };
  return { taken: true, entryIds: [...new Set(ids)].slice(0, MAX_CHECKIN_ENTRIES) };
}

/** Keeps the 60 newest check-ins (by day) and drops invalid ones. */
export function normalizeSupplementCheckins(raw: unknown): Record<string, SupplementCheckin> {
  const out: Record<string, SupplementCheckin> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  const keys = Object.keys(raw as object)
    .filter(isDayKey)
    .sort()
    .reverse()
    .slice(0, MAX_CHECKIN_DAYS)
    .reverse();
  for (const k of keys) {
    const c = normalizeSupplementCheckin((raw as Record<string, unknown>)[k]);
    if (c) out[k] = c;
  }
  return out;
}

// --- Surfaces ------------------------------------------------------------------------------------

export const SUPPLEMENT_SURFACES: readonly SupplementSurface[] = [
  'strength',
  'sleep',
  'rpe',
  'protein',
  'trends',
  'afterWorkoutHints',
];

/**
 * Surfaces with no research behind them: derived from the coefficient table (every number of
 * the surface is experimental). None today. `trends` carries the bodyweight note and
 * `afterWorkoutHints` no number, so they are never experimental.
 */
export const EXPERIMENTAL_SURFACES: readonly SupplementSurface[] = SUPPLEMENT_SURFACES.filter(
  (s) => {
    const mine = SUPPLEMENT_EFFECT_KEYS.filter((k) => SUPPLEMENT_COEFFS[k].surface === s);
    return mine.length > 0 && mine.every((k) => SUPPLEMENT_COEFFS[k].experimental);
  },
);
export const isExperimentalSurface = (k: SupplementSurface): boolean =>
  EXPERIMENTAL_SURFACES.includes(k);

/** Is one switch effectively on (master on AND the surface on)? */
export const supplementSurfaceOn = (s: SupplementSettings, surface: SupplementSurface): boolean =>
  s.useInCalculations && s.surfaces[surface] !== false;

/** Number of surface switches that are on. */
export const supplementSurfacesOnCount = (s: SupplementSettings): number =>
  SUPPLEMENT_SURFACES.filter((k) => s.surfaces[k] !== false).length;

// --- Defaults and tolerant parsing -----------------------------------------------------------------

export const SUPPLEMENT_SETTINGS_VERSION = 1;
/** Sanity ceiling on saved entries (31 items; a few may repeat). */
export const MAX_SUPPLEMENT_ENTRIES = 60;

export const defaultSupplementSettings = (): SupplementSettings => ({
  version: SUPPLEMENT_SETTINGS_VERSION,
  useInCalculations: true,
  surfaces: Object.fromEntries(
    SUPPLEMENT_SURFACES.map((s) => [s, !isExperimentalSurface(s)]),
  ) as SupplementSettings['surfaces'],
  sharing: 'off',
  checkinsOn: false,
});

export const emptySupplementState = (): SupplementState => ({
  entries: [],
  checkins: {},
  settings: defaultSupplementSettings(),
  updatedAt: 0,
});

export const isSupplementSharing = (v: unknown): v is SupplementSettings['sharing'] =>
  v === 'off' || v === 'effects' || v === 'full';

/**
 * Cleans one entry from untrusted storage; null when it cannot be an entry. A missing or
 * invalid `startedAt` becomes `fallbackStartedAt` (never a date that would give a full ramp).
 */
export function normalizeSupplementEntry(
  raw: unknown,
  fallbackStartedAt: number = Date.now(),
): SupplementEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || !r.id || !isSupplementId(r.itemId)) return null;
  const item = supplementItem(r.itemId);
  return {
    id: r.id,
    itemId: r.itemId,
    dose: finite(r.dose) ? clampDose(item, r.dose) : item.defaultDose,
    schedule: SCHEDULES.includes(r.schedule as never)
      ? (r.schedule as SupplementEntry['schedule'])
      : item.schedule,
    timing: TIMINGS.includes(r.timing as never)
      ? (r.timing as SupplementEntry['timing'])
      : item.timing,
    startedAt: finite(r.startedAt) && r.startedAt > 0 ? Math.floor(r.startedAt) : fallbackStartedAt,
    active: r.active !== false,
  };
}

/** A fresh, valid entry for an item, with its catalog defaults. `startedAt` is "now". */
export function newSupplementEntry(
  itemId: SupplementId,
  id: string,
  startedAt: number = Date.now(),
  dose?: number,
): SupplementEntry {
  const item = supplementItem(itemId);
  return {
    id,
    itemId,
    dose: dose === undefined ? item.defaultDose : clampDose(item, dose),
    schedule: item.schedule,
    timing: item.timing,
    startedAt,
    active: true,
  };
}

/** Cleans a whole stored document; anything missing falls back to the defaults. */
export function normalizeSupplements(raw: unknown): SupplementState {
  const out = emptySupplementState();
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Record<string, unknown>;
  out.updatedAt = finite(r.updatedAt) && r.updatedAt > 0 ? r.updatedAt : 0;
  if (Array.isArray(r.entries)) {
    const seen = new Set<string>();
    for (const x of r.entries) {
      const e = normalizeSupplementEntry(x, out.updatedAt || Date.now());
      if (e && !seen.has(e.id) && out.entries.length < MAX_SUPPLEMENT_ENTRIES) {
        seen.add(e.id);
        out.entries.push(e);
      }
    }
  }
  const s = r.settings as Partial<SupplementSettings> | undefined;
  if (s && typeof s === 'object') {
    if (typeof s.useInCalculations === 'boolean')
      out.settings.useInCalculations = s.useInCalculations;
    if (typeof s.checkinsOn === 'boolean') out.settings.checkinsOn = s.checkinsOn;
    // Anything but a known level is the private default.
    if (isSupplementSharing(s.sharing)) out.settings.sharing = s.sharing;
    if (s.surfaces && typeof s.surfaces === 'object')
      for (const k of SUPPLEMENT_SURFACES)
        if (typeof s.surfaces[k] === 'boolean') out.settings.surfaces[k] = s.surfaces[k];
  }
  out.checkins = normalizeSupplementCheckins(r.checkins);
  return out;
}

/** Is there anything saved at all? */
export const hasSupplementData = (s: SupplementState | null | undefined): boolean =>
  !!s && Array.isArray(s.entries) && s.entries.length > 0;

/** Keeps `isCountedEntry` reachable for the UI next to the rest of the model. */
export { isCountedEntry };
