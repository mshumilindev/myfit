/**
 * The manager's side of key delegation (SPO-196, ADR 005): real crypto, in-memory store. The client device delegates,
 * the manager's book opens the delegation, reads and writes sealed schedules, and cannot reach chat; a removed manager
 * or a client who has not delegated yet gets no ring.
 */
import { describe, expect, it } from 'vitest';
import { createCoachKey } from '../../../vaultShare';
import { readyVault } from '../../../testVault';
import { createDelegationPublisher } from './delegationPublisher';
import { createManagerBook, createManagerRings } from './managerRings';
import { createServerSigningLoader } from './trust';
import { C, CID, NOW, T, makeWorld } from './testWorld';

const M = 'manager-1';
const row = { clientId: C, cid: CID, trainerId: T, trainerName: 'Olena', name: 'Client One' };

async function setup(delegate = true) {
  const w = await makeWorld();
  await w.publishKey();
  const v = await readyVault();
  const mm = v.materialOrNull()!;
  const rec = await createCoachKey(mm.key, mm.salt);
  await w.publishPeerKey(M, rec.pub);
  w.fs.onCall('teamManagersForClient', () => ({ managers: [M] }));
  w.fs.onCall('teamClients', () => ({ clients: [row] }));
  const publisher = createDelegationPublisher({
    fs: w.cfs,
    uid: C,
    rings: w.clientRings,
    signing: createServerSigningLoader(w.fs),
  });
  if (delegate) await publisher.sync(CID);
  const rings = createManagerRings({
    fs: w.fs,
    vault: v,
    uid: M,
    loadOwnCoachKey: async () => rec,
  });
  const book = createManagerBook({ fs: w.fs, rings, uid: M, everyMs: 1e9 });
  return { w, v, rec, publisher, rings, book };
}

const sched = {
  clientId: C,
  rev: 1,
  patterns: [],
  oneOffs: [],
  exceptions: [],
  cancelled: [],
};

describe('manager book', () => {
  it('lists the team clients with a ring once the client device delegated; the ring seals and opens schedules, chat stays closed', async () => {
    const s = await setup();
    const stop = s.book.start();
    await s.book.ready();
    expect(s.book.clients()).toEqual([{ ...row, ready: true }]);
    const ring = s.book.ringFor(C)!;
    expect(ring.epoch).toBe(1);
    expect(s.book.cidOf(C)).toBe(CID);
    expect(s.book.ringForEpoch(C, 1)).toBe(ring);
    expect(s.book.ringForEpoch(C, 2)).toBeNull();
    await expect(ring.key('chat')).rejects.toThrow('not-delegated');

    // the manager writes a schedule (author = the client's trainer), the client device and the trainer's key read it
    const { sealSchedule, openSchedule } = await import('../../schedule/scheduleCodec');
    const raw = await sealSchedule({ vault: s.v, ring }, sched, T, NOW);
    const clientRing = (await s.w.clientRings.forEpoch(CID, 1))!;
    const back = await openSchedule({ vault: s.w.cv, ring: clientRing }, C, raw);
    expect(back.rev).toBe(1);
    // and the other way: what the client wrote, the manager reads
    const fromClient = await sealSchedule(
      { vault: s.w.cv, ring: clientRing },
      { ...sched, rev: 2 },
      T,
      NOW,
    );
    expect((await openSchedule({ vault: s.v, ring }, C, fromClient)).rev).toBe(2);
    stop();
  });

  it('a client who has not delegated yet stays in the list as waiting; the ring appears when the device publishes', async () => {
    const s = await setup(false);
    const stop = s.book.start();
    await s.book.ready();
    expect(s.book.clients()).toEqual([{ ...row, ready: false }]);
    expect(s.book.ringFor(C)).toBeNull();
    await expect(s.rings.current(CID)).rejects.toThrow('delegation-pending');
    let seen = 0;
    s.book.watch(() => seen++);
    await s.publisher.sync(CID);
    await new Promise((r) => setTimeout(r, 20));
    expect(s.book.clients()[0].ready).toBe(true);
    expect(seen).toBeGreaterThan(0);
    stop();
  });

  it('a removed manager loses the ring as soon as the document is deleted', async () => {
    const s = await setup();
    const stop = s.book.start();
    await s.book.ready();
    expect(s.book.ringFor(C)).not.toBeNull();
    await s.w.fs.del(`conversations/${CID}/delegations/${M}`);
    await new Promise((r) => setTimeout(r, 20));
    expect(s.book.ringFor(C)).toBeNull();
    expect(s.book.clients()[0].ready).toBe(false);
    stop();
  });

  it('another manager cannot open this delegation; a document of another epoch has no ring', async () => {
    const s = await setup();
    const doc = (await s.w.fs.get(`conversations/${CID}/delegations/${M}`))!;
    const v2 = await readyVault();
    const m2 = v2.materialOrNull()!;
    const rec2 = await createCoachKey(m2.key, m2.salt);
    const other = createManagerRings({
      fs: s.w.fs,
      vault: v2,
      uid: 'manager-2',
      loadOwnCoachKey: async () => rec2,
    });
    expect(await other.fromDelegation(CID, doc)).toBeNull();
    expect(await s.rings.forEpoch(CID, 2)).toBeNull();
    expect((await s.rings.forEpoch(CID, 1))?.epoch).toBe(1);
    expect(await s.rings.past()).toEqual(new Map());
  });

  it('plaintext never reaches the store: the delegation holds wraps only', async () => {
    const s = await setup();
    const dump = s.w.fs.dump();
    expect(dump).not.toContain('Client One');
    expect(dump).toContain('delegations');
  });
});
