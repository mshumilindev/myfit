import { useEffect, useMemo, useState } from 'react';
import { getTrainerUid } from '../../data/config';
import { useCoachWorld } from '../../data/useCoachWorld';
import type { CoachWorldPort } from '../../data/port';
import type { CoachClient } from '../../domain/types';
import { getLivePort } from './config';
import { countStates, liveRows, type LiveCounts, type LiveRow } from './model';
import type { CoachLiveSession, LivePort } from './port';

/** A clock that ticks every `ms` from the port's own time (fixtures run Wed 7 Oct 09:05 forwards). */
function usePortNow(port: LivePort, ms: number): number {
  const [now, setNow] = useState(() => port.now());
  useEffect(() => {
    const id = setInterval(() => setNow(port.now()), ms);
    return () => clearInterval(id);
  }, [port, ms]);
  return now;
}

export interface LiveApi {
  rows: LiveRow[];
  counts: LiveCounts;
  status: 'loading' | 'ready' | 'error';
  now: number;
  retry: () => void;
  /** All clients of the roster (names, goals) for screens that draw a client without a session. */
  clients: ReadonlyMap<string, CoachClient>;
  loadingClients: boolean;
}

/**
 * Sessions of the coach's clients, gated by consent, with a ticking clock. Non-blocking: an empty list while
 * loading, the last list stays on screen when the feed errors (`status` tells).
 * `tickMs`: 1000 on the Live page (running clock), 30000 for the header widget (minutes only).
 */
export function useCoachLive(
  opts: {
    port?: LivePort;
    worldPort?: CoachWorldPort;
    uid?: string | null;
    tickMs?: number;
  } = {},
): LiveApi {
  const port = opts.port ?? getLivePort();
  const uid = opts.uid === undefined ? getTrainerUid() : opts.uid;
  const world = useCoachWorld(opts.worldPort);
  const [sessions, setSessions] = useState<CoachLiveSession[]>([]);
  const [status, setStatus] = useState<LiveApi['status']>('loading');
  const [tries, setTries] = useState(0);
  const now = usePortNow(port, opts.tickMs ?? 1000);
  useEffect(() => {
    if (!uid) return;
    return port.subscribe(
      uid,
      (s) => {
        setSessions(s);
        setStatus('ready');
      },
      () => setStatus('error'),
    );
  }, [port, uid, tries]);
  const clients = useMemo(
    () => new Map((world.world?.rows ?? []).map((r) => [r.client.id, r.client] as const)),
    [world.world],
  );
  const rows = useMemo(() => liveRows(sessions, clients, now), [sessions, clients, now]);
  const counts = useMemo(() => countStates(rows), [rows]);
  return {
    rows,
    counts,
    status,
    now,
    retry: () => {
      setStatus('loading');
      setTries((n) => n + 1);
    },
    clients,
    loadingClients: world.loading,
  };
}
