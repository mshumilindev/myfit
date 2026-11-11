/**
 * Nicotine: pure data model + estimation math. No React, no store, no I/O.
 *
 * Product: the user says roughly how much they use on an ordinary day (no counters, no
 * logging) and the strength per unit. Two numbers come out of every product:
 *  - `mgPerDay`: the LABELLED mg (amount x strength on the label). Display only.
 *  - `absorbedMgPerDay`: labelled mg x a per-kind absorption factor (`ABSORPTION`). This is
 *    what the body is assumed to take up, and it is the only thing the load is built from.
 * The combined load is the plain sum of absorbed mg per day; `cigEq` = absorbed mg divided by
 * `MG_PER_CIGARETTE_EQUIVALENT` (1 mg absorbed = 1 cigarette-equivalent). From it a few
 * training numbers (readiness, deload threshold, sleep need, warm-up, rest, progression
 * step, RPE) are nudged quietly along a smooth saturating curve that approaches, but never
 * reaches, a cap.
 *
 * Every number lives in two tables (`ABSORPTION`, `SURFACE_COEFFS`); each entry carries a
 * `source` (short citation, or "none yet") and a `confidence` ('moderate' | 'weak' | 'none').
 * Only readiness and sleep have (weak) research behind them. The five surfaces with no
 * research at all (deload threshold, warm-up, rest, progression, RPE) are `experimental`:
 * their caps are guesses, they are OFF by default and only run when the user switches them
 * on. Nothing here is medical advice, and all results are ranges (`low`..`high`).
 */
import type {
  NicotineKind,
  NicotineProduct,
  NicotineSettings,
  NicotineState,
  NicotineSurface,
  NicotineUnit,
} from './types';

// --- Catalog (the 10 tiles of board 2A) ---------------------------------------------------

export interface NicotineKindInfo {
  kind: NicotineKind;
  /** Units the amount can be counted in; the first is the default. */
  units: readonly NicotineUnit[];
  /** What `strengthMg` is "per": cigarette | stick | ml | pouch | portion | bowl | session | use. */
  strengthPer:
    'cigarette' | 'cigar' | 'stick' | 'ml' | 'pouch' | 'portion' | 'bowl' | 'session' | 'use';
  /** Suggested strength when the user has not typed one. PLACEHOLDER. */
  defaultStrengthMg: number;
  /** Suggested usual amount for a fresh product (in the first unit). */
  defaultAmount: number;
}

/** Tile order of board 2A. */
export const NICOTINE_KINDS: readonly NicotineKindInfo[] = [
  {
    kind: 'cigarettes',
    units: ['pieces', 'packs'],
    strengthPer: 'cigarette',
    defaultStrengthMg: 1,
    defaultAmount: 10,
  },
  {
    kind: 'cigars',
    units: ['pieces'],
    strengthPer: 'cigar',
    defaultStrengthMg: 4,
    defaultAmount: 1,
  },
  { kind: 'pipe', units: ['bowls'], strengthPer: 'bowl', defaultStrengthMg: 6, defaultAmount: 2 },
  {
    kind: 'heated',
    units: ['sticks', 'packs'],
    strengthPer: 'stick',
    defaultStrengthMg: 1,
    defaultAmount: 8,
  },
  {
    kind: 'vape',
    units: ['ml', 'pods', 'puffs', 'sessions'],
    strengthPer: 'ml',
    defaultStrengthMg: 20,
    defaultAmount: 1.5,
  },
  {
    kind: 'pouches',
    units: ['pouches'],
    strengthPer: 'pouch',
    defaultStrengthMg: 6,
    defaultAmount: 6,
  },
  {
    kind: 'snus',
    units: ['pouches'],
    strengthPer: 'pouch',
    defaultStrengthMg: 8,
    defaultAmount: 6,
  },
  {
    kind: 'chew',
    units: ['portions'],
    strengthPer: 'portion',
    defaultStrengthMg: 6,
    defaultAmount: 3,
  },
  {
    kind: 'hookah',
    units: ['sessions'],
    strengthPer: 'session',
    defaultStrengthMg: 5,
    defaultAmount: 1,
  },
  { kind: 'other', units: ['uses'], strengthPer: 'use', defaultStrengthMg: 1, defaultAmount: 1 },
];

const KIND_BY_ID = new Map<NicotineKind, NicotineKindInfo>(NICOTINE_KINDS.map((k) => [k.kind, k]));
export const isNicotineKind = (v: unknown): v is NicotineKind => KIND_BY_ID.has(v as NicotineKind);
export const nicotineKindInfo = (kind: NicotineKind): NicotineKindInfo => KIND_BY_ID.get(kind)!;
const ALL_UNITS = new Set<string>(NICOTINE_KINDS.flatMap((k) => k.units));
const isUnit = (v: unknown): v is NicotineUnit => typeof v === 'string' && ALL_UNITS.has(v);

// --- Sources shown on the "How is this estimated?" sheet --------------------------------------

export interface NicotineSourceEntry {
  /** Which i18n topic line it supports. */
  topic: 'absorb' | 'heated' | 'vape' | 'sleep' | 'hrv';
  /** Short citation (not translated). */
  cite: string;
  /** Recalled from memory and not verified: shown with "approx.". */
  approx: boolean;
}

export const NICOTINE_SOURCES: readonly NicotineSourceEntry[] = [
  {
    topic: 'absorb',
    cite: 'Benowitz & Jacob 1984, Clin Pharmacol Ther 35:499 (mg per cigarette not verified); Digard et al. 2013, Nicotine Tob Res 15:255',
    approx: false,
  },
  {
    topic: 'heated',
    cite: 'Phillips-Waller et al. 2021, Nicotine Tob Res 23:1889; Cao et al. 2025, Nicotine Tob Res 27:783',
    approx: false,
  },
  {
    topic: 'vape',
    cite: 'Jacobson et al. 2021, Toxicol Rep 8:84; Hajek et al. 2020, Addiction',
    approx: false,
  },
  {
    topic: 'sleep',
    cite: 'Zhang et al. 2006, Am J Epidemiol 164:529; Catoire et al. 2021, Sleep Med Rev 60:101544',
    approx: false,
  },
  {
    topic: 'hrv',
    cite: 'Dinas et al. 2013, Int J Cardiol 163:109 (systematic review)',
    approx: false,
  },
];

// --- Unit conversions (PLACEHOLDER constants) ---------------------------------------------

/** A pack of cigarettes or heated sticks. */
export const PIECES_PER_PACK = 20;
/** Vape: ml of liquid per puff (about 50 puffs per ml). PLACEHOLDER. */
export const ML_PER_PUFF = 0.02;
/** Vape: ml of liquid per "session" of about 10 puffs. PLACEHOLDER. */
export const ML_PER_VAPE_SESSION = 0.2;
/** Vape: ml in one pod when the user did not say. PLACEHOLDER (pods are typically 0.7 to 2 ml). */
export const DEFAULT_ML_PER_POD = 2;
/** A from-time-to-time product counts as about one base unit a week (stick, pouch...). PLACEHOLDER. */
export const OCCASIONAL_UNITS_PER_DAY = 1 / 7;
/** Same for a vape: one session of liquid a week, in ml a day. PLACEHOLDER. */
export const OCCASIONAL_ML_PER_DAY = ML_PER_VAPE_SESSION / 7;
/** Sanity ceilings so a typo cannot produce absurd numbers. */
export const MAX_AMOUNT_PER_DAY = 500;
export const MAX_STRENGTH_MG = 200;

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
const round = (n: number, d = 2): number => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

/** Units the user may pick for a kind (first = default). */
export const unitsFor = (kind: NicotineKind): readonly NicotineUnit[] =>
  nicotineKindInfo(kind).units;

/** How many base units (cigarette, stick, pouch, ... or ml for a vape) one `unit` is. */
export function baseUnitsPer(p: Pick<NicotineProduct, 'kind' | 'unit' | 'mlPerPod'>): number {
  if (p.kind === 'vape') {
    switch (p.unit) {
      case 'ml':
        return 1;
      case 'pods':
        return finite(p.mlPerPod) && p.mlPerPod > 0 ? p.mlPerPod : DEFAULT_ML_PER_POD;
      case 'puffs':
        return ML_PER_PUFF;
      case 'sessions':
        return ML_PER_VAPE_SESSION;
      default:
        return 0; // not a vape unit
    }
  }
  if (!unitsFor(p.kind).includes(p.unit)) return 0;
  return p.unit === 'packs' ? PIECES_PER_PACK : 1;
}

/** A fresh, valid product for a kind, filled with the suggested unit, amount and strength. */
export function newNicotineProduct(kind: NicotineKind, id: string): NicotineProduct {
  const k = nicotineKindInfo(kind);
  return {
    id,
    kind,
    unit: k.units[0],
    amount: k.defaultAmount,
    strengthMg: k.defaultStrengthMg,
    active: true,
  };
}

/** Changing the unit keeps the real daily amount where it can (packs <-> pieces). */
export function convertAmount(p: NicotineProduct, unit: NicotineUnit): number {
  const from = baseUnitsPer(p);
  const to = baseUnitsPer({ ...p, unit });
  if (!from || !to) return p.amount;
  return round((p.amount * from) / to, 2);
}

// --- Absorption (PLACEHOLDER table) ---------------------------------------------------------

/** Placeholder marker for a number that has no cited source yet. */
export const NO_SOURCE = 'none yet';

/** How well a number is backed: 'none' = a guess, with no research behind it. */
export type NicotineConfidence = 'moderate' | 'weak' | 'none';

export interface AbsorptionEntry {
  /**
   * Share of the LABELLED mg that is assumed to be absorbed (>= 0). Labelled mg is the
   * strength on the pack times the amount: mg per cigarette/stick/pouch, or mg/ml x ml of
   * e-liquid. Cigarette 1 means "1 mg labelled = 1 mg absorbed", the unit of a cig-eq.
   */
  factor: number;
  /** Where the factor comes from. "none yet" when there is no citation. */
  source: string;
  confidence: NicotineConfidence;
}

/** One table; change numbers here only. Cited entries say where the figure comes from. */
export const ABSORPTION: Record<NicotineKind, AbsorptionEntry> = {
  // The reference unit: 1 mg labelled per cigarette counts as 1 mg absorbed. The mg per
  // cigarette itself is not verified (machine yield of 0.9-2.1 mg is not absorption).
  cigarettes: {
    factor: 1,
    source:
      'Reference unit, mg per cigarette not verified (machine yield is not absorption, Digard et al. 2013, Nicotine Tob Res 15:255); Benowitz & Jacob 1984, Clin Pharmacol Ther 35:499',
    confidence: 'weak',
  },
  // Cigars and pipe are mostly not inhaled, the label (per cigar/bowl) overstates intake.
  cigars: { factor: 0.5, source: NO_SOURCE, confidence: 'none' },
  pipe: { factor: 0.5, source: NO_SOURCE, confidence: 'none' },
  // Heated tobacco: about half of a cigarette's nicotine (IQOS 0.5-0.66, glo about 0.5).
  heated: {
    factor: 0.6,
    source:
      'Phillips-Waller et al. 2021, Nicotine Tob Res 23:1889 (IQOS about half of a cigarette, AUC0-30); Toxics 2023;11:525 (IQOS 0.66, glo 0.49 AUC); Cao et al. 2025, Nicotine Tob Res 27:783 (Cmax similar, AUC lower)',
    confidence: 'moderate',
  },
  // Vape: no reliable per-ml factor; 0.3 is a conservative guess.
  vape: {
    factor: 0.3,
    source:
      'Jacobson et al. 2021, Toxicol Rep 8:84 (27 studies; median Cmax 7.8 vs 18 ng/mL for cigarettes; strength a weak predictor, r=0.15); Hajek et al. 2020, Addiction (Juul). No reliable per-ml factor; device and experience dependent',
    confidence: 'weak',
  },
  // Nicotine pouches: up to 4 mg about 0.9x a cigarette's AUC (0.7x Cmax); 8 mg and above more.
  pouches: {
    factor: 0.5,
    source:
      'Nicotine pouch meta-analysis (up to 4 mg: about 0.9x cigarette AUC, 0.7x Cmax; 8 mg and above higher than a cigarette); citation not verified',
    confidence: 'moderate',
  },
  // Snus: 24-32 % of the content is extracted (about 3.4-4.5 mg absorbed per pouch).
  snus: {
    factor: 0.3,
    source:
      'Digard et al. 2013, Nicotine Tob Res 15:255 (24-32 % of the content extracted, about 3.4-4.5 mg per pouch)',
    confidence: 'moderate',
  },
  chew: { factor: 0.5, source: NO_SOURCE, confidence: 'none' },
  hookah: { factor: 0.3, source: NO_SOURCE, confidence: 'none' },
  other: { factor: 0.5, source: NO_SOURCE, confidence: 'none' },
};

// --- Sums ----------------------------------------------------------------------------------

/** LABELLED mg of nicotine per day from one product (0 when invalid or inactive). */
export function productMgPerDay(p: NicotineProduct): number {
  if (!p.active || !finite(p.strengthMg)) return 0;
  const strength = clamp(p.strengthMg, 0, MAX_STRENGTH_MG);
  // From time to time: a small fixed background amount, whatever the amount field holds.
  if (p.occasional) {
    return (p.kind === 'vape' ? OCCASIONAL_ML_PER_DAY : OCCASIONAL_UNITS_PER_DAY) * strength;
  }
  if (!finite(p.amount)) return 0;
  const amount = clamp(p.amount, 0, MAX_AMOUNT_PER_DAY);
  return amount * baseUnitsPer(p) * strength;
}

/** Absorbed mg per day from one product: labelled mg x the kind's absorption factor. */
export function productAbsorbedMgPerDay(p: NicotineProduct): number {
  return productMgPerDay(p) * ABSORPTION[p.kind].factor;
}

/** The plain sum of LABELLED mg of nicotine per day over the active products. */
export function nicotineMgPerDay(products: readonly NicotineProduct[]): number {
  let sum = 0;
  for (const p of products) sum += productMgPerDay(p);
  return round(sum, 1);
}

/** The plain sum of ABSORBED mg per day over the active products (the load is built on it). */
export function nicotineAbsorbedMgPerDay(products: readonly NicotineProduct[]): number {
  let sum = 0;
  for (const p of products) sum += productAbsorbedMgPerDay(p);
  return round(sum, 3);
}

export const activeNicotineProducts = (products: readonly NicotineProduct[]): NicotineProduct[] =>
  products.filter((p) => productMgPerDay(p) > 0);

// --- Load ------------------------------------------------------------------------------------

/**
 * One cigarette-equivalent (cig-eq) is 1 mg of ABSORBED nicotine. PLACEHOLDER (no medical
 * source): a smoked cigarette is taken to deliver about 1 mg to the body.
 */
export const MG_PER_CIGARETTE_EQUIVALENT = 1;

export interface NicotineLoad {
  /** Labelled mg a day (what the packs say). Display only. */
  mgPerDay: number;
  /** Absorbed mg a day (labelled x absorption factor). */
  absorbedMgPerDay: number;
  /** Normalised: absorbed mg / `MG_PER_CIGARETTE_EQUIVALENT`, cigarette-equivalents per day. */
  cigEq: number;
}

export function nicotineLoad(products: readonly NicotineProduct[]): NicotineLoad {
  const mgPerDay = nicotineMgPerDay(products);
  const absorbedMgPerDay = nicotineAbsorbedMgPerDay(products);
  return {
    mgPerDay,
    absorbedMgPerDay,
    cigEq: round(absorbedMgPerDay / MG_PER_CIGARETTE_EQUIVALENT, 3),
  };
}

export type NicotineScenario = 'less' | 'none';
/** What the "without nicotine" card compares against. */
export const SCENARIO_FACTOR: Record<NicotineScenario, number> = { less: 0.5, none: 0 };

/** The same load at half ('less') or none. Feed it to the same effect formulas. */
export function withoutNicotine(load: NicotineLoad, scenario: NicotineScenario): NicotineLoad {
  const f = SCENARIO_FACTOR[scenario];
  return {
    mgPerDay: round(load.mgPerDay * f, 1),
    absorbedMgPerDay: round(load.absorbedMgPerDay * f, 3),
    cigEq: round(load.cigEq * f, 3),
  };
}

// --- Per-surface coefficients (ALL PLACEHOLDER) ---------------------------------------------

/** The numeric surfaces (`trends` and `afterWorkoutHints` carry no number). */
export type NicotineEffectKey =
  | 'readiness'
  | 'deloadThreshold'
  | 'sleepMin'
  | 'warmupMin'
  | 'restPct'
  | 'progressionStep'
  | 'rpe';

export interface Coeff {
  /** Which switch gates it. */
  surface: NicotineSurface;
  /**
   * The ceiling: the largest change this can make (fraction, minutes or RPE points). The
   * curve only approaches it asymptotically, so no load ever reaches it.
   */
  cap: number;
  /**
   * Cig-eq a day at which the change is half of `cap`. Smaller = saturates sooner.
   * change = cap x (1 - 2^(-cigEq / halfScale)): rises smoothly, always increasing.
   */
  halfScale: number;
  /** Source of `cap` (and the direction). "none yet" when there is no research. */
  source: string;
  confidence: NicotineConfidence;
  /**
   * True when there is no research behind it at all (`confidence` 'none'): off by default,
   * shown in its own "Experimental" group. `halfScale` is a shape guess for every surface
   * (the dose-response is only known to be concave / saturating, Hackshaw et al., BMJ 2018,
   * for cardiovascular risk), so it carries no source of its own.
   */
  experimental: boolean;
  /** 'mult': a factor applied to the number (value = 1 -/+ change); 'add': a plain offset. */
  mode: 'mult' | 'add';
  /** Direction of the change: -1 lowers the number (readiness), +1 raises it (sleep need). */
  sign: -1 | 1;
}

/**
 * Cig-eq a day at which a change is half of its cap. Shape only, tuned so that a pack a day
 * (20 cig-eq) gives about 65 % of the cap, and 40 cig-eq about 88 %.
 */
export const DEFAULT_HALF_SCALE = 13;

export const SURFACE_COEFFS: Record<NicotineEffectKey, Coeff> = {
  // Readiness: approaches -5 % (weak evidence).
  readiness: {
    surface: 'readiness',
    cap: 0.05,
    halfScale: DEFAULT_HALF_SCALE,
    mode: 'mult',
    sign: -1,
    source:
      'Directional, unquantified: chronic smokers have reduced HRV (Dinas et al. 2013, Int J Cardiol 163:109, systematic review, no pooled magnitude). The 5 % cap is a conservative prior. Curve shape: Hackshaw et al. 2018, BMJ 360:j5855 (concave dose-response, for cardiovascular risk)',
    confidence: 'weak',
    experimental: false,
  },
  // Deload threshold: no research. Guess: up to 10 % lower.
  deloadThreshold: {
    surface: 'fatigue',
    cap: 0.1,
    halfScale: DEFAULT_HALF_SCALE,
    mode: 'mult',
    sign: -1,
    source: NO_SOURCE,
    confidence: 'none',
    experimental: true,
  },
  // Sleep need: approaches +15 min of time in bed (weak evidence).
  sleepMin: {
    surface: 'sleep',
    cap: 15,
    halfScale: DEFAULT_HALF_SCALE,
    mode: 'add',
    sign: 1,
    source:
      'Zhang et al. 2006, Am J Epidemiol 164:529 (SHHS, n=6400): current vs never smokers sleep latency +5.4 min, total sleep time -14.0 min, former smokers no different; Catoire et al. 2021, Sleep Med Rev 60:101544 (more wake after sleep onset, less slow-wave sleep). Applies to current smokers; no data for vapers or pouch users',
    confidence: 'weak',
    experimental: false,
  },
  // Warm-up: no research. Guess: up to +2 min.
  warmupMin: {
    surface: 'warmup',
    cap: 2,
    halfScale: DEFAULT_HALF_SCALE,
    mode: 'add',
    sign: 1,
    source: NO_SOURCE,
    confidence: 'none',
    experimental: true,
  },
  // Rest between sets: no research. Guess: up to +10 %.
  restPct: {
    surface: 'rest',
    cap: 0.1,
    halfScale: DEFAULT_HALF_SCALE,
    mode: 'mult',
    sign: 1,
    source: NO_SOURCE,
    confidence: 'none',
    experimental: true,
  },
  // Progression step: no research. Guess: up to 15 % smaller.
  progressionStep: {
    surface: 'progression',
    cap: 0.15,
    halfScale: DEFAULT_HALF_SCALE,
    mode: 'mult',
    sign: -1,
    source: NO_SOURCE,
    confidence: 'none',
    experimental: true,
  },
  // RPE target: no research. Guess: up to -0.5.
  rpe: {
    surface: 'rpe',
    cap: 0.5,
    halfScale: DEFAULT_HALF_SCALE,
    mode: 'add',
    sign: -1,
    source: NO_SOURCE,
    confidence: 'none',
    experimental: true,
  },
};

/**
 * How much of the estimate to show as the milder end of the range. The strong end is the
 * formula as is; the mild end is this share of it. PLACEHOLDER.
 */
export const RANGE_LOW_SHARE = 0.5;

/** `low <= high`, always. For a mult effect 1 means "no change"; for an add effect 0 does. */
export interface Range {
  low: number;
  high: number;
}

export type NicotineEffects = Record<NicotineEffectKey, Range>;

export const NEUTRAL: Record<'mult' | 'add', number> = { mult: 1, add: 0 };

const neutralRange = (mode: 'mult' | 'add'): Range => ({ low: NEUTRAL[mode], high: NEUTRAL[mode] });

/**
 * Magnitude of the change (>= 0) at full strength of the estimate: a smooth saturating
 * curve, 0 at no load, strictly increasing, always below `cap`.
 */
export function magnitude(c: Pick<Coeff, 'cap' | 'halfScale'>, cigEq: number): number {
  return c.cap * (1 - 2 ** (-Math.max(0, cigEq) / c.halfScale));
}

function rangeFor(c: Coeff, cigEq: number): Range {
  const hi = magnitude(c, cigEq);
  const lo = hi * RANGE_LOW_SHARE;
  const a = NEUTRAL[c.mode] + c.sign * lo;
  const b = NEUTRAL[c.mode] + c.sign * hi;
  return { low: round(Math.min(a, b), 4), high: round(Math.max(a, b), 4) };
}

const KEYS = Object.keys(SURFACE_COEFFS) as NicotineEffectKey[];

/**
 * The adjustment of every numeric surface for a load. A surface whose switch is off stays
 * neutral. Pure: callers decide whether the master switch lets this be used at all (see
 * `nicotineEffects`).
 */
export function effectsForLoad(
  load: NicotineLoad,
  surfaces: Partial<Record<NicotineSurface, boolean>> = {},
): NicotineEffects {
  const out = {} as NicotineEffects;
  for (const k of KEYS) {
    const c = SURFACE_COEFFS[k];
    out[k] = surfaces[c.surface] === false ? neutralRange(c.mode) : rangeFor(c, load.cigEq);
  }
  return out;
}

/**
 * What the app should apply right now, or null when nothing should change: master switch
 * off, or no active product. Engines read this and treat null as "no adjustment".
 */
export function nicotineEffects(
  state: Pick<NicotineState, 'products' | 'settings'>,
): NicotineEffects | null {
  if (!state.settings.useInCalculations) return null;
  const load = nicotineLoad(state.products);
  if (load.absorbedMgPerDay <= 0) return null;
  return effectsForLoad(load, state.settings.surfaces);
}

/** Is one switch effectively on (master on AND the surface on)? */
export const surfaceOn = (s: NicotineSettings, surface: NicotineSurface): boolean =>
  s.useInCalculations && s.surfaces[surface] !== false;

/** Number of surface switches that are on, for the "7 on" row of Advanced. */
export const surfacesOnCount = (s: NicotineSettings): number =>
  NICOTINE_SURFACES.filter((k) => s.surfaces[k] !== false).length;

/** Surfaces with some (weak) research behind them: on by default. */
export const EVIDENCE_SURFACES: readonly NicotineSurface[] = [
  'readiness',
  'sleep',
  'trends',
  'afterWorkoutHints',
];
/** Surfaces with no research at all: off by default, shown as "Experimental". */
export const EXPERIMENTAL_SURFACES: readonly NicotineSurface[] = [
  'fatigue',
  'warmup',
  'rest',
  'progression',
  'rpe',
];
export const isExperimentalSurface = (k: NicotineSurface): boolean =>
  (EXPERIMENTAL_SURFACES as readonly string[]).includes(k);

export const NICOTINE_SURFACES: readonly NicotineSurface[] = [
  'readiness',
  'fatigue',
  'sleep',
  'warmup',
  'rest',
  'progression',
  'rpe',
  'trends',
  'afterWorkoutHints',
];

// --- Summary-card hints ("Without nicotine", boards 4A / 4E) ---------------------------------

/** The user's own baselines, measured from their history (all optional). */
export interface NicotineBaselines {
  /** Their typical recovery gap between hard sessions of the same muscle, in hours. */
  recoveryGapHours?: number | null;
  /** Their average sleep, in minutes. */
  avgSleepMin?: number | null;
}

export interface NicotineHintValues {
  /** Hours shorter the recovery gap could be (>= 0). */
  recoveryGapShorterHours: Range | null;
  /** Minutes less sleep the body would need (>= 0); compare with their average sleep. */
  sleepNeedLessMin: Range | null;
}

export interface NicotineSummaryHints {
  /** Labelled mg a day. */
  mgPerDay: number;
  /** Absorbed mg a day, the base of the load. */
  absorbedMgPerDay: number;
  cigEq: number;
  /** Half the amount / none, each with its own numbers. */
  less: NicotineHintValues;
  none: NicotineHintValues;
  /** The baselines echoed back so the "How is this estimated?" sheet can show them. */
  baselines: Required<{ [K in keyof NicotineBaselines]: number | null }>;
}

const positive = (n: unknown): n is number => finite(n) && n > 0;

function hintValues(
  now: NicotineEffects,
  alt: NicotineEffects,
  b: NicotineBaselines,
  on: { readiness: boolean; sleep: boolean },
): NicotineHintValues {
  // Magnitudes: readiness is 1 - factor. Pair the strong end with the strong end.
  const rNow = { lo: 1 - now.readiness.high, hi: 1 - now.readiness.low };
  const rAlt = { lo: 1 - alt.readiness.high, hi: 1 - alt.readiness.low };
  const gain = (m: { lo: number; hi: number }, m2: { lo: number; hi: number }) => ({
    lo: Math.max(0, m.lo - m2.lo),
    hi: Math.max(0, m.hi - m2.hi),
  });
  const rd = gain(rNow, rAlt);
  const out: NicotineHintValues = {
    recoveryGapShorterHours: null,
    sleepNeedLessMin: null,
  };

  if (on.readiness && positive(b.recoveryGapHours) && rd.hi > 0) {
    // Recovery speed follows readiness, so the gap scales by (1 - now) / (1 - alt).
    const shorter = (n: number, a: number) => b.recoveryGapHours! * (1 - (1 - n) / (1 - a));
    out.recoveryGapShorterHours = {
      low: round(Math.max(0, shorter(rNow.lo, rAlt.lo)), 1),
      high: round(Math.max(0, shorter(rNow.hi, rAlt.hi)), 1),
    };
  }
  if (on.sleep && positive(b.avgSleepMin)) {
    const lo = Math.max(0, now.sleepMin.low - alt.sleepMin.low);
    const hi = Math.max(0, now.sleepMin.high - alt.sleepMin.high);
    if (hi > 0) out.sleepNeedLessMin = { low: round(lo, 0), high: round(hi, 0) };
  }
  return out;
}

const hasAny = (h: NicotineHintValues): boolean =>
  h.recoveryGapShorterHours !== null || h.sleepNeedLessMin !== null;

/**
 * The "Without nicotine" card: the same formulas at x0.5 and x0, expressed in the user's own
 * baselines. Null when the master switch or the hints switch is off, when there are no
 * active products, or when no baseline yields a hint (nothing worth showing).
 */
export function summaryHints(
  state: Pick<NicotineState, 'products' | 'settings'>,
  baselines: NicotineBaselines,
): NicotineSummaryHints | null {
  const { settings } = state;
  if (!settings.useInCalculations || settings.surfaces.afterWorkoutHints === false) return null;
  const load = nicotineLoad(state.products);
  if (load.absorbedMgPerDay <= 0) return null;
  const now = effectsForLoad(load, settings.surfaces);
  const on = {
    readiness: settings.surfaces.readiness !== false,
    sleep: settings.surfaces.sleep !== false,
  };
  const less = hintValues(
    now,
    effectsForLoad(withoutNicotine(load, 'less'), settings.surfaces),
    baselines,
    on,
  );
  const none = hintValues(
    now,
    effectsForLoad(withoutNicotine(load, 'none'), settings.surfaces),
    baselines,
    on,
  );
  if (!hasAny(less) && !hasAny(none)) return null;
  return {
    mgPerDay: load.mgPerDay,
    absorbedMgPerDay: load.absorbedMgPerDay,
    cigEq: load.cigEq,
    less,
    none,
    baselines: {
      recoveryGapHours: positive(baselines.recoveryGapHours) ? baselines.recoveryGapHours : null,
      avgSleepMin: positive(baselines.avgSleepMin) ? baselines.avgSleepMin : null,
    },
  };
}

// --- Summary text -----------------------------------------------------------------------------

/** Active products by size of contribution (labelled mg), biggest first (stable on ties). */
export function productsByLoad(products: readonly NicotineProduct[]): NicotineProduct[] {
  return activeNicotineProducts(products)
    .map((p, i) => ({ p, i, mg: productMgPerDay(p) }))
    .sort((a, b) => b.mg - a.mg || a.i - b.i)
    .map((x) => x.p);
}

/**
 * "Vape + Heated tobacco · ≈ 38 mg a day". `labelOf` supplies the localized product name
 * and `perDay` the localized "mg a day" tail (the UI passes its translations; the defaults
 * are English). Null when nothing is active.
 */
export function nicotineSummaryText(
  products: readonly NicotineProduct[],
  labelOf: (kind: NicotineKind) => string,
  perDay: (mg: number) => string = (mg) => `${mg} mg a day`,
  more: (n: number) => string = (n) => `${n} more`,
): string | null {
  const list = productsByLoad(products);
  if (!list.length) return null;
  const names: string[] = [];
  for (const p of list) {
    const n = labelOf(p.kind);
    if (!names.includes(n)) names.push(n);
  }
  const mg = nicotineMgPerDay(products);
  // At most two names, then "N more" (the same rule on all three hubs).
  const shown = names.slice(0, 2);
  const rest = names.length - shown.length;
  const head = rest > 0 ? `${shown.join(' + ')} + ${more(rest)}` : shown.join(' + ');
  // Under 10 mg keep one decimal, so a small from-time-to-time amount does not read as 0.
  return `${head} · ≈ ${perDay(mg < 10 ? round(mg, 1) : Math.round(mg))}`;
}

// --- Defaults and tolerant parsing ------------------------------------------------------------

/** Current settings version. v2: surfaces without research (experimental) are off by default. */
export const NICOTINE_SETTINGS_VERSION = 2;

export const defaultNicotineSettings = (): NicotineSettings => ({
  version: NICOTINE_SETTINGS_VERSION,
  useInCalculations: true,
  // Experimental surfaces (no research) start OFF; the rest on.
  surfaces: Object.fromEntries(
    NICOTINE_SURFACES.map((s) => [s, !isExperimentalSurface(s)]),
  ) as NicotineSettings['surfaces'],
  sharing: 'off',
});

export const emptyNicotineState = (): NicotineState => ({
  products: [],
  settings: defaultNicotineSettings(),
  updatedAt: 0,
});

export const isNicotineSharing = (v: unknown): v is NicotineSettings['sharing'] =>
  v === 'off' || v === 'effects' || v === 'full';

/** Cleans one product from untrusted storage; null when it cannot be a product. */
export function normalizeNicotineProduct(raw: unknown): NicotineProduct | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || !r.id || !isNicotineKind(r.kind)) return null;
  const info = nicotineKindInfo(r.kind);
  const unit = isUnit(r.unit) && info.units.includes(r.unit) ? r.unit : info.units[0];
  const p: NicotineProduct = {
    id: r.id,
    kind: r.kind,
    unit,
    amount: finite(r.amount) ? clamp(r.amount, 0, MAX_AMOUNT_PER_DAY) : 0,
    strengthMg: finite(r.strengthMg)
      ? clamp(r.strengthMg, 0, MAX_STRENGTH_MG)
      : info.defaultStrengthMg,
    active: r.active !== false,
  };
  // Older documents may carry perDays (above 1 = not daily): that is occasional now.
  if (r.occasional === true || (finite(r.perDays) && r.perDays > 1)) p.occasional = true;
  if (r.kind === 'vape' && finite(r.mlPerPod) && r.mlPerPod > 0)
    p.mlPerPod = clamp(r.mlPerPod, 0.1, 20);
  return p;
}

/** Cleans a whole stored document; anything missing falls back to the defaults. */
export function normalizeNicotine(raw: unknown): NicotineState {
  const out = emptyNicotineState();
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Record<string, unknown>;
  if (Array.isArray(r.products)) {
    const seen = new Set<string>();
    for (const x of r.products) {
      const p = normalizeNicotineProduct(x);
      if (p && !seen.has(p.id)) {
        seen.add(p.id);
        out.products.push(p);
      }
    }
  }
  const s = r.settings as Partial<NicotineSettings> | undefined;
  if (s && typeof s === 'object') {
    if (typeof s.useInCalculations === 'boolean')
      out.settings.useInCalculations = s.useInCalculations;
    if (isNicotineSharing(s.sharing)) out.settings.sharing = s.sharing;
    // A document older than v2 never saw the experimental group: whatever it holds for those
    // surfaces (even an explicit true, written by the old full-object save) is reset to off once.
    const current = finite(s.version) && s.version >= NICOTINE_SETTINGS_VERSION;
    if (s.surfaces && typeof s.surfaces === 'object')
      for (const k of NICOTINE_SURFACES)
        if (typeof s.surfaces[k] === 'boolean' && (current || !isExperimentalSurface(k)))
          out.settings.surfaces[k] = s.surfaces[k];
  }
  out.updatedAt = finite(r.updatedAt) && r.updatedAt > 0 ? r.updatedAt : 0;
  return out;
}

/** Is there anything saved at all (products, or a non-default setting)? */
export const hasNicotineData = (n: NicotineState): boolean => n.products.length > 0;
