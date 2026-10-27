/**
 * Offline queue invariants (.claude/rules/client-architecture.md): a change made offline is applied
 * optimistically, persisted locally and handed to Firestore's write queue; when the
 * connection returns, a retry re-attaches the listeners and the next server snapshot
 * replaces the local cache and settles the status. Replaying is idempotent: the write
 * goes to a client-chosen document id via setDoc (upsert).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type SnapHandler = (snap: unknown) => void;
const h = vi.hoisted(() => ({
  handlers: new Map<string, (snap: unknown) => void>(),
  writes: [] as Array<{ path: string; data: unknown }>,
}));

vi.mock('./firebase', () => ({
  app: {},
  auth: { currentUser: { uid: 'u1' } },
  db: {},
  functions: {},
  storage: {},
  analytics: null,
}));
vi.mock('firebase/firestore', async (orig) => ({
  ...(await orig<typeof import('firebase/firestore')>()),
  collection: (_db: unknown, ...p: string[]) => ({ path: p.join('/') }),
  doc: (_db: unknown, ...p: string[]) => ({ path: p.join('/') }),
  query: (c: unknown) => c,
  where: () => ({}),
  orderBy: () => ({}),
  limit: () => ({}),
  onSnapshot: (ref: { path: string }, next: SnapHandler) => {
    h.handlers.set(ref.path, next);
    return () => h.handlers.delete(ref.path);
  },
  // Offline the SDK queues the write and the promise stays pending.
  setDoc: (ref: { path: string }, data: unknown) => {
    h.writes.push({ path: ref.path, data });
    return new Promise<void>(() => undefined);
  },
  updateDoc: () => new Promise<void>(() => undefined),
  deleteDoc: () => new Promise<void>(() => undefined),
  getDoc: () => new Promise(() => undefined),
  getDocs: () => new Promise(() => undefined),
}));
vi.mock('firebase/functions', () => ({ httpsCallable: () => () => new Promise(() => undefined) }));
vi.mock('firebase/auth', () => ({
  signInWithCustomToken: vi.fn(),
  onAuthStateChanged: () => () => undefined,
  onIdTokenChanged: () => () => undefined,
  signOut: vi.fn(),
}));
vi.mock('firebase/storage', () => ({ ref: () => ({}), getBlob: vi.fn() }));
vi.mock('./vaultIO', async (orig) => {
  const real = await orig<typeof import('./vaultIO')>();
  const { readyVault } = await import('./testVault');
  const v = await readyVault();
  return {
    ...real,
    vault: v,
    initVault: async () => undefined,
    runKeyExchange: async () => undefined,
    prepareWrite: (c: never, d: never) => real.prepareWrite(c, d, v),
    mirrorCollection: (apply: never) => real.mirrorCollection(apply, v),
  };
});

import { __getStateForTests, retrySync, startSyncLoop, updateBodyMetrics } from './store';

const setOnline = (v: boolean) =>
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: v });

let stop: () => void = () => undefined;

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('spotter.uid', 'u1');
  h.handlers.clear();
  h.writes.length = 0;
});
afterEach(() => {
  stop();
  setOnline(true);
});

describe('offline queue', () => {
  it('queues a change offline, then settles from the server snapshot once back online', async () => {
    setOnline(false);
    stop = startSyncLoop();

    updateBodyMetrics({ heightCm: 181 });

    // Optimistic + local: visible at once and mirrored to localStorage, SEALED (SPO-216; the SDK queue takes the write).
    expect(__getStateForTests().bodyMetrics.heightCm).toBe(181);
    expect(__getStateForTests().syncStatus).toBe('offline');
    await vi.waitFor(() => expect(localStorage.getItem('spotter.body.enc')).not.toBeNull());
    const mirrored = Object.keys(localStorage).map((k) => localStorage.getItem(k) ?? '');
    expect(mirrored.some((v) => v.includes('"heightCm":181'))).toBe(false);
    const { vault } = await import('./vaultIO');
    const { openSealedLocal } = await import('./testVault');
    expect(await openSealedLocal<{ heightCm?: number }>(vault, 'spotter.body')).toMatchObject({
      heightCm: 181,
    });

    // Connection returns: retry re-attaches listeners, status is "pending" until the server answers.
    setOnline(true);
    window.dispatchEvent(new Event('online'));
    retrySync();
    expect(__getStateForTests().syncStatus).toBe('pending');

    // The server snapshot (no pending writes) replaces the cache and settles the status.
    const workouts = h.handlers.get('users/u1/workouts');
    expect(workouts).toBeTypeOf('function');
    workouts!({
      docs: [],
      metadata: { fromCache: false, hasPendingWrites: false },
    });
    // The mirror decrypts asynchronously before applying the snapshot.
    await vi.waitFor(() => expect(__getStateForTests().syncStatus).toBe('synced'));
    expect(__getStateForTests().lastSyncAt).not.toBeNull();
  });

  it('retrySync is safe to repeat (listeners are replaced, not duplicated)', () => {
    stop = startSyncLoop();
    const before = h.handlers.size;
    retrySync();
    retrySync();
    expect(h.handlers.size).toBe(before);
  });
});
