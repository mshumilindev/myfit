/**
 * Health vault crypto (WebCrypto only, no dependencies).
 *
 * The user's private conditions are encrypted on the device before they reach
 * localStorage or Firestore. The server only ever sees an opaque envelope.
 *
 *   recovery key (RK)  — 160 random bits, shown once as XXXX-XXXX-… (Crockford base32)
 *   data key  (DEK)    — AES-GCM 256, HKDF(RK, salt). Cached on the device (IndexedDB);
 *                        extractable only so the owner can grant it to a coach.
 *   envelope           — { v, salt, iv, ct } (base64). Fresh IV for every write.
 *
 * Lose the RK and every device that has no cached key loses the data: by design.
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

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32
const RK_BYTES = 20; // 160 bits → 32 characters
const INFO = new TextEncoder().encode('spotter.health-vault.v1');

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

function toBase32(bytes: Uint8Array): string {
  let bits = 0;
  let acc = 0;
  let out = '';
  for (const b of bytes) {
    acc = (acc << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(acc >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(acc << (5 - bits)) & 31];
  return out;
}

function fromBase32(s: string): Uint8Array | null {
  const out: number[] = [];
  let bits = 0;
  let acc = 0;
  for (const ch of s) {
    const v = ALPHABET.indexOf(ch);
    if (v < 0) return null;
    acc = (acc << 5) | v;
    bits += 5;
    if (bits >= 8) {
      out.push((acc >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Uint8Array.from(out);
}

/** A new random recovery key, raw form (32 chars, no separators). */
export function generateRecoveryKey(): string {
  return toBase32(globalThis.crypto.getRandomValues(new Uint8Array(RK_BYTES)));
}

/** "ABCD-EFGH-…" for display. */
export const formatRecoveryKey = (rk: string): string => rk.match(/.{1,4}/g)?.join('-') ?? rk;

/**
 * Forgiving parser: ignores case, spaces and dashes; maps the usual look-alikes
 * (I/L → 1, O → 0). Returns null unless it is exactly a valid key.
 */
export function parseRecoveryKey(input: string): string | null {
  const s = input.toUpperCase().replace(/[\s-]/g, '').replace(/[IL]/g, '1').replace(/O/g, '0');
  if (s.length !== Math.ceil((RK_BYTES * 8) / 5)) return null;
  const bytes = fromBase32(s);
  return bytes && bytes.length >= RK_BYTES ? s : null;
}

export const newSalt = (): string => b64(globalThis.crypto.getRandomValues(new Uint8Array(16)));

/**
 * Derive the vault's data key. The owner's key is extractable on purpose: it is what
 * the owner wraps for a coach (see vaultShare.ts). A coach's copy is imported non-extractable.
 */
export async function deriveVaultKey(
  recoveryKey: string,
  salt: string,
  extractable = true,
): Promise<CryptoKey> {
  const base = await subtle().importKey(
    'raw',
    new TextEncoder().encode(recoveryKey),
    'HKDF',
    false,
    ['deriveKey'],
  );
  return subtle().deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: unb64(salt) as BufferSource, info: INFO },
    base,
    { name: 'AES-GCM', length: 256 },
    extractable,
    ['encrypt', 'decrypt'],
  );
}

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
