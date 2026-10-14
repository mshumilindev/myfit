/**
 * Live model: which sessions the coach may see, in which state, with which clock. Pure; copy lives in i18n.
 *
 * Consent gate (R-FE-062, plan 9): a client who logs program-only or shares no totals is never shown as live, even
 * if a feed delivers a session for them. Two open sessions for one client collapse into the newest one.
 */
import {
  FINISHED_LINGER_MS,
  LIVE_OFFLINE_MS,
  classifyTrainee,
  type LiveState,
} from '../../../trainerLive';
import type { CoachClient } from '../../domain/types';
import type { CoachLiveSession } from './port';

export type { LiveState };

export interface LiveRow {
  session: CoachLiveSession;
  client: CoachClient;
  state: LiveState;
  /** Clock value in ms: runs while live, frozen at the last heartbeat when offline, final when finished. */
  elapsedMs: number;
  /** Seconds since the last heartbeat (live and offline); null when finished. */
  lastSeenS: number | null;
  /** Another open session of the same client was hidden (the newest is shown). */
  duplicates: number;
}

export const canShowLive = (c: CoachClient): boolean =>
  c.mode !== 'program' && c.consent.totals !== 'off';

const RANK: Record<LiveState, number> = { live: 0, offline: 1, finished: 2 };

export function liveRows(
  sessions: readonly CoachLiveSession[],
  clients: ReadonlyMap<string, CoachClient>,
  now: number,
): LiveRow[] {
  const byClient = new Map<string, { row: LiveRow; n: number }>();
  for (const s of sessions) {
    const client = clients.get(s.clientId);
    if (!client || client.invite || !canShowLive(client)) continue;
    const state = classifyTrainee(s, now);
    if (!state) continue;
    const end =
      state === 'finished' ? (s.finishedAt ?? now) : state === 'offline' ? s.updatedAt : now;
    const row: LiveRow = {
      session: s,
      client,
      state,
      elapsedMs: Math.max(0, end - s.startedAt),
      lastSeenS: state === 'finished' ? null : Math.max(0, Math.round((now - s.updatedAt) / 1000)),
      duplicates: 0,
    };
    const prev = byClient.get(s.clientId);
    if (!prev) byClient.set(s.clientId, { row, n: 1 });
    else {
      const keep = s.startedAt > prev.row.session.startedAt ? row : prev.row;
      byClient.set(s.clientId, { row: keep, n: prev.n + 1 });
    }
  }
  return [...byClient.values()]
    .map(({ row, n }) => ({ ...row, duplicates: n - 1 }))
    .sort((a, b) => RANK[a.state] - RANK[b.state] || b.session.startedAt - a.session.startedAt);
}

export interface LiveCounts {
  live: number;
  offline: number;
  finished: number;
}

export const countStates = (rows: readonly LiveRow[]): LiveCounts => ({
  live: rows.filter((r) => r.state === 'live').length,
  offline: rows.filter((r) => r.state === 'offline').length,
  finished: rows.filter((r) => r.state === 'finished').length,
});

/** "38:00" under an hour, "1:05:00" from an hour. */
export function clockText(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const two = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${two(m)}:${two(s)}`;
}

export const minutesOf = (ms: number): number => Math.floor(ms / 60_000);

/** Tonnes with one decimal: 7400 -> "7.4". */
export const tonnesText = (kg: number): string => (Math.round(kg / 100) / 10).toFixed(1);

export { FINISHED_LINGER_MS, LIVE_OFFLINE_MS };
