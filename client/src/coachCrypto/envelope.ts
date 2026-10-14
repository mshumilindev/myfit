/**
 * Sealed envelope for everything encrypted under a conversation sub-key.
 *
 *   envelope = { v, iv, ct }       (base64; v = algorithm version)
 *   AES-GCM, 96-bit random IV, AAD = v|cid|epoch|messageId|fromUid|at|kind
 *
 * The AAD binds a ciphertext to its conversation, epoch, id, sender, time and document class:
 * copied into another conversation, replayed under another id, re-attributed to the other
 * party or moved to another document class, it fails authentication. The plaintext is padded
 * to 64-byte buckets before sealing so short replies ("ok") do not stand out by length.
 *
 * `kind` here is the document class ('message', 'note', ...), NOT the inner message kind: it
 * must be known before decryption, and the inner kind (text/share/request/system) stays secret.
 */
import { b64, unb64 } from '../vaultCrypto';

const ENVELOPE_VERSION = 1 as const;
/** @internal planned: padding contract constant (server size checks). Re-exported from the barrel (index.ts) and covered by barrel.test.ts. */
export const BUCKET = 64;
/** Serialized JSON payload cap (bytes). 4,000 characters of chat fits with room to spare. */
/** @internal planned: payload cap the server rules mirror. Re-exported from the barrel (index.ts) and covered by barrel.test.ts. */
export const MAX_PAYLOAD_BYTES = 8000;

export interface CkEnvelope {
  v: typeof ENVELOPE_VERSION;
  iv: string;
  ct: string;
}

export interface EnvelopeContext {
  cid: string;
  epoch: number;
  messageId: string;
  fromUid: string;
  at: number;
  kind: string;
}

const subtle = (): SubtleCrypto => {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error('WebCrypto is not available');
  return s;
};

export const isCkEnvelope = (x: unknown): x is CkEnvelope => {
  const e = x as Partial<CkEnvelope> | null;
  return !!e && typeof e.v === 'number' && typeof e.iv === 'string' && typeof e.ct === 'string';
};

/** The authenticated context. Fields must not contain the separator (no field-shifting). */
export function contextAad(v: number, c: EnvelopeContext): Uint8Array {
  const parts = [c.cid, String(c.epoch), c.messageId, c.fromUid, String(c.at), c.kind];
  if (parts.some((p) => p.includes('|') || p.length === 0)) throw new Error('bad-context');
  if (!Number.isSafeInteger(c.at) || !Number.isInteger(c.epoch) || c.epoch < 1) {
    throw new Error('bad-context');
  }
  return new TextEncoder().encode([String(v), ...parts].join('|'));
}

/** Length header (4 bytes, big endian) + payload + zero padding to a multiple of BUCKET. */
export function pad(payload: Uint8Array, maxBytes: number = MAX_PAYLOAD_BYTES): Uint8Array {
  if (payload.length > maxBytes) throw new Error('too-large');
  const total = Math.ceil((4 + payload.length) / BUCKET) * BUCKET;
  const out = new Uint8Array(total);
  new DataView(out.buffer).setUint32(0, payload.length);
  out.set(payload, 4);
  return out;
}

/** @internal planned: counterpart of pad, used by non-envelope readers. Re-exported from the barrel (index.ts) and covered by barrel.test.ts. */
export function unpad(padded: Uint8Array): Uint8Array {
  if (padded.length < BUCKET || padded.length % BUCKET !== 0) throw new Error('bad-padding');
  const n = new DataView(padded.buffer, padded.byteOffset, padded.byteLength).getUint32(0);
  if (n > padded.length - 4 || padded.length - (4 + n) >= BUCKET) throw new Error('bad-padding');
  for (let i = 4 + n; i < padded.length; i++) if (padded[i] !== 0) throw new Error('bad-padding');
  return padded.slice(4, 4 + n);
}

/** Seal a JSON payload under a purpose sub-key. A fresh random IV every call. */
export async function sealEnvelope(
  key: CryptoKey,
  ctx: EnvelopeContext,
  payload: unknown,
  /** Payload cap for this document class (default: the chat cap). Whole-program versions are bigger than a message. */
  maxBytes: number = MAX_PAYLOAD_BYTES,
): Promise<CkEnvelope> {
  const json = JSON.stringify(payload);
  if (json === undefined) throw new Error('bad-payload');
  const aad = contextAad(ENVELOPE_VERSION, ctx);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = await subtle().encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource, additionalData: aad as BufferSource },
    key,
    pad(new TextEncoder().encode(json), maxBytes) as BufferSource,
  );
  return { v: ENVELOPE_VERSION, iv: b64(iv), ct: b64(new Uint8Array(ct)) };
}

/**
 * Open an envelope. Throws on any mismatch (wrong key, wrong context, tampering, unknown
 * version): callers show "Couldn't verify this message" and never partial text.
 */
export async function openEnvelope<T>(
  key: CryptoKey,
  ctx: EnvelopeContext,
  env: CkEnvelope,
): Promise<T> {
  if (!isCkEnvelope(env)) throw new Error('bad-envelope');
  // Algorithm agility: add a case per new version; unknown versions are refused, not guessed.
  if (env.v !== ENVELOPE_VERSION) throw new Error('unsupported-version');
  const aad = contextAad(env.v, ctx);
  const pt = await subtle().decrypt(
    { name: 'AES-GCM', iv: unb64(env.iv) as BufferSource, additionalData: aad as BufferSource },
    key,
    unb64(env.ct) as BufferSource,
  );
  return JSON.parse(new TextDecoder().decode(unpad(new Uint8Array(pt)))) as T;
}
