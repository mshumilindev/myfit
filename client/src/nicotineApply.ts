/**
 * Nicotine, applied quietly: the one bridge between the estimate (`nicotine.ts`, pure)
 * and the engines that read it (recovery, fatigue, sleep, rest, warm-up, progression,
 * RPE zone). It adds NO coefficients; every number comes from `SURFACE_COEFFS`.
 *
 * Rule for every engine: ask for the MIDPOINT of the range (`nicMid`), which is the
 * neutral value (x1 or +0) when the master switch is off, there are no products, or that
 * surface's own switch is off. So "off" means zero behaviour change, by construction.
 */
import { getNicotineEffects } from './store';
import { NEUTRAL, SURFACE_COEFFS, type NicotineEffectKey } from './nicotine';

/** Midpoint of one surface's range, or its neutral value (x1 / +0) when nothing applies. */
export function nicMid(key: NicotineEffectKey): number {
  const neutral = NEUTRAL[SURFACE_COEFFS[key].mode];
  const r = getNicotineEffects()?.[key];
  if (!r) return neutral;
  return Math.round(((r.low + r.high) / 2) * 10000) / 10000;
}

/**
 * RPE target zone shift, in whole half-points (RPE is read in half steps): the midpoint of
 * the range rounded to the nearest 0.5 and never beyond the cap. 0 when off. The curve only
 * approaches the cap, so the first half-point shows from about 30 cig-eq a day (the mid of
 * the range passes a quarter point).
 */
export function nicRpeShift(): number {
  const r = getNicotineEffects()?.rpe;
  if (!r) return 0;
  const half = Math.round(((r.low + r.high) / 2) * 2) / 2;
  return Math.max(-SURFACE_COEFFS.rpe.cap, Math.min(0, half)) || 0;
}
