/**
 * Passkey verification without Firebase (SPO-211): the storage is an interface, so the rules can be tested end to end with
 * a software authenticator. passkeys.ts wires it to Firestore and the callables.
 */
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';

export const CHALLENGE_TTL_MS = 5 * 60 * 1000;
/** Passkeys one account may hold (one per device is replaced in place, so this only stops runaway growth). */
export const MAX_PASSKEYS_PER_USER = 10;
/** Registration needs a recent sign-in (the custom token's auth_time), so a stolen idle session can't plant a passkey. */
export const REGISTER_MAX_AUTH_AGE_MS = 10 * 60 * 1000;
const RP_NAME = 'Spotter';

export interface PasskeyDoc {
  userId: string;
  publicKey: string; // base64url
  counter: number;
  transports?: AuthenticatorTransportFuture[];
  /** The browser install (sessions device id) the passkey was made on; it goes away with that device's session. */
  deviceId: string | null;
  createdAt: number;
  lastUsedAt: number | null;
}

export interface ChallengeDoc {
  challenge: string;
  userId: string | null;
  expiresAt: number;
}

export interface PasskeyStore {
  putChallenge(id: string, doc: ChallengeDoc): Promise<void>;
  /** Single use: returns the challenge and removes it (null when missing). */
  takeChallenge(id: string): Promise<ChallengeDoc | null>;
  getPasskey(id: string): Promise<PasskeyDoc | null>;
  /** Create-only: throws PasskeyError('permission-denied') when the credential id already exists (never overwrites another account's key). */
  savePasskey(id: string, doc: PasskeyDoc): Promise<void>;
  deletePasskey(id: string): Promise<void>;
  updatePasskey(id: string, patch: Partial<PasskeyDoc>): Promise<void>;
  listPasskeys(userId: string): Promise<
    {
      id: string;
      transports?: AuthenticatorTransportFuture[];
      deviceId: string | null;
    }[]
  >;
}

export type PasskeyErrorCode =
  'unauthenticated' | 'permission-denied' | 'deadline-exceeded' | 'invalid-argument';
export class PasskeyError extends Error {
  constructor(
    readonly code: PasskeyErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export interface RelyingParty {
  rpID: string;
  origin: string;
}

function assertFreshSignIn(authTimeMs: number | null, now: number): void {
  if (authTimeMs === null || now - authTimeMs > REGISTER_MAX_AUTH_AGE_MS)
    throw new PasskeyError('permission-denied', 'Sign in again to add a passkey.');
}

async function takeValid(store: PasskeyStore, id: string, now: number): Promise<ChallengeDoc> {
  const ch = await store.takeChallenge(id);
  if (!ch || now > ch.expiresAt)
    throw new PasskeyError('deadline-exceeded', 'The request expired. Try again.');
  return ch;
}

export async function registerOptionsCore(
  store: PasskeyStore,
  a: {
    uid: string;
    userName: string;
    rp: RelyingParty;
    challengeId: string;
    now: number;
    /** auth_time of the caller's token, in ms. */
    authTimeMs: number | null;
  },
) {
  assertFreshSignIn(a.authTimeMs, a.now);
  const existing = await store.listPasskeys(a.uid);
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: a.rp.rpID,
    userName: a.userName,
    userID: new TextEncoder().encode(a.uid),
    attestationType: 'none',
    excludeCredentials: existing.map((d) => ({ id: d.id, transports: d.transports })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'required',
      authenticatorAttachment: 'platform',
    },
  });
  await store.putChallenge(a.challengeId, {
    challenge: options.challenge,
    userId: a.uid,
    expiresAt: a.now + CHALLENGE_TTL_MS,
  });
  return { challengeId: a.challengeId, options };
}

export async function registerVerifyCore(
  store: PasskeyStore,
  a: {
    uid: string;
    rp: RelyingParty;
    challengeId: string;
    response: RegistrationResponseJSON;
    now: number;
    /** Required (non-empty): a passkey without a device could never be revoked with it. */
    deviceId: string;
    authTimeMs: number | null;
  },
): Promise<void> {
  if (!a.deviceId) throw new PasskeyError('invalid-argument', 'Device id required.');
  assertFreshSignIn(a.authTimeMs, a.now);
  const ch = await takeValid(store, a.challengeId, a.now);
  if (ch.userId !== a.uid) throw new PasskeyError('permission-denied', 'Wrong account.');
  const v = await verifyRegistrationResponse({
    response: a.response,
    expectedChallenge: ch.challenge,
    expectedOrigin: a.rp.origin,
    expectedRPID: a.rp.rpID,
    requireUserVerification: true,
  }).catch(() => null);
  if (!v?.verified) throw new PasskeyError('unauthenticated', 'Could not verify the passkey.');
  const { credential } = v.registrationInfo;
  // One passkey per device: the new one is saved first, then the device's old one goes (a failed save loses nothing).
  const mine = await store.listPasskeys(a.uid);
  const sameDevice = mine.filter((d) => d.deviceId === a.deviceId);
  if (mine.length - sameDevice.length >= MAX_PASSKEYS_PER_USER)
    throw new PasskeyError('invalid-argument', 'Too many passkeys on this account.');
  await store.savePasskey(credential.id, {
    userId: a.uid,
    publicKey: Buffer.from(credential.publicKey).toString('base64url'),
    counter: credential.counter,
    transports: Array.isArray(a.response.response?.transports)
      ? a.response.response.transports
      : undefined,
    deviceId: a.deviceId,
    createdAt: a.now,
    lastUsedAt: null,
  });
  for (const old of sameDevice) await store.deletePasskey(old.id);
}

export async function loginOptionsCore(
  store: PasskeyStore,
  a: { userId: string | null; rp: RelyingParty; challengeId: string; now: number },
) {
  const allow = a.userId ? await store.listPasskeys(a.userId) : [];
  const options = await generateAuthenticationOptions({
    rpID: a.rp.rpID,
    userVerification: 'required',
    allowCredentials: allow.length
      ? allow.map((d) => ({ id: d.id, transports: d.transports }))
      : undefined,
  });
  await store.putChallenge(a.challengeId, {
    challenge: options.challenge,
    userId: null,
    expiresAt: a.now + CHALLENGE_TTL_MS,
  });
  return { challengeId: a.challengeId, options };
}

/** Verifies the assertion and returns the account it signs in. */
export async function loginVerifyCore(
  store: PasskeyStore,
  a: { rp: RelyingParty; challengeId: string; response: AuthenticationResponseJSON; now: number },
): Promise<string> {
  const ch = await takeValid(store, a.challengeId, a.now);
  if (ch.userId !== null)
    throw new PasskeyError('unauthenticated', 'Could not verify the passkey.'); // a registration challenge is not a login challenge
  const cred = await store.getPasskey(String(a.response.id));
  if (!cred) throw new PasskeyError('unauthenticated', 'Passkey not recognised.');
  const v = await verifyAuthenticationResponse({
    response: a.response,
    expectedChallenge: ch.challenge,
    expectedOrigin: a.rp.origin,
    expectedRPID: a.rp.rpID,
    requireUserVerification: true,
    credential: {
      id: String(a.response.id),
      publicKey: Buffer.from(cred.publicKey, 'base64url'),
      counter: cred.counter,
      transports: cred.transports,
    },
  }).catch(() => null);
  if (!v?.verified) throw new PasskeyError('unauthenticated', 'Could not verify the passkey.');
  await store.updatePasskey(String(a.response.id), {
    counter: v.authenticationInfo.newCounter,
    lastUsedAt: a.now,
  });
  return cred.userId;
}
