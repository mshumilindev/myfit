// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createVault, type VaultHeader } from './vault';
import { isSealed, type SealedCollection } from './encryptedDoc';
import {
  migrateAll,
  migrateCollection,
  rollbackCollection,
  type MigratePorts,
} from './vaultMigrate';

async function readyVault() {
  let h: VaultHeader | null = null;
  let c: { key: CryptoKey; salt: string } | null = null;
  const v = createVault({
    remote: { load: async () => h, save: async (x) => void (h = x) },
    cache: {
      get: async () => c,
      set: async (x) => void (c = x),
      clear: async () => void (c = null),
    },
  });
  await v.init();
  await v.create();
  return v;
}

function store(seed: Partial<Record<SealedCollection, Record<string, Record<string, unknown>>>>) {
  const data = new Map<string, Record<string, unknown>>();
  for (const [c, docs] of Object.entries(seed))
    for (const [id, d] of Object.entries(docs)) data.set(`${c}/${id}`, d);
  const ports: MigratePorts = {
    list: async (c) =>
      [...data.entries()]
        .filter(([k]) => k.startsWith(`${c}/`))
        .map(([k, d]) => ({ id: k.split('/')[1], data: d })),
    write: async (c, id, d) => void data.set(`${c}/${id}`, d),
    enrich: (c, d) => (c === 'workouts' ? { ...d, stats: { volumeKg: 1, sets: 1 } } : d),
  };
  return { data, ports };
}

describe('migration', () => {
  it('seals plaintext in place, keeps open fields, returns a backup', async () => {
    const v = await readyVault();
    const { data, ports } = store({
      workouts: {
        w1: { id: 'w1', startedAt: 1, finishedAt: null, exercises: [{ name: 'Squat' }] },
      },
      gyms: { g1: { id: 'g1', name: 'Home' } },
    });
    const r = await migrateCollection('workouts', v, ports);
    expect(r).toMatchObject({ migrated: 1, alreadySealed: 0, failed: [] });
    expect(r.backup[0].data.exercises).toBeDefined();
    const stored = data.get('workouts/w1')!;
    expect(isSealed(stored)).toBe(true);
    expect(stored.startedAt).toBe(1);
    expect(stored.stats).toEqual({ volumeKg: 1, sets: 1 });
    expect(JSON.stringify(stored)).not.toContain('Squat');
    expect(isSealed(data.get('gyms/g1')!)).toBe(false); // other collections untouched
  });

  it('is idempotent: a second run migrates nothing', async () => {
    const v = await readyVault();
    const { ports } = store({ injuries: { i1: { id: 'i1', name: 'Knee' } } });
    await migrateCollection('injuries', v, ports);
    const again = await migrateCollection('injuries', v, ports);
    expect(again).toMatchObject({ migrated: 0, alreadySealed: 1 });
  });

  it('refuses while the vault is locked', async () => {
    const v = createVault({
      remote: { load: async () => null, save: async () => undefined },
      cache: { get: async () => null, set: async () => undefined, clear: async () => undefined },
    });
    await v.init();
    await expect(migrateCollection('gyms', v, store({}).ports)).rejects.toThrow('vault-locked');
  });

  it('a failing write is reported and nothing is lost', async () => {
    const v = await readyVault();
    const { data, ports } = store({
      gyms: { g1: { id: 'g1', name: 'A' }, g2: { id: 'g2', name: 'B' } },
    });
    const write = ports.write;
    ports.write = async (c, id, d) => {
      if (id === 'g2') throw new Error('offline');
      return write(c, id, d);
    };
    const r = await migrateCollection('gyms', v, ports);
    expect(r.migrated).toBe(1);
    expect(r.failed).toEqual([{ id: 'g2', reason: 'offline' }]);
    expect(data.get('gyms/g2')).toEqual({ id: 'g2', name: 'B' });
  });

  it('rollback restores the plaintext', async () => {
    const v = await readyVault();
    const { data, ports } = store({ gyms: { g1: { id: 'g1', name: 'Home', city: 'Kyiv' } } });
    const r = await migrateCollection('gyms', v, ports);
    expect(isSealed(data.get('gyms/g1')!)).toBe(true);
    expect(await rollbackCollection('gyms', r.backup, ports)).toBe(1);
    expect(data.get('gyms/g1')).toEqual({ id: 'g1', name: 'Home', city: 'Kyiv' });
  });

  it('migrateAll walks every collection and reports progress', async () => {
    const v = await readyVault();
    const { ports } = store({
      body: { body: { updatedAt: 1, weights: [{ kg: 80 }] } },
      sleeps: { s1: { id: 's1', date: 'd', bedtime: 1, wake: 2, notes: 'x' } },
    });
    const seen: string[] = [];
    const { ok, results } = await migrateAll(
      v,
      ports,
      (c) => void (seen.includes(c) || seen.push(c)),
    );
    expect(ok).toBe(true);
    expect(seen).toEqual([
      'workouts',
      'gyms',
      'restPeriods',
      'injuries',
      'activities',
      'sleeps',
      'body',
    ]);
    expect(results.find((r) => r.collection === 'body')!.migrated).toBe(1);
  });
});
