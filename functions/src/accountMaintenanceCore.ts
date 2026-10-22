/**
 * Housekeeping that backs up account deletion (SPO-285), on the `Kv` seam so it is unit tested without Firebase.
 *
 *  - `purgeStaleLoginAttempts` (S2): `loginAttempts` counters written before the `identifier` field existed cannot be found
 *    by the username during a deletion. They live only `FAIL_WINDOW` (15 min) anyway; this removes every counter whose
 *    window ended more than an hour ago, a bounded batch per run, so none of them (they hold a typed sign-in name next to
 *    an IP) outlives the next hourly run by long.
 *  - `sweepPhantomUsers` (S1): a stale ID token or an offline write queue can recreate `users/{uid}/...` after the account
 *    was deleted, leaving a "phantom" parent (subcollections, no document). The Firestore rules cannot refuse it without an
 *    `exists()` read on every client write of ~25 subcollections, so a daily sweep deletes such trees instead.
 */
import type { Kv } from './coach/kv';
import { isUid } from './coach/logic';

export const LOGIN_ATTEMPT_RETENTION_MS = 60 * 60 * 1000;
export const PURGE_BATCH = 500;

export async function purgeStaleLoginAttempts(
  kv: Kv,
  now: number,
  limit = PURGE_BATCH,
): Promise<number> {
  const rows = await kv.list('loginAttempts', {
    where: [['windowStart', '<', now - LOGIN_ATTEMPT_RETENTION_MS]],
    limit,
  });
  for (const r of rows) await kv.del(r.path);
  return rows.length;
}

export interface PhantomPorts {
  /** ids under `users/` that have descendants but no document */
  phantomUserIds(): Promise<string[]>;
  deleteTree(path: string): Promise<void>;
}
export const PHANTOM_BATCH = 200;

export async function sweepPhantomUsers(
  kv: Kv,
  ports: PhantomPorts,
  limit = PHANTOM_BATCH,
): Promise<number> {
  let n = 0;
  for (const id of await ports.phantomUserIds()) {
    if (n >= limit) break;
    if (!isUid(id)) continue;
    // re-check right before deleting: an account created since the listing is not a phantom
    if (await kv.get(`users/${id}`)) continue;
    await ports.deleteTree(`users/${id}`);
    n++;
  }
  return n;
}
