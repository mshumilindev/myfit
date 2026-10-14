// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import {
  CID_LENGTH,
  computeConversationId,
  isConversationId,
  resolveConversationId,
} from './conversationId';

const pepper = () => globalThis.crypto.getRandomValues(new Uint8Array(32));

describe('conversation id', () => {
  it('is opaque, 26 chars of base32, and deterministic for a pair', async () => {
    const p = pepper();
    const a = await computeConversationId(p, 'clientUid1', 'trainerUid1');
    expect(a).toHaveLength(CID_LENGTH);
    expect(isConversationId(a)).toBe(true);
    expect(a).not.toContain('clientUid1');
    expect(await computeConversationId(p, 'clientUid1', 'trainerUid1')).toBe(a);
  });

  it('differs per pair, per direction and per pepper', async () => {
    const p = pepper();
    const a = await computeConversationId(p, 'c1', 't1');
    expect(await computeConversationId(p, 'c1', 't2')).not.toBe(a);
    expect(await computeConversationId(p, 'c2', 't1')).not.toBe(a);
    expect(await computeConversationId(p, 't1', 'c1')).not.toBe(a);
    expect(await computeConversationId(pepper(), 'c1', 't1')).not.toBe(a);
  });

  it('matches a known HMAC vector (so the server and tests agree)', async () => {
    const p = new Uint8Array(32).fill(7);
    const { createHmac } = await import('node:crypto');
    const mac = createHmac('sha256', Buffer.from(p)).update('c1:t1').digest();
    // RFC 4648 base32, lowercase, unpadded
    const alphabet = 'abcdefghijklmnopqrstuvwxyz234567';
    let bits = '';
    for (const b of mac) bits += b.toString(2).padStart(8, '0');
    let expected = '';
    for (let i = 0; i + 5 <= bits.length; i += 5)
      expected += alphabet[parseInt(bits.slice(i, i + 5), 2)];
    expect(await computeConversationId(p, 'c1', 't1')).toBe(expected.slice(0, CID_LENGTH));
  });

  it('refuses a weak pepper and ambiguous uids', async () => {
    await expect(computeConversationId(new Uint8Array(8), 'a', 'b')).rejects.toThrow('weak-pepper');
    await expect(computeConversationId(pepper(), 'a:b', 'c')).rejects.toThrow('bad-uid');
    await expect(computeConversationId(pepper(), '', 'c')).rejects.toThrow('bad-uid');
  });

  it('the client port result is validated', async () => {
    const good = 'abcdefghijklmnopqrstuvwxyz';
    const port = { conversationId: vi.fn(async () => good) };
    expect(await resolveConversationId(port, 'c', 't')).toBe(good);
    expect(port.conversationId).toHaveBeenCalledWith('c', 't');
    await expect(
      resolveConversationId({ conversationId: async () => 'c_t' }, 'c', 't'),
    ).rejects.toThrow('bad-cid');
    await expect(
      resolveConversationId({ conversationId: async () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' }, 'c', 't'),
    ).rejects.toThrow('bad-cid');
  });
});
