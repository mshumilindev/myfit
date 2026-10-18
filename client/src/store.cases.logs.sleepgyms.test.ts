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
import { isSealed, unsealDoc } from './encryptedDoc';
import type { Gym, SleepNight } from './types';

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
const snap = (docs: Record<string, unknown>[], fromCache = false) => ({
  exists: () => docs.length > 0,
  data: () => docs[0],
  docs: docs.map((d) => ({ data: () => d })),
  metadata: { fromCache, hasPendingWrites: false },
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
  await settle(); // let in-flight sealed writes land before the next test starts
  store.resetLocalData();
});

describe('sleep', () => {
  it('start is idempotent; stop closes the night under its wake day and writes it sealed', async () => {
    const n = store.startSleep(T0, 'live')!;
    expect(store.startSleep(T0 + 1000)!.id).toBe(n.id);
    expect(store.sleepStartBlock()).toBeNull();
    await settle();
    expect(at(`users/u1/sleeps/${n.id}`)).toHaveLength(1);
    expect(store.stopSleep(T0 + 8 * 3_600_000, 'manual' as never)).toMatchObject({ id: n.id });
    const done = st().sleeps[0];
    expect(done.wake).toBe(T0 + 8 * 3_600_000);
    expect(done.date).toBe(store.sleepDayId(T0 + 8 * 3_600_000));
    expect(done.kind).toBe('sleep');
    await settle();
    const last = at(`users/u1/sleeps/${n.id}`).at(-1)!;
    expect(isSealed(last.data)).toBe(true);
    expect(last.data.wake).toBe(T0 + 8 * 3_600_000); // wake is a readable field for the server
    expect(store.stopSleep()).toBeNull();
  });

  it('a minimum of one minute is slept; wake before bedtime is clamped', () => {
    store.startSleep(T0);
    store.stopSleep(T0 - 5000);
    expect(st().sleeps[0].wake).toBe(T0 + 60_000);
  });

  it('pause / resume / activity bookkeeping banks awake time and idle gaps', () => {
    store.startSleep(T0);
    store.pauseSleep(T0 + 1000);
    store.pauseSleep(T0 + 2000);
    expect(st().sleeps[0].awakeSince).toBe(T0 + 1000);
    store.markSleepActivity(T0 + 2000);
    expect(st().sleeps[0].lastSeen).toBe(T0 + 2000);
    store.resumeSleep(T0 + 5000);
    expect(st().sleeps[0]).toMatchObject({ awakeMs: 4000, awakeSince: null });
    store.resumeSleep(T0 + 9000); // not paused
    expect(st().sleeps[0].awakeMs).toBe(4000);
    // idle past the threshold: the gap is credited as sleep
    store.noteSleepPresence(false, T0 + 10_000); // off the sleep screen: pauses
    expect(st().sleeps[0].awakeSince).toBe(T0 + 10_000);
    const idle = T0 + 10_000 + 20 * 60_000;
    store.reconcileSleep(idle);
    expect(st().sleeps[0].awakeSince).toBeNull();
    store.noteSleepPresence(false, idle + 1000);
    store.noteSleepPresence(false, idle + 1000 + 20 * 60_000); // activity after idle: banks gap + re-pauses
    expect(st().sleeps[0].awakeSince).toBe(idle + 1000 + 20 * 60_000);
    store.noteSleepPresence(true, idle + 3_000_000);
    expect(st().sleeps[0].awakeSince).toBeNull();
    store.reconcileSleep(); // no pause open: no-op
  });

  it('cancel drops the night, deletes the doc with a durable tombstone, and remembers the skipped auto date', async () => {
    store.setSleepSettings({ autoLog: true });
    const n = store.startSleep(T0, 'auto', T0 + 8 * 3_600_000)!;
    store.cancelSleep();
    expect(st().sleeps).toEqual([]);
    expect(st().sleepSettings.skippedAutoSleepDates).toContain(
      store.sleepDayId(T0 + 8 * 3_600_000),
    );
    await settle();
    expect(fs.deletes).toContain(`users/u1/sleeps/${n.id}`);
    expect(JSON.parse(localStorage.getItem('spotter.sleepTombstones.v1')!)).toContain(n.id);
    store.cancelSleep(); // nothing live
  });

  it('logSleepNight replaces a same-day same-kind entry but keeps a nap beside the night', () => {
    const night = store.logSleepNight({
      date: '2026-03-04',
      bedtime: T0 - 8 * 3_600_000,
      wake: T0,
      source: 'manual' as never,
    });
    expect(night.kind).toBe('sleep');
    const again = store.logSleepNight({
      date: '2026-03-04',
      bedtime: T0 - 7 * 3_600_000,
      wake: T0,
      source: 'manual' as never,
    });
    expect(st().sleeps.map((n) => n.id)).toEqual([again.id]);
    const nap = store.logSleepNight({
      date: '2026-03-04',
      bedtime: T0 + 3_600_000,
      wake: T0 + 5_400_000,
      source: 'manual' as never,
      kind: 'nap',
    });
    expect(
      st()
        .sleeps.map((n) => n.id)
        .sort(),
    ).toEqual([again.id, nap.id].sort());
  });

  it('quality / kind / update persist; removing an auto night skips that date next time; remove deletes the doc', async () => {
    const n = store.logSleepNight({
      date: '2026-03-03',
      bedtime: T0 - 30 * 3_600_000,
      wake: T0 - 22 * 3_600_000,
      source: 'auto',
    });
    store.setSleepQuality(n.id, 4 as never);
    store.setSleepKind(n.id, 'nap');
    store.updateSleepNight(n.id, { date: '2026-03-03' });
    expect(st().sleeps[0]).toMatchObject({ quality: 4, kind: 'nap' });
    await settle();
    expect((await open(at(`users/u1/sleeps/${n.id}`).at(-1)!)).quality).toBe(4);
    store.removeSleepNight(n.id);
    expect(st().sleepSettings.skippedAutoSleepDates).toContain('2026-03-03');
    await settle();
    expect(fs.deletes).toContain(`users/u1/sleeps/${n.id}`);
    store.removeSleepNight('missing');
  });

  it('schedule and settings changes keep the server auto-start queue in step', async () => {
    store.setSleepSettings({ autoLog: false });
    await settle();
    expect(fs.deletes).toContain('sleepSchedules/u1'); // auto-log off: queue removed
    store.setSleepSchedule({
      sameEveryNight: true,
      every: { bedtime: 23 * 60, wake: 7 * 60 },
      byDay: {},
    } as never);
    store.setSleepSettings({ autoLog: true });
    await settle();
    const q = at('sleepSchedules/u1').at(-1);
    expect(q).toBeDefined();
    expect(Array.isArray(q!.data.upcoming)).toBe(true);
    expect(q!.data.nextStartAt).toBe((q!.data.upcoming as { startAt: number }[])[0].startAt);
  });

  it('backfillSleepKind stamps old nights once and writes them', async () => {
    const old = {
      id: 'o',
      date: '2026-03-01',
      bedtime: T0 - 80 * 3_600_000,
      wake: T0 - 72 * 3_600_000,
      source: 'manual',
    } as unknown as SleepNight;
    store.__replaceStateForTests({ ...st(), sleeps: [old] });
    localStorage.removeItem('spotter.sleepKind.v1');
    store.backfillSleepKind();
    expect(st().sleeps[0].kind).toBe('sleep');
    expect(localStorage.getItem('spotter.sleepKind.v1')).toBe('1');
    await settle();
    expect(at('users/u1/sleeps/o')).toHaveLength(1);
    store.backfillSleepKind();
    await settle();
    expect(at('users/u1/sleeps/o')).toHaveLength(1);
  });

  it('normalizeSleeps re-dates a night to its wake day and drops exact duplicates', async () => {
    const a = {
      id: 'a',
      date: '2000-01-01',
      bedtime: T0 - 8 * 3_600_000,
      wake: T0,
      source: 'manual',
      kind: 'sleep',
    } as unknown as SleepNight;
    store.__replaceStateForTests({ ...st(), sleeps: [a] });
    store.normalizeSleeps(T0 + DAY);
    expect(st().sleeps[0].date).toBe(store.sleepDayId(T0));
    await settle();
    expect(at('users/u1/sleeps/a')).toHaveLength(1);
  });

  it('mergeServerSleepsWithLocal: live pause state survives, newer local wins, never-synced pending kept, synced-then-gone dropped', () => {
    const mk = (id: string, over: Partial<SleepNight> = {}) =>
      ({
        id,
        date: '2026-03-04',
        bedtime: 1000,
        wake: null,
        source: 'live',
        updatedAt: 1,
        ...over,
      }) as SleepNight;
    const out = store.mergeServerSleepsWithLocal(
      [
        mk('live', { bedtime: 500, autoWakeAt: 9 }),
        mk('edited', { wake: 5, updatedAt: 1 }),
        mk('same', { wake: 5, updatedAt: 9 }),
      ],
      [
        mk('live', { awakeSince: 77, lastSeen: 78 }),
        mk('edited', { wake: 6, updatedAt: 2 }),
        mk('same', { wake: 6, updatedAt: 3 }),
        mk('pending', { wake: 9 }),
      ],
    );
    const by = (id: string) => out.find((n) => n.id === id)!;
    expect(by('live')).toMatchObject({ bedtime: 500, autoWakeAt: 9, awakeSince: 77 });
    expect(by('edited').wake).toBe(6);
    expect(by('same').wake).toBe(5);
    expect(by('pending')).toBeDefined();
  });

  it('a snapshot never resurrects a night that is being deleted and re-issues the delete while the server still has it', async () => {
    const n = store.logSleepNight({
      date: '2026-03-04',
      bedtime: T0 - 8 * 3_600_000,
      wake: T0,
      source: 'manual' as never,
    });
    await settle();
    const stop = store.startSyncLoop();
    store.removeSleepNight(n.id);
    fs.deletes.length = 0;
    const sealed = at(`users/u1/sleeps/${n.id}`)[0].data;
    fs.listeners.get('users/u1/sleeps')!(snap([sealed], true));
    await settle();
    expect(st().sleeps).toEqual([]);
    expect(fs.deletes).toContain(`users/u1/sleeps/${n.id}`);
    // a server-authoritative snapshot without it retires the tombstone
    fs.listeners.get('users/u1/sleeps')!(snap([]));
    await settle();
    expect(JSON.parse(localStorage.getItem('spotter.sleepTombstones.v1')!)).not.toContain(n.id);
    stop();
  });

  it('a server night arrives sealed and is opened; a never-synced local night is pushed up', async () => {
    const local = store.logSleepNight({
      date: '2026-03-04',
      bedtime: T0 - 8 * 3_600_000,
      wake: T0,
      source: 'manual' as never,
    });
    await settle();
    const sealed = at(`users/u1/sleeps/${local.id}`)[0].data;
    fs.writes.length = 0;
    store.resetLocalData();
    const stop = store.startSyncLoop();
    fs.listeners.get('users/u1/sleeps')!(snap([sealed]));
    await settle();
    expect(st().sleeps.map((x) => x.id)).toEqual([local.id]);
    expect(fs.writes.filter((w) => w.path.includes('/sleeps/'))).toHaveLength(0); // identical: nothing re-written
    stop();
  });
});

describe('gyms', () => {
  const gym = (over: Partial<Gym> = {}) => ({
    name: 'Iron Temple',
    lat: 54.7,
    lng: 25.3,
    radiusM: 100,
    ...over,
  });

  it('upsertGym seals the doc (name and coordinates unreadable) under a client-made id; same id = same document', async () => {
    const g = store.upsertGym(gym());
    store.upsertGym({ ...g, name: 'Renamed' });
    await settle();
    const w = at(`users/u1/gyms/${g.id}`);
    expect(w).toHaveLength(2);
    expect(Object.keys(w[0].data).sort()).toEqual(['enc', 'id', 'updatedAt']);
    expect(JSON.stringify(w[0].data)).not.toContain('Iron');
    expect(JSON.stringify(w[0].data)).not.toContain('54.7');
    expect(st().gyms).toHaveLength(1);
    expect(st().gyms[0].name).toBe('Renamed');
    store.deleteGym(g.id);
    await settle();
    expect(fs.deletes).toEqual([`users/u1/gyms/${g.id}`]);
    expect(st().gyms).toEqual([]);
  });

  it('toggleFavorite flips an explicit choice only where it differs from the log; unknown ids ignored', () => {
    const g = store.upsertGym(gym());
    store.toggleFavorite('missing');
    store.toggleFavorite(g.id);
    expect(st().gyms[0].favorite).toBe(true);
    store.toggleFavorite(g.id);
    expect('favorite' in st().gyms[0]).toBe(false);
  });

  it('fine equipment derives the coarse inventory and, for a shared gym, writes only the delta to the shared doc', async () => {
    const g = store.upsertGym(gym({ externalId: 'osm-1' }));
    store.setGymEquipment(g.id, ['cardio-treadmill', 'cardio-treadmill']);
    expect(st().gyms[0].equipmentItems).toEqual(['cardio-treadmill']);
    expect(st().gyms[0].inventory!.length).toBeGreaterThan(0);
    store.setGymEquipment(g.id, ['cardio-bike']);
    await settle();
    const shared = at('sharedGyms/osm-1');
    expect(shared).toHaveLength(3);
    expect(shared[0].data.equipmentItems).toEqual({ union: ['cardio-treadmill'] });
    expect(shared[1].data.equipmentItems).toEqual({ union: ['cardio-bike'] });
    expect(shared[0].opts).toEqual({ merge: true });
    // the removal went out as its own delta
    expect(shared[2].data.equipmentItems).toEqual({ remove: ['cardio-treadmill'] });
    store.setGymEquipment('missing', ['x']);
  });

  it('addGymKit returns what to restore; restoreGymKit puts it back; "not here" is remembered', () => {
    const g = store.upsertGym(gym());
    expect(store.addGymKit('missing', ['cardio-bike'])).toBeNull();
    const prev = store.addGymKit(g.id, ['cardio-bike'])!;
    expect(prev).toEqual({ items: [], inventory: [] });
    expect(st().gyms[0].equipmentItems).toEqual(['cardio-bike']);
    store.restoreGymKit(g.id, prev);
    expect(st().gyms[0].equipmentItems).toEqual([]);
    expect(st().gyms[0].inventory).toEqual([]);
    store.markGymKitNotHere(g.id, 'cardio-bike');
    store.markGymKitNotHere(g.id, 'cardio-bike');
    expect(st().gyms[0].equipmentNotHere).toEqual(['cardio-bike']);
    store.markGymKitNotHere('missing', 'x');
    expect(store.gymKitEvidence('missing', T0)).toEqual([]);
    expect(Array.isArray(store.gymKitEvidence(g.id, T0))).toBe(true);
  });

  it('band library falls back to defaults and is saved per gym', () => {
    const g = store.upsertGym(gym());
    expect(store.bandLibraryFor(null).length).toBeGreaterThan(0);
    expect(store.bandLibraryFor(st().gyms[0])).toBe(store.bandLibraryFor(null));
    store.setGymBandLibrary(g.id, [{ color: 'red', kg: 10 } as never]);
    expect(store.bandLibraryFor(st().gyms[0])).toEqual([{ color: 'red', kg: 10 }]);
    store.setGymBandLibrary('missing', []);
  });

  it('the gyms snapshot opens sealed gyms and watches shared inventories (permission errors just stop watching)', async () => {
    const g = store.upsertGym(gym({ externalId: 'osm-9' }));
    await settle();
    const sealed = at(`users/u1/gyms/${g.id}`)[0].data;
    store.resetLocalData();
    const stop = store.startSyncLoop();
    fs.listeners.get('users/u1/gyms')!(snap([sealed]));
    await settle();
    expect(st().gyms.map((x) => x.id)).toEqual([g.id]);
    expect(fs.listeners.has('sharedGyms/osm-9')).toBe(true);
    fs.listeners.get('sharedGyms/osm-9')!({
      data: () => ({ equipmentItems: ['cardio-bike'], updatedAt: 5 }),
    });
    expect(st().sharedGyms['osm-9']).toEqual({ equipmentItems: ['cardio-bike'], updatedAt: 5 });
    expect(st().gyms[0].equipmentItems).toEqual(['cardio-bike']);
    fs.listeners.get('sharedGyms/osm-9')!({ data: () => undefined });
    expect(st().sharedGyms['osm-9'].updatedAt).toBe(5);
    stop();
  });

  it('pickSessionGym: none, single, then the most-used recent one', () => {
    expect(store.pickSessionGym()).toBeNull();
    const a = store.upsertGym(gym({ name: 'A' }));
    expect(store.pickSessionGym()?.id).toBe(a.id);
    const b = store.upsertGym(gym({ name: 'B', lat: 10, lng: 10 }));
    const mkW = (id: string, gymId: string, n: number) =>
      ({
        id,
        startedAt: T0 - n * DAY,
        finishedAt: T0 - n * DAY + 1,
        autoFinished: false,
        gymId,
        exercises: [],
      }) as never;
    store.__replaceStateForTests({
      ...st(),
      workouts: [mkW('1', b.id, 1), mkW('2', b.id, 2), mkW('3', a.id, 3)],
    });
    expect(store.pickSessionGym()?.id).toBe(b.id);
    // nothing recent: the latest one
    store.__replaceStateForTests({ ...st(), workouts: [mkW('4', a.id, 200), mkW('5', b.id, 300)] });
    expect(store.pickSessionGym()?.id).toBe(a.id);
    // a cached nearby position wins
    localStorage.setItem(
      'spotter.lastPos',
      JSON.stringify({ lat: 10, lng: 10, accuracy: 5, at: T0 }),
    );
    expect(store.pickSessionGym()?.id).toBe(b.id);
  });
});
