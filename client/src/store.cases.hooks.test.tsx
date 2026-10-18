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
import { act, renderHook } from '@testing-library/react';
import * as store from './store';
import { setRole } from './api';
import type { SetEntry, Workout } from './types';

const T0 = new Date('2026-03-04T10:00:00Z').getTime();
const DAY = 86_400_000;
const st = () => store.__getStateForTests();
const settle = async () => {
  for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 8));
};
const snap = (d: Record<string, unknown> | null) => ({
  exists: () => d !== null,
  data: () => d,
  docs: d ? [{ data: () => d }] : [],
  metadata: { fromCache: false, hasPendingWrites: false },
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

describe('React bindings', () => {
  it('useStore re-renders on every change and stops after unsubscribe', () => {
    const { result, unmount } = renderHook(() => store.useStore());
    expect(result.current.weightUnit).toBe('kg');
    act(() => store.setGlobalWeightUnit('lb'));
    expect(result.current.weightUnit).toBe('lb');
    const n = vi.fn();
    const off = store.subscribeStore(n);
    act(() => store.setGlobalWeightUnit('kg'));
    expect(n).toHaveBeenCalled();
    off();
    n.mockClear();
    act(() => store.setGlobalWeightUnit('lb'));
    expect(n).not.toHaveBeenCalled();
    unmount();
    expect(store.getStoreState().weightUnit).toBe('lb');
  });

  it('the private-data hooks follow the state objects they select', () => {
    const cycle = renderHook(() => store.useCycle());
    const nic = renderHook(() => store.useNicotine());
    const alc = renderHook(() => store.useAlcohol());
    const sup = renderHook(() => store.useSupplements());
    const nicLoad = renderHook(() => store.useNicotineLoad());
    const nicFx = renderHook(() => store.useNicotineEffects());
    const alcLoad = renderHook(() => store.useAlcoholLoad());
    const alcFx = renderHook(() => store.useAlcoholEffects());
    const pend = renderHook(() => store.usePendingAlcoholCheckin());
    const region = renderHook(() => store.useAlcoholRegion());
    expect(cycle.result.current.enabled).toBe(false);
    expect(nic.result.current.products).toEqual([]);
    expect(alc.result.current.entries).toEqual([]);
    expect(sup.result.current.entries).toEqual([]);
    expect(nicLoad.result.current).toEqual(store.getNicotineLoad());
    expect(nicFx.result.current).toBeNull();
    expect(alcLoad.result.current).toEqual({ gramsPerWeek: 0, gramsPerDay: 0 });
    expect(alcFx.result.current).toBeNull();
    expect(pend.result.current).toBeNull();
    expect(typeof region.result.current).toBe('string');
    act(() =>
      store.saveCycleSettings({
        mode: 'regular',
        length: 28,
        period: 5,
        anchor: store.dayKey(T0) - 3,
      }),
    );
    expect(cycle.result.current.enabled).toBe(true);
  });

  it('trainer id and coach role stay unknown until the own profile has loaded', () => {
    const tid = renderHook(() => store.useSelfTrainerId());
    const role = renderHook(() => store.useSelfCoachRole());
    expect(tid.result.current).toBeNull();
    expect(role.result.current).toBeNull();
    const stop = store.startSyncLoop();
    act(() => fs.listeners.get('users/u1')!(snap({})));
    expect(role.result.current).toBe('main');
    act(() => fs.listeners.get('users/u1')!(snap({ trainerId: 'c1' })));
    expect(tid.result.current).toBe('c1');
    expect(role.result.current).toBe('extra');
    stop();
  });

  it('supplement facts: trained days, workout starts and latest body weight', () => {
    store.addWeight(80, T0 - 2 * DAY);
    store.addWeight(82, T0 - DAY);
    store.logActivity({
      type: 'Run',
      category: 'conditioning',
      startedAt: T0 - DAY,
      finishedAt: T0 - DAY + 1000,
      durationMin: 20,
    });
    store.logActivity({
      type: 'Stretch',
      category: 'recovery',
      startedAt: T0 - 5 * DAY,
      finishedAt: T0 - 5 * DAY + 1000,
      durationMin: 20,
    });
    store.__replaceStateForTests({
      ...st(),
      workouts: [
        {
          id: 'w',
          startedAt: T0 - 3 * DAY,
          finishedAt: T0 - 3 * DAY + 1,
          autoFinished: false,
          gymId: null,
          exercises: [],
        },
      ],
    });
    const f = store.getSupplementTrainingFacts(T0);
    expect(f.bodyWeightKg).toBe(82);
    expect(f.workoutStarts).toEqual([T0 - 3 * DAY]);
    expect(f.trainedDays).toHaveLength(2); // the workout day and the conditioning day, not the recovery one
    expect(f.todayKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(store.getSupplements().entries).toEqual([]);
  });
});

describe('rest maths', () => {
  const s = (over: Partial<SetEntry>): SetEntry => ({
    id: 'x',
    reps: 10,
    weight: 50,
    isWarmup: false,
    position: 0,
    ...over,
  });

  it('restMs is the real gap, never negative, null without stamps', () => {
    expect(store.restMs(1000, 4000)).toBe(3000);
    expect(store.restMs(4000, 1000)).toBe(0);
    expect(store.restMs(null, 1000)).toBeNull();
    expect(store.restMs(1000, undefined)).toBeNull();
  });

  it('set work time: a hold uses its duration, a normal set 3 s per rep with a 30 s floor', () => {
    expect(store.setWorkSeconds({ reps: 10, durationMin: 2 })).toBe(120);
    expect(store.setWorkSeconds({ reps: 20, durationMin: null })).toBe(60);
    expect(store.setWorkSeconds({ reps: 2, durationMin: 0 })).toBe(30);
    expect(store.setWorkSeconds({ reps: -5, durationMin: null })).toBe(30);
  });

  it('rest before a set nets out its own working time; implausible gaps are null', () => {
    expect(store.restBeforeSet(0, s({ loggedAt: 1 }))).toBeNull();
    expect(store.restBeforeSet(1000, s({}))).toBeNull();
    expect(store.restBeforeSet(1000, s({ loggedAt: 1000 }))).toBeNull();
    expect(store.restBeforeSet(1000, s({ loggedAt: 1000 + 3 * 3600 * 1000 }))).toBeNull();
    expect(store.restBeforeSet(1000, s({ loggedAt: 1000 + 120_000 }))).toBe(120 - 30);
    expect(store.restBeforeSet(1000, s({ loggedAt: 1000 + 10_000 }))).toBe(0);
  });

  it('restBeforeSetInWorkout finds the previous set across exercises and stops at a cool-down', () => {
    const a = s({ id: 'a', loggedAt: 100_000 });
    const b = s({ id: 'b', loggedAt: 220_000 });
    const w = {
      id: 'w',
      startedAt: 0,
      finishedAt: null,
      autoFinished: false,
      gymId: null,
      exercises: [
        { id: 'e1', name: 'Squat', position: 0, sets: [a] },
        { id: 'e2', name: 'Bench Press', position: 1, sets: [b] },
      ],
    } as unknown as Workout;
    expect(store.restBeforeSetInWorkout(w, s({ loggedAt: undefined }))).toBeNull();
    expect(store.restBeforeSetInWorkout(w, a)).toBeNull(); // first set: nothing before
    expect(store.restBeforeSetInWorkout(w, b)).toBe(120 - 30);
    const withCooldown = {
      ...w,
      exercises: [
        ...w.exercises,
        { id: 'c', name: 'Cool-down', kind: 'cooldown', position: 2, markerAt: 150_000, sets: [] },
      ],
    } as unknown as Workout;
    expect(store.restBeforeSetInWorkout(withCooldown, b)).toBeNull();
  });

  it('cooldownInProgress: started by hand, or implied once the planned work is complete', () => {
    const lift = (sets: number, logged: number) => ({
      id: 'l',
      name: 'Squat',
      position: 0,
      plannedSets: 2,
      sets: Array.from({ length: sets }, (_, i) => s({ id: `s${i}`, loggedAt: logged + i })),
    });
    const cd = (markerAt?: number) => ({
      id: 'cd',
      name: 'Cool-down',
      kind: 'cooldown',
      position: 1,
      markerAt,
      sets: [],
    });
    const w = (exs: unknown[]) =>
      ({
        id: 'w',
        startedAt: 0,
        finishedAt: null,
        autoFinished: false,
        gymId: null,
        exercises: exs,
      }) as unknown as Workout;
    expect(store.cooldownInProgress(w([lift(2, 1000), cd(5000)]))?.id).toBe('cd');
    expect(store.cooldownInProgress(w([lift(2, 1000), cd(undefined)]))?.id).toBe('cd'); // all planned sets done
    expect(store.cooldownInProgress(w([lift(1, 1000), cd(undefined)]))).toBeNull();
    expect(store.cooldownInProgress(w([cd(undefined)]))).toBeNull();
    const extra = { ...lift(1, 9000), id: 'extra', position: 2, plannedSets: 1 };
    expect(store.cooldownInProgress(w([lift(2, 1000), cd(5000), extra]))).toBeNull(); // an exercise after the cool-down brings the clock back
  });

  it('clearStoredRest wipes legacy per-set rest once, only after workouts have loaded', async () => {
    store.clearStoredRest();
    expect(localStorage.getItem('spotter.restCleared.v2')).toBeNull(); // nothing loaded yet: flag must not be set
    const w = store.startWorkout()!;
    const e = store.addExercise(w.id, 'Squat');
    store.upsertSet(w.id, e.id, { reps: 5, weight: 100, isWarmup: false, restSec: 90 });
    store.finishWorkout(w.id);
    expect(st().workouts[0].exercises[0].sets[0].restSec).toBe(90);
    localStorage.removeItem('spotter.restCleared.v2');
    store.clearStoredRest();
    expect(st().workouts[0].exercises[0].sets[0].restSec).toBeNull();
    expect(localStorage.getItem('spotter.restCleared.v2')).toBe('1');
    await settle();
    const n = fs.writes.length;
    store.clearStoredRest();
    await settle();
    expect(fs.writes.length).toBe(n);
  });

  it('clearStoredRest still runs when storage throws', () => {
    const w = store.startWorkout()!;
    const e = store.addExercise(w.id, 'Squat');
    store.upsertSet(w.id, e.id, { reps: 5, weight: 100, isWarmup: false, restSec: 90 });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    store.clearStoredRest();
    expect(st().workouts[0].exercises[0].sets[0].restSec).toBeNull();
  });
});
