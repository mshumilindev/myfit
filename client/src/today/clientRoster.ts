/**
 * The trainer's client roster for Today's "Atlas & clients" block (the
 * `trainerClients` call — the same payload the Clients screen shows).
 *
 * Cached like the rest of the app: the list paints instantly from
 * localStorage, the network is skipped while the cache is fresh, and a refetch
 * only re-renders when the payload actually changed (delta check).
 */
import { useCallback, useEffect, useState } from 'react';
import { cacheFresh, cachePeek, cacheSet, callFn } from '../api';

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

/** Whether the cached roster has anyone in it (Today's block settings hide the
 *  client options without clients). */
export function hasCachedClients(): boolean {
  return (cachePeek<RosterClient[]>(CACHE_KEY)?.data?.length ?? 0) > 0;
}

/** The roster (null until known). `enabled: false` never touches the network
 *  (members have no clients). */
export function useClientRoster(enabled: boolean): RosterClient[] | null {
  const [clients, setClients] = useState<RosterClient[] | null>(
    () => cachePeek<RosterClient[]>(CACHE_KEY)?.data ?? null,
  );

  const refresh = useCallback(() => {
    // Skip the network entirely while the cached list is still fresh.
    if (cacheFresh(cachePeek<RosterClient[]>(CACHE_KEY), CLIENTS_TTL_MS)) return;
    callFn<{ clients: RosterClient[] }>(CACHE_KEY)
      .then((d) => {
        const prev = cachePeek<RosterClient[]>(CACHE_KEY)?.data;
        cacheSet(CACHE_KEY, d.clients); // always refresh the freshness stamp
        // Delta: only re-render when the roster actually changed.
        if (!prev || JSON.stringify(prev) !== JSON.stringify(d.clients)) setClients(d.clients);
      })
      .catch(() => {
        /* keep whatever is cached */
      });
  }, []);

  useEffect(() => {
    if (enabled) refresh();
  }, [enabled, refresh]);

  return enabled ? clients : null;
}
