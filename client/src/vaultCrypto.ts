/**
 * Health vault crypto (WebCrypto only, no dependencies).
 *
 * Private data is encrypted on the device before it reaches localStorage or Firestore.
 * The server only ever sees an opaque envelope.
 *
 *   data key  (DEK)    — AES-GCM 256, delivered by the server for the account (see autoVault.ts).
 *                        Extractable in memory only so the owner can grant it to a coach.
 *   envelope           — { v, salt, iv, ct } (base64). Fresh IV for every write.
 */

export interface VaultEnvelope {
  v: 1;
  /** HKDF salt, base64. Stable for the lifetime of the vault. */
  salt: string;
  /** AES-GCM IV, base64. New on every encryption. */
  iv: string;
  /** Ciphertext + tag, base64. */
  ct: string;
}

const subtle = (): SubtleCrypto => {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error('WebCrypto is not available');
  return s;
};

export const b64 = (bytes: Uint8Array): string => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
};
export const unb64 = (s: string): Uint8Array => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function encryptJson(
  key: CryptoKey,
  salt: string,
  data: unknown,
): Promise<VaultEnvelope> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = await subtle().encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    new TextEncoder().encode(JSON.stringify(data)),
  );
  return { v: 1, salt, iv: b64(iv), ct: b64(new Uint8Array(ct)) };
}

/** Decrypts an envelope; throws when the key is wrong or the data was tampered with. */
export async function decryptJson<T>(key: CryptoKey, env: VaultEnvelope): Promise<T> {
  if (env.v !== 1) throw new Error('Unsupported vault version');
  const pt = await subtle().decrypt(
    { name: 'AES-GCM', iv: unb64(env.iv) as BufferSource },
    key,
    unb64(env.ct) as BufferSource,
  );
  return JSON.parse(new TextDecoder().decode(pt)) as T;
}

/** Shape check for anything read from storage or the network before it is trusted. */
export function isEnvelope(x: unknown): x is VaultEnvelope {
  const e = x as Partial<VaultEnvelope> | null;
  return (
    !!e &&
    e.v === 1 &&
    typeof e.salt === 'string' &&
    typeof e.iv === 'string' &&
    typeof e.ct === 'string'
  );
}

/** A raw 256-bit AES-GCM data key (as delivered by the server) as a CryptoKey. */
export async function importRawKey(rawB64: string, extractable: boolean): Promise<CryptoKey> {
  const raw = unb64(rawB64);
  if (raw.length !== 32) throw new Error('bad-key');
  return subtle().importKey('raw', raw as BufferSource, { name: 'AES-GCM' }, extractable, [
    'encrypt',
    'decrypt',
  ]);
}
