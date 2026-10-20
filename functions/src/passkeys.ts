/**
 * Passkeys (SPO-211): Face ID / Touch ID / Windows Hello sign-in on this device.
 * A passkey is registered right after a "Remember me" sign-in; the landing then signs the person in with one tap.
 * Public keys live in `passkeys/{credentialId}`; challenges are single-use and expire after 5 minutes.
 * Sign-in returns the same payload (custom token) as `login`.
 */
import { onCall } from 'firebase-functions/v2/https';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { randomUUID } from 'node:crypto';
import { authPayload, db, displayName, HttpsError, mintToken, type UserDoc } from './lib';

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const RP_NAME = 'Spotter';

interface PasskeyDoc {
  userId: string;
  publicKey: string; // base64url
  counter: number;
  transports?: AuthenticatorTransportFuture[];
  createdAt: number;
  lastUsedAt: number | null;
}

/** The relying party is the page's own origin, limited to localhost, Firebase hosting and PASSKEY_ORIGINS (comma separated). */
function relyingParty(origin: unknown): { rpID: string; origin: string } {
  if (typeof origin !== 'string') throw new HttpsError('failed-precondition', 'Unknown origin.');
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    throw new HttpsError('failed-precondition', 'Unknown origin.');
  }
  const extra = (process.env.PASSKEY_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const host = url.hostname;
  const ok =
    host === 'localhost' ||
    host.endsWith('.web.app') ||
    host.endsWith('.firebaseapp.com') ||
    extra.includes(url.origin);
  if (!ok) throw new HttpsError('failed-precondition', 'This origin cannot use passkeys.');
  return { rpID: host, origin: url.origin };
}

async function takeChallenge(id: string): Promise<{ challenge: string; userId: string | null }> {
  const ref = db.collection('passkeyChallenges').doc(id);
  const snap = await ref.get();
  await ref.delete().catch(() => undefined); // single use
  const d = snap.exists ? (snap.data() as { challenge: string; userId: string | null; expiresAt: number }) : null;
  if (!d || Date.now() > d.expiresAt) throw new HttpsError('deadline-exceeded', 'The request expired. Try again.');
  return { challenge: d.challenge, userId: d.userId };
}

async function putChallenge(id: string, challenge: string, userId: string | null): Promise<void> {
  await db.collection('passkeyChallenges').doc(id).set({ challenge, userId, expiresAt: Date.now() + CHALLENGE_TTL_MS });
}

function asTransports(v: unknown): AuthenticatorTransportFuture[] | undefined {
  return Array.isArray(v) ? (v.filter((x) => typeof x === 'string') as AuthenticatorTransportFuture[]) : undefined;
}

// --- register (signed-in person, after "Remember me") -----------------------

export const passkeyRegisterOptions = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  const rp = relyingParty(req.rawRequest?.headers?.origin);
  const userSnap = await db.collection('users').doc(uid).get();
  if (!userSnap.exists) throw new HttpsError('not-found', 'Unknown account.');
  const user: UserDoc = { id: uid, ...(userSnap.data() as Omit<UserDoc, 'id'>) };
  const existing = await db.collection('passkeys').where('userId', '==', uid).get();
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: rp.rpID,
    userName: displayName(user),
    userID: new TextEncoder().encode(uid),
    attestationType: 'none',
    excludeCredentials: existing.docs.map((d) => ({ id: d.id, transports: (d.data() as PasskeyDoc).transports })),
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'required', authenticatorAttachment: 'platform' },
  });
  const challengeId = randomUUID();
  await putChallenge(challengeId, options.challenge, uid);
  return { challengeId, options };
});

export const passkeyRegisterVerify = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  const rp = relyingParty(req.rawRequest?.headers?.origin);
  const body = (req.data ?? {}) as { challengeId?: unknown; response?: unknown };
  if (typeof body.challengeId !== 'string' || typeof body.response !== 'object' || !body.response) {
    throw new HttpsError('invalid-argument', 'Bad request.');
  }
  const ch = await takeChallenge(body.challengeId);
  if (ch.userId !== uid) throw new HttpsError('permission-denied', 'Wrong account.');
  const response = body.response as RegistrationResponseJSON;
  const v = await verifyRegistrationResponse({
    response,
    expectedChallenge: ch.challenge,
    expectedOrigin: rp.origin,
    expectedRPID: rp.rpID,
    requireUserVerification: true,
  }).catch(() => null);
  if (!v?.verified) throw new HttpsError('unauthenticated', 'Could not verify the passkey.');
  const { credential } = v.registrationInfo;
  const doc: PasskeyDoc = {
    userId: uid,
    publicKey: Buffer.from(credential.publicKey).toString('base64url'),
    counter: credential.counter,
    transports: asTransports(response.response?.transports),
    createdAt: Date.now(),
    lastUsedAt: null,
  };
  await db.collection('passkeys').doc(credential.id).set(doc);
  return { ok: true };
});

// --- sign-in (landing; no session yet) ---------------------------------------

export const passkeyLoginOptions = onCall(async (req) => {
  const rp = relyingParty(req.rawRequest?.headers?.origin);
  const userId = (req.data as { userId?: unknown } | undefined)?.userId;
  let allow: { id: string; transports?: AuthenticatorTransportFuture[] }[] | undefined;
  if (typeof userId === 'string' && userId) {
    const snap = await db.collection('passkeys').where('userId', '==', userId).get();
    // Same shape whether or not the person has a passkey: no account probing.
    allow = snap.docs.map((d) => ({ id: d.id, transports: (d.data() as PasskeyDoc).transports }));
  }
  const options = await generateAuthenticationOptions({
    rpID: rp.rpID,
    userVerification: 'required',
    allowCredentials: allow && allow.length ? allow : undefined,
  });
  const challengeId = randomUUID();
  await putChallenge(challengeId, options.challenge, null);
  return { challengeId, options };
});

export const passkeyLoginVerify = onCall(async (req) => {
  const rp = relyingParty(req.rawRequest?.headers?.origin);
  const body = (req.data ?? {}) as { challengeId?: unknown; response?: unknown };
  if (typeof body.challengeId !== 'string' || typeof body.response !== 'object' || !body.response) {
    throw new HttpsError('invalid-argument', 'Bad request.');
  }
  const ch = await takeChallenge(body.challengeId);
  const response = body.response as AuthenticationResponseJSON;
  const credRef = db.collection('passkeys').doc(String(response.id));
  const credSnap = await credRef.get();
  if (!credSnap.exists) throw new HttpsError('unauthenticated', 'Passkey not recognised.');
  const cred = credSnap.data() as PasskeyDoc;
  const v = await verifyAuthenticationResponse({
    response,
    expectedChallenge: ch.challenge,
    expectedOrigin: rp.origin,
    expectedRPID: rp.rpID,
    requireUserVerification: true,
    credential: {
      id: credSnap.id,
      publicKey: Buffer.from(cred.publicKey, 'base64url'),
      counter: cred.counter,
      transports: cred.transports,
    },
  }).catch(() => null);
  if (!v?.verified) throw new HttpsError('unauthenticated', 'Could not verify the passkey.');
  await credRef.update({ counter: v.authenticationInfo.newCounter, lastUsedAt: Date.now() });
  const userSnap = await db.collection('users').doc(cred.userId).get();
  if (!userSnap.exists) throw new HttpsError('unauthenticated', 'Passkey not recognised.');
  const user: UserDoc = { id: cred.userId, ...(userSnap.data() as Omit<UserDoc, 'id'>) };
  if (user.status === 'suspended') throw new HttpsError('permission-denied', 'This account is suspended. Ask your admin.');
  return authPayload(user, await mintToken(user.id, user.role));
});
