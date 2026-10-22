/**
 * "Stop sharing" must reach the server (B4): the revoke of the six trainer grants is written to a small persisted queue
 * BEFORE it is sent, and a failed or offline send is retried at the next app start, when the connection returns and at
 * sign-in, like the consent queue (`legal/signupConsents.ts`). The queue holds the account's uid and the grant KINDS only
 * (no levels, no personal data), so it is a DEVICE-level key (`accounts/scopedStorage` DEVICE_KEYS): sign-out keeps it,
 * the sign-out flushes it first (short timeout), and the account's deletion prunes it. A newer sharing choice cancels a
 * revoke that was still waiting (it must never wipe what the person has just chosen).
 */
import { useEffect } from 'react';
import { currentUid } from '../../api';
import { SHARE_CATEGORIES, type ShareCategory } from './domain';

export const REVOKE_QUEUE_KEY = 'spotter.consentRevokeQueue';

interface Entry {
  uid: string;
  at: number;
  kinds: ShareCategory[];
}

function load(): Entry[] {
  try {
    const raw = localStorage.getItem(REVOKE_QUEUE_KEY);
    const v: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? (v as Entry[]) : [];
  } catch {
    return [];
  }
}
function save(q: Entry[]): void {
  try {
    if (q.length) localStorage.setItem(REVOKE_QUEUE_KEY, JSON.stringify(q));
    else localStorage.removeItem(REVOKE_QUEUE_KEY);
  } catch {
    /* storage unavailable: the in-memory attempt still runs */
  }
}

/** Records "revoke all six grants" for the signed-in account (one entry per account). */
export function enqueueRevoke(): void {
  const uid = currentUid();
  if (!uid) return;
  save([
    ...load().filter((e) => e.uid !== uid),
    { uid, at: Date.now(), kinds: [...SHARE_CATEGORIES] },
  ]);
}

/** The revoke was delivered. */
export function clearRevoke(): void {
  const uid = currentUid();
  if (uid) save(load().filter((e) => e.uid !== uid));
}

/** A newer sharing choice replaces a revoke still waiting. */
export const cancelRevoke = clearRevoke;

export const hasPendingRevoke = (uid: string): boolean => load().some((e) => e.uid === uid);

/** The account was deleted: nothing is left to revoke. */
export function pruneRevokesOf(uid: string | null): void {
  if (uid) save(load().filter((e) => e.uid !== uid));
}

let running: Promise<void> | null = null;

/** Sends the signed-in account's waiting revoke; a failure keeps it queued. Never throws. */
export function flushPendingRevokes(): Promise<void> {
  const uid = currentUid();
  if (!uid || !hasPendingRevoke(uid)) return Promise.resolve();
  if (running) return running;
  running = (async () => {
    try {
      const { getClientPort } = await import('./data/config');
      await getClientPort().revoke();
      if (currentUid() === uid) clearRevoke();
    } catch {
      /* offline, busy or the port is not installed yet: stays queued */
    } finally {
      running = null;
    }
  })();
  return running;
}

/** Retries a waiting revoke when the app opens signed in and whenever the connection returns. */
export function usePendingRevokeFlush(authed: boolean): void {
  useEffect(() => {
    if (!authed) return;
    void flushPendingRevokes();
    const on = () => void flushPendingRevokes();
    window.addEventListener('online', on);
    return () => window.removeEventListener('online', on);
  }, [authed]);
}
