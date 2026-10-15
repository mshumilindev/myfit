/**
 * "Who is my trainer" for Today (the `profileMe` call): name + photo only.
 * Offline-first like the roster — the last answer paints from the sealed on-device snapshot (nothing readable on disk),
 * the network is skipped while it is fresh, and the screen re-renders only when the payload changed.
 */
import { useEffect, useState } from 'react';
import { callFn } from '../api';
import { offlinePeekNow, offlineRevalidate } from '../offline/offlineCache';

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

const SPEC = { accept: (v: Cached) => v === false || (!!v && typeof v === 'object' && 'id' in v) };
const same = (a: MyTrainer | null, b: MyTrainer | null) => JSON.stringify(a) === JSON.stringify(b);

/** My trainer, or null while unknown / when I have none. `enabled: false` never
 *  touches the network (trainers and admins have no trainer of their own). */
export function useMyTrainer(enabled: boolean): MyTrainer | null {
  // this session's copy paints on the very first render; the sealed snapshot lands a moment later
  const [trainer, setTrainer] = useState<MyTrainer | null>(
    () => offlinePeekNow<Cached>(CACHE_KEY)?.data || null,
  );

  useEffect(() => {
    if (!enabled) return;
    return offlineRevalidate<Cached>({
      key: CACHE_KEY,
      ttlMs: TTL_MS,
      ...SPEC,
      fetch: async () => trainerFromReply(await callFn<ProfileMeReply>('profileMe')) ?? false,
      // keep whatever is shown on an error; a snapshot never overrides what the network already said
      apply: (v) => setTrainer((cur) => (same(cur, v || null) ? cur : v || null)),
    });
  }, [enabled]);

  return enabled ? trainer : null;
}
