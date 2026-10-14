/**
 * Iter21: a member who already has a trainer in the app (the legacy `users.trainerId` card) must see the REAL relationship
 * screens, not "No trainer yet". The real client port asks the server once to adopt the pointer (the same cut as the admin
 * backfill: mode app, every consent level off), the key exchange runs, and the link carries `migrated` until the member
 * chooses what to share. Real adapters + the real server services + firestore.rules, one shared store.
 */
import { describe, expect, it } from 'vitest';
import { C, T, makeServer, settle } from './parity/harness';
import { makeClient, makeTrainer } from './parity/sides';
import type { ClientSnapshot } from '../../client/data/types';

async function snapshotAfter(
  cl: Awaited<ReturnType<typeof makeClient>>,
  ms = 120,
): Promise<ClientSnapshot | null> {
  let v: ClientSnapshot | null = null;
  const off = cl.port.subscribe(
    (s) => (v = s),
    () => undefined,
  );
  await settle(ms);
  off();
  return v;
}

describe('legacy trainer adoption (client side)', () => {
  it('a legacy users.trainerId opens the real link: adopted once, nothing shared, flagged as migrated', async () => {
    const s = await makeServer();
    await makeTrainer(s);
    const cl = await makeClient(s);
    await s.kv.merge(`users/${C}`, { trainerId: T });

    const snap = await snapshotAfter(cl);
    expect(snap?.link.state).not.toBe('none');
    expect(snap?.link.trainer?.id).toBe(T);
    expect(snap?.link.trainer?.name).toContain('Iryna');
    expect(snap?.link.migrated).toBe(true);
    expect(Object.values(snap!.link.grants).every((l) => l === 'off' || l === 'full')).toBe(true);
    expect(snap!.link.grants.sets).toBe('off');
    expect(snap!.link.grants.totals).toBe('off');
    expect(cl.keyExchanges).toContain(T);
    const coaching = await s.fs.get(`coaching/${C}`);
    expect(coaching?.migratedFrom).toBe('legacy-trainerId');
    expect(coaching?.mode).toBe('app');

    // a second subscription in the same session does not ask again
    await snapshotAfter(cl);
    expect(s.fs.calls.filter((c) => c.name === 'coachAdoptLegacy')).toHaveLength(1);
  });

  it('without a legacy pointer the member is simply "no trainer" (one cheap call, nothing created)', async () => {
    const s = await makeServer();
    await makeTrainer(s);
    const cl = await makeClient(s);
    const snap = await snapshotAfter(cl);
    expect(snap?.link.state).toBe('none');
    expect(snap?.link.migrated).toBeUndefined();
    expect(await s.fs.get(`coaching/${C}`)).toBeNull();
  });

  it('a relationship the member already chose levels for is not flagged as migrated', async () => {
    const s = await makeServer();
    await makeTrainer(s);
    const cl = await makeClient(s);
    await s.kv.merge(`users/${C}`, { trainerId: T });
    await snapshotAfter(cl);
    await cl.port.setLevel('totals', 'full');
    await settle(80);
    const snap = await snapshotAfter(cl);
    expect(snap?.link.migrated).toBeUndefined();
    expect(snap?.link.grants.totals).toBe('full');
  });
});
