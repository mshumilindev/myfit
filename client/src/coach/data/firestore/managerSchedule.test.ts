/**
 * A team manager edits the schedule with delegated keys and the trainer reads the result (and the other way round):
 * the manager's book, the sealed schedule port and the Firestore store over one in-memory store, real crypto.
 */
import { describe, expect, it } from 'vitest';
import { createCoachKey } from '../../../vaultShare';
import { readyVault } from '../../../testVault';
import { createSealedSchedulePort } from '../../schedule/sealedPort';
import type { ScheduleDoc } from '../../schedule/types';
import { createDelegationPublisher } from './delegationPublisher';
import { createManagerBook, createManagerRings } from './managerRings';
import { createFirestoreScheduleStore } from './scheduleDocStore';
import { createServerSigningLoader } from './trust';
import { C, CID, NOW, T, makeWorld } from './testWorld';

const M = 'manager-1';
const doc = (rev: number, cancelled: string[] = []): ScheduleDoc => ({
  clientId: C,
  rev,
  patterns: [],
  oneOffs: [],
  exceptions: [],
  cancelled,
});

async function setup() {
  const w = await makeWorld();
  await w.publishKey();
  const v = await readyVault();
  const mm = v.materialOrNull()!;
  const rec = await createCoachKey(mm.key, mm.salt);
  await w.publishPeerKey(M, rec.pub);
  w.fs.onCall('teamManagersForClient', () => ({ managers: [M] }));
  w.fs.onCall('teamClients', () => ({
    clients: [{ clientId: C, cid: CID, trainerId: T, trainerName: 'Olena', name: 'Client One' }],
  }));
  await createDelegationPublisher({
    fs: w.cfs,
    uid: C,
    rings: w.clientRings,
    signing: createServerSigningLoader(w.fs),
  }).sync(CID);
  const rings = createManagerRings({
    fs: w.fs,
    vault: v,
    uid: M,
    loadOwnCoachKey: async () => rec,
  });
  const mbook = createManagerBook({ fs: w.fs, rings, uid: M, everyMs: 1e9 });
  mbook.start();
  await mbook.ready();
  const trainerOf = (id: string) => mbook.clients().find((c) => c.clientId === id)?.trainerId ?? '';
  const manager = createSealedSchedulePort({
    store: createFirestoreScheduleStore({ fs: w.fs, book: mbook }),
    vault: v,
    ringFor: mbook.ringFor,
    ringForEpoch: mbook.ringForEpoch,
    uid: trainerOf,
    now: () => NOW,
  });
  w.trainerBook.start();
  await w.trainerBook.ready();
  const trainer = createSealedSchedulePort({
    store: createFirestoreScheduleStore({ fs: w.fs, book: w.trainerBook }),
    vault: w.tv,
    ringFor: w.trainerBook.ringFor,
    ringForEpoch: w.trainerBook.ringForEpoch,
    uid: T,
    now: () => NOW,
  });
  return { w, manager, trainer, mbook };
}

const latest = (port: ReturnType<typeof createSealedSchedulePort>) =>
  new Promise<ScheduleDoc | undefined>((res) => {
    const off = port.subscribe(
      (d) => {
        queueMicrotask(() => off());
        res(d.docs.find((x) => x.clientId === C));
      },
      () => res(undefined),
    );
  });

describe('manager and trainer share one schedule', () => {
  it('the manager saves under the client’s trainer; the trainer reads it and saves on top; the manager sees that', async () => {
    const s = await setup();
    const saved = await s.manager.saveDoc(doc(0, ['mon-1']));
    expect(saved.rev).toBe(1);
    const stored = (await s.w.fs.get(`schedules/${C}`))!;
    expect(stored.trainerId).toBe(T); // the rules pin it to the coaching's trainer
    expect(JSON.stringify(stored)).not.toContain('mon-1'); // sealed

    const seenByTrainer = await latest(s.trainer);
    expect(seenByTrainer?.cancelled).toEqual(['mon-1']);
    await s.trainer.saveDoc({ ...seenByTrainer!, cancelled: ['mon-1', 'tue-2'] });
    const seenByManager = await latest(s.manager);
    expect(seenByManager?.rev).toBe(2);
    expect(seenByManager?.cancelled).toEqual(['mon-1', 'tue-2']);
  });

  it('a stale revision conflicts for the manager too', async () => {
    const s = await setup();
    await s.manager.saveDoc(doc(0));
    await expect(s.manager.saveDoc(doc(0))).rejects.toMatchObject({ code: 'conflict' });
  });

  it('without a delegation the manager cannot write (never in plaintext)', async () => {
    const s = await setup();
    await s.w.fs.del(`conversations/${CID}/delegations/${M}`);
    await new Promise((r) => setTimeout(r, 20));
    await expect(s.manager.saveDoc(doc(0))).rejects.toMatchObject({ code: 'vault-locked' });
    expect(s.w.fs.has(`schedules/${C}`)).toBe(false);
  });

  it('offline: the manager has the same behaviour as the trainer (a failed write changes nothing, a retry saves once)', async () => {
    const s = await setup();
    const real = s.w.fs.transact.bind(s.w.fs);
    let offline = true;
    s.w.fs.transact = ((fn: Parameters<typeof real>[0]) =>
      offline ? Promise.reject(new Error('offline')) : real(fn)) as typeof s.w.fs.transact;
    await expect(s.manager.saveDoc(doc(0, ['mon-1']))).rejects.toThrow('offline');
    expect(s.w.fs.has(`schedules/${C}`)).toBe(false);
    await expect(s.trainer.saveDoc(doc(0, ['mon-1']))).rejects.toThrow('offline'); // same for the trainer
    offline = false;
    const saved = await s.manager.saveDoc(doc(0, ['mon-1']));
    expect(saved.rev).toBe(1);
  });
});
