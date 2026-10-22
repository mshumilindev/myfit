/**
 * Passkeys (SPO-211): Face ID / Touch ID / Windows Hello sign-in on this device.
 * A passkey is registered right after a "Remember me" sign-in; the landing then signs the person in with one tap.
 * Public keys live in `passkeys/{credentialId}`; challenges in `passkeyChallenges/{id}` (single use, 5 minutes).
 * Sign-in returns the same payload (custom token) as `login`. The rules are in passkeysCore.ts.
 */
import { onCall } from 'firebase-functions/v2/https';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server';
import { randomUUID } from 'node:crypto';
import { authPayload, db, displayName, HttpsError, mintToken, type UserDoc, HOT } from './lib';
import { allowedRelyingParty } from './passkeysPure';
import {
  loginOptionsCore,
  loginVerifyCore,
  PasskeyError,
  registerOptionsCore,
  registerVerifyCore,
} from './passkeysCore';
import { firestoreStore } from './passkeysStore';
import { validDeviceId } from './sessionsPure';

function relyingParty(origin: unknown) {
  const extra = (process.env.PASSKEY_ORIGINS ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  // localhost only in the emulator / local dev, never in production.
  const rp = allowedRelyingParty(origin, extra, process.env.FUNCTIONS_EMULATOR === 'true');
  if (!rp) throw new HttpsError('failed-precondition', 'This origin cannot use passkeys.');
  return rp;
}

/** The core's errors become callable errors. */
async function mapErrors<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    if (e instanceof PasskeyError) throw new HttpsError(e.code, e.message);
    throw e;
  }
}

const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX = 40;

/** Per-address cap on the unauthenticated passkey endpoints (each call counts; the window resets after 15 minutes). */
async function rateLimit(req: { rawRequest?: { ip?: string } }): Promise<void> {
  const ip = (req.rawRequest?.ip ?? 'noip').replace(/[^\w.:-]/g, '_').slice(0, 100);
  const ref = db.collection('passkeyAttempts').doc(ip);
  const over = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();
    const cur = snap.exists ? (snap.data() as { count: number; windowStart: number }) : null;
    if (!cur || now - cur.windowStart > RATE_WINDOW_MS) {
      tx.set(ref, { count: 1, windowStart: now, expireAt: new Date(now + 2 * RATE_WINDOW_MS) });
      return false;
    }
    tx.update(ref, { count: cur.count + 1 });
    return cur.count + 1 > RATE_MAX;
  });
  if (over) throw new HttpsError('resource-exhausted', 'Too many attempts. Try again later.');
}

function mustUid(req: { auth?: { uid: string } | null }): string {
  if (!req.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  return req.auth.uid;
}

function bodyOf(data: unknown): { challengeId: string; response: unknown; deviceId?: unknown } {
  const b = (data ?? {}) as { challengeId?: unknown; response?: unknown; deviceId?: unknown };
  if (typeof b.challengeId !== 'string' || typeof b.response !== 'object' || !b.response) {
    throw new HttpsError('invalid-argument', 'Bad request.');
  }
  return { challengeId: b.challengeId, response: b.response, deviceId: b.deviceId };
}

// --- register (signed-in person, after "Remember me") -----------------------

export const passkeyRegisterOptions = onCall(async (req) => {
  const uid = mustUid(req);
  const rp = relyingParty(req.rawRequest?.headers?.origin);
  const authSec = (req.auth?.token as { auth_time?: number } | undefined)?.auth_time;
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
      authTimeMs: typeof authSec === 'number' ? authSec * 1000 : null,
    }),
  );
});

export const passkeyRegisterVerify = onCall(async (req) => {
  const uid = mustUid(req);
  const rp = relyingParty(req.rawRequest?.headers?.origin);
  const b = bodyOf(req.data);
  const authSec = (req.auth?.token as { auth_time?: number } | undefined)?.auth_time;
  const userSnap = await db.collection('users').doc(uid).get();
  if (!userSnap.exists || (userSnap.data() as { status?: string }).status === 'suspended')
    throw new HttpsError('permission-denied', 'forbidden');
  await mapErrors(() =>
    registerVerifyCore(firestoreStore, {
      uid,
      rp,
      challengeId: b.challengeId,
      response: b.response as RegistrationResponseJSON,
      now: Date.now(),
      deviceId: validDeviceId(b.deviceId) ? b.deviceId : '',
      authTimeMs: typeof authSec === 'number' ? authSec * 1000 : null,
    }),
  );
  return { ok: true };
});

// --- sign-in (landing; no session yet) ---------------------------------------

export const passkeyLoginOptions = onCall(HOT, async (req) => {
  await rateLimit(req);
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

export const passkeyLoginVerify = onCall(HOT, async (req) => {
  await rateLimit(req);
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
