/**
 * The person's max for an exercise (Periodization): the one they typed, else what their history implies right now
 * (`history.ts`, computed live on every call). A typed max replaces the estimate until they clear it; the estimate stays
 * known so the page can say when the history has moved past what was typed.
 */
import { getStoreState } from '../store';
import { historyMax, type BestSet } from './history';
import { maxKey } from './maxesData';
import { getTypedMaxes } from './maxesSync';

export type MaxSource = 'typed' | 'history' | 'none';

export interface MaxInfo {
  /** The kilograms a percent is turned into; null when there is no max. */
  kg: number | null;
  source: MaxSource;
  /** The estimate from history (null when there is none), also while a typed max wins. */
  estimate: number | null;
  /** The set the estimate comes from. */
  best: BestSet | null;
  /** The estimate is from before the recent window (nothing lifted lately). */
  older: boolean;
  /** When the typed max was set (ms), if one is. */
  typedAt: number | null;
}

/** Best estimated one-rep max from the person's history, kg, or null when there is none. */
export function estimatedMax(name: string, now: number = Date.now()): number | null {
  const h = historyMax(getStoreState().workouts, name, now);
  return h ? h.set.e1rm : null;
}

export function maxInfo(name: string, now: number = Date.now()): MaxInfo {
  const workouts = getStoreState().workouts;
  const h = historyMax(workouts, name, now);
  const estimate = h ? h.set.e1rm : null;
  const typed = getTypedMaxes().maxes[maxKey(name)];
  const base = { estimate, best: h?.set ?? null, older: h?.older ?? false };
  if (typed) {
    // A typed max stands until the person lifts past it: a set done AFTER they typed it that implies more takes over by itself
    // (a test week, a new best), nothing to confirm. Sets from before they typed it do not, so a deliberately lower training max holds.
    const later = historyMax(
      workouts.filter((w) => w.startedAt > typed.at),
      name,
      now,
    );
    if (later && later.set.e1rm > typed.kg)
      return { ...base, kg: later.set.e1rm, source: 'history', typedAt: typed.at };
    return { ...base, kg: typed.kg, source: 'typed', typedAt: typed.at };
  }
  return { ...base, kg: estimate, source: estimate === null ? 'none' : 'history', typedAt: null };
}

/** The max a percent is turned into kilograms against, as of now. */
export const maxFor = (name: string): number | null => maxInfo(name).kg;
