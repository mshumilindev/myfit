/**
 * Trainer's clients as an Instagram-stories-style row at the top of Today.
 * Read-only history recency (gold ring = fresh finished session, red = dormant,
 * quiet otherwise) plus a live pulse for anyone training right now (from the
 * realtime liveSessions feed). Live clients lead; then most-recently-trained
 * first, never-trained last. Shown for trainers and for admins who have clients.
 *
 * Cached like the rest of the app: the list paints instantly from localStorage,
 * the network is skipped while the cache is fresh, and a refetch only re-renders
 * when the payload actually changed (delta check). Avatars carry a revision so
 * their photos are served from the persistent blob cache until they change.
 */
import { useCallback, useEffect, useState } from 'react';
import { cacheFresh, cachePeek, cacheSet, callFn } from '../api';
import { useStore } from '../store';
import { classifyTrainee } from '../trainerLive';
import { Avatar } from './Avatar';
import { Icon } from '../ui';

interface StripClient {
  id: string;
  name: string;
  avatar: boolean;
  avatarRev: number;
  lastSessionAt: number | null;
  dormantDays: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const CLIENTS_TTL_MS = 2 * 60 * 1000;
const CACHE_KEY = 'trainerClients';

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

export function TrainerClientsStrip({ onOpenClient }: { onOpenClient: (id: string) => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  const liveTrainees = useStore().liveTrainees;
  const liveIds = new Set(
    liveTrainees.filter((sn) => classifyTrainee(sn, now) === 'live').map((sn) => sn.id),
  );
  const cached = cachePeek<StripClient[]>(CACHE_KEY);
  const [clients, setClients] = useState<StripClient[] | null>(cached?.data ?? null);

  const refresh = useCallback(() => {
    // Skip the network entirely while the cached list is still fresh.
    if (cacheFresh(cachePeek<StripClient[]>(CACHE_KEY), CLIENTS_TTL_MS)) return;
    callFn<{ clients: StripClient[] }>(CACHE_KEY)
      .then((d) => {
        const prev = cachePeek<StripClient[]>(CACHE_KEY)?.data;
        cacheSet(CACHE_KEY, d.clients); // always refresh the freshness stamp
        // Delta: only re-render when the roster actually changed.
        if (!prev || JSON.stringify(prev) !== JSON.stringify(d.clients)) {
          setClients(d.clients);
        }
      })
      .catch(() => {
        /* keep whatever is cached */
      });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!clients || clients.length === 0) return null;

  // Anyone training now leads; then most-recently-trained first, never-trained last.
  const sorted = [...clients].sort((a, b) => {
    const la = liveIds.has(a.id) ? 1 : 0;
    const lb = liveIds.has(b.id) ? 1 : 0;
    if (la !== lb) return lb - la;
    return (b.lastSessionAt ?? 0) - (a.lastSessionAt ?? 0);
  });

  return (
    <div className="tcs">
      <div className="tcs-row">
        {sorted.map((c) => {
          const live = liveIds.has(c.id);
          const fresh = c.lastSessionAt !== null && now - c.lastSessionAt < 2 * DAY_MS;
          const dormant = c.dormantDays !== null;
          const state = fresh ? 'fresh' : dormant ? 'dormant' : 'quiet';
          return (
            <button
              key={c.id}
              className={`tcs-item ${state}${live ? ' live' : ''}`}
              onClick={() => onOpenClient(c.id)}
              aria-label={c.name}
            >
              <span className="tcs-ring">
                <Avatar
                  userId={c.id}
                  name={c.name}
                  hasPhoto={c.avatar}
                  rev={c.avatarRev}
                  size={54}
                />
                {live && <span className="tcs-live" aria-hidden />}
                {dormant && !live && (
                  <span className="tcs-alert" aria-hidden>
                    <Icon name="warning" weight="fill" />
                  </span>
                )}
              </span>
              <span className="tcs-name">{firstName(c.name)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
