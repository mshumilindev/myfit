/**
 * Cardio machines: which fields a machine logs and how a logged entry turns
 * into energy. Pure over the exercise + a body weight (no store/React), so it
 * unit-tests as plain data and feeds every calorie total via workoutCalories.
 *
 * Energy, most to least trusted:
 *   1. kcal the athlete copied off the console (`calories` on the entry);
 *   2. a mechanical formula when the machine gives one — ACSM treadmill
 *      walking/running from speed + incline, ACSM leg/arm ergometry from watts;
 *   3. the machine's moderate-effort MET (Compendium of Physical Activities
 *      baselines), nudged by RPE — light ×0.82, hard ×1.22.
 * Resistance level is logged for progress comparisons only: levels aren't
 * comparable across brands, so they never move the calorie estimate.
 */
import type { Exercise, SetEntry, Workout } from './types';

export type CardioField = 'distance' | 'speed' | 'incline' | 'watts' | 'level' | 'floors';

type Formula = 'treadmill' | 'legs' | 'arms' | null;

export interface CardioProfile {
  /** Moderate-effort MET — the fallback when no mechanical formula applies. */
  met: number;
  /** Fields worth offering, most useful first; the first one is the row column. */
  fields: CardioField[];
  formula: Formula;
  /** Extra cost of a self-powered belt over a motorised one at the same speed. */
  factor?: number;
}

const TREAD: CardioField[] = ['distance', 'speed', 'incline'];
const ROW: CardioField[] = ['distance', 'watts'];
const BIKE_ERG: CardioField[] = ['watts', 'distance'];
const BIKE: CardioField[] = ['level', 'watts', 'distance'];
const GLIDE: CardioField[] = ['level', 'distance'];

/** Keyed by equipment-catalog id (category 'cardio'). */
export const CARDIO_PROFILES: Record<string, CardioProfile> = {
  'cardio-treadmill': { met: 7.0, fields: TREAD, formula: 'treadmill' },
  'cardio-treadclimber': { met: 6.0, fields: TREAD, formula: 'treadmill' },
  'cardio-walking-pad': { met: 3.5, fields: ['distance', 'speed'], formula: 'treadmill' },
  'cardio-curved-treadmill': {
    met: 9.0,
    fields: ['distance', 'speed'],
    formula: 'treadmill',
    factor: 1.2,
  },
  'cardio-assault-runner': {
    met: 9.0,
    fields: ['distance', 'speed'],
    formula: 'treadmill',
    factor: 1.2,
  },
  'cardio-skillmill': { met: 9.0, fields: ['distance', 'level'], formula: null },
  'cardio-rower': { met: 7.0, fields: ROW, formula: 'legs' },
  'cardio-water-rower': { met: 7.0, fields: ROW, formula: 'legs' },
  'cardio-magnetic-rower': { met: 7.0, fields: ROW, formula: 'legs' },
  'cardio-ski-erg': { met: 6.8, fields: ROW, formula: 'arms' },
  'cardio-ube': { met: 4.0, fields: ['watts', 'level'], formula: 'arms' },
  'cardio-rope-trainer': { met: 7.0, fields: ['level', 'distance'], formula: null },
  'cardio-bike-erg': { met: 7.0, fields: BIKE_ERG, formula: 'legs' },
  'cardio-air-bike': { met: 8.5, fields: BIKE_ERG, formula: 'legs' },
  'cardio-upright-bike': { met: 6.8, fields: BIKE, formula: 'legs' },
  'cardio-recumbent-bike': { met: 5.5, fields: BIKE, formula: 'legs' },
  'cardio-spin-bike': { met: 8.5, fields: BIKE, formula: 'legs' },
  'cardio-aqua-bike': { met: 5.0, fields: ['level'], formula: null },
  'cardio-elliptical': { met: 5.0, fields: GLIDE, formula: null },
  'cardio-arc-trainer': { met: 6.0, fields: GLIDE, formula: null },
  'cardio-lateral-trainer': { met: 6.0, fields: GLIDE, formula: null },
  'cardio-air-walker': { met: 4.0, fields: ['distance'], formula: null },
  'cardio-stairclimber': { met: 9.0, fields: ['floors', 'level'], formula: null },
  'cardio-recumbent-stepper': { met: 5.0, fields: ['level', 'watts'], formula: 'legs' },
  'cardio-mini-stepper': { met: 5.0, fields: [], formula: null },
  'cardio-jacobs-ladder': { met: 9.0, fields: ['level'], formula: null },
  'cardio-vertical-climber': { met: 8.0, fields: [], formula: null },
  'cardio-rebounder': { met: 4.5, fields: [], formula: null },
};

/** Cardio without a machine picked — the old generic entry. */
export const GENERIC_CARDIO: CardioProfile = { met: 6.0, fields: ['distance'], formula: null };
/** Timed cool-down / warm-up entries logged before they became markers. */
const LEGACY_TIMED_MET = { cooldown: 2.5, warmup: 4.0 } as const;

/** The machine picked for a cardio exercise (first catalog cardio id), or null. */
export function cardioMachineOf(ex: Pick<Exercise, 'equipmentItems'>): string | null {
  return ex.equipmentItems?.find((id) => id in CARDIO_PROFILES) ?? null;
}

export function cardioProfile(ex: Pick<Exercise, 'equipmentItems'>): CardioProfile {
  const id = cardioMachineOf(ex);
  return (id && CARDIO_PROFILES[id]) || GENERIC_CARDIO;
}

/** RPE → effort multiplier (same bands as activities' light/moderate/hard). */
function effortMult(rpe: number | null | undefined): number {
  if (!rpe || rpe <= 0) return 1;
  if (rpe < 5) return 0.82;
  if (rpe >= 8) return 1.22;
  return 1;
}

/** Treadmill speed: as entered, else derived from distance over time. */
export function entrySpeedKmh(s: SetEntry): number | null {
  if (s.speedKmh && s.speedKmh > 0) return s.speedKmh;
  const min = s.durationMin ?? 0;
  if (s.distanceKm && s.distanceKm > 0 && min > 0) return s.distanceKm / (min / 60);
  return null;
}

/** Rower / ski pace per 500 m in seconds, from distance over time. */
export function pace500Sec(s: SetEntry): number | null {
  const min = s.durationMin ?? 0;
  if (!s.distanceKm || s.distanceKm <= 0 || min <= 0) return null;
  return (min * 60) / (s.distanceKm * 2);
}

/** Oxygen cost (ml·kg⁻¹·min⁻¹) from the machine's mechanics, or null. */
function vo2(p: CardioProfile, s: SetEntry, bodyKg: number): number | null {
  if (p.formula === 'treadmill') {
    const kmh = entrySpeedKmh(s);
    if (!kmh) return null;
    const S = (kmh * 1000) / 60; // m/min
    const G = Math.max(0, s.inclinePct ?? 0) / 100;
    const base = kmh < 7 ? 3.5 + 0.1 * S + 1.8 * S * G : 3.5 + 0.2 * S + 0.9 * S * G;
    return base * (p.factor ?? 1);
  }
  if ((p.formula === 'legs' || p.formula === 'arms') && s.watts && s.watts > 0) {
    return p.formula === 'legs' ? 7 + (10.8 * s.watts) / bodyKg : 3.5 + (18 * s.watts) / bodyKg;
  }
  return null;
}

/**
 * Energy for one timed entry of a non-strength exercise. Console kcal wins;
 * then mechanics; then MET·effort. Null without a body weight or time.
 */
export function timedEntryKcal(
  ex: Pick<Exercise, 'kind' | 'equipmentItems'>,
  s: SetEntry,
  bodyKg: number | null | undefined,
): number | null {
  if (s.calories && s.calories > 0) return s.calories;
  const min = s.durationMin ?? 0;
  if (!bodyKg || bodyKg <= 0 || min <= 0) return null;
  if (ex.kind === 'cooldown' || ex.kind === 'warmup') {
    return LEGACY_TIMED_MET[ex.kind] * bodyKg * (min / 60);
  }
  const p = cardioProfile(ex);
  const v = vo2(p, s, bodyKg);
  if (v !== null) return (v * bodyKg * 5 * min) / 1000; // ~5 kcal per litre O₂
  return p.met * effortMult(s.rpe) * bodyKg * (min / 60);
}

/** Everyday fallbacks, most common first — used when history doesn't decide. */
const DEFAULT_MACHINES = [
  'cardio-treadmill',
  'cardio-upright-bike',
  'cardio-elliptical',
  'cardio-bike-erg',
  'cardio-rower',
  'cardio-spin-bike',
  'cardio-stairclimber',
];

/**
 * The machine a generated cardio block should use: the one you reach for most
 * in recent sessions (among the gym's machines when the gym lists any), else
 * the most common machine the gym has, else a treadmill.
 */
export function pickCardioMachine(
  finished: readonly Pick<Workout, 'startedAt' | 'exercises'>[],
  gymItems: readonly string[] | null | undefined,
): string {
  const inGym = (gymItems ?? []).filter((id) => id in CARDIO_PROFILES);
  const allowed = inGym.length > 0 ? new Set(inGym) : null;
  const counts = new Map<string, number>();
  const recent = [...finished].sort((a, b) => b.startedAt - a.startedAt).slice(0, 30);
  for (const w of recent) {
    for (const ex of w.exercises) {
      if (ex.kind !== 'cardio' || ex.sets.length === 0) continue;
      const id = cardioMachineOf(ex);
      if (id && (!allowed || allowed.has(id))) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  const top = [...counts].sort((a, b) => b[1] - a[1])[0];
  if (top) return top[0];
  if (allowed) return DEFAULT_MACHINES.find((id) => allowed.has(id)) ?? inGym[0];
  return 'cardio-treadmill';
}
