/**
 * The person's max for an exercise (Periodization): the one they typed, else the estimate from history (best e1RM, warm-ups
 * excluded, the same number the records use). A typed max replaces the estimate until they clear it.
 */
import { recordE1rm } from '../store';
import { maxKey } from './maxesData';
import { getTypedMaxes } from './maxesSync';

export type MaxSource = 'typed' | 'history' | 'none';

export interface MaxInfo {
  /** The kilograms a percent is turned into; null when there is no max. */
  kg: number | null;
  source: MaxSource;
  /** The estimate from history (null when there is none), shown even when a typed max wins. */
  estimate: number | null;
}

/** Best estimated one-rep max from the person's history, kg, or null when there is none. */
export function estimatedMax(name: string): number | null {
  const e = recordE1rm(name);
  return e > 0 ? Math.round(e * 10) / 10 : null;
}

export function maxInfo(name: string): MaxInfo {
  const estimate = estimatedMax(name);
  const typed = getTypedMaxes().maxes[maxKey(name)];
  if (typed) return { kg: typed.kg, source: 'typed', estimate };
  return { kg: estimate, source: estimate === null ? 'none' : 'history', estimate };
}

/** The max a percent is turned into kilograms against. */
export const maxFor = (name: string): number | null => maxInfo(name).kg;
