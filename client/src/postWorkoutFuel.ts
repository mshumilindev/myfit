/**
 * "Recovery fuel" on the Session summary — up to two generic, non-medical food /
 * drink ideas after a workout, read from how it went (working sets, RPE, length,
 * strength vs cardio, day type, time of day) and what the gym sells. Pure: the
 * caller passes the workout, the gym and the active conditions.
 *
 * Rules
 *  - No working sets and no cardio → nothing (null).
 *  - Candidates, each with a priority; the two highest win (ties: list order):
 *      carbMeal      very hard (≥ 18 sets, or hard and ≥ 75 min) or ≥ 90 min
 *                    — and not late at night (≥ 21 h → a light snack instead)
 *      proteinShake  ≥ 10 strength sets and cardio is not most of the session
 *      hydrate       cardio ≥ 30 min, or ≥ 75 min, or a hard session
 *      smoothie      cardio-led (≥ 20 min, < 10 strength sets), or a light session
 *      snack         light session, or late at night; also the fallback
 *  - `atGym`: shake / smoothie when the gym has a juiceBar or cafe; snack / meal
 *    when it has a cafe.
 *  - Health: an active condition whose category is metabolic (diabetes, thyroid,
 *    cholesterol …) or chronic kidney disease switches to `consult` — no specifics,
 *    just "check with your doctor or dietitian".
 */
import type { ChronicCondition, Gym, Workout } from './types';
import { sessionProfile, type SessionProfile } from './sessionProfile';
import { hasAmenity } from './data/gymAmenities';
import { catalogCondition } from './data/conditionCatalog';
import { effectiveKey, isActive } from './conditions';

export type FuelKind = 'carbMeal' | 'proteinShake' | 'hydrate' | 'smoothie' | 'snack';
/** Why it fits — picks the one-line rationale. */
export type FuelWhy = 'veryHard' | 'long' | 'heavy' | 'cardio' | 'hard' | 'light' | 'late';

export interface FuelItem {
  kind: FuelKind;
  why: FuelWhy;
  /** The gym's juice bar / cafe sells it. */
  atGym: boolean;
}

export interface FuelResult {
  /** `consult`: a diet-relevant condition is active → neutral advice, no items. */
  mode: 'suggest' | 'consult';
  items: FuelItem[];
  facts: Pick<SessionProfile, 'strengthSets' | 'cardioMin' | 'avgRpe' | 'minutes' | 'dayType'>;
}

export interface FuelInput {
  workout: Workout;
  gym?: Gym | null;
  conditions?: ChronicCondition[];
  now: number;
  /** Local hour override (tests); default from the workout's finish. */
  hour?: number | null;
}

/** Diet-relevant: metabolic category (diabetes …) and chronic kidney disease. */
export function dietSensitive(conditions: ChronicCondition[], now: number): boolean {
  return conditions.some((c) => {
    if (!isActive(c, now)) return false;
    const key = effectiveKey(c, now);
    return catalogCondition(key)?.category === 'metabolic' || key === 'other_kidney';
  });
}

interface Cand {
  kind: FuelKind;
  why: FuelWhy;
  pri: number;
}

export function postWorkoutFuel(input: FuelInput): FuelResult | null {
  const { workout, gym, conditions = [], now } = input;
  const p = sessionProfile(workout, { hour: input.hour });
  if (p.strengthSets === 0 && p.cardioMin <= 0) return null;
  const facts = {
    strengthSets: p.strengthSets,
    cardioMin: p.cardioMin,
    avgRpe: p.avgRpe,
    minutes: p.minutes,
    dayType: p.dayType,
  };
  if (dietSensitive(conditions, now)) return { mode: 'consult', items: [], facts };

  const late = p.hour !== null && p.hour >= 21;
  const cardioLed = p.cardioMin >= 20 && p.strengthSets < 10;
  const cands: Cand[] = [];
  const veryHard =
    p.strengthSets >= 18 || (p.level === 'hard' && p.minutes >= 75) || p.minutes >= 90;
  if (veryHard && !late) {
    cands.push({
      kind: 'carbMeal',
      why: p.minutes >= 90 && p.strengthSets < 18 ? 'long' : 'veryHard',
      pri: 90,
    });
  }
  if (p.strengthSets >= 10 && !cardioLed)
    cands.push({ kind: 'proteinShake', why: 'heavy', pri: 80 });
  if (p.cardioMin >= 30 || p.minutes >= 75 || p.level === 'hard') {
    cands.push({
      kind: 'hydrate',
      why: p.cardioMin >= 30 ? 'cardio' : p.minutes >= 75 ? 'long' : 'hard',
      pri: 70,
    });
  }
  if (cardioLed) cands.push({ kind: 'smoothie', why: 'cardio', pri: 60 });
  else if (p.level === 'light') cands.push({ kind: 'smoothie', why: 'light', pri: 55 });
  if (late) cands.push({ kind: 'snack', why: 'late', pri: 75 });
  else if (p.level === 'light') cands.push({ kind: 'snack', why: 'light', pri: 50 });
  if (cands.length === 0) cands.push({ kind: 'snack', why: 'light', pri: 1 });

  const sells = !!gym && (hasAmenity(gym, 'juiceBar') || hasAmenity(gym, 'cafe'));
  const eats = !!gym && hasAmenity(gym, 'cafe');
  const items = cands
    .sort((a, b) => b.pri - a.pri)
    .slice(0, 2)
    .map(({ kind, why }) => ({
      kind,
      why,
      atGym:
        kind === 'proteinShake' || kind === 'smoothie' ? sells : kind === 'hydrate' ? false : eats,
    }));
  return { mode: 'suggest', items, facts };
}
