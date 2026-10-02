/**
 * Alcohol, applied quietly: the one bridge between the estimate (`alcohol.ts`, pure) and the
 * engines that read it (recovery, sleep, fatigue, progression). It adds NO coefficients; every
 * number comes from `SURFACE_COEFFS`.
 *
 * Rule for every engine: ask for the MIDPOINT of the range (`alcMid`), which is the neutral
 * value (x1 or +0) when the master switch is off, there are no drinks, or that surface's own
 * switch is off. So "off" means zero behaviour change, by construction.
 *
 * Pass the calendar day the number is for (a Date, ms, or 'YYYY-MM-DD'): with "usually drink
 * on" set, readiness and sleep need only move on the day after a drinking day. Without a day
 * the flat weekly smoothing applies.
 */
import { getAlcoholEffects, getAlcoholEffectsFor } from './store';
import { NEUTRAL, SURFACE_COEFFS, type AlcoholEffectKey, type DayInput } from './alcohol';

/** Midpoint of one surface's range, or its neutral value (x1 / +0) when nothing applies. */
export function alcMid(key: AlcoholEffectKey, day?: DayInput): number {
  const neutral = NEUTRAL[SURFACE_COEFFS[key].mode];
  const r = (day === undefined ? getAlcoholEffects() : getAlcoholEffectsFor(day))?.[key];
  if (!r) return neutral;
  return Math.round(((r.low + r.high) / 2) * 10000) / 10000;
}
