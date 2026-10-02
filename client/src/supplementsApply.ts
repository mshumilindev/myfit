/**
 * Supplements, applied quietly: the one bridge between the estimate (`supplements.ts`, pure)
 * and the engines that read it (strength expectation, sleep need, RPE, nutrition protein).
 * It adds NO coefficients; every number comes from `SUPPLEMENT_COEFFS`.
 *
 * Rule for every engine: ask for the MIDPOINT of the range (`supMid`), which is neutral (+0)
 * when the master switch is off, nothing counts that day, or that surface's own switch is off.
 * So "off" means zero behaviour change, by construction. This module is NOT yet wired into
 * any engine (`calcMods.ts` and the engines stay as they are); it only exposes the API.
 *
 * How the app knows a TRAINING day (`supplementContext`): a day with a finished workout or
 * activity always is; a past day with none is not; today and later follow the weekdays of the
 * assigned training plan (`data/programMine.ts`, `programDayHasPlan`), or, with no plan, the
 * weekdays trained at least twice in the last 8 weeks. Body weight is the latest weigh-in; the
 * usual training time is the median start of the last 8 weeks of workouts (>= 3 needed).
 */
import { programDayHasPlan, readProgramCache } from './data/programMine';
import {
  getSupplementEffectsFor,
  getSupplementProteinGramsFor,
  getSupplementTrainingFacts,
  getSupplementWarnings,
} from './store';
import {
  addDays,
  dayKey,
  SUPPLEMENT_NEUTRAL,
  trainingDayResolver,
  usualTrainingStartMin,
  type DayInput,
  type SupplementContext,
  type SupplementEffectKey,
  type SupplementWarning,
} from './supplements';

/** The context for "now", built from the plan, the workouts and the body weight. */
export function supplementContext(now: number = Date.now()): SupplementContext {
  const facts = getSupplementTrainingFacts(now);
  const plan = readProgramCache();
  const planned = plan ? [1, 2, 3, 4, 5, 6, 7].filter((d) => programDayHasPlan(plan, d)) : null;
  return {
    isTrainingDay: trainingDayResolver({
      todayKey: facts.todayKey,
      // A plan with no training weekday at all is no plan.
      plannedWeekdays: planned && planned.length ? planned : null,
      trainedDays: facts.trainedDays,
    }),
    bodyWeightKg: facts.bodyWeightKg,
    usualTrainingStartMin: usualTrainingStartMin(facts.workoutStarts, now),
  };
}

/**
 * Midpoint of one effect's range, or its neutral value (+0) when nothing applies. `day` is the
 * calendar day the number is for (a Date, ms, or 'YYYY-MM-DD'; default today). For the sleep
 * number it is the moment the NIGHT ENDS (as in `calcMods.sleepNeedExtraMin`): the caffeine that
 * costs sleep was taken the day before, so a morning moment reads the previous day.
 */
export function supMid(key: SupplementEffectKey, day?: DayInput): number {
  const at = day === undefined ? Date.now() : day;
  let target: DayInput = at;
  if (key === 'caffeineSleepMin') {
    const k = dayKey(at);
    const hour =
      at instanceof Date ? at.getHours() : typeof at === 'number' ? new Date(at).getHours() : 0;
    if (k && hour < 12) target = addDays(k, -1);
  }
  const fx = getSupplementEffectsFor(target, supplementContext());
  const r = fx?.[key];
  if (!r) return SUPPLEMENT_NEUTRAL;
  return Math.round(((r.low + r.high) / 2) * 10000) / 10000;
}

/** Both ends of one effect's range for a day (neutral when nothing applies). */
export function supRange(key: SupplementEffectKey, day?: DayInput) {
  const fx = getSupplementEffectsFor(day === undefined ? Date.now() : day, supplementContext());
  return fx?.[key] ?? { low: SUPPLEMENT_NEUTRAL, high: SUPPLEMENT_NEUTRAL };
}

/**
 * The hook for the nutrition protein target: EXTRA grams of protein for a day from supplements
 * that count that day (daily entries, and training-day entries only on training days). Add it
 * to the day's EATEN protein; do not touch the target or the calories. 0 when off.
 */
export function supplementProteinGrams(day?: DayInput): number {
  return getSupplementProteinGramsFor(day === undefined ? Date.now() : day, supplementContext());
}

/** Safety flags of the active entries (caffeine limits use the latest body weight). */
export function supplementSafety(): SupplementWarning[] {
  return getSupplementWarnings(supplementContext());
}
