/**
 * The trainer's world, kept between launches (stale-while-revalidate) over the shared sealed snapshot
 * (`snapshotCache.ts`): shown at once on the next start, replaced by the network answer in the background.
 */
import type { SealedLocal } from '../../chat/sealedLocal';
import type { WorldData } from '../port';
import { snapshotOver } from './snapshotCache';
import type { WorldCache } from './worldPort';

/** Bump when the shape of `WorldData` changes in a way the old snapshot cannot be shown with. */
export const WORLD_SCHEMA = 1;
/** Older than this is not shown as "last known" any more (the sealed store sweeps entries idle for 30 days anyway). */
export const WORLD_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export function worldCacheOver(
  local: Promise<SealedLocal>,
  uid: string,
  o: { waitMs?: number; now?: () => number } = {},
): WorldCache {
  const c = snapshotOver<WorldData>(local, {
    key: `world:${uid}`,
    uid,
    schema: WORLD_SCHEMA,
    maxAgeMs: WORLD_MAX_AGE_MS,
    accept: (w) => Array.isArray(w.clients) && w.trainer?.id === uid,
    ...o,
  });
  return {
    async get() {
      const s = await c.get();
      return s ? { data: s.value, fetchedAt: s.savedAt } : null;
    },
    set: (v) => c.set(v.data, v.fetchedAt),
  };
}
