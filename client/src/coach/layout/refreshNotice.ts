/**
 * When does the Coach shell say anything about data freshness? (polish F6)
 *
 * A healthy background refresh is silent: the cached snapshot paints immediately and the network
 * catches up, which is the normal first load and must not show a chip. Only these are shown:
 *   offline  - the device is offline (age + Retry)
 *   failing  - the refresh failed while data is shown (Retry)
 *   quiet    - the data is older than STALE_AFTER_MS and a refresh is still running (no Retry, calm)
 * ONE decision for Today, Decision, Signals and Client 360, so they cannot drift.
 */
export const STALE_AFTER_MS = 15 * 60_000;

export type RefreshNotice = 'none' | 'offline' | 'failing' | 'quiet';

export interface RefreshInput {
  status: 'loading' | 'ready' | 'stale' | 'offline' | 'error';
  error: string | null;
  updatedAt: number | null;
}

/** `now` is the clock of the data (the world's `now`: the fixture clock in stories, real time live). */
export function refreshNotice(s: RefreshInput, now: number): RefreshNotice {
  if (s.updatedAt == null) return 'none';
  if (s.status === 'offline' || s.error === 'offline') return 'offline';
  if (s.status !== 'stale') return 'none';
  if (s.error) return 'failing';
  return now - s.updatedAt > STALE_AFTER_MS ? 'quiet' : 'none';
}
