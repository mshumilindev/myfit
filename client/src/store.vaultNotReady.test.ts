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
import { vault } from './vaultIO';
import { isSealed, unsealDoc } from './encryptedDoc';
import type { Vault } from './autoVault';
import type { Workout } from './types';

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

describe('SPO-269: a finished workout is never written as plaintext while the vault is not ready', () => {
  it('waits for the key, then writes it once, sealed', async () => {
    expect((vault as unknown as Vault).status()).not.toBe('ready');
    const w = store.startWorkout()!;
    store.addExercise(w.id, 'Bench Press');
    vi.setSystemTime(T0 + 3_600_000);
    store.finishWorkout(w.id);
    await settle();
    // the key has not arrived: nothing may reach Firestore, least of all readable text
    expect(wWrites()).toEqual([]);

    gate.open();
    await vi.waitFor(() => expect(wWrites()).toHaveLength(1));
    const data = wWrites()[0].data;
    expect(isSealed(data)).toBe(true);
    expect(JSON.stringify(data)).not.toContain('Bench');
    const back = await unsealDoc<Workout & Record<string, unknown>>(
      data,
      (vault as unknown as Vault).material().key,
    );
    expect(back.id).toBe(w.id);
    expect(back.exercises[0].name).toBe('Bench Press');
  });
});
