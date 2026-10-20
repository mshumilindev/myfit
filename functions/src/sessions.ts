/**
 * Sessions (SPO-212): the person's signed-in devices, for Profile → Settings → Sessions.
 *
 * Records live in `users/{uid}/sessions/{deviceId}` (server-only; the client uses these callables). A record holds a
 * readable device label, an approximate place (city / country from edge headers when present; never the IP) and times.
 *
 * Sign-out of another device: the record gets `revokedAt`. That device checks its record at start and on focus
 * (`sessionCheck`) and signs itself out when it finds it revoked. A device with no record yet (signed in before this
 * existed) is adopted, not signed out. A revoked device keeps working until its next check; the Firebase ID token itself
 * is not killed (revokeRefreshTokens would end every device at once).
 */
import { onCall } from 'firebase-functions/v2/https';
import { db, HttpsError } from './lib';
import { describeClient, placeFromHeaders, validDeviceId } from './sessionsPure';

function sessions(uid: string) {
  return db.collection('users').doc(uid).collection('sessions');
}

function mustUid(req: { auth?: { uid: string } | null }): string {
  if (!req.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  return req.auth.uid;
}

function deviceIdOf(data: unknown): string {
  const id = (data as { deviceId?: unknown } | undefined)?.deviceId;
  if (!validDeviceId(id)) throw new HttpsError('invalid-argument', 'Bad device id.');
  return id;
}

/** Called by the app at start and on focus. Creates / adopts the record, refreshes it, and says whether this device was signed out elsewhere. */
export const sessionCheck = onCall(async (req) => {
  const uid = mustUid(req);
  const deviceId = deviceIdOf(req.data);
  const ref = sessions(uid).doc(deviceId);
  const now = Date.now();
  const snap = await ref.get();
  if (snap.exists && (snap.data() as { revokedAt?: number | null }).revokedAt) return { active: false };
  const place = placeFromHeaders(req.rawRequest?.headers as Record<string, unknown> | undefined);
  const base = { label: describeClient(req.rawRequest?.headers?.['user-agent']), lastSeenAt: now, ...place };
  if (snap.exists) await ref.update(base);
  else await ref.set({ ...base, createdAt: now, revokedAt: null });
  return { active: true };
});

export const sessionList = onCall(async (req) => {
  const uid = mustUid(req);
  const snap = await sessions(uid).get();
  const rows = snap.docs
    .map((d) => ({ deviceId: d.id, ...(d.data() as Record<string, unknown>) }))
    .filter((r) => !(r as { revokedAt?: number | null }).revokedAt)
    .sort((a, b) => Number((b as { lastSeenAt?: number }).lastSeenAt ?? 0) - Number((a as { lastSeenAt?: number }).lastSeenAt ?? 0));
  return { sessions: rows };
});

/** Signs another device out (its next check ends its session). */
export const sessionRevoke = onCall(async (req) => {
  const uid = mustUid(req);
  const deviceId = deviceIdOf(req.data);
  const ref = sessions(uid).doc(deviceId);
  if ((await ref.get()).exists) await ref.update({ revokedAt: Date.now() });
  return { ok: true };
});

/** "Sign out all except this device". */
export const sessionRevokeOthers = onCall(async (req) => {
  const uid = mustUid(req);
  const keep = deviceIdOf(req.data);
  const now = Date.now();
  const snap = await sessions(uid).get();
  const batch = db.batch();
  let n = 0;
  for (const d of snap.docs) {
    if (d.id === keep || (d.data() as { revokedAt?: number | null }).revokedAt) continue;
    batch.update(d.ref, { revokedAt: now });
    n++;
  }
  if (n) await batch.commit();
  return { revoked: n };
});

/** This device signed out on its own: its record goes away. */
export const sessionEnd = onCall(async (req) => {
  const uid = mustUid(req);
  await sessions(uid).doc(deviceIdOf(req.data)).delete();
  return { ok: true };
});
