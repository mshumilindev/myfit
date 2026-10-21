/**
 * SPO-201 AC "the manager writes the schedule only with the delegated keys; marks reach the activity log": the REAL
 * `installFirestoreManager` over the in-memory store with real crypto (testWorld). Mark done / missed are schedule
 * saves, so they take the one write path: the sealed port with the manager's ring.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const local = vi.hoisted(() => ({
  current: null as null | import('../../../offline/sealedLocal').SealedLocal,
}));
vi.mock('../../chat/sealedLocal', async (orig) => {
  const actual = await orig<typeof import('../../chat/sealedLocal')>();
  return { ...actual, getSealedLocal: async () => local.current! };
});

import { createSealedLocal, memoryBackend } from '../../../offline/sealedLocal';
import { readyVault } from '../../../testVault';
import { createCoachKey } from '../../../vaultShare';
import { getSchedulePort } from '../../schedule/useSchedule';
import { emptyDoc, type ScheduleDoc } from '../../schedule/types';
import { createDelegationPublisher } from './delegationPublisher';
import { installFirestoreManager } from './install';
import { createServerSigningLoader } from './trust';
import { C, CID, T, makeWorld } from './testWorld';

const M = 'manager-1';
let stop: (() => void) | null = null;
beforeEach(() => vi.useRealTimers());
afterEach(() => {
  stop?.();
  stop = null;
});

async function setup(delegate = true) {
  const w = await makeWorld();
  await w.publishKey();
  const v = await readyVault();
  local.current = createSealedLocal({ vault: v, backend: memoryBackend() });
  const mm = v.materialOrNull()!;
  const rec = await createCoachKey(mm.key, mm.salt);
  await w.publishPeerKey(M, rec.pub);
  w.fs.onCall('teamManagersForClient', () => ({ managers: [M] }));
  w.fs.onCall('teamClients', () => ({
    clients: [{ clientId: C, cid: CID, trainerId: T, trainerName: 'Olena', name: 'Client One' }],
  }));
  w.fs.onCall('teamLogActivity', () => ({ ok: true }));
  if (delegate)
    await createDelegationPublisher({
      fs: w.cfs,
      uid: C,
      rings: w.clientRings,
      signing: createServerSigningLoader(w.fs),
    }).sync(CID);
  stop = installFirestoreManager({
    fs: w.fs,
    vault: v,
    manager: { id: M, name: 'Irina Melnyk' },
    loadOwnCoachKey: async () => rec,
  });
  const port = getSchedulePort();
  // the book reads the delegation once it is ready; wait for the client to be listed
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 10));
    if (!delegate || (await port.hydrate?.().then(() => true))) break;
  }
  return { w, port };
}

const marked = (status: 'done' | 'missed', rev = 0): ScheduleDoc => ({
  ...emptyDoc(C),
  rev,
  exceptions: [{ slotKey: 'slot-secret-1', status }],
});
const logged = (w: Awaited<ReturnType<typeof setup>>['w']) =>
  w.fs.calls.filter((c) => c.name === 'teamLogActivity').map((c) => c.data);

describe('manager schedule writes (installFirestoreManager)', () => {
  it('mark done and mark missed: sealed under the delegated key, pinned to the trainer, and logged by kind', async () => {
    const { w, port } = await setup();
    const a = await port.saveDoc(marked('done'));
    expect(a.rev).toBe(1);
    const stored = (await w.fs.get(`schedules/${C}`))!;
    expect(stored.trainerId).toBe(T);
    expect(JSON.stringify(stored)).not.toContain('slot-secret-1'); // no plaintext on the wire
    expect(JSON.stringify(stored)).not.toContain('done');
    await port.saveDoc(marked('missed', 1));
    await vi.waitFor(() =>
      expect(logged(w)).toEqual([
        { kind: 'session-done', clientId: C },
        { kind: 'session-missed', clientId: C },
      ]),
    );
  });

  it('a log call that fails (offline) never fails the write', async () => {
    const { w, port } = await setup();
    w.fs.onCall('teamLogActivity', () => {
      throw new Error('offline');
    });
    await expect(port.saveDoc(marked('done'))).resolves.toMatchObject({ rev: 1 });
    expect(w.fs.has(`schedules/${C}`)).toBe(true);
  });

  it('a client without a delegation: the write is refused, nothing is stored and nothing is logged', async () => {
    const { w, port } = await setup(false);
    await expect(port.saveDoc(marked('done'))).rejects.toMatchObject({ code: 'vault-locked' });
    expect(w.fs.has(`schedules/${C}`)).toBe(false);
    expect(logged(w)).toEqual([]);
  });
});
