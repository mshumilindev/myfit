import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * SPO-216 (SPO-153 AC 1): `persist()` never writes the person's own data to `localStorage` as readable text. The
 * on-device copy is a sealed envelope under `<key>.enc`; a legacy plaintext key is migrated (sealed first, then
 * removed, idempotent) and a cold start reads the sealed copy back.
 */
const fs = vi.hoisted(() => ({
  listeners: new Map<string, (snap: unknown) => void>(),
  server: null as null | { key: string; salt: string },
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
    arrayUnion: (...a: unknown[]) => a,
    arrayRemove: (...a: unknown[]) => a,
    getDoc: vi.fn(async () => ({ exists: () => false })),
    getDocs: vi.fn(async () => ({ docs: [] })),
    deleteDoc: vi.fn(async () => undefined),
    setDoc: vi.fn(async () => undefined),
    onSnapshot: (r: { path: string }, cb: (s: unknown) => void) => {
      fs.listeners.set(r.path, cb);
      return () => fs.listeners.delete(r.path);
    },
  };
});
vi.mock('./vaultIO', async (orig) => {
  const real = await orig<typeof import('./vaultIO')>();
  const { createAutoVault } = await import('./autoVault');
  const { memCache, randomServerKey } = await import('./testVault');
  fs.server ??= randomServerKey();
  const server = fs.server;
  // The test decides whether the (shared) vault holds a key: `setKeyReady`.
  const v = createAutoVault({ fetchKey: async () => server, cache: memCache() });
  return {
    ...real,
    vault: v,
    initVault: async () => undefined,
    runKeyExchange: async () => undefined,
    prepareWrite: (c: never, d: never) => real.prepareWrite(c, d, v),
    mirrorCollection: (apply: never) => real.mirrorCollection(apply, v),
  };
});

const setKeyReady = async (on: boolean) => {
  const { vault } = await import('./vaultIO');
  if (on) await vault.init();
  else await vault.lock();
  await settle(); // finished tests' stores share this vault: let them react before the next test seeds anything
  localStorage.clear();
};
const settle = async () => {
  for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 10));
};
const SEALED_KEYS = [
  'spotter.state',
  'spotter.gyms',
  'spotter.restPeriods',
  'spotter.injuries',
  'spotter.activities',
  'spotter.sleeps',
  'spotter.sleep.schedule',
  'spotter.sleep.settings',
  'spotter.body',
  'spotter.goals',
  'spotter.home',
  'spotter.mastery',
  'spotter.coach',
];
const SECRET = 'zz-secret-marker';
const plainDump = () =>
  Object.entries({ ...localStorage })
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

let live: { resetLocalData(): void } | null = null;
afterEach(async () => {
  await settle();
  live?.resetLocalData(); // a finished test's store must not keep writing into the next test
  live = null;
  await settle(); // (the mocked vault stays unlocked after the reset, so a last empty seal may still land)
  localStorage.clear();
});
beforeEach(() => {
  localStorage.clear();
  fs.listeners.clear();
  vi.resetModules();
});

describe('on-device state is sealed (SPO-216)', () => {
  it('with a key: no plaintext key and no readable content; every field has a sealed envelope', async () => {
    await setKeyReady(true);
    const store = await import('./store');
    live = store;
    const w = store.startWorkout()!;
    store.addExercise(w.id, `Squat ${SECRET}`);
    store.upsertGym({ name: `Gym ${SECRET}`, lat: 1, lng: 2, radiusM: 100 } as never);
    store.addWeight(81.5, Date.now());
    store.setMasteryHistory(2015, 'continuous');
    store.setCoach({ enabled: true });
    store.saveHomeSet({ name: `Set ${SECRET}`, moves: [] });
    store.startActivity(`run ${SECRET}`, 'conditioning');
    store.startSleep();
    store.logRestPeriod({ kind: 'rest', startDay: store.dayKey(Date.now()), days: 1 } as never);
    await settle();
    for (const k of SEALED_KEYS)
      expect(localStorage.getItem(k), `${k} must not be readable`).toBeNull();
    expect(plainDump()).not.toContain(SECRET);
    for (const k of [
      'spotter.state',
      'spotter.gyms',
      'spotter.activities',
      'spotter.sleeps',
      'spotter.body',
      'spotter.mastery',
      'spotter.coach',
      'spotter.home',
    ])
      expect(localStorage.getItem(`${k}.enc`), `${k}.enc`).not.toBeNull();
  });

  it('without a key: nothing new is written at all', async () => {
    await setKeyReady(false);
    const store = await import('./store');
    live = store;
    const w = store.startWorkout()!;
    store.addExercise(w.id, `Squat ${SECRET}`);
    store.addWeight(81.5, Date.now());
    await settle();
    expect(plainDump()).not.toContain(SECRET);
    expect(Object.keys({ ...localStorage }).filter((k) => k.startsWith('spotter.state'))).toEqual(
      [],
    );
    expect(store.__getStateForTests().workouts).toHaveLength(1); // still in memory
  });

  it('migrates legacy plaintext keys without loss, removes them, and a second start changes nothing', async () => {
    const legacyWorkout = {
      id: 'w-old',
      startedAt: 1,
      finishedAt: 2,
      gymId: null,
      exercises: [],
      note: SECRET,
    };
    await setKeyReady(true);
    localStorage.setItem('spotter.state', JSON.stringify([legacyWorkout]));
    localStorage.setItem('spotter.goals', JSON.stringify({ focus: { muscles: [SECRET] } }));
    localStorage.setItem(
      'spotter.mastery',
      JSON.stringify({ sinceYear: 2001, pattern: 'frequent', seenRating: null, updatedAt: 5 }),
    );

    const store = await import('./store');
    live = store;
    // readable at boot, before the key
    expect(store.__getStateForTests().workouts.map((x) => x.id)).toEqual(['w-old']);
    await settle();
    for (const k of ['spotter.state', 'spotter.goals', 'spotter.mastery'])
      expect(localStorage.getItem(k), k).toBeNull();
    expect(plainDump()).not.toContain(SECRET);
    expect(store.__getStateForTests().workouts.map((x) => x.id)).toEqual(['w-old']);
    expect(store.__getStateForTests().mastery.sinceYear).toBe(2001);

    const sealedBefore = localStorage.getItem('spotter.state.enc');
    expect(sealedBefore).not.toBeNull();
    // second start (cold start from the sealed copy only)
    vi.resetModules();
    const again = await import('./store');
    await settle();
    expect(again.__getStateForTests().workouts.map((x) => x.id)).toEqual(['w-old']);
    expect(again.__getStateForTests().mastery.sinceYear).toBe(2001);
    expect(JSON.stringify(again.__getStateForTests().goals)).toContain(SECRET);
    expect(plainDump()).not.toContain(SECRET);
  });

  it('a Firestore snapshot that arrives first wins over the sealed copy (a deleted workout stays deleted)', async () => {
    await setKeyReady(true);
    const first = await import('./store');
    live = first;
    const w = first.startWorkout()!;
    first.finishWorkout(w.id);
    await settle();
    expect(localStorage.getItem('spotter.state.enc')).not.toBeNull();

    vi.resetModules();
    const second = await import('./store');
    live = second;
    const stop = second.startSyncLoop();
    // the server (empty) answers before/while the sealed copy is opened
    fs.listeners.get('users/u1/workouts')?.({
      docs: [],
      metadata: { fromCache: false, hasPendingWrites: false },
    });
    await settle();
    expect(second.__getStateForTests().workouts.filter((x) => x.id === w.id)).toEqual([]);
    stop();
  });

  it('resetLocalData removes the sealed copies too', async () => {
    await setKeyReady(true);
    const store = await import('./store');
    live = store;
    store.addWeight(80, Date.now());
    await settle();
    expect(localStorage.getItem('spotter.body.enc')).not.toBeNull();
    store.resetLocalData();
    for (const k of SEALED_KEYS) {
      expect(localStorage.getItem(k)).toBeNull();
      expect(localStorage.getItem(`${k}.enc`)).toBeNull();
    }
  });
});
