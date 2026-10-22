/**
 * Sessions (SPO-212): the person's signed-in devices, for Profile → Settings → Sessions.
 *
 * Records live in `users/{uid}/sessions/{deviceId}` (server-only; the client uses these callables). A record holds a
 * readable device label, an approximate place (city / country from edge headers when present; never the IP) and times.
 *
 * Sign-out of another device: the record gets `revokedAt`. That device checks its record at start and on focus
 * (`sessionCheck`) and signs itself out when it finds it revoked. A device with no record yet (signed in before this
 * existed) is adopted, not signed out. A single revoked device keeps working until its next check (Firebase can't end one
 * device's refresh token alone); its passkeys are deleted at once so it can't sign in again by biometrics.
 *
 * "Sign out all except this device" is hard: every refresh token of the account is revoked (other devices can't renew
 * after their current ID token, at most about an hour), all other passkeys are deleted, and this device gets a fresh
 * custom token to sign itself back in.
 */
import { onCall } from 'firebase-functions/v2/https';
import { authAdmin, db, HttpsError, mintToken, type UserDoc, HOT } from './lib';
import { deletePasskeysOf, deletePasskeysOfDevice } from './passkeysStore';
import { describeClient, placeFromHeaders, validDeviceId } from './sessionsPure';
import {
  checkCore,
  listCore,
  revokeCore,
  revokeOthersCore,
  type SessionDoc,
  type SessionStore,
} from './sessionsCore';

function sessions(uid: string) {
  return db.collection('users').doc(uid).collection('sessions');
}

/** Firestore storage for one person's session records. */
function storeFor(uid: string): SessionStore {
  const col = sessions(uid);
  return {
    async get(id) {
      const s = await col.doc(id).get();
      return s.exists ? (s.data() as SessionDoc) : null;
    },
    async set(id, doc) {
      await col.doc(id).set(doc);
    },
    async update(id, patch) {
      await col.doc(id).update(patch);
    },
    async list() {
      return (await col.get()).docs.map((d) => ({ deviceId: d.id, doc: d.data() as SessionDoc }));
    },
    async remove(id) {
      await col.doc(id).delete();
    },
  };
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
export const sessionCheck = onCall(HOT, async (req) => {
  const uid = mustUid(req);
  const headers = req.rawRequest?.headers as Record<string, unknown> | undefined;
  const info = { label: describeClient(headers?.['user-agent']), ...placeFromHeaders(headers) };
  return checkCore(storeFor(uid), deviceIdOf(req.data), info, Date.now());
});

export const sessionList = onCall(async (req) => ({
  sessions: await listCore(storeFor(mustUid(req))),
}));

/** Signs another device out (its next check ends its session). */
export const sessionRevoke = onCall(async (req) => {
  const uid = mustUid(req);
  const deviceId = deviceIdOf(req.data);
  await revokeCore(storeFor(uid), deviceId, Date.now());
  await deletePasskeysOfDevice(uid, deviceId);
  return { ok: true };
});

/** "Sign out all except this device". */
export const sessionRevokeOthers = onCall(async (req) => {
  const uid = mustUid(req);
  const keep = deviceIdOf(req.data);
  const userSnap = await db.collection('users').doc(uid).get();
  if (!userSnap.exists) throw new HttpsError('not-found', 'Unknown account.');
  const user = userSnap.data() as Omit<UserDoc, 'id'>;
  if (user.status === 'suspended') throw new HttpsError('permission-denied', 'forbidden');
  const revoked = await revokeOthersCore(storeFor(uid), keep, Date.now());
  await deletePasskeysOf(uid, keep);
  await authAdmin.revokeRefreshTokens(uid);
  // This device's own refresh token died too: it signs itself back in with this fresh token.
  return { revoked, token: await mintToken(uid, user.role) };
});

/** This device signed out on its own: its record goes away; with `forget` (left the landing list) so does its passkey. */
export const sessionEnd = onCall(HOT, async (req) => {
  const uid = mustUid(req);
  const deviceId = deviceIdOf(req.data);
  await storeFor(uid).remove(deviceId);
  if ((req.data as { forget?: unknown }).forget === true)
    await deletePasskeysOfDevice(uid, deviceId);
  return { ok: true };
});
