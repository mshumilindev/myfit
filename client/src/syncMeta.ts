/**
 * What the server still owes us, read from Firestore snapshot metadata (SPO-375): how many workouts
 * have writes it has not confirmed yet, and whether some synced documents cannot be opened because the
 * vault key is not ready. Kept out of the store so the store stays small. `setSyncMeta` must run
 * before the store notifies, so a component that reads `getSyncMeta()` while rendering sees fresh values.
 */
import type { QuerySnapshot } from 'firebase/firestore';
import type { SyncStatus } from './types';

export interface SnapMeta {
  fromCache: boolean;
  pending: boolean;
  /** Documents with writes the server has not confirmed. */
  pendingCount: number;
}

export interface SyncMeta {
  pendingWrites: number;
  dataLocked: boolean;
}

/** The parts of a collection snapshot the sync state is made of. */
export function snapMeta(snap: QuerySnapshot): SnapMeta {
  return {
    fromCache: snap.metadata.fromCache,
    pending: snap.metadata.hasPendingWrites,
    pendingCount: snap.docs.filter((d) => d.metadata.hasPendingWrites).length,
  };
}

/** Pending changes go out when online and wait when not; cached data with nothing pending, offline, is `offline` too. */
export function syncStatusOf(hasPending: boolean, fromCache: boolean, online: boolean): SyncStatus {
  if (hasPending) return online ? 'pending' : 'offline';
  return fromCache && !online ? 'offline' : 'synced';
}

let meta: SyncMeta = { pendingWrites: 0, dataLocked: false };
const listeners = new Set<() => void>();

export function getSyncMeta(): SyncMeta {
  return meta;
}

export function subscribeSyncMeta(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function setSyncMeta(pendingWrites: number, locked: number | boolean): void {
  const dataLocked = typeof locked === 'number' ? locked > 0 : locked;
  if (meta.pendingWrites === pendingWrites && meta.dataLocked === dataLocked) return;
  meta = { pendingWrites, dataLocked };
  for (const l of listeners) l();
}
