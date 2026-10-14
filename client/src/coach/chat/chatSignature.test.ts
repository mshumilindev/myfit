// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { pairedRings, trainer, CID, CID2 } from '../../coachCrypto/testHelpers';
import { readyVault } from '../../testVault';
import { openChatMessage, openChatMessageForUi, sealChatMessage } from './chatCodec';
import { generateSigningKey, keyIdOf, memorySignerDirectory } from './chatSignature';

const AT = 1_791_364_800_123;
const msg = {
  id: 'm1',
  fromUid: 'client-uid',
  at: AT,
  body: { kind: 'text', text: 'my shoulder hurts' } as const,
};
const role = (uid: string) => (uid === 'trainer-uid' ? ('trainer' as const) : ('client' as const));

async function setup() {
  const vault = await readyVault();
  const rings = await pairedRings(await trainer());
  const clientKey = await generateSigningKey();
  const directory = memorySignerDirectory();
  await directory.add('client-uid', clientKey);
  return { vault, rings, clientKey, directory };
}

describe('sender signature (Part C.2 no. 7)', () => {
  it('signs on send and verifies on receive; the key is non-extractable', async () => {
    const { vault, rings, clientKey, directory } = await setup();
    expect(clientKey.privateKey.extractable).toBe(false);
    expect(clientKey.kid).toBe(await keyIdOf(clientKey.publicRaw));
    const doc = await sealChatMessage({ vault, ring: rings.client }, msg, clientKey);
    expect(doc.sigKid).toBe(clientKey.kid);
    expect(typeof doc.sig).toBe('string');
    expect(JSON.stringify(doc)).not.toContain('shoulder');
    const opened = await openChatMessage({ vault, ring: rings.trainer }, 'm1', doc, { directory });
    expect(opened.body).toEqual({ kind: 'text', text: 'my shoulder hurts' });
  });

  it('refuses a missing signature unless the migration grace is on', async () => {
    const { vault, rings, directory } = await setup();
    const doc = await sealChatMessage({ vault, ring: rings.client }, msg);
    await expect(
      openChatMessage({ vault, ring: rings.trainer }, 'm1', doc, { directory }),
    ).rejects.toThrow('bad-signature');
    const ok = await openChatMessage({ vault, ring: rings.trainer }, 'm1', doc, {
      directory,
      allowUnsigned: true,
    });
    expect(ok.id).toBe('m1');
  });

  it('refuses a signature by another key, another sender, a revoked key, or tampered ciphertext', async () => {
    const { vault, rings, clientKey, directory } = await setup();
    const other = await generateSigningKey();
    await directory.add('trainer-uid', other);
    // signed by the trainer's key but claiming the client as sender
    const forged = await sealChatMessage({ vault, ring: rings.client }, msg, other);
    await expect(
      openChatMessage({ vault, ring: rings.trainer }, 'm1', forged, { directory }),
    ).rejects.toThrow('bad-signature');
    // unknown key id
    const good = await sealChatMessage({ vault, ring: rings.client }, msg, clientKey);
    await expect(
      openChatMessage(
        { vault, ring: rings.trainer },
        'm1',
        { ...good, sigKid: 'deadbeefdeadbeef' },
        { directory },
      ),
    ).rejects.toThrow('bad-signature');
    // tampered signature / ciphertext
    const sig = good.sig as string;
    const flipped = (sig[0] === 'A' ? 'B' : 'A') + sig.slice(1);
    await expect(
      openChatMessage(
        { vault, ring: rings.trainer },
        'm1',
        { ...good, sig: flipped },
        { directory },
      ),
    ).rejects.toThrow('bad-signature');
    const enc = good.enc as { v: number; iv: string; ct: string };
    const ct = (enc.ct[0] === 'A' ? 'B' : 'A') + enc.ct.slice(1);
    await expect(
      openChatMessage(
        { vault, ring: rings.trainer },
        'm1',
        { ...good, enc: { ...enc, ct } },
        { directory },
      ),
    ).rejects.toThrow();
    // revoked
    directory.revoke('client-uid', clientKey.kid);
    await expect(
      openChatMessage({ vault, ring: rings.trainer }, 'm1', good, { directory }),
    ).rejects.toThrow('bad-signature');
  });

  it('a signature cannot be moved to another message id, time or conversation', async () => {
    const { vault, rings, clientKey, directory } = await setup();
    const good = await sealChatMessage({ vault, ring: rings.client }, msg, clientKey);
    await expect(
      openChatMessage({ vault, ring: rings.trainer }, 'm2', { ...good, id: 'm2' }, { directory }),
    ).rejects.toThrow();
    await expect(
      openChatMessage(
        { vault, ring: rings.trainer },
        'm1',
        { ...good, at: (good.at as number) + 1000 },
        { directory },
      ),
    ).rejects.toThrow();
    const other = await pairedRings(await trainer(), CID2);
    expect(CID).not.toBe(CID2);
    await expect(
      openChatMessage({ vault, ring: other.trainer }, 'm1', good, { directory }),
    ).rejects.toThrow();
  });

  it('the UI helper turns every failure into an unverified message without any content', async () => {
    const { vault, rings, clientKey, directory } = await setup();
    const good = await sealChatMessage({ vault, ring: rings.client }, msg, clientKey);
    const ok = await openChatMessageForUi({ vault, ring: rings.trainer }, CID, 'm1', good, role, {
      directory,
    });
    expect(ok.unverified).toBeUndefined();
    expect(ok.body).toEqual({ kind: 'text', text: 'my shoulder hurts' });
    const bad = await openChatMessageForUi(
      { vault, ring: rings.trainer },
      CID,
      'm1',
      { ...good, sig: 'AAAA' },
      role,
      { directory },
    );
    expect(bad.unverified).toBe(true);
    expect(JSON.stringify(bad)).not.toContain('shoulder');
    expect(bad.body).toEqual({ kind: 'unsupported' });
    const garbage = await openChatMessageForUi(
      { vault, ring: rings.trainer },
      CID,
      'x',
      { id: 'y' },
      role,
    );
    expect(garbage.unverified).toBe(true);
  });
});
