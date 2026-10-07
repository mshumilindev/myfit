import type { Gym, Workout } from './types';

/** Minimum recent sessions at a gym, and its share of the sessions that have a gym, to count as main. */
export const AUTO_MAIN_MIN_SESSIONS = 3;
export const AUTO_MAIN_MIN_SHARE = 0.3;
const AUTO_MAIN_WINDOW_MS = 180 * 24 * 60 * 60 * 1000;

/**
 * Gyms that the log alone says are main: at least a few recent sessions there and
 * either a real share of the gym-attached sessions or simply the most visited gym.
 * Sessions without a gym don't count against anyone.
 */
export function autoMainGymIds(workouts: Workout[], now = Date.now()): Set<string> {
  const since = now - AUTO_MAIN_WINDOW_MS;
  const count = new Map<string, number>();
  let total = 0;
  for (const w of workouts) {
    if (w.finishedAt === null || w.startedAt < since || !w.gymId) continue;
    total++;
    count.set(w.gymId, (count.get(w.gymId) ?? 0) + 1);
  }
  const top = Math.max(0, ...count.values());
  const out = new Set<string>();
  for (const [id, n] of count)
    if (n >= AUTO_MAIN_MIN_SESSIONS && (n / total >= AUTO_MAIN_MIN_SHARE || n === top)) out.add(id);
  return out;
}

/** Main gym = the athlete's explicit choice (the checkbox), else what the log shows. */
export function isMainGym(g: Gym, auto: Set<string>): boolean {
  return g.favorite ?? auto.has(g.id);
}
