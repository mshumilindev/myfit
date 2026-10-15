/**
 * The trainer's client roster for Today's "Atlas & clients" block (the
 * `trainerClients` call — the same payload the Clients screen shows).
 *
 * Offline-first: the list paints from the sealed on-device snapshot (client names are personal data, never stored
 * readable), the network is skipped while the snapshot is fresh, and a refetch only re-renders when the payload
 * actually changed (delta check). The Clients screen shares the same snapshot and the same in-flight request.
 */
import { useEffect, useState } from 'react';
import { callFn } from '../api';
import { offlinePeekNow, offlineRevalidate } from '../offline/offlineCache';

export interface RosterClient {
  id: string;
  name: string;
  avatar: boolean;
  avatarRev?: number;
  lastSessionAt: number | null;
  /** Sessions in the last 7 days. */
  weekSessions?: number;
  /** Days since the last session when that is 30+, else null. */
  dormantDays: number | null;
}

const CLIENTS_TTL_MS = 2 * 60 * 1000;
const CACHE_KEY = 'trainerClients';

/** Whether the roster known in this session has anyone in it (Today's block settings hide the
 *  client options without clients). Memory only: the roster hook has hydrated it by the time settings open. */
export function hasCachedClients(): boolean {
  return (offlinePeekNow<RosterClient[]>(CACHE_KEY)?.data?.length ?? 0) > 0;
}

/** The roster (null until known). `enabled: false` never touches the network
 *  (members have no clients). */
export function useClientRoster(enabled: boolean): RosterClient[] | null {
  const [clients, setClients] = useState<RosterClient[] | null>(
    () => offlinePeekNow<RosterClient[]>(CACHE_KEY)?.data ?? null,
  );

  useEffect(() => {
    if (!enabled) return;
    return offlineRevalidate<RosterClient[]>({
      key: CACHE_KEY,
      ttlMs: CLIENTS_TTL_MS, // a fresh snapshot skips the network entirely
      accept: Array.isArray,
      fetch: async () => (await callFn<{ clients: RosterClient[] }>(CACHE_KEY)).clients,
      // Delta: only re-render when the roster actually changed.
      apply: (next) =>
        setClients((cur) => (cur && JSON.stringify(cur) === JSON.stringify(next) ? cur : next)),
    });
  }, [enabled]);

  return enabled ? clients : null;
}
