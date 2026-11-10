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

const gate = vi.hoisted(() => ({ ready: true }));
vi.mock('./trackerRt', async (orig) => {
  const real = await orig<typeof import('./trackerRt')>();
  return { ...real, isTrackerReady: (id: string) => (id === 'alcohol' ? gate.ready : true) };
});

import * as store from './store';
import { vault } from './vaultIO';
import { isSealed, unsealDoc } from './encryptedDoc';
import { newAlcoholEntry } from './alcohol';
import { trackerReady } from './trackerRt';
import type { CoachView } from './conditions';

const tick = () => new Promise((r) => setTimeout(r, 30));
const PATH = 'users/u1/meta/coachShare';
const stub = vault as unknown as import('./autoVault').Vault;
const shareWrites = () => fs.writes.filter((w) => w.path === PATH);

describe('coach share while the alcohol chunk is not loaded', () => {
  let stop: () => void;
  beforeEach(async () => {
    localStorage?.clear?.();
    fs.writes.length = 0;
    fs.docs.clear();
    fs.listeners.clear();
    gate.ready = true;
    store.deleteAlcoholData();
    store.setAlcoholSharing('off');
    stop = store.startSyncLoop();
    await tick();
    store.saveAlcoholEntry({ ...newAlcoholEntry('spWhisky', 'e-w', 40), servingsPerWeek: 10 });
    store.setAlcoholSurface('readiness', true);
    store.setAlcoholSharing('effects');
    await tick();
  });
  afterEach(() => {
    gate.ready = true;
    stop();
    store.deleteAlcoholData();
  });

  it('does not publish a view without the alcohol section, and re-publishes once the tracker is ready', async () => {
    gate.ready = false;
    fs.writes.length = 0;
    store.saveAlcoholEntry({ ...newAlcoholEntry('spWhisky', 'e-w', 40), servingsPerWeek: 40 });
    await tick();
    expect(shareWrites()).toHaveLength(0);
    gate.ready = true;
    trackerReady('alcohol');
    await tick();
    const w = shareWrites().at(-1)!;
    expect(isSealed(w.data)).toBe(true);
    const plain = await unsealDoc<{ view: CoachView }>(w.data, stub.material().key);
    expect(plain.view.alcohol?.mode).toBe('effects');
  });
});
