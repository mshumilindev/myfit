// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  BUCKET,
  MAX_PAYLOAD_BYTES,
  contextAad,
  openEnvelope,
  pad,
  sealEnvelope,
  unpad,
  type EnvelopeContext,
} from './envelope';
import { CID, CID2, pairedRings, trainer } from './testHelpers';

const ctx: EnvelopeContext = {
  cid: CID,
  epoch: 1,
  messageId: 'm-1',
  fromUid: 'u-client',
  at: 1_700_000_000_000,
  kind: 'message',
};

async function setup() {
  const t = await trainer();
  const rings = await pairedRings(t);
  return { t, key: await rings.client.key('chat'), rings };
}

describe('message envelope', () => {
  it('round-trips, with the {v, iv, ct} shape and no plaintext', async () => {
    const { key } = await setup();
    const env = await sealEnvelope(key, ctx, { kind: 'text', text: 'Knee pain on squats' });
    expect(Object.keys(env).sort()).toEqual(['ct', 'iv', 'v']);
    expect(env.v).toBe(1);
    expect(JSON.stringify(env)).not.toContain('Knee');
    expect(await openEnvelope(key, ctx, env)).toEqual({
      kind: 'text',
      text: 'Knee pain on squats',
    });
  });

  it('uses a fresh 96-bit IV every time', async () => {
    const { key } = await setup();
    const ivs = new Set<string>();
    for (let i = 0; i < 50; i++) ivs.add((await sealEnvelope(key, ctx, { i: 1 })).iv);
    expect(ivs.size).toBe(50);
    expect(Buffer.from([...ivs][0], 'base64').length).toBe(12);
  });

  it('fails when the ciphertext is tampered', async () => {
    const { key } = await setup();
    const env = await sealEnvelope(key, ctx, { text: 'x' });
    const b = Buffer.from(env.ct, 'base64');
    b[5] ^= 0x01;
    await expect(openEnvelope(key, ctx, { ...env, ct: b.toString('base64') })).rejects.toThrow();
    const iv = Buffer.from(env.iv, 'base64');
    iv[0] ^= 1;
    await expect(openEnvelope(key, ctx, { ...env, iv: iv.toString('base64') })).rejects.toThrow();
  });

  it.each([
    ['cid', { cid: CID2 }],
    ['epoch', { epoch: 2 }],
    ['messageId', { messageId: 'm-2' }],
    ['fromUid (re-attributed)', { fromUid: 'u-trainer' }],
    ['at (reordered in time)', { at: 1_700_000_000_001 }],
    ['kind', { kind: 'note' }],
  ])('fails when the %s in the AAD is swapped', async (_n, over) => {
    const { key } = await setup();
    const env = await sealEnvelope(key, ctx, { text: 'x' });
    await expect(openEnvelope(key, { ...ctx, ...over }, env)).rejects.toThrow();
  });

  it('fails for the wrong coach (a stranger with their own wrap)', async () => {
    const { key } = await setup();
    const strangerRings = await pairedRings(await trainer());
    const env = await sealEnvelope(key, ctx, { text: 'x' });
    await expect(openEnvelope(await strangerRings.trainer.key('chat'), ctx, env)).rejects.toThrow();
  });

  it('a ciphertext replayed into another conversation does not open, even with its context', async () => {
    const t = await trainer();
    const a = await pairedRings(t, CID, 1);
    const b = await pairedRings(t, CID2, 1);
    const env = await sealEnvelope(await a.client.key('chat'), ctx, { text: 'x' });
    // other conversation's key, with either context
    await expect(openEnvelope(await b.client.key('chat'), ctx, env)).rejects.toThrow();
    await expect(
      openEnvelope(await b.client.key('chat'), { ...ctx, cid: CID2 }, env),
    ).rejects.toThrow();
  });

  it('a removed trainer (old epoch only) cannot read the next epoch', async () => {
    const t = await trainer();
    const e1 = await pairedRings(t, CID, 1);
    const e2 = await pairedRings(t, CID, 2);
    const env2 = await sealEnvelope(
      await e2.client.key('chat'),
      { ...ctx, epoch: 2 },
      { text: 'x' },
    );
    await expect(
      openEnvelope(await e1.trainer.key('chat'), { ...ctx, epoch: 2 }, env2),
    ).rejects.toThrow();
    await expect(openEnvelope(await e1.trainer.key('chat'), ctx, env2)).rejects.toThrow();
  });

  it('refuses unknown versions and malformed envelopes (algorithm agility)', async () => {
    const { key } = await setup();
    const env = await sealEnvelope(key, ctx, { text: 'x' });
    await expect(openEnvelope(key, ctx, { ...env, v: 2 as never })).rejects.toThrow(
      'unsupported-version',
    );
    await expect(openEnvelope(key, ctx, { ...env, v: 0 as never })).rejects.toThrow();
    await expect(openEnvelope(key, ctx, { v: 1 } as never)).rejects.toThrow('bad-envelope');
    // the version is part of the AAD: the same bytes under another v can never verify
    expect(Buffer.from(contextAad(1, ctx)).equals(Buffer.from(contextAad(2, ctx)))).toBe(false);
  });

  it('AAD is v|cid|epoch|messageId|fromUid|at|kind and rejects separator injection', () => {
    expect(new TextDecoder().decode(contextAad(1, ctx))).toBe(
      `1|${CID}|1|m-1|u-client|1700000000000|message`,
    );
    expect(() => contextAad(1, { ...ctx, messageId: 'a|b' })).toThrow('bad-context');
    expect(() => contextAad(1, { ...ctx, fromUid: '' })).toThrow('bad-context');
    expect(() => contextAad(1, { ...ctx, at: 1.5 })).toThrow('bad-context');
    expect(() => contextAad(1, { ...ctx, epoch: 0 })).toThrow('bad-context');
  });
});

describe('padding', () => {
  it('hides length differences inside a 64-byte bucket, and only there', async () => {
    const { key } = await setup();
    const len = async (text: string) =>
      Buffer.from((await sealEnvelope(key, ctx, { text })).ct, 'base64').length;
    expect(await len('ok')).toBe(await len('okay, see you at 6'));
    expect(await len('ok')).toBe(BUCKET + 16);
    expect(await len('x'.repeat(200))).toBeGreaterThan(await len('ok'));
    expect((await len('x'.repeat(200))) % BUCKET).toBe(16); // multiple of the bucket + GCM tag
  });

  it('pad / unpad are exact inverses and unpad rejects forged padding', () => {
    for (const n of [0, 1, 59, 60, 61, 63, 64, 200, MAX_PAYLOAD_BYTES]) {
      const p = new Uint8Array(n).map((_, i) => (i % 250) + 1);
      const padded = pad(p);
      expect(padded.length % BUCKET).toBe(0);
      expect(Buffer.from(unpad(padded)).equals(Buffer.from(p))).toBe(true);
    }
    const bad = pad(new Uint8Array([1, 2, 3]));
    bad[bad.length - 1] = 9;
    expect(() => unpad(bad)).toThrow('bad-padding');
    expect(() => unpad(new Uint8Array(10))).toThrow('bad-padding');
    expect(() => pad(new Uint8Array(MAX_PAYLOAD_BYTES + 1))).toThrow('too-large');
  });

  it('a message at the size cap fits the rules limit for ct', async () => {
    const { key } = await setup();
    const big = JSON.stringify({ text: 'é'.repeat(3900) });
    expect(big.length).toBeLessThan(MAX_PAYLOAD_BYTES);
    const env = await sealEnvelope(key, ctx, { text: 'é'.repeat(3900) });
    expect(env.ct.length).toBeLessThan(11000); // keep in step with firestore.rules sealedCk
  });
});
