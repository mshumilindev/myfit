/**
 * The numbers of the "Your supplements" card on the session summary, for the day of the
 * workout (pure). INFORMATION only: a creatine strength expectation, the creatine body-weight
 * note and the caffeine effort note. Nothing here changes a load or a target. A line whose
 * strong end rounds to nothing is dropped; null when no line is left, or the "After a
 * workout" switch is off.
 */
import { supplementSurfaceOn, type Range, type SupplementEffects } from '../../supplements';
import type { SupplementSettings } from '../../types';

export interface SupplementCardModel {
  /** Strength expectation in whole percent (0 .. 8 at the full ramp). */
  strengthPct: Range | null;
  /** Body-weight note in kg, one decimal (mostly water, first weeks). */
  weightKg: Range | null;
  /** How much easier a set may feel, in RPE points (positive numbers). */
  rpe: Range | null;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

export function supplementCardModel(
  effects: SupplementEffects | null,
  settings: Pick<SupplementSettings, 'useInCalculations' | 'surfaces'>,
): SupplementCardModel | null {
  if (!effects || !supplementSurfaceOn(settings as SupplementSettings, 'afterWorkoutHints'))
    return null;
  let strengthPct: Range | null = {
    low: Math.round(effects.creatineStrength.low * 100),
    high: Math.round(effects.creatineStrength.high * 100),
  };
  if (strengthPct.high < 1) strengthPct = null;
  let weightKg: Range | null = {
    low: round1(effects.creatineBodyweightKg.low),
    high: round1(effects.creatineBodyweightKg.high),
  };
  if (weightKg.high < 0.5) weightKg = null;
  // RPE offsets are negative (lower effort): show the size of the drop.
  let rpe: Range | null = {
    low: round1(-effects.caffeineRpe.high),
    high: round1(-effects.caffeineRpe.low),
  };
  if (rpe.high < 0.1) rpe = null;
  if (!strengthPct && !weightKg && !rpe) return null;
  return { strengthPct, weightKg, rpe };
}
