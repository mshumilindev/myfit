/**
 * The one place where the lifestyle estimates that nudge training numbers are combined, so
 * every engine asks the same question and nicotine and alcohol STACK:
 *  - readiness: factors multiply (both <= 1; a muscle's recovery window stretches by 1 / factor);
 *  - sleep need: minutes add;
 *  - deload threshold and progression step: factors multiply.
 * Each estimate keeps its own cap (`SURFACE_COEFFS`) and the COMBINED values have their own:
 * readiness never drops below x0.85 (-15 %: nicotine -5 % and alcohol -10 % at their caps) and
 * the extra sleep need never exceeds 60 min (nicotine +15, alcohol +30 and late caffeine from
 * supplements +45, the last one capped on its own at 45 before it is added). So no stack of
 * lifestyle estimates can swing a number further than the sum of the individual caps, even
 * if a cap is raised later. With none in use (or switched off)
 * every value is exactly neutral (x1 / +0), so nothing changes for a user without them.
 * Supplements touch ONLY the sleep need here (late caffeine, `caffeineSleepMin`); readiness,
 * the deload line and the progression step never move because of a supplement.
 *
 * Alcohol is day-aware (the day after a usual drinking day, or after a check-in): pass the
 * moment the number is computed FOR (ms); it defaults to now.
 */
import { alcMid } from './alcoholApply';
import { nicMid } from './nicotineApply';
import { supMid } from './supplementsApply';

/** Combined floor of the readiness factor (-15 %). */
export const READINESS_MIN_MULT = 0.85;
/** Combined ceiling of the extra sleep need, in minutes. */
export const SLEEP_NEED_MAX_EXTRA_MIN = 60;
/** Ceiling of the supplements' own part of it (late caffeine), in minutes. */
export const SUPPLEMENT_SLEEP_MAX_EXTRA_MIN = 45;

/** Readiness factor (<= 1) at a moment. */
export const readinessMult = (at: number = Date.now()): number =>
  Math.max(READINESS_MIN_MULT, nicMid('readiness') * alcMid('readiness', at));

/** Extra minutes of sleep the body is taken to need, for the night ending at a moment. */
export const sleepNeedExtraMin = (at: number = Date.now()): number =>
  Math.min(
    SLEEP_NEED_MAX_EXTRA_MIN,
    nicMid('sleepMin') +
      alcMid('sleepMin', at) +
      Math.min(SUPPLEMENT_SLEEP_MAX_EXTRA_MIN, supMid('caffeineSleepMin', at)),
  );

/** Factor on the 'high' / 'fried' fatigue lines (alcohol's is experimental and off by default). */
export const deloadMult = (): number => nicMid('deloadThreshold') * alcMid('deloadThreshold');

/** Factor on the next load jump. */
export const progressionMult = (): number => nicMid('progressionStep') * alcMid('progressionStep');
