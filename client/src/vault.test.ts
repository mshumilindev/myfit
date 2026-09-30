// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createVault, type VaultHeader, type VaultPorts } from './vault';
import { OPEN_FIELDS, isSealed, sealDoc, unsealDoc } from './encryptedDoc';

function ports() {
  let header: VaultHeader | null = null;
  let cached: { key: CryptoKey; salt: string } | null = null;
  const p: VaultPorts = {
    remote: {
      load: async () => header,
      save: async (h) => void (header = h),
    },
    cache: {
      get: async () => cached,
      set: async (v) => void (cached = v),
      clear: async () => void (cached = null),
    },
  };
  return { p, wipeCache: () => (cached = null), header: () => header };
}

describe('vault lifecycle', () => {
  it('unset → create → ready, and a fresh start on the same device is ready', async () => {
    const { p } = ports();
    const v = createVault(p);
    expect(await v.init()).toBe('unset');
    const rk = await v.create();
    expect(rk).toMatch(/^([0-9A-Z]{4}-){7}[0-9A-Z]{4}$/);
    expect(v.status()).toBe('ready');
    expect(await createVault(p).init()).toBe('ready');
  });

  it('a new device is locked until the right recovery key is entered', async () => {
    const { p, wipeCache } = ports();
    const first = createVault(p);
    await first.init();
    const rk = await first.create();
    wipeCache();
    const second = createVault(p);
    expect(await second.init()).toBe('locked');
    expect(await second.unlock('not a key')).toBe(false);
    expect(await second.unlock('0000-0000-0000-0000-0000-0000-0000-0000')).toBe(false);
    expect(second.status()).toBe('locked');
    expect(await second.unlock(rk.toLowerCase())).toBe(true);
    expect(second.status()).toBe('ready');
  });

  it('data sealed on one device opens on another after unlock', async () => {
    const { p, wipeCache } = ports();
    const a = createVault(p);
    await a.init();
    const rk = await a.create();
    const { key, salt } = a.material();
    const sealed = await sealDoc(
      'injuries',
      { id: 'i1', updatedAt: 5, name: 'Knee', note: 'x' },
      key,
      salt,
    );
    wipeCache();
    const b = createVault(p);
    await b.init();
    await b.unlock(rk);
    expect(await unsealDoc(sealed, b.material().key)).toEqual({
      id: 'i1',
      updatedAt: 5,
      name: 'Knee',
      note: 'x',
    });
  });

  it('lock forgets the key; material() throws', async () => {
    const { p } = ports();
    const v = createVault(p);
    await v.init();
    await v.create();
    await v.lock();
    expect(v.status()).toBe('locked');
    expect(() => v.material()).toThrow('vault-locked');
  });
});

describe('sealed documents', () => {
  it('keeps only open fields readable and leaks nothing else', async () => {
    const { p } = ports();
    const v = createVault(p);
    await v.init();
    await v.create();
    const { key, salt } = v.material();
    const w = {
      id: 'w1',
      startedAt: 1000,
      finishedAt: null,
      updatedAt: 2000,
      gymId: 'g1',
      dayName: 'Push day',
      exercises: [{ name: 'Barbell Squat', sets: [{ reps: 5, weight: 140 }] }],
    };
    const s = await sealDoc('workouts', w, key, salt);
    expect(isSealed(s)).toBe(true);
    expect(s.startedAt).toBe(1000);
    expect(s.finishedAt).toBeNull();
    const text = JSON.stringify(s);
    for (const secret of ['Barbell Squat', 'Push day', 'g1', '140'])
      expect(text).not.toContain(secret);
    expect(await unsealDoc(s, key)).toEqual(w);
  });

  it('drops undefined fields (Firestore rejects them)', async () => {
    const { p } = ports();
    const v = createVault(p);
    await v.init();
    await v.create();
    const { key, salt } = v.material();
    const s = await sealDoc(
      'gyms',
      { id: 'g', updatedAt: 1, name: 'Home', city: undefined },
      key,
      salt,
    );
    expect(await unsealDoc(s, key)).toEqual({ id: 'g', updatedAt: 1, name: 'Home' });
  });

  it('legacy documents pass through, even while locked', async () => {
    const legacy = { id: 'g', name: 'Home', updatedAt: 1 };
    expect(await unsealDoc(legacy, null)).toEqual(legacy);
  });

  it('a sealed document cannot be read while locked', async () => {
    const { p } = ports();
    const v = createVault(p);
    await v.init();
    await v.create();
    const { key, salt } = v.material();
    const s = await sealDoc('gyms', { id: 'g', updatedAt: 1, name: 'Home' }, key, salt);
    await expect(unsealDoc(s, null)).rejects.toThrow('vault-locked');
  });

  it('open-field lists never include obviously private fields', () => {
    const banned = [
      'name',
      'note',
      'notes',
      'weight',
      'exercises',
      'kind',
      'gymId',
      'dayName',
      'mood',
    ];
    for (const [c, fields] of Object.entries(OPEN_FIELDS))
      for (const f of fields)
        if (!(c === 'sleeps' && f === 'kind')) expect(banned).not.toContain(f);
  });
});
