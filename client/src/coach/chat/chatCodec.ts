/**
 * Message <-> sealed document (plan 10.1, Part C.2 no. 6). The ONLY place a chat message is sealed or opened.
 * Sealing goes through `sealOrThrow('messages', ...)`, so it throws `vault-locked` instead of ever writing
 * plaintext, binds the envelope to cid | epoch | messageId | fromUid | at | 'message' (AAD) and pads to 64-byte
 * buckets. No console output, no logging of bodies (C.3).
 */
import { openSealed, sealOrThrow, type SealSource } from '../../coachCrypto/sealOrThrow';
import { isCkEnvelope, type CkEnvelope } from '../../coachCrypto/envelope';
import {
  signEnvelope,
  verifyEnvelope,
  type SignerDirectory,
  type SigningKey,
} from './chatSignature';
import { MAX_TEXT, type ChatMessage, type MsgBody, type MsgFrom } from './types';

export const MESSAGE_VERSION = 1;

export interface OutgoingMessage {
  id: string;
  fromUid: string;
  /** ms; rounded down to the second (timestamp minimisation) */
  at: number;
  body: MsgBody;
}

export interface OpenedMessage {
  id: string;
  fromUid: string;
  at: number;
  body: MsgBody;
}

const roundSecond = (ms: number) => Math.floor(ms / 1000) * 1000;

/** The enc fields of the registry: kind, text, share, reqId, sys. */
function toFields(b: MsgBody): Record<string, unknown> {
  switch (b.kind) {
    case 'text': {
      const text = b.text.trim();
      if (!text) throw new Error('empty-message');
      if (text.length > MAX_TEXT) throw new Error('too-long');
      return { kind: 'text', text };
    }
    case 'system':
      return { kind: 'system', sys: { type: b.type, ...(b.text ? { text: b.text } : {}) } };
    case 'share':
      return { kind: 'share', share: b.share, ...(b.text ? { text: b.text } : {}) };
    case 'request':
      return { kind: 'request', reqId: b.reqId };
    default:
      throw new Error('unsupported-kind');
  }
}

/** The authenticated context of a stored message (what the AAD and the signature both bind). */
const envCtx = (src: Pick<SealSource, 'ring'>, id: string, fromUid: string, at: number) => {
  if (!src.ring) throw new Error('chat-key-missing');
  return { cid: src.ring.cid, epoch: src.ring.epoch, kind: 'message', messageId: id, fromUid, at };
};

/**
 * Seal a message. With a `signer` the stored doc also carries `sig` + `sigKid` (open fields, C.2 no. 7): an ECDSA
 * signature of the sender's device key over the envelope context and ciphertext.
 */
export async function sealChatMessage(
  src: Omit<SealSource, 'ctx'>,
  m: OutgoingMessage,
  signer?: Pick<SigningKey, 'kid' | 'privateKey'>,
): Promise<Record<string, unknown>> {
  const at = roundSecond(m.at);
  const doc = await sealOrThrow(
    'messages',
    { id: m.id, from: m.fromUid, at, v: MESSAGE_VERSION, ...toFields(m.body) },
    { ...src, ctx: { messageId: m.id, fromUid: m.fromUid, at } },
  );
  if (!signer) return doc;
  const sig = await signEnvelope(signer, envCtx(src, m.id, m.fromUid, at), doc.enc as CkEnvelope);
  return { ...doc, sig, sigKid: signer.kid };
}

/** Receiver side of C.2 no. 7: who may have signed, and whether an unsigned message is tolerated. */
export interface VerifyOptions {
  directory: SignerDirectory;
  /** Migration grace for messages written before signing existed. Default: a missing signature fails. */
  allowUnsigned?: boolean;
}

/**
 * Open a stored message. Throws on any authentication failure (wrong key, copied to another
 * conversation / id / sender / time, tampering): the caller renders "Couldn't verify this message".
 * An authentic message of a kind this build does not know becomes `{ kind: 'unsupported' }`.
 */
export async function openChatMessage(
  src: Omit<SealSource, 'ctx'>,
  docId: string,
  raw: Record<string, unknown>,
  verify?: VerifyOptions,
): Promise<OpenedMessage> {
  if (raw.id !== docId || typeof raw.from !== 'string' || !Number.isSafeInteger(raw.at)) {
    throw new Error('bad-envelope');
  }
  if (verify) await checkSignature(src, docId, raw, verify);
  const doc = await openSealed<Record<string, unknown>>('messages', raw, {
    ...src,
    ctx: { messageId: docId, fromUid: raw.from, at: raw.at as number },
  });
  return { id: docId, fromUid: raw.from, at: raw.at as number, body: toBody(doc) };
}

function toBody(d: Record<string, unknown>): MsgBody {
  if (d.kind === 'text' && typeof d.text === 'string') return { kind: 'text', text: d.text };
  if (d.kind === 'system' && d.sys && typeof d.sys === 'object') {
    const s = d.sys as { type?: unknown; text?: unknown };
    return {
      kind: 'system',
      type: typeof s.type === 'string' ? s.type : 'unknown',
      ...(typeof s.text === 'string' ? { text: s.text } : {}),
    };
  }
  if (d.kind === 'share' && d.share != null)
    return {
      kind: 'share',
      share: d.share,
      ...(typeof d.text === 'string' ? { text: d.text } : {}),
    };
  if (d.kind === 'request' && typeof d.reqId === 'string')
    return { kind: 'request', reqId: d.reqId };
  return { kind: 'unsupported' };
}

/** Throws `bad-signature` unless the envelope is signed by a known, unrevoked key of its claimed sender. */
async function checkSignature(
  src: Omit<SealSource, 'ctx'>,
  docId: string,
  raw: Record<string, unknown>,
  verify: VerifyOptions,
): Promise<void> {
  const { sig, sigKid } = raw;
  if (sig == null && sigKid == null) {
    if (verify.allowUnsigned) return;
    throw new Error('bad-signature');
  }
  if (typeof sig !== 'string' || typeof sigKid !== 'string' || !isCkEnvelope(raw.enc)) {
    throw new Error('bad-signature');
  }
  const key = await verify.directory.key(raw.from as string, sigKid);
  if (!key) throw new Error('bad-signature');
  const ok = await verifyEnvelope(
    key,
    envCtx(src, docId, raw.from as string, raw.at as number),
    raw.enc,
    sig,
  );
  if (!ok) throw new Error('bad-signature');
}

/**
 * What a real adapter hands the UI for one stored doc: the opened message, or - on ANY failure (wrong key, moved or
 * tampered ciphertext, bad or missing signature, vault locked) - a message with `unverified: true` and no content.
 * Never throws, never carries text from a document that did not authenticate, never logs.
 */
export async function openChatMessageForUi(
  src: Omit<SealSource, 'ctx'>,
  cid: string,
  docId: string,
  raw: Record<string, unknown>,
  roleOf: (uid: string) => MsgFrom,
  verify?: VerifyOptions,
): Promise<ChatMessage> {
  const from = typeof raw.from === 'string' ? roleOf(raw.from) : 'client';
  const at = Number.isSafeInteger(raw.at) ? (raw.at as number) : 0;
  try {
    const o = await openChatMessage(src, docId, raw, verify);
    return { id: docId, cid, from: roleOf(o.fromUid), at: o.at, body: o.body, state: 'sent' };
  } catch {
    return {
      id: docId,
      cid,
      from,
      at,
      body: { kind: 'unsupported' },
      unverified: true,
      state: 'sent',
    };
  }
}
