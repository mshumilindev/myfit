/**
 * The person's max for an exercise (Periodization). Iteration 1: the estimate from history only (best e1RM, warm-ups excluded,
 * the same number the records use). Typed maxes come with the Maxes page.
 */
import { recordE1rm } from '../store';

/** Best estimated one-rep max from the person's history, kg, or null when there is none. */
export function estimatedMax(name: string): number | null {
  const e = recordE1rm(name);
  return e > 0 ? Math.round(e * 10) / 10 : null;
}

/** The max a percent is turned into kilograms against. */
export function maxFor(name: string): number | null {
  return estimatedMax(name);
}
