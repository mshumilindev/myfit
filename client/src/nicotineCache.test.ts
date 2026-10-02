import { describe, expect, it } from 'vitest';
import { NICOTINE_ENC_KEY, NICOTINE_KEY, createNicotineCache } from './nicotineCache';
import { newNicotineProduct, emptyNicotineState } from './nicotine';
import { readyVault, unsetVault } from './testVault';
import type { NicotineState } from './types';

const mem = () => {
  const m = new Map<string, string>();
  return {
    m,
    storage: {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
    },
  };
};
const doc = (id: string, updatedAt: number): NicotineState => ({
  ...emptyNicotineState(),
  products: [newNicotineProduct('vape', id)],
  updatedAt,
});
const wait = () => new Promise((r) => setTimeout(r, 20));

describe('nicotineCache', () => {
  it('without a key: plaintext fallback, readable by load()', async () => {
    const { m, storage } = mem();
    const c = createNicotineCache({ vault: await unsetVault(), storage: () => storage });
    c.boot(c.load());
    c.persist(doc('a', 5));
    expect(JSON.parse(m.get(NICOTINE_KEY)!).products[0].id).toBe('a');
    expect(c.load().products[0].id).toBe('a');
  });

  it('with a key: sealed envelope, plaintext removed, round trips through hydrate', async () => {
    const vault = await readyVault();
    const { m, storage } = mem();
    m.set(NICOTINE_KEY, JSON.stringify(doc('old', 3))); // legacy plaintext from the no-key time
    const c = createNicotineCache({ vault, storage: () => storage });
    c.boot(c.load());
    const next = await c.hydrate(c.load());
    expect(next).toBeNull();
    await wait();
    expect(m.get(NICOTINE_KEY)).toBeUndefined();
    expect(m.get(NICOTINE_ENC_KEY)).toBeDefined();
    expect(m.get(NICOTINE_ENC_KEY)).not.toContain('vape');

    // A fresh boot (no plaintext) recovers the doc from the sealed copy.
    const c2 = createNicotineCache({ vault, storage: () => storage });
    c2.boot(c2.load());
    const got = await c2.hydrate(emptyNicotineState());
    expect(got?.products[0].id).toBe('old');
  });

  it('a Firestore answer that already arrived wins over the sealed copy; newer sealed wins otherwise', async () => {
    const vault = await readyVault();
    const { storage } = mem();
    const a = createNicotineCache({ vault, storage: () => storage });
    a.boot(emptyNicotineState());
    a.persist(doc('sealed', 10));
    await wait();

    const remoteWins = createNicotineCache({ vault, storage: () => storage });
    remoteWins.boot(emptyNicotineState());
    remoteWins.markRemote();
    expect(await remoteWins.hydrate(doc('remote', 1))).toBeNull();

    const newer = createNicotineCache({ vault, storage: () => storage });
    newer.boot(emptyNicotineState());
    expect((await newer.hydrate(doc('local', 1)))?.products[0].id).toBe('sealed');
    const older = createNicotineCache({ vault, storage: () => storage });
    older.boot(emptyNicotineState());
    expect(await older.hydrate(doc('local', 99))).toBeNull();
  });

  it('never keeps an unsaved (updatedAt 0) document, and clear() removes both copies', async () => {
    const vault = await readyVault();
    const { m, storage } = mem();
    const c = createNicotineCache({ vault, storage: () => storage });
    c.boot(emptyNicotineState());
    c.persist(emptyNicotineState());
    await wait();
    expect(m.size).toBe(0);
    c.persist(doc('x', 4));
    await wait();
    expect(m.size).toBe(1);
    c.clear();
    expect(m.size).toBe(0);
  });

  it('a sealed copy is not clobbered by stale plaintext while the key is missing', async () => {
    const vault = await readyVault();
    const { m, storage } = mem();
    const sealing = createNicotineCache({ vault, storage: () => storage });
    sealing.boot(emptyNicotineState());
    sealing.persist(doc('s', 9));
    await wait();
    const keyless = createNicotineCache({ vault: await unsetVault(), storage: () => storage });
    keyless.boot(keyless.load());
    keyless.persist(keyless.load());
    expect(m.get(NICOTINE_KEY)).toBeUndefined();
    expect(m.get(NICOTINE_ENC_KEY)).toBeDefined();
  });
});
