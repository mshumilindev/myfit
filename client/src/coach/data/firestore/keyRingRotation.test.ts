/**
 * Key ring of past epochs: after a rotation the trainer still reads the history they legitimately held; a removed
 * trainer reads nothing; a re-linked trainer gets the new link period only; a trainer key change is re-wrapped.
 */
import { describe, expect, it } from 'vitest';
import { openSealed, sealOrThrow } from '../../../coachCrypto/sealOrThrow';
import type { ChatKeyRing } from '../../../coachCrypto/conversationKey';
import { createRingBook } from './ringBook';
import { C, CID, T, makeWorld, type TestWorld } from './testWorld';

const ctx = { messageId: 'n1', fromUid: T, at: 1_700_000_000_000 };
const sealNote = (w: TestWorld, ring: ChatKeyRing, text: string) =>
  sealOrThrow(
    'notes',
    { id: 'n1', by: T, at: ctx.at, updatedAt: ctx.at, text },
    { vault: w.tv, ring, ctx },
  );
const openNote = (w: TestWorld, ring: ChatKeyRing, raw: Record<string, unknown>) =>
  openSealed('notes', raw, { vault: w.tv, ring, ctx }).then((d) => d.text);

/** what the server does after the client published a new epoch (onConversationKey) */
const settle = (w: TestWorld) =>
  w.fs.update(`conversations/${CID}`, { rotateDue: false, keyStale: false });
/** what coachEnd does to the conversation + coaching (and the ring), then a re-link */
async function endRelationship(w: TestWorld) {
  const conv = { ...(await w.fs.get(`conversations/${CID}`))! };
  delete conv.ck;
  await w.fs.set(`conversations/${CID}`, { ...conv, active: false });
  for (const k of w.fs.keys(`conversations/${CID}/keyring/`)) await w.fs.del(k);
  await w.fs.update(`coaching/${C}`, { status: 'ended', keyEpoch: 2 });
}
async function relink(w: TestWorld) {
  await w.fs.update(`coaching/${C}`, { status: 'active', trainerId: T });
  await w.fs.update(`conversations/${CID}`, { active: true });
}

async function epoch1(w: TestWorld) {
  await w.publishKey();
  const t1 = await w.trainerRings.forEpoch(CID, 1);
  expect(t1?.epoch).toBe(1);
  return t1!;
}

describe('key ring of past epochs', () => {
  it('reset: the trainer opens epoch-1 history after the client rotated to epoch 2', async () => {
    const w = await makeWorld();
    const t1 = await epoch1(w);
    const note1 = await sealNote(w, t1, 'knee: no deep squats');

    await w.fs.update(`conversations/${CID}`, { rotateDue: true });
    const c2 = await w.clientRings.current(CID);
    expect(c2.epoch).toBe(2);
    await settle(w);

    // the ring holds a wrap of epoch 1 for the trainer, and nothing readable
    const row = (await w.fs.get(`conversations/${CID}/keyring/1`))!;
    expect(Object.keys(row).sort()).toEqual(['at', 'ck', 'epoch']);
    expect(row.epoch).toBe(1);

    // a trainer device with an empty cache (restart)
    const tp = w.trainerProvider();
    const cur = await tp.current(CID);
    expect(cur.epoch).toBe(2);
    const past = await tp.forEpoch(CID, 1);
    expect(past?.epoch).toBe(1);
    expect(await openNote(w, past!, note1)).toBe('knee: no deep squats');
    expect((await tp.past(CID, 2)).has(1)).toBe(true);
    // an epoch that never existed is not invented
    expect(await tp.forEpoch(CID, 3)).toBeNull();
    // the client opens everything too
    const cp = await w.clientRings.forEpoch(CID, 1);
    expect(await openNote(w, cp!, note1)).toBe('knee: no deep squats');
  });

  it('two rotations: every epoch of the period is in the ring', async () => {
    const w = await makeWorld();
    const t1 = await epoch1(w);
    const n1 = await sealNote(w, t1, 'one');
    await w.fs.update(`conversations/${CID}`, { rotateDue: true });
    const c2 = await w.clientRings.current(CID);
    await settle(w);
    const n2 = await sealNote(w, (await w.trainerProvider().forEpoch(CID, 2))!, 'two');
    await w.fs.update(`conversations/${CID}`, { rotateDue: true });
    const c3 = await w.clientRings.current(CID);
    await settle(w);
    expect([c2.epoch, c3.epoch]).toEqual([2, 3]);
    expect(w.fs.keys(`conversations/${CID}/keyring/`).sort()).toEqual([
      `conversations/${CID}/keyring/1`,
      `conversations/${CID}/keyring/2`,
    ]);
    const tp = w.trainerProvider();
    expect((await tp.current(CID)).epoch).toBe(3);
    expect(await openNote(w, (await tp.forEpoch(CID, 1))!, n1)).toBe('one');
    expect(await openNote(w, (await tp.forEpoch(CID, 2))!, n2)).toBe('two');
    expect([...(await tp.past(CID, 3)).keys()].sort()).toEqual([1, 2]);
  });

  it('a removed trainer holds nothing: the ended relationship has no ck and no ring', async () => {
    const w = await makeWorld();
    const t1 = await epoch1(w);
    await sealNote(w, t1, 'private');
    await w.fs.update(`conversations/${CID}`, { rotateDue: true });
    await w.clientRings.current(CID);
    await settle(w);
    await endRelationship(w);
    const tp = w.trainerProvider(); // restarted device of the removed trainer
    await expect(tp.current(CID)).rejects.toThrow('chat-key-missing');
    expect(await tp.forEpoch(CID, 1)).toBeNull();
    expect(await tp.forEpoch(CID, 2)).toBeNull();
    expect((await tp.past(CID, 3)).size).toBe(0);
  });

  it('re-linked: the trainer gets the NEW link period only; the client still opens everything', async () => {
    const w = await makeWorld();
    const t1 = await epoch1(w);
    const old = await sealNote(w, t1, 'before the break');
    await w.fs.update(`conversations/${CID}`, { rotateDue: true });
    await w.clientRings.current(CID); // epoch 2 (ring holds 1)
    await settle(w);
    await endRelationship(w); // coaching.keyEpoch 2 -> next link must start above the published epoch
    await w.fs.update(`coaching/${C}`, { keyEpoch: 3 });
    await relink(w);
    const c3 = await w.clientRings.current(CID);
    expect(c3.epoch).toBe(3);
    await settle(w);
    // nothing of the earlier period is wrapped for the trainer
    expect(w.fs.keys(`conversations/${CID}/keyring/`)).toEqual([]);
    const tp = w.trainerProvider();
    expect((await tp.current(CID)).epoch).toBe(3);
    expect(await tp.forEpoch(CID, 1)).toBeNull();
    expect(await tp.forEpoch(CID, 2)).toBeNull();
    // the client keeps its own history
    const mine = await w.clientRings.forEpoch(CID, 1);
    expect(await openNote(w, mine!, old)).toBe('before the break');

    // a reset inside the NEW period wraps epoch 3 only (not 1 or 2)
    await w.fs.update(`conversations/${CID}`, { rotateDue: true });
    expect((await w.clientRings.current(CID)).epoch).toBe(4);
    await settle(w);
    expect(w.fs.keys(`conversations/${CID}/keyring/`)).toEqual([`conversations/${CID}/keyring/3`]);
  });

  it('trainer key change: the client re-wraps current AND past epochs for the new key', async () => {
    const w = await makeWorld();
    const t1 = await epoch1(w);
    const note = await sealNote(w, t1, 'plan notes');
    await w.fs.update(`conversations/${CID}`, { rotateDue: true });
    await w.clientRings.current(CID);
    await settle(w);
    const before = (await w.fs.get(`conversations/${CID}/keyring/1`))!.ck as { fp: string };

    const rec2 = await w.rotateCoachKey();
    await w.fs.update(`conversations/${CID}`, { keyStale: true }); // onCoachKeyChanged
    // the trainer with the NEW key cannot open anything yet
    expect(await w.trainerProvider(rec2).forEpoch(CID, 1)).toBeNull();
    const cur = await w.clientRings.current(CID); // client device re-wraps
    expect(cur.epoch).toBe(2);
    await settle(w);
    const after = (await w.fs.get(`conversations/${CID}/keyring/1`))!.ck as { fp: string };
    expect(after.fp).not.toBe(before.fp);
    const tp = w.trainerProvider(rec2);
    expect((await tp.current(CID)).epoch).toBe(2);
    expect(await openNote(w, (await tp.forEpoch(CID, 1))!, note)).toBe('plan notes');
    // the OLD key can no longer open the past epoch (its wrap was replaced)
    expect(await w.trainerProvider(w.rec).forEpoch(CID, 1)).toBeNull();
  });

  it('a different trainer is a different conversation: the old trainer id gets nothing', async () => {
    const w = await makeWorld();
    await epoch1(w);
    await w.fs.update(`conversations/${CID}`, { rotateDue: true });
    await w.clientRings.current(CID);
    await settle(w);
    // the same device now acts as another coach uid reading the same cid (it is not the conversation's trainer)
    const stranger = (await import('./keyRing')).createRingProvider({
      fs: w.fs,
      vault: w.tv,
      uid: 'trainer-2',
      side: 'trainer',
      signing: async () => null,
      loadOwnCoachKey: async () => w.rec,
    });
    expect(await stranger.forEpoch(CID, 2)).toBeNull();
    expect(await stranger.forEpoch(CID, 1)).toBeNull();
    // the ring rows exist (they are wraps for the real trainer's key) but the stranger cannot open any of them
    expect((await stranger.past(CID, 2)).size).toBe(0);
  });

  it('the ring book exposes past rings (what notes and schedule open history with)', async () => {
    const w = await makeWorld();
    await w.publishKey();
    w.trainerBook.start();
    await w.trainerBook.ready();
    await w.fs.update(`conversations/${CID}`, { rotateDue: true });
    await w.clientRings.current(CID);
    await settle(w);
    const book = createRingBook({ fs: w.fs, rings: w.trainerProvider(), uid: T, side: 'trainer' });
    book.start();
    await book.ready();
    expect(book.ringFor(C)?.epoch).toBe(2);
    // past rings arrive shortly after the first paint
    const t0 = Date.now();
    while (!book.ringForEpoch(C, 1) && Date.now() - t0 < 1500)
      await new Promise((r) => setTimeout(r, 5));
    expect(book.ringForEpoch(C, 1)?.epoch).toBe(1);
    expect(book.ringForEpoch(C, 2)?.epoch).toBe(2);
    expect(book.ringForEpoch(C, 5)).toBeNull();
  });
});
