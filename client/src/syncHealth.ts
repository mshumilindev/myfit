/**
 * Background-sync health, for the non-modal sync indicator.
 *
 * The app renders from the local cache (localStorage mirror + Firestore's
 * persistent cache) and syncs in the background, so a dead or very slow network
 * must never gate the UI. This module only *describes* the situation (calm
 * "syncing / slow / offline" chip) and schedules retries with exponential
 * backoff; it never blocks, never touches the offline queue, and never merges
 * data — the store keeps replacing its cache with the server state.
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { currentUid, getMutationPending, subscribeMutation } from './api';
import { getStoreState, retrySync, subscribeStore } from './store';
import { getSyncMeta, subscribeSyncMeta } from './syncMeta';
import type { SyncStatus } from './types';
import type { SyncStatusState } from './components/ui/SyncStatus';

/** What the indicator can show: the chip states plus the two the icon adds (SPO-375). */
export type SyncUiState = SyncStatusState | 'stale' | 'locked';

/** A sync that has not settled after this long is "slow". */
export const SLOW_AFTER_MS = 8_000;
/** A plain "Syncing" chip is hidden for this long, so quick syncs never flash. */
export const SYNCING_SHOW_AFTER_MS = 2_000;
/** A save indicator is hidden for this long, so quick saves never flash. */
export const SAVING_SHOW_AFTER_MS = 400;
export const BACKOFF_BASE_MS = 5_000;
export const BACKOFF_MAX_MS = 60_000;

/** Delay before retry number `attempt` (0-based): 5s, 10s, 20s, 40s, then 60s. */
export function backoffDelay(attempt: number): number {
  const n = Math.max(0, Math.floor(attempt));
  return Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.min(n, 10));
}

export interface SyncUiInput {
  signedIn: boolean;
  status: SyncStatus;
  online: boolean;
  /** How long the store has been unsettled (not synced), ms. */
  unsettledForMs: number;
  /** How long a mutation request has been in flight, ms (0 = none). */
  savingForMs: number;
  /** Workouts not yet confirmed by the server. Omitted = unknown. */
  pendingWrites?: number;
  /** Synced documents the vault cannot open yet. */
  locked?: boolean;
}

/** What the chip should say. `synced` means "show nothing". Pure. */
export function deriveSyncUi(i: SyncUiInput): SyncUiState {
  if (!i.signedIn) return 'synced';
  if (i.status === 'failed') return 'failed';
  if (i.locked) return 'locked';
  if (!i.online || i.status === 'offline') {
    // No network and nothing of ours waiting to be sent: what you see is the saved copy.
    return i.pendingWrites === 0 ? 'stale' : 'offline';
  }
  if (i.status === 'pending' || i.status === 'syncing') {
    if (i.unsettledForMs >= SLOW_AFTER_MS) return 'slow';
    if (i.savingForMs >= SAVING_SHOW_AFTER_MS) return 'saving';
    return i.unsettledForMs >= SYNCING_SHOW_AFTER_MS ? 'syncing' : 'synced';
  }
  return i.savingForMs >= SAVING_SHOW_AFTER_MS ? 'saving' : 'synced';
}

// --- Unsettled / saving clocks ----------------------------------------------
// Tracked outside React (fed by the store and mutation listeners), so components
// only read plain numbers and no ref or effect has to write state during render.

const clock = { unsettledSince: null as number | null, savingSince: null as number | null };
const clockListeners = new Set<() => void>();

function updateClock(now: number = Date.now()): void {
  const unsettled = getStoreState().syncStatus !== 'synced';
  const unsettledSince = unsettled ? (clock.unsettledSince ?? now) : null;
  const savingSince = getMutationPending() > 0 ? (clock.savingSince ?? now) : null;
  if (unsettledSince === clock.unsettledSince && savingSince === clock.savingSince) return;
  clock.unsettledSince = unsettledSince;
  clock.savingSince = savingSince;
  for (const l of clockListeners) l();
}
subscribeStore(updateClock);
subscribeMutation(updateClock);
updateClock();

function subscribeClock(cb: () => void): () => void {
  clockListeners.add(cb);
  return () => clockListeners.delete(cb);
}

/** Give the connection a fresh grace period (after a manual retry or coming back online). */
function restartUnsettledClock(): void {
  if (clock.unsettledSince === null) return;
  clock.unsettledSince = Date.now();
  for (const l of clockListeners) l();
}

function useOnline(): boolean {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener('online', cb);
      window.addEventListener('offline', cb);
      return () => {
        window.removeEventListener('online', cb);
        window.removeEventListener('offline', cb);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}

/**
 * Derives the indicator state from the store + connectivity + in-flight
 * mutations, and drives retries: exponential backoff while slow, an immediate
 * retry when the browser comes back online. Returns the state and a manual retry.
 */
export function useSyncUi(): { state: SyncUiState; retry: () => void; count: number } {
  const status = useSyncExternalStore(
    subscribeStore,
    () => getStoreState().syncStatus,
    () => getStoreState().syncStatus,
  );
  const { pendingWrites, dataLocked: locked } = useSyncExternalStore(
    subscribeSyncMeta,
    getSyncMeta,
    getSyncMeta,
  );
  const online = useOnline();
  const unsettledSince = useSyncExternalStore(
    subscribeClock,
    () => clock.unsettledSince,
    () => null,
  );
  const savingSince = useSyncExternalStore(
    subscribeClock,
    () => clock.savingSince,
    () => null,
  );
  const [now, setNow] = useState(() => Date.now());

  // Tick while something is unsettled or saving, so the slow / saving
  // thresholds are crossed without waiting for another store update.
  const ticking = unsettledSince !== null || savingSince !== null;
  useEffect(() => {
    if (!ticking) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [ticking]);

  const signedIn = !!currentUid();
  const state = deriveSyncUi({
    signedIn,
    status,
    online,
    unsettledForMs: unsettledSince === null ? 0 : Math.max(0, now - unsettledSince),
    savingForMs: savingSince === null ? 0 : Math.max(0, now - savingSince),
    pendingWrites,
    locked,
  });

  const retry = useCallback(() => {
    restartUnsettledClock();
    retrySync();
  }, []);

  // Back online: retry now and give the connection a fresh grace period.
  useEffect(() => {
    if (!signedIn) return;
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [signedIn, retry]);

  // Slow but "online": keep retrying in the background with exponential backoff.
  const slow = state === 'slow';
  useEffect(() => {
    if (!slow) return;
    let cancelled = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        if (cancelled) return;
        attempt += 1;
        retrySync();
        schedule();
      }, backoffDelay(attempt));
    };
    schedule();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [slow]);

  return { state, retry, count: pendingWrites };
}
