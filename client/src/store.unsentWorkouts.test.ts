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

describe('SPO-269: a finished workout parked for the key is not lost with the tab', () => {
  it('its id is kept on this device until the write has reached the Firestore queue, and a snapshot keeps it', async () => {
    const w = store.startWorkout()!;
    store.addExercise(w.id, 'Bench Press');
    vi.setSystemTime(T0 + 3_600_000);
    store.finishWorkout(w.id);
    await settle();
    expect(wWrites()).toEqual([]);

    // parked: only the id is remembered (never the content), per account
    const raw = JSON.parse(localStorage.getItem('spotter.unsentWorkouts.v1') ?? 'null');
    expect(raw).toEqual({ uid: 'u1', ids: [w.id] });
    expect(localStorage.getItem('spotter.unsentWorkouts.v1')).not.toContain('Bench');

    // a server snapshot that does not have it yet (the tab was reopened) must not drop it
    const finished = store.getStoreState().workouts.find((x) => x.id === w.id)!;
    expect(finished.finishedAt).not.toBeNull();
    const kept = store.mergeServerWorkoutsWithLocalDrafts([], [finished]);
    expect(kept.map((x) => x.id)).toEqual([w.id]);

    // the key arrives: written once, and the id is forgotten
    gate.open();
    await vi.waitFor(() => expect(wWrites()).toHaveLength(1));
    await vi.waitFor(() => expect(localStorage.getItem('spotter.unsentWorkouts.v1')).toBeNull());
    expect(store.mergeServerWorkoutsWithLocalDrafts([], [finished])).toEqual([]);
  });
});
