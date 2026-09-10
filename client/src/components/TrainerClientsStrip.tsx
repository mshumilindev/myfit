/**
 * Trainer's clients as an Instagram-stories-style row at the top of Today.
 * Read-only, history-only (no live sessions — a trainer can't see those). The
 * ring reflects recency: a gold ring for a fresh finished session, a red ring
 * for a dormant client, a quiet ring otherwise. Sorted most-recently-trained
 * first, never-trained last. Shown for trainers and for admins who have clients.
 */
import { useCallback, useEffect, useState } from 'react';
import { cachePeek, cacheSet, callFn } from '../api';
import { Avatar } from './Avatar';
import { Icon } from '../ui';

interface StripClient {
  id: string;
  name: string;
  avatar: boolean;
  lastSessionAt: number | null;
  dormantDays: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

export function TrainerClientsStrip({ onOpenClient }: { onOpenClient: (id: string) => void }) {
  const [now] = useState(() => Date.now());
  const cached = cachePeek<StripClient[]>('trainerClients');
  const [clients, setClients] = useState<StripClient[] | null>(cached?.data ?? null);

  const refresh = useCallback(() => {
    callFn<{ clients: StripClient[] }>('trainerClients')
      .then((d) => {
        cacheSet('trainerClients', d.clients);
        setClients(d.clients);
      })
      .catch(() => {
        /* keep whatever is cached */
      });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!clients || clients.length === 0) return null;

  // Most-recently-trained first; clients who never trained sort to the end.
  const sorted = [...clients].sort((a, b) => (b.lastSessionAt ?? 0) - (a.lastSessionAt ?? 0));

  return (
    <div className="tcs">
      <div className="tcs-row">
        {sorted.map((c) => {
          const fresh = c.lastSessionAt !== null && now - c.lastSessionAt < 2 * DAY_MS;
          const dormant = c.dormantDays !== null;
          const state = fresh ? 'fresh' : dormant ? 'dormant' : 'quiet';
          return (
            <button
              key={c.id}
              className={`tcs-item ${state}`}
              onClick={() => onOpenClient(c.id)}
              aria-label={c.name}
            >
              <span className="tcs-ring">
                <Avatar userId={c.id} name={c.name} hasPhoto={c.avatar} size={54} />
                {dormant && (
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
