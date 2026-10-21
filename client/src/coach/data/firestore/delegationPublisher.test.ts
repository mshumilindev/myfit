/**
 * The client device delegates the schedule and request keys to the trainer team's managers (SPO-196, ADR 005):
 * real crypto, in-memory store. The manager opens the delegation with their own key; chat is out of reach.
 */
import { describe, expect, it } from 'vitest';
import { fingerprint } from '../../../vaultGrants';
import { createCoachKey } from '../../../vaultShare';
import { readyVault } from '../../../testVault';
import { openDelegation, type Delegation } from '../../../coachCrypto/delegation';
import { createDelegationPublisher } from './delegationPublisher';
import { createServerSigningLoader } from './trust';
import { C, CID, makeWorld, type TestWorld } from './testWorld';

const M1 = 'manager-1';
const M2 = 'manager-2';

async function addManager(w: TestWorld, uid: string, signed = true) {
  const v = await readyVault();
  const m = v.materialOrNull()!;
  const rec = await createCoachKey(m.key, m.salt);
  await w.publishPeerKey(uid, rec.pub, signed);
  return { v, rec };
}

async function setup(managers: string[] = [M1]) {
  const w = await makeWorld();
  await w.publishKey();
  w.fs.onCall('teamManagersForClient', () => ({ managers }));
  const pub = createDelegationPublisher({
    fs: w.cfs,
    uid: C,
    rings: w.clientRings,
    signing: createServerSigningLoader(w.fs),
  });
  return { w, pub };
}

describe('delegation publisher (client device)', () => {
  it('publishes the schedule and request keys for an active manager with a signed key; the manager opens them, chat stays closed', async () => {
    const { w, pub } = await setup();
    const mgr = await addManager(w, M1);
    const r = await pub.sync(CID);
    expect(r).toEqual({ ready: [M1], pending: [], removed: [] });
    const doc = (await w.fs.get(`conversations/${CID}/delegations/${M1}`)) as unknown as Delegation;
    expect(doc.epoch).toBe(1);
    expect(doc.fp).toBe(await fingerprint(mgr.rec.pub));
    // the shape firestore.rules `delegations` + `validCk` demand: only these fields, fixed sizes, epoch and fp repeated
    expect(Object.keys(doc).sort()).toEqual(['at', 'epoch', 'fp', 'requests', 'schedule']);
    expect(doc.fp).toHaveLength(16);
    for (const w of [doc.schedule, doc.requests]) {
      expect(Object.keys(w).sort()).toEqual(['ct', 'epk', 'epoch', 'fp', 'iv', 'v']);
      expect(w.iv).toHaveLength(16);
      expect(w.ct).toHaveLength(64);
      expect(w.epoch).toBe(doc.epoch);
      expect(w.fp).toBe(doc.fp);
    }

    const ring = await openDelegation(doc, CID, mgr.rec, mgr.v.materialOrNull()!.key);
    await expect(ring.key('schedule')).resolves.toBeTruthy();
    await expect(ring.key('requests')).resolves.toBeTruthy();
    for (const p of ['chat', 'notes', 'plan', 'live'] as const)
      await expect(ring.key(p)).rejects.toThrow('not-delegated');
  });

  it('is idempotent: a second run writes nothing', async () => {
    const { w, pub } = await setup();
    await addManager(w, M1);
    await pub.sync(CID);
    const before = JSON.stringify(await w.fs.get(`conversations/${CID}/delegations/${M1}`));
    const r = await pub.sync(CID);
    expect(r.ready).toEqual([M1]);
    expect(JSON.stringify(await w.fs.get(`conversations/${CID}/delegations/${M1}`))).toBe(before);
  });

  it('a manager who has not opened the app (no signed key) is pending, not an error', async () => {
    const { w, pub } = await setup([M1, M2]);
    await addManager(w, M1);
    const r = await pub.sync(CID);
    expect(r).toEqual({ ready: [M1], pending: [M2], removed: [] });
    expect(w.fs.has(`conversations/${CID}/delegations/${M2}`)).toBe(false);
  });

  it('an unsigned key is never trusted (key substitution)', async () => {
    const { w, pub } = await setup();
    await addManager(w, M1, false);
    const r = await pub.sync(CID);
    expect(r).toEqual({ ready: [], pending: [M1], removed: [] });
  });

  it('a manager who left the team loses the document; the remaining one keeps theirs', async () => {
    const w = await makeWorld();
    await w.publishKey();
    let managers = [M1, M2];
    w.fs.onCall('teamManagersForClient', () => ({ managers }));
    const pub = createDelegationPublisher({
      fs: w.cfs,
      uid: C,
      rings: w.clientRings,
      signing: createServerSigningLoader(w.fs),
    });
    await addManager(w, M1);
    await addManager(w, M2);
    await pub.sync(CID);
    managers = [M2];
    const r = await pub.sync(CID);
    expect(r).toEqual({ ready: [M2], pending: [], removed: [M1] });
    expect(w.fs.has(`conversations/${CID}/delegations/${M1}`)).toBe(false);
    expect(w.fs.has(`conversations/${CID}/delegations/${M2}`)).toBe(true);
  });

  it('a new epoch (rotation) is delegated again; the old wrap is replaced', async () => {
    const { w, pub } = await setup();
    const mgr = await addManager(w, M1);
    await pub.sync(CID);
    await w.fs.update(`conversations/${CID}`, { rotateDue: true });
    await w.clientRings.current(CID); // the client rotates to epoch 2
    await w.fs.update(`conversations/${CID}`, { rotateDue: false, keyStale: false });
    await pub.sync(CID);
    const doc = (await w.fs.get(`conversations/${CID}/delegations/${M1}`)) as unknown as Delegation;
    expect(doc.epoch).toBe(2);
    const ring = await openDelegation(doc, CID, mgr.rec, mgr.v.materialOrNull()!.key);
    expect(ring.epoch).toBe(2);
  });

  it('does nothing without a published key or for a conversation that is not mine', async () => {
    const w = await makeWorld(); // no publishKey
    w.fs.onCall('teamManagersForClient', () => ({ managers: [M1] }));
    const pub = createDelegationPublisher({
      fs: w.cfs,
      uid: C,
      rings: w.clientRings,
      signing: createServerSigningLoader(w.fs),
    });
    expect(await pub.sync(CID)).toEqual({ ready: [], pending: [], removed: [] });
    const other = createDelegationPublisher({
      fs: w.cfs,
      uid: 'someone-else',
      rings: w.clientRings,
      signing: createServerSigningLoader(w.fs),
    });
    await w.publishKey();
    expect(await other.sync(CID)).toEqual({ ready: [], pending: [], removed: [] });
  });
});

describe('keepDelegated', () => {
  it('runs once for a held ring, not again within the gap unless the epoch moved, and stops on cleanup', async () => {
    const { keepDelegated } = await import('./delegationPublisher');
    const calls: string[] = [];
    const pub = {
      sync: async (cid: string) => (calls.push(cid), { ready: [], pending: [], removed: [] }),
    };
    let epoch = 1;
    let t = 0;
    const subs = new Set<() => void>();
    const book = {
      entries: () => [{ cid: 'c1', ring: { epoch } }] as never,
      watch: (f: () => void) => (subs.add(f), () => void subs.delete(f)),
    };
    const stop = keepDelegated(book, pub, { everyMs: 1e9, minGapMs: 1000, now: () => t });
    expect(calls).toEqual(['c1']);
    t = 500;
    subs.forEach((f) => f());
    expect(calls).toHaveLength(1);
    epoch = 2;
    subs.forEach((f) => f());
    expect(calls).toHaveLength(2);
    t = 5000;
    subs.forEach((f) => f());
    expect(calls).toHaveLength(3);
    stop();
    expect(subs.size).toBe(0);
  });

  it("the service worker's silent sync push runs it at once, past the gap; cleanup stops listening", async () => {
    const { keepDelegated } = await import('./delegationPublisher');
    const sw = new EventTarget();
    Object.defineProperty(navigator, 'serviceWorker', { value: sw, configurable: true });
    try {
      const calls: string[] = [];
      const pub = {
        sync: async (cid: string) => (calls.push(cid), { ready: [], pending: [], removed: [] }),
      };
      const book = {
        entries: () => [{ cid: 'c1', ring: { epoch: 1 } }] as never,
        watch: () => () => undefined,
      };
      const stop = keepDelegated(book, pub, { everyMs: 1e9, minGapMs: 1e9, now: () => 0 });
      expect(calls).toHaveLength(1);
      sw.dispatchEvent(new MessageEvent('message', { data: { type: 'something-else' } }));
      expect(calls).toHaveLength(1);
      sw.dispatchEvent(new MessageEvent('message', { data: { type: 'coach-sync' } }));
      expect(calls).toHaveLength(2);
      stop();
      sw.dispatchEvent(new MessageEvent('message', { data: { type: 'coach-sync' } }));
      expect(calls).toHaveLength(2);
    } finally {
      Reflect.deleteProperty(navigator, 'serviceWorker');
    }
  });
});
