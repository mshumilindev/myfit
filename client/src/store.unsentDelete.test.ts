import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const gate = vi.hoisted(() => ({ open: () => undefined as void }));
const fs = vi.hoisted(() => ({
  writes: [] as { path: string; data: Record<string, unknown>; opts?: unknown }[],
  deletes: [] as string[],
  listeners: new Map<string, (snap: unknown) => void>(),
  failWith: null as null | { code: string },
  uid: 'u1' as string | null,
}));

vi.mock('./firebase', () => ({ db: {} }));
vi.mock('./api', async (orig) => ({
  ...(await orig<typeof import('./api')>()),
  currentUid: () => fs.uid,
  callFn: vi.fn(async () => {
    throw new Error('offline');
  }),
}));
vi.mock('firebase/firestore', () => {
  const ref = (_db: unknown, ...p: string[]) => ({ path: p.join('/') });
  return {
    doc: ref,
    collection: ref,
    query: (r: unknown) => r,
    where: () => ({}),
    arrayUnion: (...a: unknown[]) => ({ union: a }),
    arrayRemove: (...a: unknown[]) => ({ remove: a }),
    getDoc: vi.fn(async () => ({ exists: () => false })),
    getDocs: vi.fn(async () => ({ docs: [] })),
    deleteDoc: vi.fn(async (r: { path: string }) => {
      if (fs.failWith) throw fs.failWith;
      fs.deletes.push(r.path);
    }),
    setDoc: vi.fn(async (r: { path: string }, data: Record<string, unknown>, opts?: unknown) => {
      if (fs.failWith) throw fs.failWith;
      fs.writes.push({ path: r.path, data, opts });
    }),
    onSnapshot: (r: { path: string }, cb: (s: unknown) => void) => {
      fs.listeners.set(r.path, cb);
      return () => fs.listeners.delete(r.path);
    },
  };
});
vi.mock('./vaultIO', async (orig) => {
  const real = await orig<typeof import('./vaultIO')>();
  // SPO-269: the key is still on its way (cold start / offline first visit): fetchKey is held until `gate.open()`.
  const { createAutoVault } = await import('./autoVault');
  const { memCache, randomServerKey } = await import('./testVault');
  const server = randomServerKey();
  const v = createAutoVault({
    fetchKey: () => new Promise((res) => void (gate.open = () => res(server))),
    cache: memCache(),
  });
  void v.init();
  return {
    ...real,
    vault: v,
    initVault: async () => undefined,
    runKeyExchange: async () => undefined,
    prepareWrite: (c: never, d: never) => real.prepareWrite(c, d, v),
    mirrorCollection: (apply: never) => real.mirrorCollection(apply, v),
  };
});

import * as store from './store';

const T0 = new Date('2026-03-04T10:00:00Z').getTime();
const settle = async () => {
  for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 8));
};
const wWrites = () => fs.writes.filter((w) => w.path.startsWith('users/u1/workouts/'));

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
  localStorage.clear();
  fs.uid = 'u1';
  store.resetLocalData();
  await settle();
  fs.writes.length = 0;
});
afterEach(() => {
  vi.useRealTimers();
});

describe('SPO-269 review: a delete made while a write is parked wins', () => {
  it('the parked setDoc never fires after the workout was deleted, and the unsent id is forgotten', async () => {
    const w = store.startWorkout()!;
    store.addExercise(w.id, 'Bench Press');
    vi.setSystemTime(T0 + 3_600_000);
    store.finishWorkout(w.id);
    await settle();
    expect(wWrites()).toEqual([]);

    store.deleteWorkout(w.id);
    await settle();
    expect(localStorage.getItem('spotter.unsentWorkouts.v1')).toBeNull();

    gate.open();
    await settle();
    expect(wWrites()).toEqual([]);
    expect(fs.deletes).toContain(`users/u1/workouts/${w.id}`);
  });
});
