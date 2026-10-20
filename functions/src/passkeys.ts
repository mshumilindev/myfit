/**
 * Passkeys (SPO-211): Face ID / Touch ID / Windows Hello sign-in on this device.
 * A passkey is registered right after a "Remember me" sign-in; the landing then signs the person in with one tap.
 * Public keys live in `passkeys/{credentialId}`; challenges in `passkeyChallenges/{id}` (single use, 5 minutes).
 * Sign-in returns the same payload (custom token) as `login`. The rules are in passkeysCore.ts.
 */
import { onCall } from 'firebase-functions/v2/https';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server';
import { randomUUID } from 'node:crypto';
import { authPayload, db, displayName, HttpsError, mintToken, type UserDoc } from './lib';
import { allowedRelyingParty } from './passkeysPure';
import {
  loginOptionsCore,
  loginVerifyCore,
  PasskeyError,
  registerOptionsCore,
  registerVerifyCore,
  type ChallengeDoc,
  type PasskeyDoc,
  type PasskeyStore,
} from './passkeysCore';

function relyingParty(origin: unknown) {
  const extra = (process.env.PASSKEY_ORIGINS ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  const rp = allowedRelyingParty(origin, extra);
  if (!rp) throw new HttpsError('failed-precondition', 'This origin cannot use passkeys.');
  return rp;
}

const firestoreStore: PasskeyStore = {
  async putChallenge(id, doc) {
    await db.collection('passkeyChallenges').doc(id).set(doc);
  },
  async takeChallenge(id) {
    const ref = db.collection('passkeyChallenges').doc(id);
    const snap = await ref.get();
    await ref.delete().catch(() => undefined); // single use
    return snap.exists ? (snap.data() as ChallengeDoc) : null;
  },
  async getPasskey(id) {
    const snap = await db.collection('passkeys').doc(id).get();
    return snap.exists ? (snap.data() as PasskeyDoc) : null;
  },
  async savePasskey(id, doc) {
    await db.collection('passkeys').doc(id).set(doc);
  },
  async updatePasskey(id, patch) {
    await db.collection('passkeys').doc(id).update(patch);
  },
  async listPasskeys(userId) {
    const snap = await db.collection('passkeys').where('userId', '==', userId).get();
    return snap.docs.map((d) => ({ id: d.id, transports: (d.data() as PasskeyDoc).transports }));
  },
};

/** The core's errors become callable errors. */
async function mapErrors<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    if (e instanceof PasskeyError) throw new HttpsError(e.code, e.message);
    throw e;
  }
}

function mustUid(req: { auth?: { uid: string } | null }): string {
  if (!req.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  return req.auth.uid;
}

function bodyOf(data: unknown): { challengeId: string; response: unknown } {
  const b = (data ?? {}) as { challengeId?: unknown; response?: unknown };
  if (typeof b.challengeId !== 'string' || typeof b.response !== 'object' || !b.response) {
    throw new HttpsError('invalid-argument', 'Bad request.');
  }
  return { challengeId: b.challengeId, response: b.response };
}

// --- register (signed-in person, after "Remember me") -----------------------

export const passkeyRegisterOptions = onCall(async (req) => {
  const uid = mustUid(req);
  const rp = relyingParty(req.rawRequest?.headers?.origin);
  const userSnap = await db.collection('users').doc(uid).get();
  if (!userSnap.exists) throw new HttpsError('not-found', 'Unknown account.');
  const user: UserDoc = { id: uid, ...(userSnap.data() as Omit<UserDoc, 'id'>) };
  return mapErrors(() =>
    registerOptionsCore(firestoreStore, {
      uid,
      userName: displayName(user),
      rp,
      challengeId: randomUUID(),
      now: Date.now(),
    }),
  );
});

export const passkeyRegisterVerify = onCall(async (req) => {
  const uid = mustUid(req);
  const rp = relyingParty(req.rawRequest?.headers?.origin);
  const b = bodyOf(req.data);
  await mapErrors(() =>
    registerVerifyCore(firestoreStore, {
      uid,
      rp,
      challengeId: b.challengeId,
      response: b.response as RegistrationResponseJSON,
      now: Date.now(),
    }),
  );
  return { ok: true };
});

// --- sign-in (landing; no session yet) ---------------------------------------

export const passkeyLoginOptions = onCall(async (req) => {
  const rp = relyingParty(req.rawRequest?.headers?.origin);
  const userId = (req.data as { userId?: unknown } | undefined)?.userId;
  return mapErrors(() =>
    loginOptionsCore(firestoreStore, {
      userId: typeof userId === 'string' && userId ? userId : null,
      rp,
      challengeId: randomUUID(),
      now: Date.now(),
    }),
  );
});

export const passkeyLoginVerify = onCall(async (req) => {
  const rp = relyingParty(req.rawRequest?.headers?.origin);
  const b = bodyOf(req.data);
  const userId = await mapErrors(() =>
    loginVerifyCore(firestoreStore, {
      rp,
      challengeId: b.challengeId,
      response: b.response as AuthenticationResponseJSON,
      now: Date.now(),
    }),
  );
  const userSnap = await db.collection('users').doc(userId).get();
  if (!userSnap.exists) throw new HttpsError('unauthenticated', 'Passkey not recognised.');
  const user: UserDoc = { id: userId, ...(userSnap.data() as Omit<UserDoc, 'id'>) };
  if (user.status === 'suspended')
    throw new HttpsError('permission-denied', 'This account is suspended. Ask your admin.');
  return authPayload(user, await mintToken(user.id, user.role));
});
