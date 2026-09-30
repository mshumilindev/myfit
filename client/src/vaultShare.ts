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
const INFO = new TextEncoder().encode('spotter.vault-grant.v1');

async function wrapKey(priv: CryptoKey, pub: CryptoKey): Promise<CryptoKey> {
  const bits = await subtle().deriveBits({ name: 'ECDH', public: pub }, priv, 256);
  const base = await subtle().importKey('raw', bits, 'HKDF', false, ['deriveKey']);
  return subtle().deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: INFO },
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

/** Athlete: encrypt the vault key for a coach. */
export async function createGrant(
  dek: CryptoKey,
  salt: string,
  coachPub: JsonWebKey,
): Promise<Grant> {
  const eph = await subtle().generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ]);
  const wrap = await wrapKey(eph.privateKey, await importPub(coachPub));
  const raw = new Uint8Array(await subtle().exportKey('raw', dek));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = await subtle().encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, wrap, raw);
  return {
    v: 1,
    epk: await subtle().exportKey('jwk', eph.publicKey),
    salt,
    iv: b64(iv),
    ct: b64(new Uint8Array(ct)),
  };
}

/** Coach: recover the athlete's data key (non-extractable) using their own vault key. */
export async function openGrant(
  grant: Grant,
  coach: CoachKeyRecord,
  ownKey: CryptoKey,
): Promise<{ key: CryptoKey; salt: string }> {
  if (grant.v !== 1) throw new Error('Unsupported grant version');
  const privJwk = await decryptJson<JsonWebKey>(ownKey, coach.priv);
  const priv = await subtle().importKey(
    'jwk',
    privJwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveBits'],
  );
  const wrap = await wrapKey(priv, await importPub(grant.epk));
  const raw = await subtle().decrypt(
    { name: 'AES-GCM', iv: unb64(grant.iv) as BufferSource },
    wrap,
    unb64(grant.ct) as BufferSource,
  );
  const key = await subtle().importKey('raw', raw, { name: 'AES-GCM' }, false, ['decrypt']);
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
