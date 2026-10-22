import { describe, expect, it } from 'vitest';
import { VaultLockedError } from '../../../coachCrypto/sealOrThrow';
import { readyVault, unsetVault } from '../../../testVault';
import { createCoachKey } from '../../../vaultShare';
import { createRingProvider } from './keyRing';
import { createServerSigningLoader } from './trust';
import { C, CID, T, makeWorld } from './testWorld';

describe('a locked vault', () => {
  it('neither side can read or create a key, and nothing is written', async () => {
    const w = await makeWorld();
    const locked = await unsetVault();
    const signing = createServerSigningLoader(w.fs);
    const client = createRingProvider({
      fs: w.cfs,
      vault: locked,
      uid: C,
      side: 'client',
      signing,
    });
    const trainer = createRingProvider({
      fs: w.tfs,
      vault: locked,
      uid: T,
      side: 'trainer',
      signing,
      loadOwnCoachKey: async () => w.rec,
    });
    const before = w.fs.writes.length;
    await expect(client.current(CID)).rejects.toBeInstanceOf(VaultLockedError);
    await expect(client.forEpoch(CID, 1)).rejects.toBeInstanceOf(VaultLockedError);
    await expect(trainer.current(CID)).rejects.toBeInstanceOf(VaultLockedError);
    expect(w.fs.writes.length).toBe(before);
    expect(w.fs.has(`users/${C}/meta/chatKeys`)).toBe(false);
  });
});

describe('who may create a key', () => {
  it('a client cannot make a key for a conversation that is not theirs', async () => {
    const w = await makeWorld();
    w.fs.seed(`conversations/${CID}`, {
      clientId: 'someone-else',
      trainerId: T,
      active: true,
      keyEpoch: 0,
    });
    await expect(w.clientRings.current(CID)).rejects.toThrow('no-conversation');
    await expect(w.clientRings.current('missing-conversation')).rejects.toThrow('no-conversation');
    expect(w.fs.has(`users/${C}/meta/chatKeys`)).toBe(false);
  });

  it('refuses to wrap for a trainer key that is unsigned, signed for someone else, or has changed after signing', async () => {
    const w = await makeWorld();
    const good = (await w.fs.get(`coachKeys/${T}`))!;
    // no signature at all
    const { sig: _s, ...unsigned } = good;
    void _s;
    w.fs.seed(`coachKeys/${T}`, unsigned);
    await expect(w.clientRings.current(CID)).rejects.toThrow('untrusted-trainer-key');
    // the signature belongs to a different key (an attacker swapped the public key)
    const other = await createCoachKey(w.tv.materialOrNull()!.key, w.tv.materialOrNull()!.salt);
    w.fs.seed(`coachKeys/${T}`, { ...good, pub: other.pub });
    await expect(w.clientRings.current(CID)).rejects.toThrow('untrusted-trainer-key');
    // the same document under another trainer id does not vouch for this one
    w.fs.seed(`coachKeys/${T}`, good);
    w.fs.seed(`conversations/${CID}`, {
      clientId: C,
      trainerId: 'trainer-2',
      active: true,
      keyEpoch: 0,
    });
    w.fs.seed('coachKeys/trainer-2', good);
    await expect(w.clientRings.current(CID)).rejects.toThrow('untrusted-trainer-key');
    // nothing was published in any of these cases
    expect((await w.fs.get(`conversations/${CID}`))!.ck).toBeUndefined();
    expect(w.fs.has(`users/${C}/meta/chatKeys`)).toBe(false);
  });

  it('the stored client key is sealed with the member vault: another account cannot read it', async () => {
    const w = await makeWorld();
    await w.publishKey();
    const raw = (await w.fs.get(`users/${C}/meta/chatKeys`))!;
    expect(Object.keys(raw).sort()).toEqual(['enc', 'v']);
    const intruder = createRingProvider({
      fs: w.cfs,
      vault: await readyVault(),
      uid: C,
      side: 'client',
      signing: createServerSigningLoader(w.fs),
    });
    await expect(intruder.forEpoch(CID, 1)).rejects.toBeTruthy();
  });
});

describe('the trainer side', () => {
  it('a trainer cannot open or use a conversation that belongs to another trainer', async () => {
    const w = await makeWorld();
    await w.publishKey();
    await w.fs.update(`conversations/${CID}`, { trainerId: 'trainer-9' });
    const tp = w.trainerProvider();
    expect(await tp.forEpoch(CID, 1)).toBeNull();
    await expect(tp.current(CID)).rejects.toThrow('no-conversation');
    expect(await tp.forEpoch('no-such-conversation', 1)).toBeNull();
  });

  it('before the client published a key the trainer has none ("Setting up secure chat")', async () => {
    const w = await makeWorld();
    await expect(w.trainerRings.current(CID)).rejects.toThrow('chat-key-missing');
    expect(await w.trainerRings.forEpoch(CID, 1)).toBeNull();
  });

  it('a wrap made for a rotated coach key does not open and gives no ring; a device without a coach key has none', async () => {
    const w = await makeWorld();
    await w.publishKey();
    const rotated = await w.rotateCoachKey();
    // this device still holds the OLD record: the wrap was made for the old key, so it still opens...
    expect((await w.trainerProvider(w.rec).forEpoch(CID, 1))?.epoch).toBe(1);
    // ...but a device holding a record that does not match the wrap gets nothing, not a guess
    expect(await w.trainerProvider(rotated).forEpoch(CID, 1)).toBeNull();
    const noKey = createRingProvider({
      fs: w.tfs,
      vault: w.tv,
      uid: T,
      side: 'trainer',
      signing: createServerSigningLoader(w.fs),
      loadOwnCoachKey: async () => null,
    });
    expect(await noKey.forEpoch(CID, 1)).toBeNull();
    const noLoader = createRingProvider({
      fs: w.tfs,
      vault: w.tv,
      uid: T,
      side: 'trainer',
      signing: createServerSigningLoader(w.fs),
    });
    expect(await noLoader.forEpoch(CID, 1)).toBeNull();
  });

  it('an epoch the conversation has not reached is not invented, and an earlier one needs the published ring entry', async () => {
    const w = await makeWorld();
    await w.publishKey();
    const tp = w.trainerProvider();
    expect(await tp.forEpoch(CID, 2)).toBeNull();
    await w.fs.update(`conversations/${CID}`, { rotateDue: true });
    await w.clientRings.current(CID);
    // a tampered ring entry (epoch mismatch) is refused
    const row = (await w.fs.get(`conversations/${CID}/keyring/1`))!;
    w.fs.seed(`conversations/${CID}/keyring/1`, {
      ...row,
      ck: { ...(row.ck as object), epoch: 5 },
    });
    expect(await w.trainerProvider().forEpoch(CID, 1)).toBeNull();
    w.fs.seed(`conversations/${CID}/keyring/1`, { epoch: 1 });
    expect(await w.trainerProvider().forEpoch(CID, 1)).toBeNull();
  });

  it('past() on the trainer side lists only the epochs the ring holds, never invalid ids', async () => {
    const w = await makeWorld();
    await w.publishKey();
    await w.fs.update(`conversations/${CID}`, { rotateDue: true });
    await w.clientRings.current(CID);
    w.fs.seed(`conversations/${CID}/keyring/junk`, { epoch: 'x' });
    const past = await w.trainerProvider().past(CID, 2);
    expect([...past.keys()]).toEqual([1]);
  });
});

describe('forget', () => {
  it('drops cached rings and keys: a later read has to go back to the sealed store', async () => {
    const w = await makeWorld();
    await w.publishKey();
    const a = await w.clientRings.forEpoch(CID, 1);
    expect(a?.epoch).toBe(1);
    w.clientRings.forget();
    const b = await w.clientRings.forEpoch(CID, 1);
    expect(b?.epoch).toBe(1);
    expect(b).not.toBe(a);
  });

  it('a ring that could not be found is looked up again next time (offline / not yet published)', async () => {
    const w = await makeWorld();
    expect(await w.clientRings.forEpoch(CID, 1)).toBeNull();
    await w.publishKey();
    expect((await w.clientRings.forEpoch(CID, 1))?.epoch).toBe(1);
  });
});

describe('client: a stale key flag', () => {
  it('a wrap that already carries the fingerprint of the signed key is current: no second wrap is written', async () => {
    const w = await makeWorld();
    await w.publishKey();
    await w.fs.update(`conversations/${CID}`, { keyStale: true });
    const before = w.fs.writes.length;
    const r = await w.clientRings.current(CID);
    expect(r.epoch).toBe(1);
    expect(w.fs.writes.slice(before).filter((p) => p === `conversations/${CID}`)).toEqual([]);
  });

  it('after the trainer key changed, the client re-wraps the same epoch for the new signed key', async () => {
    const w = await makeWorld();
    await w.publishKey();
    const first = (await w.fs.get(`conversations/${CID}`))!.ck as { fp: string };
    await w.rotateCoachKey();
    await w.fs.update(`conversations/${CID}`, { keyStale: true });
    const r = await w.clientRings.current(CID);
    expect(r.epoch).toBe(1);
    const second = (await w.fs.get(`conversations/${CID}`))!.ck as { fp: string };
    expect(second.fp).not.toBe(first.fp);
  });

  it('a client that lost the key of its epoch starts a new epoch instead of failing', async () => {
    const w = await makeWorld();
    await w.publishKey();
    await w.fs.del(`users/${C}/meta/chatKeys`);
    w.clientRings.forget();
    const r = await w.clientRings.current(CID);
    expect(r.epoch).toBe(2);
  });
});

describe('client: its own history', () => {
  it('past() lists every earlier epoch this device holds for THIS conversation only', async () => {
    const w = await makeWorld();
    await w.publishKey();
    await w.fs.update(`conversations/${CID}`, { rotateDue: true });
    await w.clientRings.current(CID);
    await w.fs.update(`conversations/${CID}`, { rotateDue: false, keyStale: false });
    await w.fs.update(`conversations/${CID}`, { rotateDue: true });
    expect((await w.clientRings.current(CID)).epoch).toBe(3);
    const past = await w.clientRings.past(CID, 3);
    expect([...past.keys()].sort()).toEqual([1, 2]);
    expect([...(await w.clientRings.past('another-conversation', 3)).keys()]).toEqual([]);
    expect([...(await w.clientRings.past(CID, 2)).keys()]).toEqual([1]);
  });

  it('a failure while publishing the ring entries never blocks the key: chat keeps working', async () => {
    const w = await makeWorld();
    await w.publishKey();
    await w.fs.update(`conversations/${CID}`, { rotateDue: true });
    w.fs.failWrites(null);
    const realSet = w.cfs.set.bind(w.cfs);
    w.cfs.set = async (p, d) => {
      if (p.includes('/keyring/')) throw new Error('ring write refused');
      return realSet(p, d);
    };
    expect((await w.clientRings.current(CID)).epoch).toBe(2);
    expect(w.fs.has(`conversations/${CID}/keyring/1`)).toBe(false);
  });

  it('re-linking after an end starts a new link period: the floor moves, older epochs are not offered to the new trainer', async () => {
    const w = await makeWorld();
    await w.publishKey(); // epoch 1
    // the relationship ended: no wrap any more; the client re-links at a newer coaching epoch
    const conv = { ...(await w.fs.get(`conversations/${CID}`))! };
    delete conv.ck;
    w.fs.seed(`conversations/${CID}`, { ...conv, keyEpoch: 1 });
    await w.fs.update(`coaching/${C}`, { keyEpoch: 2 });
    const r = await w.clientRings.current(CID);
    expect(r.epoch).toBe(2);
    expect(w.fs.has(`conversations/${CID}/keyring/1`)).toBe(false);
  });
});
