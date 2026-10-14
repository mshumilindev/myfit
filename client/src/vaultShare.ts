/**
 * Coach access without the server ever holding a key.
 *
 *  coach key pair  — ECDH P-256. The public half is published; the private half is stored
 *                    encrypted under the coach's own vault key (so only the coach unlocks it).
 *  grant           — the athlete's data key, encrypted for one coach:
 *                    AES-GCM( HKDF( ECDH(ephemeral private, coach public) ), raw DEK ).
 *                    Stored at users/{athlete}/grants/{coachId}. The server sees ciphertext only.
 *
 * Revoking a coach = delete the grant and re-key the vault (new salt, re-seal data): a coach
 * who already copied the old key can still read old data, which is inherent to any such scheme.
 */
import { b64, decryptJson, encryptJson, unb64, type VaultEnvelope } from './vaultCrypto';

export interface CoachKeyRecord {
  v: 1;
  /** Public half, JWK. Safe to publish. */
  pub: JsonWebKey;
  /** Private half (JWK JSON) encrypted under the coach's own vault key. */
  priv: VaultEnvelope;
}

export interface Grant {
  v: 1;
  /** Athlete-side ephemeral public key, JWK. */
  epk: JsonWebKey;
  /** Vault salt the data key was derived with (the coach needs it to seal/unseal headers). */
  salt: string;
  iv: string;
  /** Raw data key, encrypted. */
  ct: string;
}

const subtle = (): SubtleCrypto => {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error('WebCrypto is not available');
  return s;
};
const GRANT_INFO = 'spotter.vault-grant.v1';

async function wrapKey(priv: CryptoKey, pub: CryptoKey, info: string): Promise<CryptoKey> {
  const bits = await subtle().deriveBits({ name: 'ECDH', public: pub }, priv, 256);
  const base = await subtle().importKey('raw', bits, 'HKDF', false, ['deriveKey']);
  return subtle().deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0),
      info: new TextEncoder().encode(info),
    },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

const importPub = (jwk: JsonWebKey) =>
  subtle().importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, false, []);

/** Coach: create a key pair; `ownKey` is the coach's own vault key. */
export async function createCoachKey(ownKey: CryptoKey, ownSalt: string): Promise<CoachKeyRecord> {
  const pair = await subtle().generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ]);
  const pub = await subtle().exportKey('jwk', pair.publicKey);
  const priv = await subtle().exportKey('jwk', pair.privateKey);
  return { v: 1, pub, priv: await encryptJson(ownKey, ownSalt, priv) };
}

/** What a wrap is bound to. `info` separates purposes; `aad` binds the wrap to its context. */
export interface WrapOptions {
  info: string;
  aad?: Uint8Array;
}

/** A raw key encrypted for one recipient (ephemeral-static ECDH P-256 + HKDF + AES-GCM). */
export interface Wrap {
  v: 1;
  /** Sender-side ephemeral public key, JWK. */
  epk: JsonWebKey;
  iv: string;
  ct: string;
}

async function wrapBytes(raw: Uint8Array, recipientPub: JsonWebKey, o: WrapOptions): Promise<Wrap> {
  const eph = await subtle().generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ]);
  const wrap = await wrapKey(eph.privateKey, await importPub(recipientPub), o.info);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const params: AesGcmParams = { name: 'AES-GCM', iv: iv as BufferSource };
  if (o.aad) params.additionalData = o.aad as BufferSource;
  const ct = await subtle().encrypt(params, wrap, raw as BufferSource);
  return {
    v: 1,
    epk: await subtle().exportKey('jwk', eph.publicKey),
    iv: b64(iv),
    ct: b64(new Uint8Array(ct)),
  };
}

async function unwrapBytes(
  w: Wrap,
  recipient: CoachKeyRecord,
  ownKey: CryptoKey,
  o: WrapOptions,
): Promise<ArrayBuffer> {
  if (w.v !== 1) throw new Error('Unsupported grant version');
  const privJwk = await decryptJson<JsonWebKey>(ownKey, recipient.priv);
  const priv = await subtle().importKey(
    'jwk',
    privJwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveBits'],
  );
  const wrap = await wrapKey(priv, await importPub(w.epk), o.info);
  const params: AesGcmParams = { name: 'AES-GCM', iv: unb64(w.iv) as BufferSource };
  if (o.aad) params.additionalData = o.aad as BufferSource;
  return subtle().decrypt(params, wrap, unb64(w.ct) as BufferSource);
}

/**
 * Generic wrap: encrypt any raw key (a CryptoKey that is extractable, or the bytes) for a
 * recipient's public key. `createGrant` is this with the vault-grant context.
 */
export async function createWrap(
  key: CryptoKey | Uint8Array,
  recipientPub: JsonWebKey,
  o: WrapOptions,
): Promise<Wrap> {
  const raw =
    key instanceof Uint8Array ? key : new Uint8Array(await subtle().exportKey('raw', key));
  return wrapBytes(raw, recipientPub, o);
}

/**
 * Generic unwrap: the recipient recovers the key (non-extractable) with the `usages` and
 * algorithm they choose. Throws on a wrong recipient, a wrong context (`aad`) or a tampered wrap.
 */
export async function openWrap(
  w: Wrap,
  recipient: CoachKeyRecord,
  ownKey: CryptoKey,
  usages: KeyUsage[],
  o: WrapOptions,
  algorithm: 'AES-GCM' | 'HKDF' = 'AES-GCM',
): Promise<CryptoKey> {
  const raw = await unwrapBytes(w, recipient, ownKey, o);
  try {
    return await subtle().importKey(
      'raw',
      raw,
      algorithm === 'HKDF' ? 'HKDF' : { name: 'AES-GCM' },
      false,
      usages,
    );
  } finally {
    new Uint8Array(raw).fill(0);
  }
}

/** Athlete: encrypt the vault key for a coach. */
export async function createGrant(
  dek: CryptoKey,
  salt: string,
  coachPub: JsonWebKey,
): Promise<Grant> {
  const w = await createWrap(dek, coachPub, { info: GRANT_INFO });
  return { v: 1, epk: w.epk, salt, iv: w.iv, ct: w.ct };
}

/** Coach: recover the athlete's data key (non-extractable) using their own vault key. */
export async function openGrant(
  grant: Grant,
  coach: CoachKeyRecord,
  ownKey: CryptoKey,
): Promise<{ key: CryptoKey; salt: string }> {
  // decrypt only: a coach must not be able to write under an athlete's key
  const key = await openWrap(grant, coach, ownKey, ['decrypt'], { info: GRANT_INFO });
  return { key, salt: grant.salt };
}

export function isGrant(x: unknown): x is Grant {
  const g = x as Partial<Grant> | null;
  return (
    !!g &&
    g.v === 1 &&
    typeof g.salt === 'string' &&
    typeof g.iv === 'string' &&
    typeof g.ct === 'string' &&
    !!g.epk
  );
}
