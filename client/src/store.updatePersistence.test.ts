import { beforeEach, describe, expect, it, vi } from 'vitest';

// SPO-317: what the person set up must survive a new build (a reload of the app) and the first sync after it.
const fs = vi.hoisted(() => ({
  listeners: new Map<string, (snap: unknown) => void>(),
  writes: [] as { path: string; data: Record<string, unknown> }[],
  deletes: [] as string[],
}));

vi.mock('./firebase', () => ({ db: {} }));
vi.mock('./api', async (orig) => ({
  ...(await orig<typeof import('./api')>()),
  currentUid: () => 'u1',
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
      fs.deletes.push(r.path);
    }),
    setDoc: vi.fn(async (r: { path: string }, data: Record<string, unknown>) => {
      fs.writes.push({ path: r.path, data });
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

const SCHEDULE = {
  sameEveryNight: false,
  every: null,
  byDay: { 1: { bedMin: 1380, wakeMin: 420 }, 2: { bedMin: 1410, wakeMin: 450 } },
};
const SETTINGS = {
  autoDim: true,
  autoLog: true,
  goalMin: 450,
  lastDimDay: null,
  skippedAutoSleepDates: [],
  patternOffer: 'accepted',
};
const settle = async () => {
  for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 8));
};

describe('state survives a new build', () => {
  beforeEach(() => {
    localStorage.clear();
    fs.listeners.clear();
    fs.writes.length = 0;
    fs.deletes.length = 0;
    vi.resetModules();
  });

  it('reads the sleep schedule and settings back after a reload', async () => {
    localStorage.setItem('spotter.sleep.schedule', JSON.stringify(SCHEDULE));
    localStorage.setItem('spotter.sleep.settings', JSON.stringify(SETTINGS));
    const store = await import('./store');
    expect(store.__getStateForTests().sleepSchedule).toEqual(SCHEDULE);
    expect(store.__getStateForTests().sleepSettings).toEqual(SETTINGS);
  });

  it('keeps them through the first sync: empty remote snapshots never overwrite local values', async () => {
    localStorage.setItem('spotter.sleep.schedule', JSON.stringify(SCHEDULE));
    localStorage.setItem('spotter.sleep.settings', JSON.stringify(SETTINGS));
    const store = await import('./store');
    const stop = store.startSyncLoop();
    await settle();
    const empty = {
      exists: () => false,
      data: () => ({}),
      docs: [],
      metadata: { fromCache: false },
    };
    for (const cb of fs.listeners.values()) cb(empty);
    await settle();
    expect(store.__getStateForTests().sleepSchedule).toEqual(SCHEDULE);
    expect(store.__getStateForTests().sleepSettings).toEqual(SETTINGS);
    // the on-device copy is sealed now (SPO-216): the legacy plaintext key was migrated away, the value kept
    expect(localStorage.getItem('spotter.sleep.schedule')).toBeNull();
    const { vault } = await import('./vaultIO');
    const { openSealedLocal } = await import('./testVault');
    expect(await openSealedLocal(vault, 'spotter.sleep.schedule')).toEqual(SCHEDULE);
    stop();
  });
});
