/**
 * The numbers of the "Without alcohol" card, for the day of the workout (pure). Alcohol moves
 * readiness and sleep need on the day AFTER drinking (a usual drinking day or a check-in),
 * so the card has something to say only on such a day (or with a flat weekly amount). A line
 * whose strong end rounds to nothing (< 1 %, < 1 min) is dropped; null when no line is left,
 * or the "After a workout" switch is off.
 */
import { surfaceOn, type AlcoholEffects, type Range } from '../../alcohol';
import type { AlcoholSettings } from '../../types';

export interface AlcoholCardModel {
  /** Recovery quicker without alcohol, in whole percent. */
  recoveryPct: Range | null;
  /** Minutes of sleep need less without alcohol (whole minutes). */
  sleepMin: Range | null;
}

export function alcoholCardModel(
  effects: AlcoholEffects | null,
  settings: Pick<AlcoholSettings, 'useInCalculations' | 'surfaces'>,
): AlcoholCardModel | null {
  if (!effects || !surfaceOn(settings as AlcoholSettings, 'afterWorkoutHints')) return null;
  // Readiness is a factor <= 1 (1 = no change): the strong end is the lower factor.
  let recoveryPct: Range | null = {
    low: Math.round((1 - effects.readiness.high) * 100),
    high: Math.round((1 - effects.readiness.low) * 100),
  };
  if (recoveryPct.high < 1) recoveryPct = null;
  let sleepMin: Range | null = {
    low: Math.round(effects.sleepMin.low),
    high: Math.round(effects.sleepMin.high),
  };
  if (sleepMin.high < 1) sleepMin = null;
  if (!recoveryPct && !sleepMin) return null;
  return { recoveryPct, sleepMin };
}
