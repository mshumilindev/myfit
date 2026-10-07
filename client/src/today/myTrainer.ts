/**
 * "Who is my trainer" for Today (the `profileMe` call): name + photo only.
 * Cached like the roster — paints instantly from localStorage, skips the
 * network while fresh, and re-renders only when the payload changed.
 */
import { useCallback, useEffect, useState } from 'react';
import { cacheFresh, cachePeek, cacheSet, callFn } from '../api';

export interface MyTrainer {
  id: string;
  name: string;
  avatar: boolean;
  avatarRev?: number;
}

interface ProfileMeReply {
  trainer?: MyTrainer | null;
  access?: { id: string; name: string; role: string }[];
}

const TTL_MS = 10 * 60 * 1000;
const CACHE_KEY = 'myTrainer';
/** `false` is cached too — "no trainer" is an answer, not a miss. */
type Cached = MyTrainer | false;

/** Pick the trainer out of a `profileMe` reply (older servers only list `access`). */
export function trainerFromReply(d: ProfileMeReply): MyTrainer | null {
  if (d.trainer) return d.trainer;
  if (d.trainer === null) return null;
  const a = d.access?.find((x) => x.role === 'trainer');
  return a ? { id: a.id, name: a.name, avatar: false } : null;
}

/** My trainer, or null while unknown / when I have none. `enabled: false` never
 *  touches the network (trainers and admins have no trainer of their own). */
export function useMyTrainer(enabled: boolean): MyTrainer | null {
  const [trainer, setTrainer] = useState<MyTrainer | null>(() => {
    const c = cachePeek<Cached>(CACHE_KEY)?.data;
    return c || null;
  });

  const refresh = useCallback(() => {
    if (cacheFresh(cachePeek<Cached>(CACHE_KEY), TTL_MS)) return;
    callFn<ProfileMeReply>('profileMe')
      .then((d) => {
        const next = trainerFromReply(d);
        const prev = cachePeek<Cached>(CACHE_KEY)?.data || null;
        cacheSet<Cached>(CACHE_KEY, next ?? false);
        if (JSON.stringify(prev) !== JSON.stringify(next)) setTrainer(next);
      })
      .catch(() => {
        /* keep whatever is cached */
      });
  }, []);

  useEffect(() => {
    if (enabled) refresh();
  }, [enabled, refresh]);

  return enabled ? trainer : null;
}
