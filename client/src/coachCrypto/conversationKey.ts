/**
 * Conversation keys (CK) for coach <-> client data. See plan-security Part C.2.
 *
 *  - One random 256-bit CK per (cid, epoch), generated on the client device. Never derived
 *    from a password, a uid or the vault key.
 *  - The CK is only a root: every data class uses its own sub-key, HKDF-SHA256(CK, salt,
 *    info = purpose|cid|epoch), so a bug or leak in one class does not expose the others.
 *  - Delivery to the trainer: ephemeral-static ECDH P-256 + HKDF + AES-GCM (vaultShare
 *    `createWrap`), bound with AAD to cid, epoch and the trainer key fingerprint, so a wrap
 *    cannot be moved to another conversation or epoch. The trainer checks the fingerprint
 *    on unwrap and refuses a wrap made for a different key.
 *  - The CK lives in memory as a non-extractable HKDF CryptoKey. The raw bytes exist only
 *    inside `createChatWrap` / `ringFromBytes` / `openChatKey` and are zeroed afterwards.
 */
import { fingerprint } from '../vaultGrants';
import { createWrap, openWrap, type CoachKeyRecord, type Wrap } from '../vaultShare';

/** @internal planned: purpose list the real key adapters iterate. Re-exported from the barrel (index.ts) and covered by barrel.test.ts. */
export const PURPOSES = ['chat', 'notes', 'schedule', 'plan', 'live', 'requests'] as const;
export type Purpose = (typeof PURPOSES)[number];

/** Rotate before the 96-bit random IV birthday budget gets close (asserted by the sealer). */
/** @internal planned: per-epoch message cap the key-rotation logic will enforce. Re-exported from the barrel (index.ts) and covered by barrel.test.ts. */
export const MAX_MESSAGES_PER_EPOCH = 2 ** 28;

const subtle = (): SubtleCrypto => {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error('WebCrypto is not available');
  return s;
};
const enc = (s: string) => new TextEncoder().encode(s);
const HKDF_SALT = enc('spotter.coach.v1');

function checkId(cid: string, epoch: number): void {
  if (!/^[a-z2-7]{26}$/.test(cid)) throw new Error('bad-cid');
  if (!Number.isInteger(epoch) || epoch < 1 || epoch > 0x7fffffff) throw new Error('bad-epoch');
}

/** A conversation key ring: sub-keys per purpose, derived lazily and cached. */
export interface ChatKeyRing {
  readonly cid: string;
  readonly epoch: number;
  /** AES-GCM sub-key for a purpose (non-extractable, usages encrypt + decrypt). */
  key(purpose: Purpose): Promise<CryptoKey>;
}

/** A fresh random CK (32 bytes). Zero it after use. */
export function newConversationKeyBytes(): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(32));
}

/** Imports raw CK bytes as the HKDF root (non-extractable) and zeroes the input. */
export async function ringFromBytes(
  cid: string,
  epoch: number,
  raw: Uint8Array,
): Promise<ChatKeyRing> {
  checkId(cid, epoch);
  if (raw.length !== 32) throw new Error('bad-key');
  const root = await subtle().importKey('raw', raw as BufferSource, 'HKDF', false, ['deriveKey']);
  raw.fill(0);
  return ringFromRoot(cid, epoch, root);
}

/** What is stored at conversations/{cid}.ck */
export interface ChatWrap extends Wrap {
  epoch: number;
  /** Fingerprint of the trainer public key this wrap was made for. */
  fp: string;
}

const wrapInfo = 'spotter.chat-wrap.v1';
const wrapAad = (cid: string, epoch: number, fp: string) => enc(`ckwrap|1|${cid}|${epoch}|${fp}`);

/** Client: wrap raw CK bytes for the trainer's public key. Does NOT zero `raw` (caller owns it). */
export async function createChatWrap(
  raw: Uint8Array,
  cid: string,
  epoch: number,
  trainerPub: JsonWebKey,
): Promise<ChatWrap> {
  checkId(cid, epoch);
  const fp = await fingerprint(trainerPub);
  const w = await createWrap(raw, trainerPub, { info: wrapInfo, aad: wrapAad(cid, epoch, fp) });
  return { ...w, epoch, fp };
}

export function isChatWrap(x: unknown): x is ChatWrap {
  const w = x as Partial<ChatWrap> | null;
  return (
    !!w &&
    w.v === 1 &&
    typeof w.epoch === 'number' &&
    typeof w.fp === 'string' &&
    typeof w.iv === 'string' &&
    typeof w.ct === 'string' &&
    !!w.epk
  );
}

/**
 * Trainer: open the wrap into a key ring. Refuses a wrap made for a different trainer key
 * (fingerprint check), another conversation or another epoch (AAD), or a tampered one. The
 * sub-keys it yields can ENCRYPT and decrypt (unlike `openGrant`, which is decrypt-only).
 */
export async function openChatKey(
  wrap: ChatWrap,
  cid: string,
  trainer: CoachKeyRecord,
  ownKey: CryptoKey,
): Promise<ChatKeyRing> {
  if (!isChatWrap(wrap)) throw new Error('bad-wrap');
  checkId(cid, wrap.epoch);
  if ((await fingerprint(trainer.pub)) !== wrap.fp) throw new Error('fingerprint-mismatch');
  const root = await openWrap(
    wrap,
    trainer,
    ownKey,
    ['deriveKey'],
    { info: wrapInfo, aad: wrapAad(cid, wrap.epoch, wrap.fp) },
    'HKDF',
  );
  // `openWrap` returned a non-extractable HKDF key; build the ring around it.
  return ringFromRoot(cid, wrap.epoch, root);
}

function ringFromRoot(cid: string, epoch: number, root: CryptoKey): ChatKeyRing {
  const cache = new Map<Purpose, Promise<CryptoKey>>();
  return {
    cid,
    epoch,
    key(purpose) {
      if (!PURPOSES.includes(purpose)) return Promise.reject(new Error('bad-purpose'));
      let k = cache.get(purpose);
      if (!k) {
        k = subtle().deriveKey(
          {
            name: 'HKDF',
            hash: 'SHA-256',
            salt: HKDF_SALT,
            info: enc(`${purpose}|${cid}|${epoch}`),
          },
          root,
          { name: 'AES-GCM', length: 256 },
          false,
          ['encrypt', 'decrypt'],
        );
        cache.set(purpose, k);
      }
      return k;
    },
  };
}
