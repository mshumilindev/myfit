/** Session rules (SPO-212) over a storage interface, so they can be tested without Firebase. sessions.ts wires Firestore. */

import type { DeviceKind } from './sessionsPure';

export interface SessionDoc {
  label: string;
  /** Absent on records made before SPO-436; the next check fills it in. */
  kind?: DeviceKind;
  city: string | null;
  country: string | null;
  lastSeenAt: number;
  createdAt: number;
  revokedAt: number | null;
}

export interface SessionStore {
  get(deviceId: string): Promise<SessionDoc | null>;
  set(deviceId: string, doc: SessionDoc): Promise<void>;
  update(deviceId: string, patch: Partial<SessionDoc>): Promise<void>;
  list(): Promise<{ deviceId: string; doc: SessionDoc }[]>;
  remove(deviceId: string): Promise<void>;
}

/** Records one person may keep; the least recently seen ones go first, so a script can't grow the collection without bound. */
export const MAX_SESSIONS = 50;

/** After a new device appears, the next one inside this window is not announced again. */
export const NEW_DEVICE_QUIET_MS = 10 * 60_000;

/** A record nobody has used for this long is dropped: browsers that lost their storage leave such ghosts behind (SPO-436). */
export const STALE_SESSION_MS = 30 * 24 * 3600_000;

/** Drops live records idle past STALE_SESSION_MS (never a revoked one: removing it would let that device re-adopt itself). */
async function purgeStale(
  store: SessionStore,
  all: { deviceId: string; doc: SessionDoc }[],
  now: number,
): Promise<{ deviceId: string; doc: SessionDoc }[]> {
  const stale = all.filter((r) => !r.doc.revokedAt && now - r.doc.lastSeenAt > STALE_SESSION_MS);
  for (const r of stale) await store.remove(r.deviceId);
  return stale.length ? all.filter((r) => !stale.includes(r)) : all;
}

export type SessionInfo = Pick<SessionDoc, 'label' | 'kind' | 'city' | 'country'>;

/** Refreshes (or adopts) the device's record; `active:false` when it was signed out from another device. */
export async function checkCore(
  store: SessionStore,
  deviceId: string,
  info: SessionInfo,
  now: number,
): Promise<{ active: boolean; newDevice: boolean }> {
  const cur = await store.get(deviceId);
  if (cur?.revokedAt) return { active: false, newDevice: false };
  let newDevice = false;
  if (cur) await store.update(deviceId, { ...info, lastSeenAt: now });
  else {
    const all = await purgeStale(store, await store.list(), now);
    // The very first device of an account is not news; any later one is (SPO-436).
    // Only records the SPO-436 server has seen count (they carry `kind`), so the rollout does not announce every old
    // device; and one new device per NEW_DEVICE_QUIET_MS, so cycling device ids cannot turn this into push spam.
    newDevice =
      all.some((r) => !r.doc.revokedAt && r.doc.kind) &&
      !all.some((r) => now - r.doc.createdAt < NEW_DEVICE_QUIET_MS);
    const excess = all.length + 1 - MAX_SESSIONS;
    if (excess > 0) {
      const oldest = all
        .filter((r) => !r.doc.revokedAt) // a revocation is never evicted: that would let the device re-adopt itself
        .sort((a, b) => a.doc.lastSeenAt - b.doc.lastSeenAt)
        .slice(0, excess);
      for (const r of oldest) await store.remove(r.deviceId);
    }
    await store.set(deviceId, { ...info, lastSeenAt: now, createdAt: now, revokedAt: null });
  }
  return { active: true, newDevice };
}

export async function listCore(
  store: SessionStore,
  now?: number,
): Promise<(SessionDoc & { deviceId: string })[]> {
  const all = await store.list();
  return (now === undefined ? all : await purgeStale(store, all, now))
    .filter((r) => !r.doc.revokedAt)
    .map((r) => ({ deviceId: r.deviceId, ...r.doc }))
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt);
}

export async function revokeCore(
  store: SessionStore,
  deviceId: string,
  now: number,
): Promise<void> {
  if (await store.get(deviceId)) await store.update(deviceId, { revokedAt: now });
}

/** Everything except `keep`; returns how many were signed out. */
export async function revokeOthersCore(
  store: SessionStore,
  keep: string,
  now: number,
): Promise<number> {
  let n = 0;
  for (const r of await store.list()) {
    if (r.deviceId === keep || r.doc.revokedAt) continue;
    await store.update(r.deviceId, { revokedAt: now });
    n++;
  }
  return n;
}
