/**
 * Pure helpers for the coach's live-athlete banner: turn the raw liveSessions
 * feed into the cards Today renders, classified by state and ordered so the
 * freshest live session leads.
 */
import type { LiveSession } from './types';

/** No heartbeat for this long ⇒ treat a live session as offline (last-seen). */
export const LIVE_OFFLINE_MS = 90_000;
/** Keep a finished session on the coach's Today this long, then drop it. */
export const FINISHED_LINGER_MS = 5 * 60_000;

export type LiveState = 'live' | 'offline' | 'finished';
export interface TraineeCard {
  s: LiveSession;
  state: LiveState;
}

/** State of one session as of `now`, or null when it should no longer show. */
export function classifyTrainee(s: LiveSession, now: number): LiveState | null {
  if (s.finishedAt != null) {
    return now - s.finishedAt < FINISHED_LINGER_MS ? 'finished' : null;
  }
  if (now - (s.updatedAt ?? s.startedAt) > LIVE_OFFLINE_MS) return 'offline';
  return 'live';
}

/** The sessions to show, freshest first; live/offline lead, finished trail. */
export function activeTrainees(list: LiveSession[], now: number = Date.now()): TraineeCard[] {
  const rank = (st: LiveState) => (st === 'finished' ? 1 : 0);
  return list
    .map((s) => ({ s, state: classifyTrainee(s, now) }))
    .filter((c): c is TraineeCard => c.state !== null)
    .sort((a, b) => rank(a.state) - rank(b.state) || b.s.startedAt - a.s.startedAt);
}
