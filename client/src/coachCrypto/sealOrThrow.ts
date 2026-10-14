/**
 * The only way new coaching documents are sealed (R-BE-KEY-4).
 *
 * Unlike `prepareWrite` (which falls back to plaintext while the vault is not ready), this
 * throws `vault-locked`: a fallback would put chat text, notes or schedules in the database
 * in the clear. Callers show a retry state and queue the intent locally.
 */
import type { Vault } from '../autoVault';
import { decryptJson, encryptJson, isEnvelope } from '../vaultCrypto';
import { isCkEnvelope, openEnvelope, sealEnvelope, type EnvelopeContext } from './envelope';
import { NEW_COLLECTIONS, splitFields, type NewCollectionName } from './newCollections';
import type { ChatKeyRing } from './conversationKey';

export class VaultLockedError extends Error {
  readonly code = 'vault-locked';
  constructor(message = 'vault-locked') {
    super(message);
    this.name = 'VaultLockedError';
  }
}

/** Per-document authenticated context for key 'ck' collections (cid/epoch/kind come from the ring and registry). */
export interface DocContext {
  messageId: string;
  fromUid: string;
  at: number;
}

export interface SealSource {
  vault: Vault;
  /** Required for key 'ck' collections. */
  ring?: ChatKeyRing | null;
  /** Required for key 'ck' collections. */
  ctx?: DocContext;
}

const ckContext = (
  name: NewCollectionName,
  ring: ChatKeyRing,
  ctx: DocContext,
): EnvelopeContext => {
  const spec = NEW_COLLECTIONS[name];
  if (!('aadKind' in spec)) throw new Error('not-ck');
  return { cid: ring.cid, epoch: ring.epoch, kind: spec.aadKind, ...ctx };
};

export async function sealOrThrow(
  name: NewCollectionName,
  doc: Record<string, unknown>,
  src: SealSource,
): Promise<Record<string, unknown>> {
  const spec = NEW_COLLECTIONS[name];
  if (spec.key === 'none') {
    const { open, secret } = splitFields(name, doc);
    if (Object.keys(secret).length) throw new Error(`undeclared-field:${name}`);
    return open;
  }
  if (src.vault.status() !== 'ready') throw new VaultLockedError();
  const m = src.vault.materialOrNull();
  if (!m) throw new VaultLockedError();
  const { open, secret } = splitFields(name, doc);
  if (spec.key === 'dek') {
    return { ...open, enc: await encryptJson(m.key, m.salt, secret) };
  }
  // key 'ck'
  const { ring, ctx } = src;
  if (!ring || !ctx) throw new VaultLockedError('chat-key-missing');
  if ('keyEpoch' in open && open.keyEpoch !== ring.epoch) throw new Error('epoch-mismatch');
  const key = await ring.key(spec.purpose);
  const enc = await sealEnvelope(
    key,
    ckContext(name, ring, ctx),
    secret,
    'maxBytes' in spec ? spec.maxBytes : undefined,
  );
  return { ...open, keyEpoch: ring.epoch, enc };
}

/** Inverse of `sealOrThrow`. Throws when the key is missing or authentication fails. */
export async function openSealed<T extends Record<string, unknown>>(
  name: NewCollectionName,
  raw: Record<string, unknown>,
  src: SealSource,
): Promise<T> {
  const spec = NEW_COLLECTIONS[name];
  const { enc, ...open } = raw;
  if (spec.key === 'none') return raw as T;
  if (spec.key === 'dek') {
    const m = src.vault.materialOrNull();
    if (!m) throw new VaultLockedError();
    if (!isEnvelope(enc)) throw new Error('bad-envelope');
    return { ...open, ...(await decryptJson<Record<string, unknown>>(m.key, enc)) } as T;
  }
  const { ring, ctx } = src;
  if (!ring || !ctx) throw new VaultLockedError('chat-key-missing');
  if (!isCkEnvelope(enc)) throw new Error('bad-envelope');
  if (open.keyEpoch !== ring.epoch) throw new Error('epoch-mismatch');
  const key = await ring.key(spec.purpose);
  const secret = await openEnvelope<Record<string, unknown>>(key, ckContext(name, ring, ctx), enc);
  return { ...open, ...secret } as T;
}

/** Seal, then hand to the writer. If sealing throws, the writer is never called. */
/** @internal planned: the real Firestore adapters will route writes through it. Re-exported from the barrel (index.ts) and covered by barrel.test.ts. */
export async function sealedWrite(
  name: NewCollectionName,
  doc: Record<string, unknown>,
  src: SealSource,
  write: (sealed: Record<string, unknown>) => Promise<void>,
): Promise<void> {
  await write(await sealOrThrow(name, doc, src));
}
