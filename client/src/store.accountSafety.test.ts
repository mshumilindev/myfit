import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

import * as store from './store';
import { vault } from './vaultIO';
import { CONDITION_CATALOG } from './data/conditionCatalog';
import { isHealthWriteDenied } from './data/healthConsentGate';
import type { Vault } from './autoVault';
import { isSealed } from './encryptedDoc';

const KEY = CONDITION_CATALOG[0].key;
const T0 = new Date('2026-03-04T10:00:00Z').getTime();
const st = () => store.__getStateForTests();
const settle = async () => {
  for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 8));
};
const at = (path: string) => fs.writes.filter((w) => w.path === path);
const snap = (docs: Record<string, unknown>[]) => ({
  exists: () => docs.length > 0,
  data: () => docs[0] ?? null,
  docs: docs.map((d) => ({ data: () => d })),
  metadata: { fromCache: false, hasPendingWrites: false },
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
  localStorage.clear();
  fs.writes.length = 0;
  fs.deletes.length = 0;
  fs.listeners.clear();
  fs.failWith = null;
  fs.uid = 'u1';
  store.resetLocalData();
});
afterEach(async () => {
  vi.useRealTimers();
  await settle();
  store.resetLocalData();
});

describe('SPO-219 (a): a corrupted workout document does not break the listener', () => {
  it('an `enc` without `salt` is skipped, the good documents still arrive and the store keeps working', async () => {
    const good = {
      id: 'w-good',
      startedAt: T0 - 86_400_000,
      finishedAt: T0 - 86_000_000,
      exercises: [
        {
          id: 'e1',
          name: 'Squat',
          position: 0,
          sets: [{ id: 's1', reps: 5, weight: 100, restSec: 90 }],
        },
      ],
    };
    const broken = { id: 'w-bad', startedAt: T0 - 1000, enc: { v: 1, iv: 'AAAA', ct: 'AAAA' } };
    const unhandled: unknown[] = [];
    const onUnhandled = (e: unknown) => void unhandled.push(e);
    process.on('unhandledRejection', onUnhandled);
    try {
      const stop = store.startSyncLoop();
      fs.listeners.get('users/u1/workouts')!(snap([good, broken]));
      await settle();
      expect(unhandled).toEqual([]);
      expect(st().workouts.map((w) => w.id)).toEqual(['w-good']);
      // the next snapshot is processed normally
      fs.listeners.get('users/u1/workouts')!(snap([good]));
      await settle();
      expect(st().workouts.map((w) => w.id)).toEqual(['w-good']);
      stop();
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });
});

describe('SPO-219 (b): the coach-share memo does not carry over to the next account', () => {
  const publishAs = async (uid: string) => {
    fs.uid = uid;
    const c = store.addCondition({ key: KEY, severity: 2, share: 'full' });
    if (isHealthWriteDenied(c)) throw new Error('consent denied in test setup');
    store.setConditionsShare('full');
    await settle();
  };

  it('two accounts in a row with the same view: the second one is published too', async () => {
    await publishAs('u1');
    expect(at('users/u1/meta/coachShare').length).toBeGreaterThan(0);

    store.resetLocalData(); // sign-out / account switch
    await settle();
    fs.writes.length = 0;
    await publishAs('u2');

    const shares = at('users/u2/meta/coachShare');
    expect(shares.length).toBeGreaterThan(0);
    expect(isSealed(shares.at(-1)!.data)).toBe(true);
    expect((vault as unknown as Vault).status()).toBe('ready');
    expect(st().conditions).toHaveLength(1);
  });

  it('sign-out without resetLocalData (the app path): the next account signing in still publishes', async () => {
    fs.uid = 'u1';
    let stop = store.startSyncLoop();
    await publishAs('u1');
    expect(at('users/u1/meta/coachShare').length).toBeGreaterThan(0);
    stop(); // App: effect cleanup on sign-out

    fs.writes.length = 0;
    fs.uid = 'u2';
    stop = store.startSyncLoop();
    store.setConditionsShare('effects');
    store.setConditionsShare('full'); // back to the same view the previous account published last
    await settle();
    stop();
    expect(at('users/u2/meta/coachShare').length).toBeGreaterThan(0);
  });
});
