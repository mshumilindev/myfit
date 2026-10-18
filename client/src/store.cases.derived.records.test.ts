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
import type { Exercise, Gym, SetEntry, Workout } from './types';

const T0 = new Date('2026-03-04T10:00:00Z').getTime();
const DAY = 86_400_000;
const st = () => store.__getStateForTests();
const settle = async () => {
  for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 8));
};
const at = (path: string) => fs.writes.filter((w) => w.path === path);
const set = (over: Partial<SetEntry> = {}): SetEntry => ({
  id: over.id ?? `s${Math.random()}`,
  reps: 5,
  weight: 100,
  isWarmup: false,
  position: 0,
  ...over,
});
const ex = (name: string, sets: SetEntry[], over: Partial<Exercise> = {}): Exercise => ({
  id: `e-${name}-${Math.random()}`,
  name,
  position: 0,
  kind: 'strength',
  sets,
  ...over,
});
const done = (
  id: string,
  daysAgo: number,
  gymId: string | null,
  exercises: Exercise[],
): Workout => ({
  id,
  startedAt: T0 - daysAgo * DAY,
  finishedAt: T0 - daysAgo * DAY + 3_600_000,
  autoFinished: false,
  gymId,
  exercises,
});
const load = (workouts: Workout[], gyms: Gym[] = []) =>
  store.__replaceStateForTests({ ...st(), workouts, gyms });
const gymOf = (id: string, over: Partial<Gym> = {}): Gym => ({
  id,
  name: id,
  lat: 0,
  lng: 0,
  radiusM: 50,
  ...over,
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

describe('lifting history helpers', () => {
  const squat = (sets: SetEntry[], over: Partial<Exercise> = {}) => ex('Squat', sets, over);

  it('e1RM is the Epley estimate for 1-10 reps only; drops count, warm-ups do not', () => {
    expect(store.est1rm(100, 0)).toBe(0);
    expect(store.est1rm(0, 5)).toBe(0);
    expect(store.est1rm(100, 11)).toBe(0);
    expect(store.est1rm(100, 10)).toBe(133);
    expect(store.setBestE1rm(set({ type: 'warmup', isWarmup: true }))).toBe(0);
    const drop = set({
      type: 'reverse-drop',
      weight: 60,
      reps: 5,
      drops: [{ reps: 4, weight: 120 }],
    });
    expect(store.setBestE1rm(drop)).toBe(store.est1rm(120, 4));
    expect(store.setTopWeight(drop)).toBe(120);
    expect(
      store.estimatedOneRepMaxSet([set({ id: 'a', weight: 50 }), set({ id: 'b', weight: 90 })])?.id,
    ).toBe('b');
    expect(store.estimatedOneRepMaxSet([set({ reps: 20 })])).toBeUndefined();
  });

  it('prevLift, recordWeight, recordE1rm look at finished sessions only and can exclude the current one', () => {
    load([
      done('new', 1, null, [
        squat([set({ weight: 120, reps: 3 }), set({ weight: 60, isWarmup: true, type: 'warmup' })]),
      ]),
      done('old', 10, null, [squat([set({ weight: 140, reps: 1 })])]),
      { ...done('live', 0, null, [squat([set({ weight: 999 })])]), finishedAt: null },
    ]);
    expect(store.prevLift('squat')).toEqual({ reps: 3, weight: 120 });
    expect(store.prevLift('squat', 'new')).toEqual({ reps: 1, weight: 140 });
    expect(store.prevLift('Nonexistent')).toBeUndefined();
    // an unfinished session only drops out when the caller excludes it (the one being logged)
    expect(store.recordWeight('Squat', 'live')).toBe(140);
    load([
      done('new', 1, null, [
        squat([
          set({ weight: 120, reps: 3 }),
          set({ weight: 200, isWarmup: true, type: 'warmup' }),
        ]),
      ]),
      done('old', 10, null, [squat([set({ weight: 140, reps: 1 })])]),
    ]);
    expect(store.recordWeight('Squat', 'old')).toBe(120); // a warm-up weight never counts
    expect(store.recordWeight('Squat', 'new')).toBe(140);
    load([
      done('new', 1, null, [
        squat([set({ weight: 120, reps: 3 }), set({ weight: 60, isWarmup: true, type: 'warmup' })]),
      ]),
      done('old', 10, null, [squat([set({ weight: 140, reps: 1 })])]),
      { ...done('live', 0, null, [squat([set({ weight: 999 })])]), finishedAt: null },
    ]);
    expect(store.recordE1rm('Squat', 'live')).toBe(
      Math.max(store.est1rm(140, 1), store.est1rm(120, 3)),
    );
    expect(store.lastSessionWith('Squat', 'new')?.workout.id).toBe('old');
    expect(store.historicalWorkingKg('Squat', 'new')).toBe(140);
    expect(store.historicalWorkingKg('Nothing')).toBe(0);
  });

  it('historicalWorkingKg is the most common working weight of the last session (heavier on ties)', () => {
    load([
      done('h', 2, null, [
        squat([
          set({ weight: 100 }),
          set({ weight: 100 }),
          set({ weight: 110 }),
          set({ weight: 110 }),
          set({ weight: 40, type: 'warmup' }),
        ]),
      ]),
    ]);
    expect(store.historicalWorkingKg('Squat')).toBe(110);
  });

  it('autoWarmupSets: light leading sets become warm-ups relative to history, manual choices and special types anchor', () => {
    const a = set({ id: 'a', weight: 40, position: 0 });
    const b = set({ id: 'b', weight: 100, position: 1 });
    const c = set({ id: 'c', weight: 50, position: 2 });
    const out = store.autoWarmupSets([a, b, c], 'weight');
    expect(out.map((s) => store.setTypeOf(s))).toEqual(['warmup', 'working', 'working']);
    // history reference: a light opener is flagged straight away
    expect(store.autoWarmupSets([a], 'weight', 100)[0].type).toBe('warmup');
    // non-weight loads are untouched
    expect(store.autoWarmupSets([a, b], 'assist')).toEqual([a, b]);
    expect(store.autoWarmupSets([set({ weight: 0 })], 'weight')).toHaveLength(1);
    // a manual working choice anchors the run; a manual warm-up stays
    const manual = set({ id: 'm', weight: 40, position: 0, warmupManual: true, type: 'working' });
    expect(store.autoWarmupSets([manual, b], 'weight')[0].type).toBe('working');
    const drop = set({ id: 'd', weight: 40, position: 0, type: 'drop', drops: [] });
    expect(store.autoWarmupSets([drop, b], 'weight')[0].type).toBe('drop');
    // a set wrongly stored as warm-up after the run starts is corrected
    const wrong = set({ id: 'w', weight: 100, position: 1, type: 'warmup', isWarmup: true });
    expect(store.autoWarmupSets([b, wrong], 'weight')[1].type).toBe('working');
  });

  it('liftReference uses the best recent e1RM, else all-time, and days since last', () => {
    load([
      done('r1', 5, null, [squat([set({ weight: 100, reps: 5 })])]),
      done('r2', 100, null, [squat([set({ weight: 200, reps: 1 })])]),
    ]);
    expect(store.liftReference('Squat', undefined, 56, T0)).toEqual({
      refE1: store.est1rm(100, 5),
      daysSinceLift: 5,
    });
    load([done('r2', 100, null, [squat([set({ weight: 200, reps: 1 })])])]);
    expect(store.liftReference('Squat', undefined, 56, T0)).toEqual({
      refE1: store.est1rm(200, 1),
      daysSinceLift: 100,
    });
    expect(store.liftReference('Nope', undefined, 56, T0)).toEqual({
      refE1: 0,
      daysSinceLift: null,
    });
  });

  it('recentSessionsOf returns the newest sessions that contain the lift', () => {
    load([
      done('a', 3, null, [squat([set({ id: 'x' })])]),
      done('b', 1, null, [squat([set({ id: 'y' })])]),
      done('c', 2, null, [ex('Curl', [set()])]),
      done('d', 4, null, [squat([])]),
    ]);
    expect(store.recentSessionsOf('squat', undefined, 5).map((s) => s.sets[0].id)).toEqual([
      'y',
      'x',
    ]);
    expect(store.recentSessionsOf('squat', 'b', 5).map((s) => s.sets[0].id)).toEqual(['x']);
    expect(store.recentSessionsOf('squat', undefined, 1)).toHaveLength(1);
  });

  it('knownExercises lists each strength lift once with its last top set; myExercises includes ad-hoc ones', () => {
    load([
      done('a', 1, null, [
        ex('Squat', [set({ weight: 90 }), set({ weight: 100 })]),
        ex('Running, Treadmill', [], { kind: 'cardio' }),
      ]),
      done('b', 2, null, [
        ex('My Strange Machine', [set()], {
          primaryMuscle: 'lats',
          secondaryMuscles: [],
          equipment: ['machine'],
        }),
      ]),
    ]);
    expect(store.knownExercises().map((k) => k.name)).toEqual(['Squat', 'My Strange Machine']);
    expect(store.knownExercises()[0].last).toEqual({ reps: 5, weight: 100 });
    const mine = store.myExercises();
    expect(mine.map((m) => [m.name, m.source])).toEqual([['My Strange Machine', 'logged']]);
    expect(mine[0].primaryMuscle).toBe('lats');
  });

  it('aggregates: sets, volume, cardio minutes and distance', () => {
    const w = done('w', 1, null, [
      ex('Squat', [set({ weight: 100, reps: 5 }), set({ weight: 100, reps: 5 })]),
      ex(
        'Running, Treadmill',
        [
          set({ durationMin: 20, distanceKm: 3, reps: 0, weight: null }),
          set({ durationMin: -4, distanceKm: -1, reps: 0, weight: null }),
        ],
        { kind: 'cardio' },
      ),
    ]);
    expect(store.workoutSets(w)).toBe(2);
    expect(store.workoutVolumeKg(w)).toBe(1000);
    expect(store.workoutCardioMinutes(w)).toBe(20);
    expect(store.workoutCardioDistanceKm(w)).toBe(3);
    expect(store.workoutStats(w)).toEqual({ volumeKg: 1000, sets: 2 });
  });
});

describe('machines across gyms', () => {
  const machine = (name: string, w: number) =>
    ex(name, [set({ weight: w })], { equipment: ['machine'] });

  it('liftVariant is the picked kit, else the gym, and only for machine/cable lifts', () => {
    const w = { gymId: 'g1' };
    expect(store.liftVariant(w, ex('Squat', [], { equipment: ['barbell'] }))).toBe('');
    expect(store.liftVariant(w, ex('Leg Press', [], { equipment: ['machine'] }))).toBe('gym:g1');
    expect(
      store.liftVariant({ gymId: null }, ex('Leg Press', [], { equipment: ['machine'] })),
    ).toBe('');
    expect(
      store.liftVariant(
        w,
        ex('Leg Press', [], { equipment: ['machine'], equipmentItems: ['b', 'a'] }),
      ),
    ).toBe('eq:a+b');
    expect(store.isMachineLift({ name: 'x', equipment: ['cable'] })).toBe(true);
  });

  it('the variant keeps the same lift on different machines apart', () => {
    load([
      done('a', 2, 'g1', [machine('Leg Press', 100)]),
      done('b', 1, 'g2', [machine('Leg Press', 60)]),
    ]);
    expect(store.recordWeight('Leg Press', undefined, 'gym:g1')).toBe(100);
    expect(store.recordWeight('Leg Press', undefined, 'gym:g2')).toBe(60);
    expect(store.prevLift('Leg Press', undefined, 'gym:g2')?.weight).toBe(60);
    expect(store.recordE1rm('Leg Press', undefined, 'gym:g2')).toBe(store.est1rm(60, 5));
    const recs = store.recordsByVariant('Leg Press');
    expect(recs.map((r) => [r.variant, r.weight])).toEqual([
      ['gym:g1', 100],
      ['gym:g2', 60],
    ]);
  });

  it('normalizedProgress follows weight ratios on one variant and does not move on a switch', () => {
    load([
      done('a', 3, 'g1', [machine('Leg Press', 100)]),
      done('b', 2, 'g1', [machine('Leg Press', 110)]),
      done('c', 1, 'g2', [machine('Leg Press', 40)]),
    ]);
    const pts = store.normalizedProgress('Leg Press');
    expect(pts.map((p) => Math.round(p.value))).toEqual([100, 110, 110]);
    expect(pts.map((p) => p.switched)).toEqual([false, false, true]);
  });

  it('gymTransferRatio needs three shared lifts and a plausible median; crossGymHint estimates only without local history', () => {
    const names = ['Leg Press', 'Leg Extension', 'Leg Curl'];
    const mk = (id: string, days: number, gym: string, k: number) =>
      done(
        id,
        days,
        gym,
        names.map((n) => machine(n, 100 * k)),
      );
    load(
      [mk('m', 5, 'main', 1), mk('o', 4, 'other', 0.5)],
      [gymOf('main', { favorite: true }), gymOf('other')],
    );
    expect(store.gymTransferRatio('main', 'other')).toBe(0.5);
    expect(store.gymTransferRatio('main', 'nowhere')).toBeNull();
    expect(store.mainGyms().map((g) => g.id)).toEqual(['main']);

    const live = {
      ...done('live', 0, 'other', [machine('Leg Press', 0)]),
      finishedAt: null,
    } as Workout;
    load(
      [
        mk('m', 5, 'main', 1),
        mk('o', 4, 'other', 0.5).id ? { ...mk('o', 4, 'other', 0.5), exercises: [] } : live,
        live,
      ],
      [gymOf('main', { favorite: true }), gymOf('other')],
    );
    const hint = store.crossGymHint('live', live.exercises[0])!;
    expect(hint.gym.id).toBe('main');
    expect(hint.weight).toBe(100);
    expect(hint.hasLocal).toBe(false);
    expect(hint.estimate).toBeNull(); // not enough shared lifts: never guess
    // main gym itself, unknown workout, strength barbell: no hint
    expect(store.crossGymHint('nope', live.exercises[0])).toBeUndefined();
    expect(store.crossGymHint('live', ex('Squat', [], { equipment: ['barbell'] }))).toBeUndefined();
  });

  it('crossGymHint rounds an estimate to 2.5 kg when the gyms share enough lifts', () => {
    const names = ['Leg Press', 'Leg Extension', 'Leg Curl'];
    const mk = (id: string, days: number, gym: string, k: number) =>
      done(
        id,
        days,
        gym,
        names.map((n) => machine(n, 100 * k)),
      );
    const live = {
      ...done('live', 0, 'other', [machine('Seated Row', 0)]),
      finishedAt: null,
    } as Workout;
    const main = done('m2', 3, 'main', [machine('Seated Row', 77)]);
    main.exercises.push(
      ...mk('m', 5, 'main', 1).exercises.map((e, i) => ({ ...e, position: i + 1 })),
    );
    load(
      [main, mk('o', 4, 'other', 0.5), live],
      [gymOf('main', { favorite: true }), gymOf('other')],
    );
    const hint = store.crossGymHint('live', live.exercises[0])!;
    expect(hint.estimate).toBe(Math.round((77 * 0.5) / 2.5) * 2.5);
  });
});

describe('undo and clean-up helpers', () => {
  it('restore / clear / duplicate keep ids unique and positions ordered', () => {
    const w = store.startWorkout()!;
    const a = store.addExercise(w.id, 'Squat');
    store.upsertSet(w.id, a.id, { reps: 5, weight: 100, isWarmup: false });
    store.upsertSet(w.id, a.id, { reps: 5, weight: 100, isWarmup: false });
    const removed = store.clearSets(w.id, a.id);
    expect(removed).toHaveLength(2);
    expect(st().workouts[0].exercises[0].sets).toEqual([]);
    store.restoreSet(w.id, a.id, removed[1]);
    store.restoreSet(w.id, a.id, removed[0]);
    expect(st().workouts[0].exercises[0].sets.map((s) => s.position)).toEqual([0, 1]);
    expect(store.clearSets('nope', 'x')).toEqual([]);

    store.duplicateExercise(w.id, a.id);
    const [orig, copy] = st().workouts[0].exercises;
    expect(copy.id).not.toBe(orig.id);
    expect(copy.sets.map((s) => s.id)).not.toEqual(orig.sets.map((s) => s.id));
    expect(copy.sets.map((s) => s.position)).toEqual([0, 1]);
    store.restoreExercise(w.id, { ...orig, id: 'again', position: 5 });
    expect(st().workouts[0].exercises.at(-1)!.id).toBe('again');
    store.restoreSet('nope', 'x', removed[0]);
    store.restoreExercise('nope', orig);
    store.duplicateExercise('nope', 'x');
  });

  it('finishWorkoutClean drops empty lifts but keeps warm-up markers; reopen makes it live again', async () => {
    const w = store.startWorkout()!;
    store.addExercise(w.id, 'Warm-up', 'warmup');
    const empty = store.addExercise(w.id, 'Squat');
    const lifted = store.addExercise(w.id, 'Bench Press');
    store.upsertSet(w.id, lifted.id, { reps: 5, weight: 60, isWarmup: false });
    const fin = store.finishWorkoutClean(w.id)!;
    expect(fin.exercises.map((e) => e.name)).toEqual(['Warm-up', 'Bench Press']);
    expect(fin.exercises.some((e) => e.id === empty.id)).toBe(false);
    expect(fin.finishedAt).not.toBeNull();
    expect(store.finishWorkoutClean('nope')).toBeUndefined();
    await settle();
    store.reopenWorkout(w.id);
    expect(st().workouts[0].finishedAt).toBeNull();
    store.reopenWorkout('nope');
  });

  it('warm-up habit: sessions opened with a marker or cardio count; nothing to judge defaults to yes', () => {
    const marker = ex('Warm-up', [], { kind: 'warmup' });
    const lift = ex('Squat', [set()], { position: 1 });
    const withWu = done('a', 1, null, [marker, lift]);
    const without = {
      ...done('b', 2, null, [{ ...lift, position: 0 }]),
      startedAt: store.MARKERS_KEPT_SINCE + DAY,
    };
    const cardioFirst = done('c', 3, null, [ex('Running, Treadmill', [set()], { kind: 'cardio' })]);
    expect(store.opensWithWarmupSession(withWu)).toBe(true);
    expect(store.opensWithWarmupSession(cardioFirst)).toBe(true);
    expect(store.opensWithWarmupSession(done('x', 1, null, []))).toBe(false);
    expect(store.warmupHabit([])).toBe(true);
    const old = {
      ...done('o', 1, null, [{ ...lift, position: 0 }]),
      startedAt: store.MARKERS_KEPT_SINCE - DAY,
    };
    expect(store.warmupHabit([old])).toBe(true); // too old to judge
    expect(
      store.warmupHabit([
        without,
        without,
        without,
        { ...withWu, startedAt: store.MARKERS_KEPT_SINCE + DAY },
      ]),
    ).toBe(false);
    expect(
      store.warmupHabit([without, { ...withWu, startedAt: store.MARKERS_KEPT_SINCE + DAY }]),
    ).toBe(true);
  });

  it('equipment items on an exercise stock the gym with anything new', async () => {
    const g = store.upsertGym({
      name: 'G',
      lat: 0,
      lng: 0,
      radiusM: 10,
      equipmentItems: ['cardio-bike'],
    });
    const w = store.startWorkout(g.id)!;
    const a = store.addExercise(w.id, 'Leg Press');
    store.setExerciseEquipmentItems(
      w.id,
      a.id,
      ['cardio-bike', 'cardio-treadmill', 'cardio-treadmill'],
      g.id,
    );
    expect(st().workouts[0].exercises[0].equipmentItems).toEqual([
      'cardio-bike',
      'cardio-treadmill',
    ]);
    expect(st().gyms[0].equipmentItems).toEqual(['cardio-bike', 'cardio-treadmill']);
    // nothing new: the gym is not re-written
    await settle();
    const n = at(`users/u1/gyms/${g.id}`).length;
    store.setExerciseEquipmentItems(w.id, a.id, ['cardio-bike'], g.id);
    await settle();
    expect(at(`users/u1/gyms/${g.id}`).length).toBe(n);
    store.setExerciseEquipmentItems('nope', a.id, []);
    store.updateExerciseMeta(w.id, a.id, {
      primaryMuscle: 'glutes',
      secondaryMuscles: [],
      equipment: ['machine'],
    });
    expect(st().workouts[0].exercises[0]).toMatchObject({
      primaryMuscle: 'glutes',
      equipment: ['machine'],
    });
    store.updateExerciseMeta('nope', a.id, {
      primaryMuscle: null,
      secondaryMuscles: [],
      equipment: [],
    });
  });
});
