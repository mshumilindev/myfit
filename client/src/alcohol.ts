/**
 * Alcohol: pure data model + estimation math. No React, no store, no I/O.
 *
 * Product: the user says roughly how many servings of which bundled drink they have in an
 * ordinary week (no logging by day). Everything is turned into ONE number: grams of pure
 * alcohol a week (`alcoholCatalog.ts`). From it a few training numbers (readiness, deload
 * threshold, sleep need, progression step) are nudged quietly along a smooth saturating curve
 * that approaches, but never reaches, a cap.
 *
 * Two shapes of the same curve:
 *  - flat: no "usually drink on" days set. The weekly amount is spread evenly, the effect is
 *    the same every day (`alcoholEffects`).
 *  - day-aware: weekdays are set. The next-day numbers (readiness, sleep need) only move on the
 *    day AFTER a listed day, with the grams of one drinking day (weekly / number of days);
 *    other days stay neutral. Numbers that are not "next day" in nature (deload threshold,
 *    progression step) always follow the flat weekly curve (`alcoholEffectsFor(state, date)`).
 *
 * Every number lives in one table (`SURFACE_COEFFS`); each entry carries a `source` and a
 * `confidence` ('moderate' | 'weak' | 'none'). Readiness and sleep need have WEAK evidence
 * (population / lab studies of one drinking occasion); the deload threshold and the
 * progression step have none and are experimental (off by default). A surface whose
 * coefficients are all experimental starts OFF. Nothing here is medical advice, and all
 * results are ranges (`low`..`high`).
 *
 * Day check-ins: with "usually drink on" days set, the app asks on Today whether the user
 * actually drank; the answer replaces the usual-days assumption for that day.
 */
import {
  activeAlcoholEntries,
  alcoholItem,
  isAlcoholItemId,
  MAX_SERVING_ML,
  MAX_SERVINGS_PER_WEEK,
  MIN_SERVING_ML,
  weeklyGrams,
} from './alcoholCatalog';
import { isAlcoholRegion } from './alcoholRegion';
import type {
  AlcoholCheckin,
  AlcoholEntry,
  AlcoholSettings,
  AlcoholState,
  AlcoholSurface,
} from './types';

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
const round = (n: number, d = 2): number => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

/** Placeholder marker for a number that has no cited source yet. */
export const NO_SOURCE = 'none yet';

export type AlcoholConfidence = 'moderate' | 'weak' | 'none';

// --- Load -------------------------------------------------------------------------------------

export interface AlcoholLoad {
  /** Pure alcohol, grams in an ordinary week (a from-time-to-time drink adds a small amount). */
  gramsPerWeek: number;
  /** The same spread evenly over seven days. */
  gramsPerDay: number;
}

export function alcoholLoad(entries: readonly AlcoholEntry[]): AlcoholLoad {
  const gramsPerWeek = weeklyGrams(entries);
  return { gramsPerWeek, gramsPerDay: round(gramsPerWeek / 7, 2) };
}

// --- Per-surface coefficients (ALL PLACEHOLDER) ------------------------------------------------

/** The numeric surfaces (`trends` and `afterWorkoutHints` carry no number). */
export type AlcoholEffectKey = 'readiness' | 'sleepMin' | 'deloadThreshold' | 'progressionStep';

export interface AlcoholCoeff {
  /** Which switch gates it. */
  surface: AlcoholSurface;
  /** The ceiling: the largest change (fraction or minutes). The curve only approaches it. */
  cap: number;
  /**
   * Grams a week at which the flat change is half of `cap`:
   * change = cap x (1 - 2^(-grams / halfScaleG)).
   */
  halfScaleG: number;
  /**
   * Day-aware only: grams of ONE drinking day at which the day-after change is half of `cap`.
   * Null = this number is not a next-day one and always follows the flat curve.
   */
  sessionHalfG: number | null;
  source: string;
  confidence: AlcoholConfidence;
  /** True when there is no research behind it at all: off by default, shown as "Experimental". */
  experimental: boolean;
  /** 'mult': a factor (value = 1 -/+ change); 'add': a plain offset. */
  mode: 'mult' | 'add';
  /** -1 lowers the number (readiness), +1 raises it (sleep need). */
  sign: -1 | 1;
}

/**
 * Grams of ONE drinking occasion at which a next-day change is half of its cap. Shape only
 * (the studies give a few dose points, not a curve). With the readiness / sleep caps below it
 * gives about 3.7 % / 11 min (strong end) at 20 g and 7.5 % / 22 min at 60 g.
 */
export const DEFAULT_SESSION_HALF_G = 30;
/**
 * The same shape on a WEEKLY amount, for the flat view (no weekdays set): the weekly grams are
 * spread over seven days and read as the dose of an ordinary day, so 7 x the per-occasion
 * half scale. Deliberately conservative: an even daily average is a smaller dose than the
 * real drinking evenings.
 */
export const DEFAULT_HALF_SCALE_G = DEFAULT_SESSION_HALF_G * 7;
/** Weekly half scale of the numbers with no research (a pure guess). */
export const GUESS_HALF_SCALE_G = 150;

const READINESS_SOURCE =
  'Pietilä 2018, JMIR Ment Health (n=4,098; wearable recovery state lower after 0.25 / 0.25-0.75 / >0.75 g/kg by 9 / 24 / 39 units); de Zambotti 2021, Sleep (lab, placebo: nocturnal heart rate +4 % at 0.21-0.38 g/kg, +14 % at 0.64-0.71 g/kg, RMSSD lower even at the low dose). Magnitude is a weak prior for the day after one occasion: 0 to -3 % at about 20 g, -3 to -10 % at about 60 g; cap 10 %. The curve shape is a guess';
const SLEEP_SOURCE =
  'Ebrahim 2013, ACER (review: shorter sleep latency, later and lower REM, disrupted second half; no numbers); de Zambotti 2021, Sleep (lab, placebo). Magnitude is a weak prior for the night after one occasion: +0 to 15 min of sleep need at about 20 g, +15 to 30 min at about 60 g; cap 30 min. The curve shape is a guess';

export const SURFACE_COEFFS: Record<AlcoholEffectKey, AlcoholCoeff> = {
  // Readiness the day after drinking: approaches -10 % (weak evidence).
  readiness: {
    surface: 'readiness',
    cap: 0.1,
    halfScaleG: DEFAULT_HALF_SCALE_G,
    sessionHalfG: DEFAULT_SESSION_HALF_G,
    mode: 'mult',
    sign: -1,
    source: READINESS_SOURCE,
    confidence: 'weak',
    experimental: false,
  },
  // Sleep need the night after drinking: approaches +30 min of time in bed (weak evidence).
  sleepMin: {
    surface: 'sleep',
    cap: 30,
    halfScaleG: DEFAULT_HALF_SCALE_G,
    sessionHalfG: DEFAULT_SESSION_HALF_G,
    mode: 'add',
    sign: 1,
    source: SLEEP_SOURCE,
    confidence: 'weak',
    experimental: false,
  },
  // Deload threshold: no research at all. Guess: up to 6 % lower. Experimental, off by default.
  deloadThreshold: {
    surface: 'fatigue',
    cap: 0.06,
    halfScaleG: GUESS_HALF_SCALE_G,
    sessionHalfG: null,
    mode: 'mult',
    sign: -1,
    source: NO_SOURCE,
    confidence: 'none',
    experimental: true,
  },
  // Progression step: no research at all (the muscle studies are binge-dose only, see
  // ALCOHOL_SOURCES). Guess: up to 8 % smaller. Experimental, off by default.
  progressionStep: {
    surface: 'progression',
    cap: 0.08,
    halfScaleG: GUESS_HALF_SCALE_G,
    sessionHalfG: null,
    mode: 'mult',
    sign: -1,
    source: NO_SOURCE,
    confidence: 'none',
    experimental: true,
  },
};

// --- Sources shown on the "How is this estimated?" sheet -------------------------------------------

export interface AlcoholSourceEntry {
  /** Which i18n topic line it supports. */
  topic:
    | 'readiness'
    | 'heartRate'
    | 'sleep'
    | 'muscle'
    | 'strength'
    | 'review'
    | 'standardDrink'
    | 'guideline';
  /** Short citation (not translated). */
  cite: string;
  /** Not verified: shown with "approx.". */
  approx: boolean;
}

export const ALCOHOL_SOURCES: readonly AlcoholSourceEntry[] = [
  { topic: 'readiness', cite: 'Pietilä 2018, JMIR Ment Health (n=4,098)', approx: false },
  { topic: 'heartRate', cite: 'de Zambotti 2021, Sleep (lab, placebo)', approx: false },
  { topic: 'sleep', cite: 'Ebrahim 2013, ACER (review)', approx: false },
  {
    topic: 'muscle',
    cite: 'Parr 2014, PLoS ONE (1.5 g/kg): a binge dose only, not used for any number',
    approx: false,
  },
  {
    topic: 'strength',
    cite: 'Barnes 2011, Eur J Appl Physiol (0.5 g/kg): no strength difference, not used for any number',
    approx: false,
  },
  { topic: 'review', cite: 'Vella 2010, Nutrients', approx: false },
  { topic: 'standardDrink', cite: 'CDC: 14 g standard drink (US)', approx: false },
  {
    topic: 'guideline',
    cite: 'CCSA 2023 (Canada); UK CMO 2016, NHMRC 2020 (AU), NIAAA (US): figures not re-verified',
    approx: true,
  },
];

/** The i18n key and the English text of the one disclaimer the UI shows under the estimate. */
export const ALCOHOL_DISCLAIMER_KEY = 'alcoholDisclaimer';
export const ALCOHOL_DISCLAIMER_EN =
  'Estimates are based on population studies of alcohol, sleep and heart rate. Individual response varies. This is not medical advice. Alcohol has no proven safe level for health; see your national guidance.';

/** Share of the estimate shown as the milder end of the range. PLACEHOLDER. */
export const RANGE_LOW_SHARE = 0.5;

/** `low <= high`, always. For a mult effect 1 means "no change"; for an add effect 0 does. */
export interface Range {
  low: number;
  high: number;
}

export type AlcoholEffects = Record<AlcoholEffectKey, Range>;

export const NEUTRAL: Record<'mult' | 'add', number> = { mult: 1, add: 0 };
const neutralRange = (mode: 'mult' | 'add'): Range => ({ low: NEUTRAL[mode], high: NEUTRAL[mode] });

/**
 * Magnitude of the change (>= 0) for `grams` against a half-scale: 0 at no alcohol, strictly
 * increasing, always below `cap`.
 */
export function magnitude(cap: number, halfScale: number, grams: number): number {
  return cap * (1 - 2 ** (-Math.max(0, grams) / halfScale));
}

function rangeFor(c: AlcoholCoeff, hi: number): Range {
  const lo = hi * RANGE_LOW_SHARE;
  const a = NEUTRAL[c.mode] + c.sign * lo;
  const b = NEUTRAL[c.mode] + c.sign * hi;
  return { low: round(Math.min(a, b), 4), high: round(Math.max(a, b), 4) };
}

export const ALCOHOL_EFFECT_KEYS = Object.keys(SURFACE_COEFFS) as AlcoholEffectKey[];

/** Is this number a next-day one (readiness, sleep need) that the weekday pattern concentrates? */
export const isNextDayKey = (k: AlcoholEffectKey): boolean =>
  SURFACE_COEFFS[k].sessionHalfG !== null;

/** Flat effects of a weekly amount: the same every day. A switched-off surface stays neutral. */
export function effectsForLoad(
  load: AlcoholLoad,
  surfaces: Partial<Record<AlcoholSurface, boolean>> = {},
): AlcoholEffects {
  const out = {} as AlcoholEffects;
  for (const k of ALCOHOL_EFFECT_KEYS) {
    const c = SURFACE_COEFFS[k];
    out[k] =
      surfaces[c.surface] === false
        ? neutralRange(c.mode)
        : rangeFor(c, magnitude(c.cap, c.halfScaleG, load.gramsPerWeek));
  }
  return out;
}

// --- Weekdays ------------------------------------------------------------------------------------

/** 0 = Monday ... 6 = Sunday (ISO weekday - 1; NOT JavaScript's Sunday-first getDay). */
export const WEEKDAYS: readonly number[] = [0, 1, 2, 3, 4, 5, 6];

/** A calendar day: a Date, a ms timestamp, or a 'YYYY-MM-DD' string (read as a local day). */
export type DayInput = Date | number | string;

function toLocalDate(day: DayInput): Date | null {
  if (day instanceof Date) return Number.isNaN(day.getTime()) ? null : day;
  if (typeof day === 'number') return Number.isFinite(day) ? new Date(day) : null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(day);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(day);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Weekday of a day, 0 = Monday ... 6 = Sunday; null when the input is not a date. */
export function weekdayIndex(day: DayInput): number | null {
  const d = toLocalDate(day);
  return d ? (d.getDay() + 6) % 7 : null;
}

/** The local calendar day as 'YYYY-MM-DD'; null when the input is not a date. */
export function dayKey(day: DayInput): string | null {
  const d = toLocalDate(day);
  if (!d) return null;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** A 'YYYY-MM-DD' key `n` calendar days later (negative = earlier). DST-safe. */
export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + n))!;
}

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
const isDayKey = (k: unknown): k is string =>
  typeof k === 'string' && DAY_KEY.test(k) && dayKey(k) === k;

export const cleanUsualDays = (v: unknown): number[] =>
  Array.isArray(v)
    ? [...new Set(v.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6))].sort(
        (a, b) => a - b,
      )
    : [];

/** Grams of ONE usual drinking evening: the weekly grams over the number of usual days (0 = no pattern). */
export function usualOccasionGrams(
  entries: readonly AlcoholEntry[],
  usualDays: readonly number[],
): number {
  const n = cleanUsualDays(usualDays).length;
  return n ? round(weeklyGrams(entries) / n, 1) : 0;
}

/** Keeps the 60 newest check-ins (by day) and drops invalid ones. */
export const MAX_CHECKIN_DAYS = 60;
/** Sanity ceiling for a typed amount of one evening, grams. */
export const MAX_CHECKIN_GRAMS = 1000;

export function normalizeCheckin(raw: unknown): AlcoholCheckin | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.drank !== 'boolean') return null;
  const grams = finite(r.grams) ? clamp(round(r.grams, 1), 0, MAX_CHECKIN_GRAMS) : undefined;
  // "Drank" with no (or zero) grams still counts as the usual evening when grams is absent;
  // an explicit zero is "no alcohol".
  if (r.drank && grams === 0) return { drank: false };
  if (!r.drank) return { drank: false };
  const out: AlcoholCheckin = { drank: true };
  if (grams !== undefined) out.grams = grams;
  if (Array.isArray(r.entryIds)) {
    const ids = r.entryIds.filter((x): x is string => typeof x === 'string' && x.length > 0);
    if (ids.length) out.entryIds = [...new Set(ids)].slice(0, 50);
  }
  return out;
}

export function normalizeCheckins(raw: unknown): Record<string, AlcoholCheckin> {
  const out: Record<string, AlcoholCheckin> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  const keys = Object.keys(raw as object)
    .filter(isDayKey)
    .sort()
    .reverse()
    .slice(0, MAX_CHECKIN_DAYS)
    .reverse();
  for (const k of keys) {
    const c = normalizeCheckin((raw as Record<string, unknown>)[k]);
    if (c) out[k] = c;
  }
  return out;
}

/** The grams of the drinking evening `key`: a check-in if there is one, else the usual assumption. */
export function eveningGrams(
  key: string,
  usualDays: readonly number[],
  perOccasion: number,
  checkins: Record<string, AlcoholCheckin> | undefined,
): number {
  const c = checkins?.[key];
  if (c) return c.drank ? (c.grams ?? perOccasion) : 0;
  const wd = weekdayIndex(key);
  return wd !== null && usualDays.includes(wd) ? perOccasion : 0;
}

/**
 * Effects for one calendar day. Same as the flat effects when no weekdays are set (check-ins
 * are only asked, and only used, with weekdays). With weekdays set, the next-day numbers
 * (readiness, sleep need) follow the grams of the PREVIOUS evening:
 *  - a check-in for that evening wins (none = neutral, usual / typed = those grams);
 *  - no check-in: the usual assumption (weekly / number of usual days) on a usual day, else
 *    neutral.
 * The other numbers (deload threshold, progression step) always follow the flat weekly curve.
 */
export function effectsForDay(
  load: AlcoholLoad,
  settings: Pick<AlcoholSettings, 'surfaces' | 'usualDays'>,
  day: DayInput,
  checkins?: Record<string, AlcoholCheckin>,
): AlcoholEffects {
  const flat = effectsForLoad(load, settings.surfaces);
  const usual = cleanUsualDays(settings.usualDays);
  if (!usual.length) return flat;
  const today = dayKey(day);
  if (!today) return flat;
  const grams = eveningGrams(addDays(today, -1), usual, load.gramsPerWeek / usual.length, checkins);
  for (const k of ALCOHOL_EFFECT_KEYS) {
    const c = SURFACE_COEFFS[k];
    if (c.sessionHalfG === null || settings.surfaces[c.surface] === false) continue;
    flat[k] =
      grams > 0 ? rangeFor(c, magnitude(c.cap, c.sessionHalfG, grams)) : neutralRange(c.mode);
  }
  return flat;
}

type EffectState = Pick<AlcoholState, 'entries' | 'settings'> &
  Partial<Pick<AlcoholState, 'checkins'>>;

/**
 * What the app should apply right now (flat weekly smoothing), or null when nothing should
 * change: master switch off, or no active drink. Engines read this and treat null as "no
 * adjustment". Safe for an old / undefined state.
 */
export function alcoholEffects(state: EffectState | null | undefined): AlcoholEffects | null {
  if (!state?.settings?.useInCalculations) return null;
  const load = alcoholLoad(state.entries ?? []);
  if (load.gramsPerWeek <= 0) return null;
  return effectsForLoad(load, state.settings.surfaces);
}

/** The same for one calendar day, honouring "usually drink on" and the day check-ins. */
export function alcoholEffectsFor(
  state: EffectState | null | undefined,
  day: DayInput,
): AlcoholEffects | null {
  if (!state?.settings?.useInCalculations) return null;
  const load = alcoholLoad(state.entries ?? []);
  if (load.gramsPerWeek <= 0) return null;
  return effectsForDay(load, state.settings, day, state.checkins);
}

// --- Day check-ins ---------------------------------------------------------------------------------

/** Hour (local) from which TODAY's evening may be asked about: the evening is over by then. */
export const CHECKIN_FROM_HOUR = 21;
/** A check-in is never asked for a day older than this many days. */
export const CHECKIN_MAX_AGE_DAYS = 3;

export interface PendingCheckin {
  /** The drinking day being asked about, 'YYYY-MM-DD'. */
  date: string;
  /** The grams of a usual evening: what "As usual" means. */
  usualGrams: number;
}

/**
 * The one check-in to ask on Today, or null. Rules:
 *  - only when the master switch and "Ask me on Today" are on, "usually drink on" days are set and an active drink
 *    exists;
 *  - the candidates are the usual drinking days of the last 3 days that have no answer yet:
 *    today only from 21:00 (the evening is over), otherwise yesterday, 2 and 3 days ago;
 *  - one at a time, the MOST RECENT first (after it is answered, an older unanswered one may
 *    come up, never further back than 3 days).
 */
export function pendingAlcoholCheckin(
  now: DayInput,
  state: EffectState | null | undefined,
): PendingCheckin | null {
  if (!state?.settings?.useInCalculations || state.settings.checkinsOn !== true) return null;
  const usual = cleanUsualDays(state.settings.usualDays);
  if (!usual.length) return null;
  const entries = state.entries ?? [];
  if (!activeAlcoholEntries(entries).length) return null;
  const d = toLocalDate(now);
  const todayKey = dayKey(now);
  if (!d || !todayKey) return null;
  const usualGrams = usualOccasionGrams(entries, usual);
  if (usualGrams <= 0) return null;
  for (let back = d.getHours() >= CHECKIN_FROM_HOUR ? 0 : 1; back <= CHECKIN_MAX_AGE_DAYS; back++) {
    const key = addDays(todayKey, -back);
    const wd = weekdayIndex(key);
    if (wd !== null && usual.includes(wd) && !state.checkins?.[key])
      return { date: key, usualGrams };
  }
  return null;
}

export interface WeekActual {
  /** Grams actually answered so far this week (check-ins only). */
  grams: number;
  /** Days of the week up to today that have an answer, and how many of them were drinking days. */
  answeredDays: number;
  drinkDays: number;
  /** Usual days up to today with no answer yet (they still count by the usual assumption). */
  unansweredUsualDays: number;
  /** The planned weekly grams (the entries), for comparison. */
  plannedGrams: number;
  /** The week's first day (ISO 1 = Monday ... 7 = Sunday) and today, as day keys. */
  from: string;
  to: string;
}

/** What the week looks like so far, from the check-ins. `weekStart` is the ISO weekday the week begins on. */
export function alcoholWeekActual(
  state: EffectState | null | undefined,
  now: DayInput,
  weekStart = 1,
): WeekActual | null {
  const todayKey = dayKey(now);
  if (!todayKey) return null;
  const ws = Number.isInteger(weekStart) && weekStart >= 1 && weekStart <= 7 ? weekStart : 1;
  const wd = weekdayIndex(todayKey)!; // 0 = Monday
  const back = (wd - (ws - 1) + 7) % 7;
  const from = addDays(todayKey, -back);
  const usual = cleanUsualDays(state?.settings?.usualDays);
  let grams = 0;
  let answeredDays = 0;
  let drinkDays = 0;
  let unansweredUsualDays = 0;
  for (let i = 0; i <= back; i++) {
    const key = addDays(from, i);
    const c = state?.checkins?.[key];
    if (c) {
      answeredDays++;
      if (c.drank) {
        drinkDays++;
        grams += c.grams ?? usualOccasionGrams(state?.entries ?? [], usual);
      }
    } else if (usual.includes(weekdayIndex(key)!)) unansweredUsualDays++;
  }
  return {
    grams: round(grams, 1),
    answeredDays,
    drinkDays,
    unansweredUsualDays,
    plannedGrams: weeklyGrams(state?.entries ?? []),
    from,
    to: todayKey,
  };
}

// --- Surfaces ------------------------------------------------------------------------------------

export const ALCOHOL_SURFACES: readonly AlcoholSurface[] = [
  'readiness',
  'sleep',
  'fatigue',
  'progression',
  'trends',
  'afterWorkoutHints',
];

/**
 * Surfaces with no research behind them: derived from the coefficient table (every number of
 * the surface is experimental), so they turn on by default as soon as the table says so.
 * `trends` and `afterWorkoutHints` carry no number of their own and are never experimental.
 */
export const EXPERIMENTAL_SURFACES: readonly AlcoholSurface[] = ALCOHOL_SURFACES.filter((s) => {
  const mine = ALCOHOL_EFFECT_KEYS.filter((k) => SURFACE_COEFFS[k].surface === s);
  return mine.length > 0 && mine.every((k) => SURFACE_COEFFS[k].experimental);
});
export const isExperimentalSurface = (k: AlcoholSurface): boolean =>
  EXPERIMENTAL_SURFACES.includes(k);

/** Is one switch effectively on (master on AND the surface on)? */
export const surfaceOn = (s: AlcoholSettings, surface: AlcoholSurface): boolean =>
  s.useInCalculations && s.surfaces[surface] !== false;

/** Number of surface switches that are on. */
export const surfacesOnCount = (s: AlcoholSettings): number =>
  ALCOHOL_SURFACES.filter((k) => s.surfaces[k] !== false).length;

// --- Defaults and tolerant parsing -----------------------------------------------------------------

export const ALCOHOL_SETTINGS_VERSION = 1;

export const defaultAlcoholSettings = (): AlcoholSettings => ({
  version: ALCOHOL_SETTINGS_VERSION,
  useInCalculations: true,
  surfaces: Object.fromEntries(
    ALCOHOL_SURFACES.map((s) => [s, !isExperimentalSurface(s)]),
  ) as AlcoholSettings['surfaces'],
  sharing: 'off',
  usualDays: [],
  checkinsOn: false,
});

export const emptyAlcoholState = (): AlcoholState => ({
  entries: [],
  checkins: {},
  settings: defaultAlcoholSettings(),
  updatedAt: 0,
});

export const isAlcoholSharing = (v: unknown): v is AlcoholSettings['sharing'] =>
  v === 'off' || v === 'effects';

/** Cleans one entry from untrusted storage; null when it cannot be an entry. */
export function normalizeAlcoholEntry(raw: unknown): AlcoholEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || !r.id || !isAlcoholItemId(r.itemId)) return null;
  const item = alcoholItem(r.itemId);
  const e: AlcoholEntry = {
    id: r.id,
    itemId: r.itemId,
    servingMl: finite(r.servingMl)
      ? clamp(Math.round(r.servingMl), MIN_SERVING_ML, MAX_SERVING_ML)
      : item.servings.metric[Math.min(1, item.servings.metric.length - 1)],
    servingsPerWeek: finite(r.servingsPerWeek)
      ? clamp(round(r.servingsPerWeek, 1), 0, MAX_SERVINGS_PER_WEEK)
      : 0,
    active: r.active !== false,
  };
  if (r.occasional === true) e.occasional = true;
  return e;
}

/** A fresh, valid entry for an item, with its default serving and a starting count. */
export function newAlcoholEntry(
  itemId: AlcoholEntry['itemId'],
  id: string,
  servingMl?: number,
): AlcoholEntry {
  const item = alcoholItem(itemId);
  return {
    id,
    itemId,
    servingMl: servingMl ?? item.servings.metric[Math.min(1, item.servings.metric.length - 1)],
    servingsPerWeek: 3,
    active: true,
  };
}

/** Cleans a whole stored document; anything missing falls back to the defaults. */
export function normalizeAlcohol(raw: unknown): AlcoholState {
  const out = emptyAlcoholState();
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Record<string, unknown>;
  if (Array.isArray(r.entries)) {
    const seen = new Set<string>();
    for (const x of r.entries) {
      const e = normalizeAlcoholEntry(x);
      if (e && !seen.has(e.id)) {
        seen.add(e.id);
        out.entries.push(e);
      }
    }
  }
  const s = r.settings as Partial<AlcoholSettings> | undefined;
  if (s && typeof s === 'object') {
    if (typeof s.useInCalculations === 'boolean')
      out.settings.useInCalculations = s.useInCalculations;
    // Anything but a known level (a stray 'full') is the private default.
    if (isAlcoholSharing(s.sharing)) out.settings.sharing = s.sharing;
    if (s.surfaces && typeof s.surfaces === 'object')
      for (const k of ALCOHOL_SURFACES)
        if (typeof s.surfaces[k] === 'boolean') out.settings.surfaces[k] = s.surfaces[k];
    out.settings.usualDays = cleanUsualDays(s.usualDays);
    if (typeof s.checkinsOn === 'boolean') out.settings.checkinsOn = s.checkinsOn;
    if (isAlcoholRegion(s.regionOverride)) out.settings.regionOverride = s.regionOverride;
  }
  out.checkins = normalizeCheckins(r.checkins);
  out.updatedAt = finite(r.updatedAt) && r.updatedAt > 0 ? r.updatedAt : 0;
  return out;
}

/** Is there anything saved at all? */
export const hasAlcoholData = (a: AlcoholState | null | undefined): boolean =>
  !!a && Array.isArray(a.entries) && a.entries.length > 0;
