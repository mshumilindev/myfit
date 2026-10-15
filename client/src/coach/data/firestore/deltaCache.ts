/**
 * The previous raw `coachRead` answer of one client (workouts for totals / sets), kept between refreshes in the sealed
 * on-device store so the next read can ask only for what changed (`deltaSync.ts`). Same rules as every snapshot
 * (`snapshotCache.ts`): sealed with the vault key, dropped on another account / schema / age, never throws.
 */
import type { SealedLocal } from '../../chat/sealedLocal';
import { DELTA_SCHEMA, FULL_RESYNC_MS, isDeltaEntry, type DeltaEntry } from './deltaSync';
import { snapshotOver, type SnapshotCache } from './snapshotCache';

export function deltaCacheOver(
  local: Promise<SealedLocal>,
  trainerUid: string,
  clientId: string,
  o: { waitMs?: number; now?: () => number } = {},
): SnapshotCache<DeltaEntry> {
  return snapshotOver<DeltaEntry>(local, {
    key: `delta:${trainerUid}:${clientId}`,
    uid: trainerUid,
    schema: DELTA_SCHEMA,
    // an entry older than the full-resync age is never used for a delta anyway: do not keep sealed data around
    maxAgeMs: 2 * FULL_RESYNC_MS,
    accept: isDeltaEntry,
    waitMs: 2_000,
    ...o,
  });
}
