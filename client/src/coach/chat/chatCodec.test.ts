// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { pairedRings, trainer, CID, CID2 } from '../../coachCrypto/testHelpers';
import { readyVault, unsetVault } from '../../testVault';
import { openChatMessage, sealChatMessage } from './chatCodec';
import { MAX_TEXT } from './types';

const AT = 1_791_364_800_123;
const msg = {
  id: 'm1',
  fromUid: 'client-uid',
  at: AT,
  body: { kind: 'text', text: 'my shoulder hurts' } as const,
};

async function setup() {
  const vault = await readyVault();
  const rings = await pairedRings(await trainer());
  return { vault, rings };
}

describe('chat message codec (Part C.2 no. 6)', () => {
  it('round-trips between the two parties; the stored doc has no plaintext', async () => {
    const { vault, rings } = await setup();
    const doc = await sealChatMessage({ vault, ring: rings.client }, msg);
    expect(JSON.stringify(doc)).not.toContain('shoulder');
    expect(Object.keys(doc).sort()).toEqual(['at', 'enc', 'from', 'id', 'keyEpoch', 'v']);
    expect(doc.at).toBe(Math.floor(AT / 1000) * 1000); // timestamps rounded to the second
    const opened = await openChatMessage({ vault, ring: rings.trainer }, 'm1', doc);
    expect(opened).toMatchObject({
      id: 'm1',
      fromUid: 'client-uid',
      body: { kind: 'text', text: 'my shoulder hurts' },
    });
  });

  it('refuses a ciphertext moved to another message id, sender or time', async () => {
    const { vault, rings } = await setup();
    const doc = await sealChatMessage({ vault, ring: rings.client }, msg);
    await expect(
      openChatMessage({ vault, ring: rings.trainer }, 'm2', { ...doc, id: 'm2' }),
    ).rejects.toThrow();
    await expect(
      openChatMessage({ vault, ring: rings.trainer }, 'm1', { ...doc, from: 'trainer-uid' }),
    ).rejects.toThrow();
    await expect(
      openChatMessage({ vault, ring: rings.trainer }, 'm1', {
        ...doc,
        at: (doc.at as number) + 1000,
      }),
    ).rejects.toThrow();
  });

  it('refuses a message copied into another conversation (other cid) or epoch', async () => {
    const { vault, rings } = await setup();
    const other = await pairedRings(await trainer(), CID2);
    const doc = await sealChatMessage({ vault, ring: rings.client }, msg);
    expect(rings.client.cid).toBe(CID);
    await expect(openChatMessage({ vault, ring: other.trainer }, 'm1', doc)).rejects.toThrow();
    await expect(
      openChatMessage({ vault, ring: rings.trainer }, 'm1', { ...doc, keyEpoch: 2 }),
    ).rejects.toThrow();
  });

  it('a tampered envelope does not open (shows "Couldn\'t verify this message")', async () => {
    const { vault, rings } = await setup();
    const doc = await sealChatMessage({ vault, ring: rings.client }, msg);
    const enc = doc.enc as { ct: string };
    const bad = { ...doc, enc: { ...enc, ct: (enc.ct[0] === 'A' ? 'B' : 'A') + enc.ct.slice(1) } };
    await expect(openChatMessage({ vault, ring: rings.trainer }, 'm1', bad)).rejects.toThrow();
  });

  it('never seals while the vault is locked (no plaintext fallback)', async () => {
    const rings = await pairedRings(await trainer());
    await expect(
      sealChatMessage({ vault: await unsetVault(), ring: rings.client }, msg),
    ).rejects.toThrow('vault-locked');
    await expect(sealChatMessage({ vault: await readyVault(), ring: null }, msg)).rejects.toThrow(
      'chat-key-missing',
    );
  });

  it('text only: empty and over-long messages are refused, an unknown authentic kind is "unsupported"', async () => {
    const { vault, rings } = await setup();
    await expect(
      sealChatMessage(
        { vault, ring: rings.client },
        { ...msg, body: { kind: 'text', text: '   ' } },
      ),
    ).rejects.toThrow('empty-message');
    await expect(
      sealChatMessage(
        { vault, ring: rings.client },
        { ...msg, body: { kind: 'text', text: 'x'.repeat(MAX_TEXT + 1) } },
      ),
    ).rejects.toThrow('too-long');
    await expect(
      sealChatMessage({ vault, ring: rings.client }, { ...msg, body: { kind: 'unsupported' } }),
    ).rejects.toThrow();
    // an authentic doc with a future kind opens as unsupported, never as partial text
    const { sealOrThrow } = await import('../../coachCrypto/sealOrThrow');
    const future = await sealOrThrow(
      'messages',
      { id: 'm9', from: 'client-uid', at: 1000, v: 1, kind: 'voice', text: 'x' },
      { vault, ring: rings.client, ctx: { messageId: 'm9', fromUid: 'client-uid', at: 1000 } },
    );
    expect((await openChatMessage({ vault, ring: rings.trainer }, 'm9', future)).body).toEqual({
      kind: 'unsupported',
    });
  });

  it('system and request bodies round-trip', async () => {
    const { vault, rings } = await setup();
    const sys = await sealChatMessage(
      { vault, ring: rings.trainer },
      {
        id: 's1',
        fromUid: 't',
        at: 5000,
        body: { kind: 'system', type: 'program-updated', text: 'Program updated' },
      },
    );
    expect((await openChatMessage({ vault, ring: rings.client }, 's1', sys)).body).toEqual({
      kind: 'system',
      type: 'program-updated',
      text: 'Program updated',
    });
    const req = await sealChatMessage(
      { vault, ring: rings.trainer },
      { id: 'r1', fromUid: 't', at: 5000, body: { kind: 'request', reqId: 'rq1' } },
    );
    expect((await openChatMessage({ vault, ring: rings.client }, 'r1', req)).body).toEqual({
      kind: 'request',
      reqId: 'rq1',
    });
  });
});
