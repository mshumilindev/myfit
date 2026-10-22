import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fs = vi.hoisted(() => ({
  writes: [] as { path: string; data: Record<string, unknown>; opts?: unknown }[],
  deletes: [] as string[],
  listeners: new Map<string, (snap: unknown) => void>(),
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
import { setRole } from './api';
import { registerCustomExercises } from './data/exercises';
import { EQUIPMENT_CATALOG } from './data/equipmentCatalog';
import type { GeneratedDay, PlannedExercise } from './sessionBuilder';

const T0 = new Date('2026-03-04T10:00:00Z').getTime();
const st = () => store.__getStateForTests();
const settle = async () => {
  for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 8));
};
const at = (path: string) => fs.writes.filter((w) => w.path === path);
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
  fs.failWith = null;
  fs.uid = 'u1';
  fs.callResult = () => {
    throw new Error('offline');
  };
  setRole('member');
  registerCustomExercises([]);
  store.resetLocalData();
});
afterEach(async () => {
  vi.useRealTimers();
  await settle();
  store.resetLocalData();
  registerCustomExercises([]);
});

describe('session builder', () => {
  const planned = (over: Partial<PlannedExercise>): PlannedExercise => ({
    name: 'Squat',
    kind: 'strength',
    primary: 'quads',
    secondary: ['glutes'],
    equipment: ['barbell'],
    loadType: 'weight',
    sets: 3,
    repLow: 6,
    repHigh: 8,
    targetWeight: 100,
    deltaKg: 0,
    progState: '',
    warmup: [],
    whyKey: 'steady' as never,
    priority: 1,
    ...over,
  });
  const day = (): GeneratedDay => ({
    dayName: 'Legs',
    intent: 'build' as never,
    targetMuscles: ['quads'],
    warmup: [
      planned({
        name: 'x',
        kind: 'warmup',
        sets: 0,
        repHigh: 0,
        primary: null,
        secondary: [],
        durationMin: 5,
      }),
    ],
    main: [planned({}), planned({ name: 'Leg Curl', primary: 'hamstrings', secondary: [] })],
    cardio: [
      planned({
        name: 'c',
        kind: 'cardio',
        sets: 0,
        repHigh: 0,
        primary: 'cardio' as never,
        secondary: [],
        durationMin: 10,
        equipmentItems: ['cardio-bike'],
      }),
    ],
    cooldown: [
      planned({ name: 'y', kind: 'cooldown', sets: 0, repHigh: 0, primary: null, secondary: [] }),
    ],
    coverage: [{ muscle: 'quads', sets: 6 }],
    estMinutes: 50,
  });

  it('startGeneratedDay builds a live workout with planned sets/reps per block in order', () => {
    const w = store.startGeneratedDay(day(), null)!;
    expect(w.exercises.map((e) => e.kind)).toEqual([
      'warmup',
      'strength',
      'strength',
      'cardio',
      'cooldown',
    ]);
    const squat = w.exercises[1];
    expect([squat.plannedSets, squat.plannedReps, squat.primaryMuscle]).toEqual([3, 8, 'quads']);
    expect(w.exercises[0].plannedSets).toBeNull();
    expect(w.exercises[0].plannedDurationMin).toBe(5);
    expect(w.exercises[3].equipmentItems).toEqual(['cardio-bike']);
    expect(w.targetMuscles).toEqual(['quads']);
    expect(w.dayName).toBeTruthy();
  });

  it('startGeneratedDay does nothing while another live mode runs', () => {
    store.startActivity('Run', 'conditioning');
    expect(store.startGeneratedDay(day())).toBeNull();
  });

  it('cardioBlockName resolves the machine name, or the incline-walk fallback', () => {
    expect(store.cardioBlockName(null, 'Incline walk', 'en')).toBe('Incline walk');
    expect(store.cardioBlockName('cardio-treadmill', 'Incline walk', 'en')).toBe('Incline walk');
    expect(store.cardioBlockName('no-such-machine', 'Incline walk', 'en')).toBe('Incline walk');
    const machine = EQUIPMENT_CATALOG.find(
      (e) => e.id !== 'cardio-treadmill' && e.id.startsWith('cardio'),
    )!;
    expect(store.cardioBlockName(machine.id, 'Incline walk', 'en')).not.toBe('Incline walk');
  });

  it('saveGeneratedDayAsProgram: signed out throws; no program creates a draft and activates it', async () => {
    fs.uid = null;
    await expect(store.saveGeneratedDayAsProgram(day(), 3, 'Leg day')).rejects.toThrow(
      'not signed in',
    );
    fs.uid = 'u1';
    fs.callResult = (n) => {
      if (n === 'programMine') return { assignment: null };
      return {};
    };
    const r = await store.saveGeneratedDayAsProgram(day(), 3, '  Leg day ');
    expect(r).toEqual({ status: 'active', days: [3] });
    const prog = fs.writes.find((w) => w.path.startsWith('programs/'))!;
    expect(prog.data).toMatchObject({
      authorId: 'u1',
      status: 'draft',
      name: 'Leg day',
      daysPerWeek: 1,
      dayNames: { '3': 'Leg day' },
    });
    expect((prog.data.items as { day: number }[]).every((i) => i.day === 3)).toBe(true);
    expect(fs.calls.at(-1)).toEqual({
      name: 'setProgramStatus',
      body: { id: prog.data.id, status: 'active' },
    });
  });

  it('activation rejected: the program stays a draft; a blank name falls back to the day name', async () => {
    fs.callResult = (n) => {
      if (n === 'programMine') throw new Error('offline');
      throw new Error('validation');
    };
    const r = await store.saveGeneratedDayAsProgram(day(), 1, '   ');
    expect(r).toEqual({ status: 'draft', days: [1] });
    expect(fs.writes.find((w) => w.path.startsWith('programs/'))!.data.name).toBe('Legs');
  });

  it('with an own active program the day is appended to it, replacing that weekday', async () => {
    fs.callResult = () => ({
      assignment: {
        program: {
          id: 'p1',
          authorId: 'u1',
          name: 'Mine',
          weeks: 0,
          daysPerWeek: 2,
          dayNames: { '1': 'Push' },
          targetMuscles: { '1': ['chest'] },
          items: [
            { id: 'i1', day: 1, name: 'Bench' },
            { id: 'i2', day: 3, name: 'Old Squat' },
          ],
        },
      },
    });
    const r = await store.saveGeneratedDayAsProgram(day(), 3, 'Legs');
    expect(r).toEqual({ status: 'active', days: [1, 3] });
    const w = fs.writes.find((x) => x.path === 'programs/p1')!;
    const its = w.data.items as { day: number; name: string }[];
    expect(its.filter((i) => i.day === 3).map((i) => i.name)).toEqual(['Squat', 'Leg Curl']);
    expect(w.data).toMatchObject({
      status: 'active',
      daysPerWeek: 2,
      dayNames: { '1': 'Push', '3': 'Legs' },
    });
    // someone else's program is not touched: a new one is created instead
    fs.writes.length = 0;
    fs.callResult = () => ({ assignment: { program: { id: 'p9', authorId: 'coach', items: [] } } });
    await store.saveGeneratedDayAsProgram(day(), 2, 'Legs');
    expect(fs.writes.some((x) => x.path === 'programs/p9')).toBe(false);
  });
});

describe('live session presence for a coached athlete', () => {
  it('writes only startedAt/trainerId (no contents) and removes the doc when finished; silent without a coach', async () => {
    const stop = store.startSyncLoop();
    const w = store.startWorkout()!;
    store.addExercise(w.id, 'Squat');
    expect(fs.deletes).toContain('liveSessions/u1'); // no coach yet: no doc
    fs.listeners.get('users/u1')!(snap({ trainerId: 'coach1', firstName: 'A' }));
    expect(store.legacyLiveWriterOn()).toBe(true);
    store.writeLiveSession(st().workouts[0]);
    await settle();
    const live = at('liveSessions/u1').at(-1)!;
    expect(Object.keys(live.data).sort()).toEqual(['id', 'startedAt', 'trainerId', 'updatedAt']);
    expect(live.data.trainerId).toBe('coach1');
    store.finishWorkout(w.id);
    expect(fs.deletes.filter((d) => d === 'liveSessions/u1').length).toBeGreaterThan(1);
    stop();
  });

  it('trainer view: live athletes arrive from the liveSessions query', () => {
    setRole('trainer');
    const stop = store.startSyncLoop();
    fs.listeners.get('liveSessions')!({
      docs: [{ data: () => ({ id: 'a1', trainerId: 'u1', startedAt: 5, updatedAt: 6 }) }],
    });
    expect(st().liveTrainees.map((l) => l.id)).toEqual(['a1']);
    stop();
  });

  it('exposes the coach role and trainer id reactively once the profile loaded', async () => {
    const stop = store.startSyncLoop();
    fs.listeners.get('users/u1')!(snap({ trainerId: null }));
    fs.listeners.get('users/u1')!(snap({ trainerId: 'c9' }));
    stop();
  });
});
