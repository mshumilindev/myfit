/** Session rules (SPO-212) over a storage interface, so they can be tested without Firebase. sessions.ts wires Firestore. */

export interface SessionDoc {
  label: string;
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

export type SessionInfo = Pick<SessionDoc, 'label' | 'city' | 'country'>;

/** Refreshes (or adopts) the device's record; `active:false` when it was signed out from another device. */
export async function checkCore(store: SessionStore, deviceId: string, info: SessionInfo, now: number): Promise<{ active: boolean }> {
  const cur = await store.get(deviceId);
  if (cur?.revokedAt) return { active: false };
  if (cur) await store.update(deviceId, { ...info, lastSeenAt: now });
  else await store.set(deviceId, { ...info, lastSeenAt: now, createdAt: now, revokedAt: null });
  return { active: true };
}

export async function listCore(store: SessionStore): Promise<(SessionDoc & { deviceId: string })[]> {
  return (await store.list())
    .filter((r) => !r.doc.revokedAt)
    .map((r) => ({ deviceId: r.deviceId, ...r.doc }))
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt);
}

export async function revokeCore(store: SessionStore, deviceId: string, now: number): Promise<void> {
  if (await store.get(deviceId)) await store.update(deviceId, { revokedAt: now });
}

/** Everything except `keep`; returns how many were signed out. */
export async function revokeOthersCore(store: SessionStore, keep: string, now: number): Promise<number> {
  let n = 0;
  for (const r of await store.list()) {
    if (r.deviceId === keep || r.doc.revokedAt) continue;
    await store.update(r.deviceId, { revokedAt: now });
    n++;
  }
  return n;
}
