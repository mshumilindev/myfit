import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fs = vi.hoisted(() => {
  const writes: { path: string; data: Record<string, unknown> }[] = [];
  const listeners = new Map<string, (snap: unknown) => void>();
  return { writes, listeners, docs: new Map<string, Record<string, unknown>>() };
});

vi.mock('./firebase', () => ({ db: {} }));
vi.mock('./api', async (orig) => ({
  ...(await orig<typeof import('./api')>()),
  currentUid: () => 'u1',
}));
vi.mock('firebase/firestore', () => {
  const ref = (_db: unknown, ...p: string[]) => ({ path: p.join('/') });
  return {
    doc: ref,
    collection: ref,
    query: (r: unknown) => r,
    where: () => ({}),
    arrayUnion: (...a: unknown[]) => a,
    arrayRemove: (...a: unknown[]) => a,
    getDoc: vi.fn(async () => ({ exists: () => false })),
    getDocs: vi.fn(async () => ({ docs: [] })),
    deleteDoc: vi.fn(async (r: { path: string }) => void fs.docs.delete(r.path)),
    setDoc: vi.fn(async (r: { path: string }, data: Record<string, unknown>) => {
      fs.writes.push({ path: r.path, data });
      fs.docs.set(r.path, data);
    }),
    onSnapshot: (r: { path: string }, cb: (s: unknown) => void) => {
      fs.listeners.set(r.path, cb);
      return () => fs.listeners.delete(r.path);
    },
  };
});
vi.mock('./vaultIO', async (orig) => {
  const real = await orig<typeof import('./vaultIO')>();
  const { readyVault } = await import('./testVault');
  const v = await readyVault();
  return {
    ...real,
    vault: v,
    initVault: async () => undefined,
    prepareWrite: (c: never, d: never) => real.prepareWrite(c, d, v),
    mirrorCollection: (apply: never) => real.mirrorCollection(apply, v),
  };
});

import * as store from './store';
import { vault } from './vaultIO';
import { isSealed, unsealDoc } from './encryptedDoc';
import { newNicotineProduct, nicotineMgPerDay } from './nicotine';
import { NICOTINE_ENC_KEY, NICOTINE_KEY } from './nicotineCache';
import type { NicotineProduct, NicotineState } from './types';

const PATH = 'users/u1/meta/nicotine';
// Waits until the Firestore write count stops changing (a fixed delay was flaky under load).
const tick = async () => {
  let last = -1;
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 30));
    const n = fs.writes.filter((w) => w.path === PATH).length;
    if (n === last) return;
    last = n;
  }
};
const stub = vault as unknown as import('./autoVault').Vault;
const cur = (): NicotineState => store.__getStateForTests().nicotine;
const nicWrites = () => fs.writes.filter((w) => w.path === PATH);
const lastPlain = async () =>
  unsealDoc<NicotineState & Record<string, unknown>>(nicWrites().at(-1)!.data, stub.material().key);
const vapeP = (over: Partial<NicotineProduct> = {}): NicotineProduct => ({
  ...newNicotineProduct('vape', 'p-vape'),
  ...over,
});

describe('nicotine store', () => {
  let stop: () => void;
  beforeEach(async () => {
    localStorage?.clear?.();
    fs.writes.length = 0;
    fs.docs.clear();
    fs.listeners.clear();
    store.deleteNicotineData();
    stop = store.startSyncLoop();
    await tick();
    fs.writes.length = 0;
  });
  afterEach(() => stop());

  it('starts empty: master on, sharing off, no products, no effects', () => {
    expect(cur().products).toEqual([]);
    expect(cur().settings.useInCalculations).toBe(true);
    expect(cur().settings.sharing).toBe('off');
    expect(store.getNicotineEffects()).toBeNull();
    expect(store.getNicotineLoad()).toEqual({ mgPerDay: 0, absorbedMgPerDay: 0, cigEq: 0 });
  });

  it('an old state without nicotine gives no effects and an empty load (no crash)', () => {
    const st = store.__getStateForTests() as { nicotine?: unknown };
    const saved = st.nicotine;
    st.nicotine = undefined;
    try {
      expect(store.getNicotineEffects()).toBeNull();
      expect(store.getNicotineLoad()).toEqual({ mgPerDay: 0, absorbedMgPerDay: 0, cigEq: 0 });
    } finally {
      st.nicotine = saved;
    }
  });

  it('saves a product as a sealed doc: only updatedAt is readable', async () => {
    store.saveNicotineProduct(vapeP({ amount: 1.5, strengthMg: 20 }));
    await tick();
    const w = nicWrites().at(-1)!;
    expect(isSealed(w.data)).toBe(true);
    expect(Object.keys(w.data).sort()).toEqual(['enc', 'updatedAt']);
    const text = JSON.stringify(w.data);
    for (const secret of ['vape', 'strengthMg', 'products', 'sharing', 'p-vape'])
      expect(text).not.toContain(secret);
    const plain = await lastPlain();
    expect(plain.products).toHaveLength(1);
    expect(plain.products[0]).toMatchObject({ kind: 'vape', amount: 1.5, strengthMg: 20 });
    expect(nicotineMgPerDay(cur().products)).toBe(30);
    expect(store.getNicotineLoad().mgPerDay).toBe(30);
    expect(store.getNicotineEffects()).not.toBeNull();
  });

  it('rejects an invalid product and writes nothing', async () => {
    expect(store.saveNicotineProduct({ ...vapeP(), kind: 'nope' as never })).toBeNull();
    await tick();
    expect(nicWrites()).toHaveLength(0);
  });

  it('saving the same id replaces; update merges; remove deletes; no-ops do not write', async () => {
    store.saveNicotineProduct(vapeP());
    store.saveNicotineProduct(vapeP({ amount: 3 }));
    expect(cur().products).toHaveLength(1);
    expect(cur().products[0].amount).toBe(3);
    await tick();
    const n = nicWrites().length;
    store.updateNicotineProduct('p-vape', { amount: 3 }); // unchanged
    store.updateNicotineProduct('missing', { amount: 1 });
    store.removeNicotineProduct('missing');
    await tick();
    expect(nicWrites().length).toBe(n);
    store.updateNicotineProduct('p-vape', { active: false, unit: 'pods', mlPerPod: 1 });
    expect(cur().products[0]).toMatchObject({ active: false, unit: 'pods', mlPerPod: 1 });
    store.removeNicotineProduct('p-vape');
    expect(cur().products).toEqual([]);
    await tick();
    expect((await lastPlain()).products).toEqual([]);
  });

  it('saves and clears the from-time-to-time flag; an old perDays document becomes occasional', async () => {
    store.saveNicotineProduct(vapeP({ occasional: true }));
    expect(cur().products[0].occasional).toBe(true);
    store.updateNicotineProduct('p-vape', { occasional: undefined });
    expect('occasional' in cur().products[0]).toBe(false);
    store.saveNicotineProduct({ ...vapeP(), perDays: 14 } as NicotineProduct);
    expect(cur().products[0].occasional).toBe(true);
    expect('perDays' in cur().products[0]).toBe(false);
    await tick();
    const plain = (await lastPlain()).products[0];
    expect(plain).toMatchObject({ occasional: true });
    expect(plain).not.toHaveProperty('perDays');
  });

  it('master, per-surface and sharing settings persist and are validated', async () => {
    store.saveNicotineProduct(vapeP());
    store.setNicotineUseInCalculations(false);
    expect(store.getNicotineEffects()).toBeNull();
    store.setNicotineUseInCalculations(true);
    store.setNicotineSurface('sleep', false);
    store.setNicotineSharing('effects');
    store.setNicotineSharing('bogus' as never);
    await tick();
    expect(cur().settings).toMatchObject({ useInCalculations: true, sharing: 'effects' });
    expect(cur().settings.surfaces.sleep).toBe(false);
    expect(store.getNicotineEffects()!.sleepMin).toEqual({ low: 0, high: 0 });
    const plain = await lastPlain();
    expect(plain.settings.sharing).toBe('effects');
    expect(plain.settings.surfaces.sleep).toBe(false);
    const n = nicWrites().length;
    store.setNicotineSharing('effects'); // same value
    await tick();
    expect(nicWrites().length).toBe(n);
  });

  it('applies a newer doc from another device, ignores an older one, never echoes', async () => {
    store.saveNicotineProduct(vapeP());
    await tick();
    fs.writes.length = 0;
    const { prepareWrite } = await import('./vaultIO');
    const remote = {
      products: [newNicotineProduct('heated', 'h1')],
      settings: { useInCalculations: false, sharing: 'full', surfaces: {} },
      updatedAt: Date.now() + 10_000,
    };
    fs.listeners.get(PATH)!({ exists: () => true, data: () => prepareWrite('nicotine', remote) });
    // The mirror reads the raw snapshot synchronously; hand it the sealed doc.
    const sealed = await prepareWrite('nicotine', remote);
    fs.listeners.get(PATH)!({ exists: () => true, data: () => sealed });
    await tick();
    expect(cur().products.map((p) => p.id)).toEqual(['h1']);
    expect(cur().settings.useInCalculations).toBe(false);
    expect(cur().settings.sharing).toBe('full');
    expect(nicWrites()).toHaveLength(0);

    const old = await prepareWrite('nicotine', { ...remote, products: [], updatedAt: 5 });
    fs.listeners.get(PATH)!({ exists: () => true, data: () => old });
    await tick();
    expect(cur().products.map((p) => p.id)).toEqual(['h1']);
  });

  it('deleteNicotineData wipes state, the Firestore doc and the on-device copy', async () => {
    store.saveNicotineProduct(vapeP());
    store.setNicotineSharing('full');
    await tick();
    expect(fs.docs.has(PATH)).toBe(true);
    expect(
      localStorage.getItem(NICOTINE_ENC_KEY) !== null ||
        localStorage.getItem(NICOTINE_KEY) !== null,
    ).toBe(true);
    store.deleteNicotineData();
    await tick();
    expect(cur().products).toEqual([]);
    expect(cur().settings.sharing).toBe('off');
    expect(cur().updatedAt).toBe(0);
    expect(fs.docs.has(PATH)).toBe(false);
    expect(localStorage.getItem(NICOTINE_ENC_KEY)).toBeNull();
    expect(localStorage.getItem(NICOTINE_KEY)).toBeNull();
    // A later unrelated change must not bring an empty copy back.
    store.setConditionsShare('off');
    await tick();
    expect(localStorage.getItem(NICOTINE_ENC_KEY)).toBeNull();
    expect(localStorage.getItem(NICOTINE_KEY)).toBeNull();
  });

  it('the on-device copy is sealed once the key exists (no plaintext product data)', async () => {
    store.saveNicotineProduct(vapeP());
    await tick();
    const enc = localStorage.getItem(NICOTINE_ENC_KEY);
    expect(enc).not.toBeNull();
    expect(enc).not.toContain('vape');
    expect(localStorage.getItem(NICOTINE_KEY)).toBeNull();
  });

  it('resetLocalData clears nicotine too', async () => {
    store.saveNicotineProduct(vapeP());
    await tick();
    store.resetLocalData();
    expect(cur().products).toEqual([]);
    expect(localStorage.getItem(NICOTINE_ENC_KEY)).toBeNull();
    expect(localStorage.getItem(NICOTINE_KEY)).toBeNull();
  });
});
