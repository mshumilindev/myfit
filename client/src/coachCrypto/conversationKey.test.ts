// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  PURPOSES,
  createChatWrap,
  isChatWrap,
  newConversationKeyBytes,
  openChatKey,
  ringFromBytes,
} from './conversationKey';
import { openEnvelope, sealEnvelope } from './envelope';
import { CID, CID2, pairedRings, trainer } from './testHelpers';

const ctx = (over = {}) => ({
  cid: CID,
  epoch: 1,
  messageId: 'm1',
  fromUid: 'u-client',
  at: 1_700_000_000_000,
  kind: 'message',
  ...over,
});

describe('conversation key', () => {
  it('is random, 256 bits, never the same twice', () => {
    const a = newConversationKeyBytes();
    const b = newConversationKeyBytes();
    expect(a.length).toBe(32);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  });

  it('client wraps, trainer unwraps, and both read each other (trainer can ENCRYPT)', async () => {
    const t = await trainer();
    const { client, trainer: tr } = await pairedRings(t);
    const ck = await client.key('chat');
    const tk = await tr.key('chat');
    const fromClient = await sealEnvelope(ck, ctx(), { text: 'hello coach' });
    expect(await openEnvelope(tk, ctx(), fromClient)).toEqual({ text: 'hello coach' });
    const fromTrainer = await sealEnvelope(tk, ctx({ fromUid: 'u-trainer' }), { text: 'hi' });
    expect(await openEnvelope(ck, ctx({ fromUid: 'u-trainer' }), fromTrainer)).toEqual({
      text: 'hi',
    });
  });

  it('sub-keys are per purpose, non-extractable and cannot read each other', async () => {
    const t = await trainer();
    const { client } = await pairedRings(t);
    const keys = await Promise.all(PURPOSES.map((p) => client.key(p)));
    for (const k of keys) {
      expect(k.extractable).toBe(false);
      expect(k.usages.sort()).toEqual(['decrypt', 'encrypt']);
    }
    const env = await sealEnvelope(await client.key('chat'), ctx(), { x: 1 });
    for (const p of PURPOSES.filter((p) => p !== 'chat')) {
      await expect(openEnvelope(await client.key(p), ctx(), env)).rejects.toThrow();
    }
    expect(await client.key('chat')).toBe(await client.key('chat')); // cached
    await expect(client.key('bogus' as never)).rejects.toThrow('bad-purpose');
  });

  it('sub-keys differ per cid and per epoch even from the same CK bytes', async () => {
    const raw = newConversationKeyBytes();
    const a = await ringFromBytes(CID, 1, new Uint8Array(raw));
    const b = await ringFromBytes(CID2, 1, new Uint8Array(raw));
    const c = await ringFromBytes(CID, 2, new Uint8Array(raw));
    const env = await sealEnvelope(await a.key('chat'), ctx(), { x: 1 });
    await expect(openEnvelope(await b.key('chat'), ctx(), env)).rejects.toThrow();
    await expect(openEnvelope(await c.key('chat'), ctx(), env)).rejects.toThrow();
    // same bytes, same cid + epoch: same sub-key (a second device)
    const a2 = await ringFromBytes(CID, 1, new Uint8Array(raw));
    expect(await openEnvelope(await a2.key('chat'), ctx(), env)).toEqual({ x: 1 });
  });

  it('zeroes the raw bytes it imports', async () => {
    const raw = newConversationKeyBytes();
    await ringFromBytes(CID, 1, raw);
    expect(raw.every((b) => b === 0)).toBe(true);
  });

  it('the wrap differs every time and reveals nothing', async () => {
    const t = await trainer();
    const raw = newConversationKeyBytes();
    const a = await createChatWrap(raw, CID, 1, t.rec.pub);
    const b = await createChatWrap(raw, CID, 1, t.rec.pub);
    expect(isChatWrap(a)).toBe(true);
    expect(a.ct).not.toBe(b.ct);
    expect(a.fp).toBe(b.fp);
  });

  it('a different trainer cannot unwrap', async () => {
    const t = await trainer();
    const other = await trainer();
    const wrap = await createChatWrap(newConversationKeyBytes(), CID, 1, t.rec.pub);
    await expect(openChatKey(wrap, CID, other.rec, other.key)).rejects.toThrow(
      'fingerprint-mismatch',
    );
    // even if the attacker lies about the fingerprint
    const lied = { ...wrap, fp: await (await import('../vaultGrants')).fingerprint(other.rec.pub) };
    await expect(openChatKey(lied, CID, other.rec, other.key)).rejects.toThrow();
  });

  it('refuses a wrap made for a key the trainer no longer has (fingerprint check)', async () => {
    const t = await trainer();
    const rotated = await trainer();
    const wrap = await createChatWrap(newConversationKeyBytes(), CID, 1, t.rec.pub);
    await expect(openChatKey(wrap, CID, rotated.rec, rotated.key)).rejects.toThrow(
      'fingerprint-mismatch',
    );
  });

  it('the trainer with the wrong vault key cannot unwrap their private half', async () => {
    const t = await trainer();
    const stranger = await trainer();
    const wrap = await createChatWrap(newConversationKeyBytes(), CID, 1, t.rec.pub);
    await expect(openChatKey(wrap, CID, t.rec, stranger.key)).rejects.toThrow();
  });

  it('a tampered wrap throws', async () => {
    const t = await trainer();
    const wrap = await createChatWrap(newConversationKeyBytes(), CID, 1, t.rec.pub);
    const bytes = Buffer.from(wrap.ct, 'base64');
    bytes[0] ^= 1;
    await expect(
      openChatKey({ ...wrap, ct: bytes.toString('base64') }, CID, t.rec, t.key),
    ).rejects.toThrow();
  });

  it('a wrap cannot be moved to another conversation or epoch (AAD)', async () => {
    const t = await trainer();
    const wrap = await createChatWrap(newConversationKeyBytes(), CID, 1, t.rec.pub);
    await expect(openChatKey(wrap, CID2, t.rec, t.key)).rejects.toThrow();
    await expect(openChatKey({ ...wrap, epoch: 2 }, CID, t.rec, t.key)).rejects.toThrow();
  });

  it('rejects malformed ids and epochs', async () => {
    const t = await trainer();
    await expect(createChatWrap(newConversationKeyBytes(), 'a_b', 1, t.rec.pub)).rejects.toThrow(
      'bad-cid',
    );
    await expect(createChatWrap(newConversationKeyBytes(), CID, 0, t.rec.pub)).rejects.toThrow(
      'bad-epoch',
    );
    await expect(ringFromBytes(CID, 1, new Uint8Array(16))).rejects.toThrow('bad-key');
  });
});
