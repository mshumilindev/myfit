import { describe, expect, it } from 'vitest';
import { SUPPLEMENTS_ENC_KEY, SUPPLEMENTS_KEY, createSupplementsCache } from './supplementsCache';
import { newSupplementEntry, emptySupplementState } from './supplements';
import { readyVault, unsetVault } from './testVault';
import type { SupplementState } from './types';

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
const doc = (id: string, updatedAt: number): SupplementState => ({
  ...emptySupplementState(),
  entries: [newSupplementEntry('creatine', id, 1)],
  updatedAt,
});
const wait = () => new Promise((r) => setTimeout(r, 20));

describe('supplementsCache', () => {
  it('without a key: plaintext fallback, readable by load()', async () => {
    const { m, storage } = mem();
    const c = createSupplementsCache({ vault: await unsetVault(), storage: () => storage });
    c.boot(c.load());
    c.persist(doc('a', 5));
    expect(JSON.parse(m.get(SUPPLEMENTS_KEY)!).entries[0].id).toBe('a');
    expect(c.load().entries[0].id).toBe('a');
  });

  it('with a key: sealed envelope, plaintext removed, round trips through hydrate', async () => {
    const vault = await readyVault();
    const { m, storage } = mem();
    m.set(SUPPLEMENTS_KEY, JSON.stringify(doc('old', 3))); // legacy plaintext from the no-key time
    const c = createSupplementsCache({ vault, storage: () => storage });
    c.boot(c.load());
    const next = await c.hydrate(c.load());
    expect(next).toBeNull();
    await wait();
    expect(m.get(SUPPLEMENTS_KEY)).toBeUndefined();
    expect(m.get(SUPPLEMENTS_ENC_KEY)).toBeDefined();
    expect(m.get(SUPPLEMENTS_ENC_KEY)).not.toContain('creatine');

    // A fresh boot (no plaintext) recovers the doc from the sealed copy.
    const c2 = createSupplementsCache({ vault, storage: () => storage });
    c2.boot(c2.load());
    const got = await c2.hydrate(emptySupplementState());
    expect(got?.entries[0].id).toBe('old');
  });

  it('a Firestore answer that already arrived wins over the sealed copy; newer sealed wins otherwise', async () => {
    const vault = await readyVault();
    const { storage } = mem();
    const a = createSupplementsCache({ vault, storage: () => storage });
    a.boot(emptySupplementState());
    a.persist(doc('sealed', 10));
    await wait();

    const remoteWins = createSupplementsCache({ vault, storage: () => storage });
    remoteWins.boot(emptySupplementState());
    remoteWins.markRemote();
    expect(await remoteWins.hydrate(doc('remote', 1))).toBeNull();

    const newer = createSupplementsCache({ vault, storage: () => storage });
    newer.boot(emptySupplementState());
    expect((await newer.hydrate(doc('local', 1)))?.entries[0].id).toBe('sealed');
    const older = createSupplementsCache({ vault, storage: () => storage });
    older.boot(emptySupplementState());
    expect(await older.hydrate(doc('local', 99))).toBeNull();
  });

  it('never keeps an unsaved (updatedAt 0) document, and clear() removes both copies', async () => {
    const vault = await readyVault();
    const { m, storage } = mem();
    const c = createSupplementsCache({ vault, storage: () => storage });
    c.boot(emptySupplementState());
    c.persist(emptySupplementState());
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
    const sealing = createSupplementsCache({ vault, storage: () => storage });
    sealing.boot(emptySupplementState());
    sealing.persist(doc('s', 9));
    await wait();
    const keyless = createSupplementsCache({ vault: await unsetVault(), storage: () => storage });
    keyless.boot(keyless.load());
    keyless.persist(keyless.load());
    expect(m.get(SUPPLEMENTS_KEY)).toBeUndefined();
    expect(m.get(SUPPLEMENTS_ENC_KEY)).toBeDefined();
  });
});
