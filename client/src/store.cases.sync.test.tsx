import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fs = vi.hoisted(() => ({
  writes: [] as { path: string; data: Record<string, unknown>; opts?: unknown }[],
  deletes: [] as string[],
  listeners: new Map<string, (snap: unknown) => void>(),
  errors: new Map<string, (e: unknown) => void>(),
  failWith: null as null | { code: string },
  uid: 'u1' as string | null,
  calls: [] as { name: string; body: unknown }[],
  callResult: ((): unknown => {
    throw new Error('offline');
  }) as (n: string) => unknown,
}));

vi.mock('./firebase', () => ({ db: {} }));
vi.mock('./api', async (orig) => ({
  ...(await orig<typeof import('./api')>()),
  currentUid: () => fs.uid,
  callFn: vi.fn(async (name: string, body?: unknown) => {
    fs.calls.push({ name, body });
    return fs.callResult(name);
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
    onSnapshot: (r: { path: string }, cb: (s: unknown) => void, err?: (e: unknown) => void) => {
      fs.listeners.set(r.path, cb);
      if (err) fs.errors.set(r.path, err);
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
import { setRole } from './api';
import { vault } from './vaultIO';
import { unsealDoc } from './encryptedDoc';
import { CONDITION_CATALOG } from './data/conditionCatalog';
import { weekStartDay, setWeekStartDay } from './weekStart';
import { activityPins, setActivityPins } from './activityPrefs';
import type { Gym } from './types';

const KEY = CONDITION_CATALOG[0].key;
const T0 = new Date('2026-03-04T10:00:00Z').getTime();
const DAY = 86_400_000;
const stub = vault as unknown as import('./autoVault').Vault;
const st = () => store.__getStateForTests();
const settle = async () => {
  for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 8));
};
const at = (path: string) => fs.writes.filter((w) => w.path === path);
const open = (w: { data: Record<string, unknown> }) =>
  unsealDoc<Record<string, unknown>>(w.data, stub.material().key);
const snap = (d: Record<string, unknown> | null) => ({
  exists: () => d !== null,
  data: () => d,
  docs: d ? [{ data: () => d }] : [],
  metadata: { fromCache: false, hasPendingWrites: false },
});
const docsSnap = (ds: Record<string, unknown>[]) => ({
  docs: ds.map((d) => ({ data: () => d })),
  metadata: { fromCache: false, hasPendingWrites: false },
});
const gymAt = (id: string, lat: number, lng: number): Gym => ({
  id,
  name: id,
  lat,
  lng,
  radiusM: 100,
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
  localStorage.clear();
  fs.writes.length = 0;
  fs.deletes.length = 0;
  fs.calls.length = 0;
  fs.listeners.clear();
  fs.errors.clear();
  fs.failWith = null;
  fs.uid = 'u1';
  setRole('member');
  store.resetLocalData();
});
afterEach(async () => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await settle();
  store.resetLocalData();
});

describe('location, presence and visit reminders', () => {
  const geo = (
    coords: { latitude: number; longitude: number; accuracy: number } | 'denied' | 'fail',
  ) => {
    const getCurrentPosition = vi.fn((ok: (p: unknown) => void, err: (e: unknown) => void) => {
      if (coords === 'denied') err({ code: 1, PERMISSION_DENIED: 1 });
      else if (coords === 'fail') err({ code: 2, PERMISSION_DENIED: 1 });
      else ok({ coords });
    });
    vi.stubGlobal(
      'navigator',
      Object.assign(Object.create(navigator), { geolocation: { getCurrentPosition } }),
    );
    return getCurrentPosition;
  };

  it('getCurrentPositionOnce caches fresh fixes and serves them without asking again', async () => {
    const g = geo({ latitude: 54.7, longitude: 25.3, accuracy: 20 });
    const fix = await store.getCurrentPositionOnce();
    expect(fix).toEqual({ lat: 54.7, lng: 25.3, accuracy: 20 });
    expect(JSON.parse(localStorage.getItem('spotter.lastPos')!)).toMatchObject({
      lat: 54.7,
      at: T0,
    });
    expect(g).toHaveBeenCalledTimes(1);
    expect(await store.getCurrentPositionOnce({ maxAgeMs: 60_000 })).toEqual(fix);
    expect(g).toHaveBeenCalledTimes(1);
    vi.setSystemTime(T0 + 120_000);
    await store.getCurrentPositionOnce({ maxAgeMs: 60_000 });
    expect(g).toHaveBeenCalledTimes(2);
  });

  it('cacheFirst returns the cached fix and never prompts; denial falls back to the cache only for cache-aware callers', async () => {
    localStorage.setItem(
      'spotter.lastPos',
      JSON.stringify({ lat: 1, lng: 2, accuracy: 3, at: T0 - DAY }),
    );
    const g = geo('denied');
    expect(await store.getCurrentPositionOnce({ cacheFirst: true })).toEqual({
      lat: 1,
      lng: 2,
      accuracy: 3,
    });
    expect(g).not.toHaveBeenCalled();
    expect(await store.getCurrentPositionOnce({ maxAgeMs: 10 })).toEqual({
      lat: 1,
      lng: 2,
      accuracy: 3,
    });
    await expect(store.getCurrentPositionOnce()).rejects.toThrow();
  });

  it('errors without a cache: denied vs unavailable vs no geolocation', async () => {
    geo('denied');
    await expect(store.getCurrentPositionOnce()).rejects.toThrow(/заборонено/);
    geo('fail');
    await expect(store.getCurrentPositionOnce()).rejects.toThrow(/Не вдалося/);
    vi.stubGlobal('navigator', { onLine: true });
    await expect(store.getCurrentPositionOnce()).rejects.toThrow(/недоступна/);
    localStorage.setItem(
      'spotter.lastPos',
      JSON.stringify({ lat: 1, lng: 2, accuracy: 3, at: T0 }),
    );
    expect(await store.getCurrentPositionOnce({ cacheFirst: true })).toEqual({
      lat: 1,
      lng: 2,
      accuracy: 3,
    });
    expect(await store.getCurrentPositionOnce({ maxAgeMs: 1 })).toEqual({
      lat: 1,
      lng: 2,
      accuracy: 3,
    });
  });

  it('a corrupt position cache is ignored', async () => {
    localStorage.setItem('spotter.lastPos', '{not json');
    geo({ latitude: 5, longitude: 6, accuracy: 7 });
    expect(await store.getCurrentPositionOnce({ cacheFirst: true })).toEqual({
      lat: 5,
      lng: 6,
      accuracy: 7,
    });
    localStorage.setItem('spotter.lastPos', JSON.stringify({ lat: 'x' }));
    expect(store.pickSessionGym()).toBeNull();
  });

  it('gymAtCurrentPosition: inside a radius with good accuracy only; nearest wins', async () => {
    expect(await store.gymAtCurrentPosition([])).toBeNull();
    geo({ latitude: 54.7, longitude: 25.3, accuracy: 20 });
    const near = gymAt('near', 54.7001, 25.3);
    const nearer = gymAt('nearer', 54.70005, 25.3);
    const far = gymAt('far', 55, 25.3);
    expect((await store.gymAtCurrentPosition([far, near, nearer]))?.id).toBe('nearer');
    expect(await store.gymAtCurrentPosition([far])).toBeNull();
    geo({ latitude: 54.7, longitude: 25.3, accuracy: 100 });
    localStorage.clear();
    expect(await store.gymAtCurrentPosition([near])).toBeNull(); // too imprecise
  });

  it('presence pings are off unless the flag is on, throttled, and only inside a gym radius', async () => {
    store.upsertGym(gymAt('g1', 54.7, 25.3));
    const g = geo({ latitude: 54.7, longitude: 25.3, accuracy: 20 });
    store.recordPresence();
    expect(g).not.toHaveBeenCalled(); // flag off

    localStorage.setItem('gym.flags', JSON.stringify({ gymPresence: true }));
    store.recordPresence();
    expect(g).toHaveBeenCalledTimes(1);
    await settle();
    const ping = fs.writes.find((w) => w.path.startsWith('users/u1/pings/'))!;
    expect(ping.data).toEqual({ gymId: expect.any(String), at: T0 });
    store.recordPresence(); // throttled
    expect(g).toHaveBeenCalledTimes(1);

    localStorage.removeItem('spotter.lastPingAt');
    geo({ latitude: 10, longitude: 10, accuracy: 20 });
    fs.writes.length = 0;
    store.recordPresence();
    geo({ latitude: 54.7, longitude: 25.3, accuracy: 900 });
    store.recordPresence();
    geo('denied');
    store.recordPresence();
    await settle();
    expect(fs.writes.filter((w) => w.path.includes('/pings/'))).toEqual([]);
  });

  it('long unlogged visits become reminders; dismissing is stored; logging one makes a sealed workout', async () => {
    const gym = store.upsertGym(gymAt('g1', 54.7, 25.3));
    const stop = store.startSyncLoop();
    const t = T0 - 3 * 3_600_000;
    fs.listeners.get('users/u1/pings')!(
      docsSnap([
        { gymId: gym.id, at: t },
        { gymId: gym.id, at: t + 30 * 60_000 },
        { gymId: gym.id, at: t + 65 * 60_000 },
        { gymId: 'short', at: t },
        { gymId: 'short', at: t + 10 * 60_000 },
        { gymId: gym.id, at: T0 - 20 * DAY },
      ]),
    );
    expect(st().reminders).toEqual([
      { gymId: gym.id, gymName: gym.name, visitStart: t, visitEnd: t + 65 * 60_000 },
    ]);
    const r = st().reminders[0];
    store.dismissReminder(r);
    expect(st().reminders).toEqual([]);
    await settle();
    expect(at(`users/u1/reminderDismissals/${gym.id}:${t}`)[0].data).toEqual({
      gymId: gym.id,
      visitStart: t,
    });
    fs.listeners.get('users/u1/reminderDismissals')!(docsSnap([{ gymId: gym.id, visitStart: t }]));
    expect(st().reminders).toEqual([]);
    fs.listeners.get('users/u1/reminderDismissals')!(docsSnap([]));
    expect(st().reminders).toHaveLength(1);

    const w = store.logVisitAsWorkout(st().reminders[0]);
    expect(w).toMatchObject({ startedAt: t, finishedAt: t + 65 * 60_000, gymId: gym.id });
    expect(st().reminders).toEqual([]);
    await settle();
    const wr = at(`users/u1/workouts/${w.id}`);
    expect(wr).toHaveLength(1);
    expect(JSON.stringify(wr[0].data)).not.toContain(gym.id);
    expect((await open(wr[0])).gymId).toBe(gym.id);
    stop();
  });

  it('a visit that overlaps a logged workout is not a reminder', () => {
    const gym = store.upsertGym(gymAt('g1', 54.7, 25.3));
    const stop = store.startSyncLoop();
    const t = T0 - 3 * 3_600_000;
    store.__replaceStateForTests({
      ...st(),
      workouts: [
        {
          id: 'w',
          startedAt: t + 10 * 60_000,
          finishedAt: t + 50 * 60_000,
          autoFinished: false,
          gymId: gym.id,
          exercises: [],
        },
      ],
    });
    fs.listeners.get('users/u1/pings')!(
      docsSnap([
        { gymId: gym.id, at: t },
        { gymId: gym.id, at: t + 65 * 60_000 },
      ]),
    );
    expect(st().reminders).toEqual([]);
    stop();
  });
});

describe('sync loop plumbing', () => {
  it('prefs: the first sync keeps a local week start; a server value is applied without echoing back', async () => {
    setWeekStartDay(3, 50);
    const stop = store.startSyncLoop();
    fs.listeners.get('users/u1/meta/prefs')!(snap({}));
    await settle();
    expect(at('users/u1/meta/prefs').at(-1)!.data).toMatchObject({ weekStart: 3 });
    expect(at('users/u1/meta/prefs').at(-1)!.opts).toEqual({ merge: true });
    fs.writes.length = 0;
    fs.listeners.get('users/u1/meta/prefs')!(
      snap({ weekStart: 6, updatedAt: 500, activityPins: ['run'], activityPinsUpdatedAt: 400 }),
    );
    await settle();
    expect(weekStartDay()).toBe(6);
    expect(activityPins()).toEqual(['run']);
    expect(at('users/u1/meta/prefs')).toEqual([]); // remote values are not written back
    stop();
  });

  it('prefs: a local edit is merge-written with only its own fields', async () => {
    setActivityPins(['yoga']);
    await settle();
    const w = at('users/u1/meta/prefs').at(-1)!;
    expect(w.data.activityPins).toEqual(['yoga']);
    expect(typeof w.data.activityPinsUpdatedAt).toBe('number');
    expect('weekStart' in w.data).toBe(false);
  });

  it('errors from a hard listener (rules) flip the chip; soft ones are ignored', () => {
    const stop = store.startSyncLoop();
    fs.errors.get('users/u1/injuries')!({ code: 'permission-denied' }); // soft: rule may not be deployed yet
    expect(st().syncStatus).not.toBe('failed');
    fs.errors.get('users/u1/workouts')!({ code: 'unavailable' });
    expect(st().syncStatus).not.toBe('failed');
    fs.errors.get('users/u1/workouts')!({ code: 'permission-denied' });
    expect(st().syncStatus).toBe('failed');
    expect(st().syncError?.status).toBe(403);
    stop();
  });

  it('retrySync clears a failed state and re-attaches the listeners when online and signed in', () => {
    store.__replaceStateForTests({
      ...st(),
      syncStatus: 'failed',
      syncError: { status: 403, statusLine: 'x' },
    });
    const on = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    store.retrySync();
    expect(st().syncStatus).toBe('pending');
    expect(st().syncError).toBeNull();
    expect(fs.listeners.size).toBeGreaterThan(0);
    on.mockReturnValue(false);
    fs.listeners.clear();
    store.retrySync();
    expect(st().syncStatus).toBe('offline');
    expect(fs.listeners.size).toBe(0);
    store.discardBlockingChange();
    expect(st().syncStatus).toBe('offline');
    void store.sync();
  });

  it('signed out: the loop is a no-op', () => {
    fs.uid = null;
    const stop = store.startSyncLoop();
    expect(fs.listeners.size).toBe(0);
    stop();
  });

  it('the 15 s tick auto-finishes stale sessions and keeps the coach heartbeat alive', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(T0);
    const stop = store.startSyncLoop();
    fs.listeners.get('users/u1')!(snap({ trainerId: 'c1' }));
    const w = store.startWorkout()!;
    store.addExercise(w.id, 'Squat'); // writes the live-session doc
    await vi.advanceTimersByTimeAsync(0);
    fs.writes.length = 0;
    await vi.advanceTimersByTimeAsync(15_000);
    expect(at('liveSessions/u1')).toEqual([]); // inside the heartbeat window
    await vi.advanceTimersByTimeAsync(45_000);
    const beat = at('liveSessions/u1').at(-1)!;
    expect(beat.data).toEqual({ updatedAt: expect.any(Number) });
    expect(beat.opts).toEqual({ merge: true });
    stop();
  });

  it('the legacy live-session writer stays silent when the Coach backend owns the document', () => {
    const stop = store.startSyncLoop();
    fs.listeners.get('users/u1')!(snap({ trainerId: 'c1' }));
    store.setLegacyLiveWriter(false);
    const w = store.startWorkout()!;
    store.addExercise(w.id, 'Squat');
    store.finishWorkout(w.id);
    expect(fs.writes.filter((x) => x.path === 'liveSessions/u1')).toEqual([]);
    expect(fs.deletes).not.toContain('liveSessions/u1');
    store.setLegacyLiveWriter(true);
    stop();
  });

  it('resetLocalData forgets everything on the device, including the sealed copies', async () => {
    store.saveCycleSettings({
      mode: 'regular',
      length: 28,
      period: 5,
      anchor: store.dayKey(T0) - 3,
    });
    store.addCondition({ key: KEY, severity: 2, share: 'off' });
    const w = store.startWorkout()!;
    store.addExercise(w.id, 'Squat');
    store.addWeight(80, T0);
    await settle();
    expect(localStorage.getItem('spotter.state')).not.toBeNull();
    store.resetLocalData();
    expect(st().workouts).toEqual([]);
    expect(st().cycle.enabled).toBe(false);
    expect(st().conditions).toEqual([]);
    expect(st().bodyMetrics.weights).toEqual([]);
    expect(localStorage.getItem('spotter.sleepTombstones.v1')).toBe('[]');
    for (const k of [
      'spotter.body',
      'spotter.gyms',
      'spotter.injuries',
      'spotter.activities',
      'spotter.sleeps',
    ])
      expect(JSON.parse(localStorage.getItem(k) ?? 'null') ?? []).toEqual([]);
  });

  it('health data kept on the device is sealed: no condition, cycle or alcohol content in plain localStorage', async () => {
    store.addCondition({ key: KEY, severity: 2, share: 'off' });
    store.saveCycleSettings({
      mode: 'regular',
      length: 31,
      period: 6,
      anchor: store.dayKey(T0) - 3,
    });
    store.saveAlcoholEntry({
      ...(await import('./alcohol')).newAlcoholEntry('beerRegular', 'e-beer', 500),
      servingsPerWeek: 7,
    });
    store.saveNicotineProduct({
      id: 'n1',
      kind: 'cigarette',
      name: 'secret-brand',
      amountPerDay: 11,
    } as never);
    await settle();
    const dump = Object.entries({ ...localStorage })
      .filter(([k]) => k.startsWith('spotter.'))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
    expect(dump).not.toContain(KEY);
    expect(dump).not.toContain('secret-brand');
    expect(dump).not.toContain('beerRegular');
    expect(dump).not.toContain('"length":31');
  });
});
