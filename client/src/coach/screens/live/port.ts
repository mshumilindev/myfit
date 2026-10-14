/**
 * The seam between the Live UI (header widget, Live list, one-client Live page) and its data (plan 2.6, C-21).
 * Only the SERVICE fields exist here: who, when it started, gym, exercise count, heartbeat, the last session's
 * context and the finished totals. There is no per-set field anywhere, by contract (R-FE-062).
 *
 * The real adapter (done): `data/firestore/livePort.ts`, fed by the member's single sealed writer `liveWriter.ts`:
 *   subscribe  onSnapshot(liveSessions where trainerId == uid); the doc id is the athlete's uid, which the adapter
 *              maps to the roster client id. Fields other than `trainerId`, `startedAt`, `updatedAt`,
 *              `finishedAt` are sealed with the `live` sub-key of the conversation (Part C.2 no. 3) and opened
 *              locally. A session of a client who does not share totals, or who logs program-only, is never
 *              delivered (rules + the UI gate in model.ts).
 *   The athlete's app writes the heartbeat (`updatedAt`) every 45 s while a session is open (`LIVE_BEAT_MS`); after
 *   90 s without one the UI shows Offline (trainerLive.ts LIVE_OFFLINE_MS). A finished session lingers 5 minutes
 *   in the feed (FINISHED_LINGER_MS); its doc lives 10 minutes (`LIVE_FINISH_TTL_MS`).
 */
import type { LiveSession } from '../../../types';

/** A live session as the coach sees it: the athlete's `LiveSession` plus the roster id and the session name. */
export interface CoachLiveSession extends LiveSession {
  /** Roster client id (what the rest of Coach calls the client). */
  clientId: string;
  /** "Lower A": the program day being trained. */
  sessionName?: string | null;
}

export type Unsubscribe = () => void;

export interface LivePort {
  /** Calls `onSessions` at once (cached or empty) and on every change. */
  subscribe(
    trainerUid: string,
    onSessions: (sessions: CoachLiveSession[]) => void,
    onError: (e: unknown) => void,
  ): Unsubscribe;
  /** Clock of the data (the fixtures adapter pins Wed 7 Oct 2026 09:05 and lets it run). */
  now(): number;
}
