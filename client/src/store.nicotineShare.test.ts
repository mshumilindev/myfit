import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fs = vi.hoisted(() => {
  const writes: { path: string; data: Record<string, unknown> }[] = [];
  const listeners = new Map<string, (snap: unknown) => void>();
  return { writes, listeners, docs: new Map<string, Record<string, unknown>>(), failNext: false };
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
      if (fs.failNext) {
        fs.failNext = false;
        throw new Error('offline');
      }
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
import { newNicotineProduct } from './nicotine';
import type { CoachView } from './conditions';

const tick = () => new Promise((r) => setTimeout(r, 30));
const PATH = 'users/u1/meta/coachShare';
const stub = vault as unknown as import('./autoVault').Vault;
const shareWrites = () => fs.writes.filter((w) => w.path === PATH);
async function lastView(): Promise<CoachView> {
  const w = shareWrites().at(-1)!;
  expect(isSealed(w.data)).toBe(true);
  const plain = await unsealDoc<{ view: CoachView }>(w.data, stub.material().key);
  return plain.view;
}

describe('nicotine in the sealed coach share', () => {
  let stop: () => void;
  beforeEach(async () => {
    localStorage?.clear?.();
    fs.writes.length = 0;
    fs.docs.clear();
    fs.listeners.clear();
    store.deleteNicotineData();
    store.setNicotineSharing('off');
    stop = store.startSyncLoop();
    await tick();
    store.saveNicotineProduct({
      ...newNicotineProduct('vape', 'p-vape'),
      unit: 'ml',
      amount: 1.5,
      strengthMg: 20,
    });
    await tick();
    fs.writes.length = 0;
  });
  afterEach(() => {
    stop();
    store.deleteNicotineData();
  });

  it('Off (the default) never carries nicotine, whatever the products do', async () => {
    store.updateNicotineProduct('p-vape', { amount: 3 });
    store.setNicotineUseInCalculations(false);
    await tick();
    for (const w of shareWrites()) {
      const plain = await unsealDoc<{ view: CoachView }>(w.data, stub.material().key);
      expect(plain.view.nicotine).toBeUndefined();
    }
  });

  it('Effects publishes only the effect summary; Full adds the amounts and mg; sealed on the wire', async () => {
    store.setNicotineSharing('effects');
    await tick();
    let v = await lastView();
    expect(v.nicotine!.mode).toBe('effects');
    expect(v.nicotine!.effects.length).toBeGreaterThan(0);
    expect(JSON.stringify(v.nicotine)).not.toMatch(/vape|strengthMg|mgPerDay|products/);

    store.setNicotineSharing('full');
    await tick();
    v = await lastView();
    expect(v.nicotine!.mode).toBe('full');
    expect(v.nicotine!.full!.mgPerDay).toBe(30);
    expect(v.nicotine!.full!.absorbedMgPerDay).toBe(9); // vape: 30 mg labelled x 0.3
    expect(v.nicotine!.full!.cigEq).toBe(9);
    expect(v.nicotine!.full!.products[0]).toMatchObject({ kind: 'vape', amount: 1.5 });
    for (const w of shareWrites()) expect(JSON.stringify(w.data)).not.toMatch(/vape|nicotine/);
  });

  it('a product change republishes; going back to Off or deleting the data removes it', async () => {
    store.setNicotineSharing('full');
    await tick();
    store.updateNicotineProduct('p-vape', { amount: 3 });
    await tick();
    expect((await lastView()).nicotine!.full!.mgPerDay).toBe(60);
    store.setNicotineSharing('off');
    await tick();
    expect((await lastView()).nicotine).toBeUndefined();
    store.setNicotineSharing('full');
    await tick();
    store.deleteNicotineData();
    await tick();
    expect((await lastView()).nicotine).toBeUndefined();
  });
});
