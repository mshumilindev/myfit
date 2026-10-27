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
import { vault } from './vaultIO';
import { isSealed, unsealDoc } from './encryptedDoc';
import { setRole } from './api';
import { registerCustomExercises } from './data/exercises';

const T0 = new Date('2026-03-04T10:00:00Z').getTime();
const DAY = 86_400_000;
const st = () => store.__getStateForTests();
const settle = async () => {
  for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 8));
};
const at = (path: string) => fs.writes.filter((w) => w.path === path);
const open = (w: { data: Record<string, unknown> }) =>
  unsealDoc<Record<string, unknown>>(
    w.data,
    (vault as unknown as import('./autoVault').Vault).material().key,
  );
const snap = (d: Record<string, unknown> | null) => ({
  exists: () => d !== null,
  data: () => d,
  docs: d ? [{ data: () => d }] : [],
  metadata: { fromCache: false, hasPendingWrites: false },
});

beforeEach(async () => {
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
  // the per-test consent reset (legal/testSetup) republishes the coach view asynchronously: let it land, then start clean
  await settle();
  fs.writes.length = 0;
});
afterEach(async () => {
  vi.useRealTimers();
  await settle();
  store.resetLocalData();
  registerCustomExercises([]);
});

describe('shared exercise catalog (trainer / admin only)', () => {
  const meta = {
    name: '  My Cable Twist ',
    primaryMuscle: 'core' as const,
    secondaryMuscles: [],
    equipment: ['cable'],
  };

  it('a member cannot write the shared catalog', async () => {
    store.saveCatalogExercise(meta);
    store.updateCatalogExercise('x', meta);
    store.deleteCatalogExercise('x');
    await settle();
    expect(fs.writes).toEqual([]);
    expect(fs.deletes).toEqual([]);
    expect(store.myExercises()).toEqual([]);
  });

  it('a trainer saves under the lowercased name; rename removes the old document; delete removes it', async () => {
    setRole('trainer');
    store.saveCatalogExercise({ ...meta, subRegions: { core: ['upper'] } as never });
    expect(store.myExercises().map((m) => [m.id, m.source])).toEqual([
      ['my cable twist', 'catalog'],
    ]);
    await settle();
    const w = at('exerciseCatalog/my cable twist')[0];
    expect(w.data).toMatchObject({
      id: 'my cable twist',
      name: 'My Cable Twist',
      kind: 'strength',
      createdBy: 'u1',
    });
    expect(w.data.subRegions).toBeDefined();

    store.updateCatalogExercise('my cable twist', { ...meta, name: 'Cable Twist 2' });
    await settle();
    expect(fs.deletes).toContain('exerciseCatalog/my cable twist');
    expect(at('exerciseCatalog/cable twist 2')).toHaveLength(1);
    expect(store.myExercises().map((m) => m.id)).toEqual(['cable twist 2']);

    store.deleteCatalogExercise('cable twist 2');
    await settle();
    expect(store.myExercises()).toEqual([]);
    expect(fs.deletes).toContain('exerciseCatalog/cable twist 2');
  });

  it('the catalog snapshot registers custom exercises; signed-out trainers only change local state', async () => {
    setRole('admin');
    fs.uid = null;
    store.saveCatalogExercise(meta);
    await settle();
    expect(fs.writes).toEqual([]);
    expect(store.myExercises()).toHaveLength(1);
    fs.uid = 'u1';
    const stop = store.startSyncLoop();
    const cb = fs.listeners.get('exerciseCatalog')!;
    cb({
      docs: [
        {
          data: () => ({
            id: 'srv',
            name: 'Server Move',
            primaryMuscle: 'chest',
            secondaryMuscles: [],
            equipment: [],
          }),
        },
      ],
    });
    expect(store.myExercises().map((m) => m.id)).toEqual(['srv']);
    stop();
  });
});

describe('warm-up block items', () => {
  const setup = () => {
    const w = store.startWorkout()!;
    const wu = store.addExercise(w.id, 'Warm-up', 'warmup');
    return { w: w.id, wu: wu.id };
  };
  const items = (w: string) =>
    st().workouts.find((x) => x.id === w)!.exercises[0].warmupItems ?? [];

  it('items are cleaned, summed into the marker minutes only when done, and removable', () => {
    const { w, wu } = setup();
    expect(store.addWarmupItem(w, wu, { name: '   ' })).toBeNull();
    const a = store.addWarmupItem(w, wu, {
      name: ' Arm circles ',
      durationSec: 90.4,
      reps: 0,
      weight: -5,
    })!;
    expect(a).toMatchObject({ name: 'Arm circles', durationSec: 90, done: false });
    expect('reps' in a).toBe(false);
    expect('weight' in a).toBe(false);
    expect(st().workouts[0].exercises[0].plannedDurationMin).toBeNull();
    const b = store.addWarmupItem(w, wu, {
      name: 'Band pull',
      reps: 12.6,
      weight: 5,
      exerciseId: 'ex1',
    })!;
    store.logWarmupItem(w, wu, a.id, { durationSec: 120 });
    expect(items(w).find((i) => i.id === a.id)).toMatchObject({ done: true, durationSec: 120 });
    expect(items(w).find((i) => i.id === a.id)!.at).toBe(T0);
    expect(st().workouts[0].exercises[0].plannedDurationMin).toBe(2);
    store.updateWarmupItem(w, wu, b.id, { reps: 15, weight: 0 });
    expect(items(w).find((i) => i.id === b.id)).toMatchObject({
      reps: 15,
      exerciseId: 'ex1',
      done: false,
    });
    expect('weight' in items(w).find((i) => i.id === b.id)!).toBe(false);
    store.removeWarmupItem(w, wu, a.id);
    store.removeWarmupItem(w, wu, b.id);
    expect(st().workouts[0].exercises[0].warmupItems).toBeUndefined();
  });

  it('setWarmupItems replaces the list with fresh, undone items; minutes apply to a generic warm-up', () => {
    const { w, wu } = setup();
    store.setWarmupMinutes(w, wu, 7.4);
    expect(st().workouts[0].exercises[0].plannedDurationMin).toBe(7);
    store.setWarmupMinutes(w, wu, 0);
    expect(st().workouts[0].exercises[0].plannedDurationMin).toBeNull();
    store.setWarmupItems(w, wu, [
      { name: 'Jog', durationSec: 60, done: true },
      { name: '' },
      { name: 'Hops', reps: 10 },
    ]);
    expect(items(w).map((i) => [i.name, i.done])).toEqual([
      ['Jog', false],
      ['Hops', false],
    ]);
    store.addWarmupItem('nope', wu, { name: 'x' });
    store.setWarmupMinutes(w, 'nope', 3);
  });

  it('a warm-up with logged sets is no longer a marker: its items are read-only', () => {
    const { w, wu } = setup();
    store.upsertSet(w, wu, { reps: 1, weight: 0, isWarmup: false });
    expect(store.addWarmupItem(w, wu, { name: 'x' })).toBeNull();
  });

  it('the measured warm-up time is frozen once the first strength set is logged', () => {
    const { w, wu } = setup();
    const lift = store.addExercise(w, 'Squat');
    vi.setSystemTime(T0 + 5 * 60_000);
    store.upsertSet(w, lift.id, { reps: 5, weight: 100, isWarmup: false });
    const marker = st().workouts[0].exercises.find((e) => e.id === wu)!;
    expect(marker.warmupMeasuredSec).toBeGreaterThan(0);
    const before = marker.warmupMeasuredSec;
    vi.setSystemTime(T0 + 15 * 60_000);
    store.freezeWarmupMeasure(w);
    expect(st().workouts[0].exercises.find((e) => e.id === wu)!.warmupMeasuredSec).toBe(before);
    store.freezeWarmupMeasure('nope');
  });
});

describe('home sets', () => {
  it('sets and own moves are saved, edited, deleted, and synced as one document (sealed, SPO-217)', async () => {
    const mv = store.saveHomeMove({
      name: ' Door Rows ',
      measure: 'reps',
      muscle: 'lats',
      icon: 'door',
    });
    const set1 = store.saveHomeSet({ name: ' Morning ', moves: [mv.id, mv.id, 'Pullups'] });
    expect(set1.moves).toEqual([mv.id, 'Pullups']);
    expect(set1.name).toBe('Morning');
    const edited = store.saveHomeSet({ id: set1.id, name: 'Morning 2', moves: ['Pullups'] });
    expect(edited.createdAt).toBe(set1.createdAt);
    expect(st().home.sets).toHaveLength(1);
    await settle();
    const w = at('users/u1/meta/home').at(-1)!;
    expect(isSealed(w.data)).toBe(true); // sealed (SPO-217): no set or move names readable in the database
    expect(w.data.sets).toBeUndefined();
    expect((await open(w)).sets).toHaveLength(1);
    store.deleteHomeMove(mv.id);
    expect(st().home.moves).toEqual([]);
    store.deleteHomeSet(set1.id);
    expect(st().home.sets).toEqual([]);
  });

  it('startHomeSet opens a live home session with the moves; refuses while a session with exercises is live', () => {
    const mv = store.saveHomeMove({
      name: 'Door Rows',
      measure: 'hold',
      muscle: 'lats',
      icon: 'door',
    });
    const s = store.saveHomeSet({ name: 'S', moves: [mv.id, 'Pullups', 'missing-move'] });
    const w = store.startHomeSet({ set: s, name: 'S', moves: s.moves })!;
    expect(w.kind).toBe('home');
    expect(w.homeSetId).toBe(s.id);
    expect(w.exercises.map((e) => e.name)).toEqual(['Door Rows', 'Pullups']);
    expect(w.exercises[0].measure).toBe('hold');
    expect(store.startHomeSet({ name: 'again', moves: [] })).toBeNull();
    store.setExerciseMeasure(w.id, w.exercises[0].id, 'reps');
    expect(st().workouts[0].exercises[0].measure).toBeNull();
    store.setExerciseMeasure(w.id, w.exercises[0].id, 'time');
    expect(st().workouts[0].exercises[0].measure).toBe('time');
    store.setExerciseMeasure('nope', 'x', 'time');
  });

  it('renaming an own move renames it in a live home session', () => {
    const mv = store.saveHomeMove({
      name: 'Door Rows',
      measure: 'reps',
      muscle: 'lats',
      icon: 'door',
    });
    const w = store.startHomeSet({ name: 'S', moves: [mv.id] })!;
    store.saveHomeMove({
      id: mv.id,
      name: 'Door Pulls',
      measure: 'hold',
      muscle: 'lats',
      icon: 'door',
    });
    expect(st().workouts.find((x) => x.id === w.id)!.exercises[0]).toMatchObject({
      name: 'Door Pulls',
      measure: 'hold',
    });
  });

  it('backfillHomeSet makes a draft that stays off the server until saved', async () => {
    const mv = store.saveHomeMove({
      name: 'Door Rows',
      measure: 'reps',
      muscle: 'lats',
      icon: 'door',
    });
    const s = store.saveHomeSet({ name: 'S', moves: [mv.id] });
    const w = store.backfillHomeSet(T0 - DAY, 600_000, s);
    expect(w).toMatchObject({ kind: 'home', homeSetId: s.id, dayName: 'S' });
    expect(w.exercises).toHaveLength(1);
    const bare = store.backfillHomeSet(T0 - 2 * DAY, 600_000, null);
    expect(bare.homeSetId).toBeNull();
    await settle();
    expect(fs.writes.filter((x) => x.path.includes('/workouts/'))).toEqual([]);
  });

  it('an idle live home set finishes itself at its last set and keeps what was logged', async () => {
    const mv = store.saveHomeMove({
      name: 'Door Rows',
      measure: 'reps',
      muscle: 'lats',
      icon: 'door',
    });
    const w = store.startHomeSet({ name: 'S', moves: [mv.id, 'Pullups'] })!;
    store.upsertSet(w.id, st().workouts[0].exercises[0].id, {
      reps: 8,
      weight: null,
      isWarmup: false,
    });
    vi.setSystemTime(T0 + 30 * 60_000);
    store.applyAutoFinish();
    const fin = st().workouts[0];
    expect(fin.finishedAt).toBe(T0 + 60_000);
    expect(fin.autoFinished).toBe(false);
    expect(fin.exercises.map((e) => e.name)).toEqual(['Door Rows']);
    await settle();
    expect(fs.writes.filter((x) => x.path.endsWith(w.id))).toHaveLength(1);
  });

  it('an idle home set that never got a set is dropped, never saved empty', async () => {
    store.startHomeSet({ name: 'S', moves: [] });
    vi.setSystemTime(T0 + 30 * 60_000);
    store.applyAutoFinish();
    expect(st().workouts).toEqual([]);
    await settle();
    expect(fs.writes.filter((x) => x.path.includes('/workouts/'))).toEqual([]);
  });

  it('the home snapshot: first sync pushes local sets; a newer local edit beats the server', async () => {
    store.saveHomeSet({ name: 'Local', moves: ['Pullups'] });
    await settle();
    fs.writes.length = 0;
    const stop = store.startSyncLoop();
    fs.listeners.get('users/u1/meta/home')!(snap(null));
    await settle();
    expect(at('users/u1/meta/home')).toHaveLength(1);
    const local = st().home.updatedAt!;
    fs.listeners.get('users/u1/meta/home')!(snap({ sets: [], moves: [], updatedAt: local - 1 }));
    await settle();
    expect(st().home.sets).toHaveLength(1);
    fs.listeners.get('users/u1/meta/home')!(snap({ sets: [], moves: [], updatedAt: local + 1 }));
    await settle();
    expect(st().home.sets).toHaveLength(0);
    stop();
  });
});
