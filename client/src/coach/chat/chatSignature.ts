/**
 * Sender authenticity inside a conversation (plan Part C.2 no. 7).
 *
 * Firestore rules already enforce `from == request.auth.uid`; on top of that every message carries an ECDSA P-256
 * signature made with the SENDER'S device signing key over `context AAD | iv | ciphertext`. A receiver verifies it
 * before opening: a message that fails renders "Couldn't verify this message" and never the text.
 *
 * What is signed is exactly what the sealed envelope authenticates (the AAD binds cid, epoch, id, sender, time and
 * class), so a signature cannot be moved to another conversation, id, time or sender either.
 *
 * Open fields added to a stored message: `sig` (base64, 64-byte raw r|s) and `sigKid` (key id). Both are needed in
 * the `messages` `open` list of the registry (`coachCrypto/newCollections.ts`) and in the rules' `hasOnly` list (both done).
 *
 * The real `SignerDirectory` is `data/firestore/trust.ts`: it reads the sender's public signing key from the signed
 * client / trainer record (`coachKeys/{uid}` for the trainer, the signed client record for the client; a key without
 * a valid server signature is `null`). Nothing in this file talks to Firebase.
 */
import { b64, unb64 } from '../../vaultCrypto';
import {
  contextAad,
  isCkEnvelope,
  type CkEnvelope,
  type EnvelopeContext,
} from '../../coachCrypto/envelope';

const subtle = (): SubtleCrypto => {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error('WebCrypto is not available');
  return s;
};

const ALG = { name: 'ECDSA', namedCurve: 'P-256' } as const;
const SIG_PREFIX = new TextEncoder().encode('spotter/chat-sig/1\0');

/** The sender's device signing key. The private half never leaves the device (non-extractable). */
export interface SigningKey {
  kid: string;
  privateKey: CryptoKey;
  /** base64 uncompressed point, published with the signed client record */
  publicRaw: string;
}

/** Where a receiver finds the sender's public key. `null` = unknown, unsigned or revoked. */
export interface SignerDirectory {
  key(uid: string, kid: string): Promise<CryptoKey | null>;
}

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

/** Key id: first 8 bytes of SHA-256 over the raw public key (stable, short, not secret). */
export async function keyIdOf(publicRaw: string): Promise<string> {
  const d = await subtle().digest('SHA-256', unb64(publicRaw) as BufferSource);
  return hex(new Uint8Array(d).slice(0, 8));
}

export async function generateSigningKey(): Promise<SigningKey> {
  const pair = await subtle().generateKey(ALG, true, ['sign', 'verify']);
  const publicRaw = b64(new Uint8Array(await subtle().exportKey('raw', pair.publicKey)));
  // re-import the private half as non-extractable: scripts can sign with it but never read it out
  const pkcs8 = await subtle().exportKey('pkcs8', pair.privateKey);
  const privateKey = await subtle().importKey('pkcs8', pkcs8, ALG, false, ['sign']);
  return { kid: await keyIdOf(publicRaw), privateKey, publicRaw };
}

export async function importVerifyKey(publicRaw: string): Promise<CryptoKey> {
  return subtle().importKey('raw', unb64(publicRaw) as BufferSource, ALG, true, ['verify']);
}

function signedBytes(ctx: EnvelopeContext, env: CkEnvelope): Uint8Array {
  const aad = contextAad(env.v, ctx);
  const iv = unb64(env.iv);
  const ct = unb64(env.ct);
  const out = new Uint8Array(SIG_PREFIX.length + aad.length + 1 + iv.length + ct.length);
  let o = 0;
  out.set(SIG_PREFIX, o);
  o += SIG_PREFIX.length;
  out.set(aad, o);
  o += aad.length;
  out[o++] = 0;
  out.set(iv, o);
  o += iv.length;
  out.set(ct, o);
  return out;
}

export async function signEnvelope(
  key: Pick<SigningKey, 'privateKey'>,
  ctx: EnvelopeContext,
  env: CkEnvelope,
): Promise<string> {
  const sig = await subtle().sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key.privateKey,
    signedBytes(ctx, env) as BufferSource,
  );
  return b64(new Uint8Array(sig));
}

export async function verifyEnvelope(
  publicKey: CryptoKey,
  ctx: EnvelopeContext,
  env: CkEnvelope,
  sig: string,
): Promise<boolean> {
  if (!isCkEnvelope(env) || typeof sig !== 'string' || sig.length === 0) return false;
  try {
    return await subtle().verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      publicKey,
      unb64(sig) as BufferSource,
      signedBytes(ctx, env) as BufferSource,
    );
  } catch {
    return false;
  }
}

/** In-memory directory (tests, stories, the fixtures adapter). */
export function memorySignerDirectory(): SignerDirectory & {
  add(uid: string, key: SigningKey): Promise<void>;
  revoke(uid: string, kid: string): void;
} {
  const map = new Map<string, CryptoKey>();
  return {
    async add(uid, key) {
      map.set(`${uid}|${key.kid}`, await importVerifyKey(key.publicRaw));
    },
    revoke(uid, kid) {
      map.delete(`${uid}|${kid}`);
    },
    async key(uid, kid) {
      return map.get(`${uid}|${kid}`) ?? null;
    },
  };
}
