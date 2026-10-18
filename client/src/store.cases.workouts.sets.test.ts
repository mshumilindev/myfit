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
import { setProgramMemory } from './data/programMemory';
import type { Gym, SetEntry, Workout } from './types';

const T0 = new Date('2026-03-04T10:00:00Z').getTime(); // a Wednesday
const st = () => store.__getStateForTests();
const wk = (id: string) => st().workouts.find((w) => w.id === id)!;
const settle = async () => {
  for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 8));
};
const wWrites = (id?: string) =>
  fs.writes.filter((w) => w.path.startsWith('users/u1/workouts/') && (!id || w.path.endsWith(id)));
const setIn = (over: Partial<SetEntry> = {}) => ({ reps: 8, weight: 80, isWarmup: false, ...over });

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

describe('exercises and sets', () => {
  const start = () => {
    const w = store.startWorkout()!;
    return w.id;
  };

  it('the first exercise starts the clock; deleting the last turns the session back into a draft', () => {
    const id = start();
    vi.setSystemTime(T0 + 60_000);
    const ex = store.addExercise(id, 'Bench Press');
    expect(wk(id).startedAt).toBe(T0 + 60_000);
    expect(ex.primaryMuscle).toBe('chest');
    expect(store.isSessionStarted(wk(id))).toBe(true);
    vi.setSystemTime(T0 + 120_000);
    store.deleteExercise(id, ex.id);
    expect(wk(id).startedAt).toBe(T0 + 120_000);
    expect(store.isSessionStarted(wk(id))).toBe(false);
    expect(store.getOpenWorkout()!.id).toBe(id);
  });

  it('pure cardio by name becomes a cardio entry; warm-up and cool-down markers get a start time', () => {
    const id = start();
    const run = store.addExercise(id, 'Running, Treadmill');
    expect(run.kind).toBe('cardio');
    const wu = store.addExercise(id, 'Warm-up', 'warmup');
    expect(wu.markerAt).toBe(T0);
    const cd = store.addExercise(id, 'Cool-down', 'cooldown');
    expect(cd.markerAt).toBe(T0);
    expect(store.isMarkerExercise(wu)).toBe(true);
    expect(store.isTimedExercise(run)).toBe(true);
    expect(store.isStrengthExercise(run)).toBe(false);
  });

  it('upsertSet: new sets append with positions, stamp rest from the real gap, edits keep position and stamps', () => {
    const id = start();
    const ex = store.addExercise(id, 'Bench Press');
    vi.setSystemTime(T0 + 1000);
    store.upsertSet(id, ex.id, setIn({ weight: 100 }));
    vi.setSystemTime(T0 + 91_000);
    store.upsertSet(id, ex.id, setIn({ weight: 100 }));
    const sets = wk(id).exercises[0].sets;
    expect(sets.map((s) => s.position)).toEqual([0, 1]);
    expect(sets[0].restSec).toBeNull();
    expect(sets[1].restSec).toBe(90);

    vi.setSystemTime(T0 + 500_000);
    store.upsertSet(id, ex.id, { ...sets[1], reps: 10 });
    const edited = wk(id).exercises[0].sets[1];
    expect(edited.reps).toBe(10);
    expect(edited.position).toBe(1);
    expect(edited.loggedAt).toBe(T0 + 91_000);
    expect(edited.restSec).toBe(90);
  });

  it('a gap of 3 hours or more is not counted as rest', () => {
    const id = start();
    const ex = store.addExercise(id, 'Bench Press');
    store.upsertSet(id, ex.id, setIn());
    vi.setSystemTime(T0 + 3 * 3600 * 1000);
    store.upsertSet(id, ex.id, setIn());
    expect(wk(id).exercises[0].sets[1].restSec).toBeNull();
  });

  it('stores optional cardio readings, failure and partials only when given', () => {
    const id = start();
    const ex = store.addExercise(id, 'Running, Treadmill');
    store.upsertSet(id, ex.id, {
      reps: 0,
      weight: null,
      isWarmup: false,
      durationMin: 10,
      distanceKm: 1.5,
      speedKmh: 9,
      inclinePct: 2,
      watts: 100,
      level: 3,
      floors: 4,
      failure: 'auto',
      failureWhy: 'bar slowed',
      partials: 2,
      rpeAuto: 9,
      restTargetSec: 120,
    });
    const s = wk(id).exercises[0].sets[0];
    expect(s).toMatchObject({
      speedKmh: 9,
      inclinePct: 2,
      watts: 100,
      level: 3,
      floors: 4,
      failure: 'auto',
      failureWhy: 'bar slowed',
      partials: 2,
      rpeAuto: 9,
      restTargetSec: 120,
      distanceKm: 1.5,
    });
    store.upsertSet(id, ex.id, setIn({ weight: 20 }));
    const plainSet = wk(id).exercises[0].sets[1];
    expect('speedKmh' in plainSet).toBe(false);
    expect('failure' in plainSet).toBe(false);
  });

  it('ignores sets for unknown workouts/exercises', () => {
    const id = start();
    store.upsertSet('nope', 'nope', setIn());
    store.upsertSet(id, 'nope', setIn());
    store.deleteSet('nope', 'x', 'y');
    store.renameExercise(id, 'nope', 'X');
    store.replaceExercise(id, 'nope', 'X', 'strength');
    store.setCardioMachine(id, 'nope', null, 'X');
    store.reorderExercises('nope', []);
    store.setMarkerStarted('nope', 'x', 1);
    expect(store.duplicateSet(id, 'nope', 'x')).toBeNull();
    expect(wk(id).exercises).toEqual([]);
  });

  it('drops and duplicates: reverse drops, copies get fresh ids, renumbered positions', () => {
    const id = start();
    const ex = store.addExercise(id, 'Bench Press');
    store.upsertSet(id, ex.id, setIn());
    const s0 = wk(id).exercises[0].sets[0];
    store.addDropToSet(id, ex.id, s0.id, { reps: 6, weight: 60 });
    let s = wk(id).exercises[0].sets[0];
    expect(s.type).toBe('drop');
    expect(s.drops).toEqual([{ reps: 6, weight: 60 }]);
    store.addDropToSet(id, ex.id, s0.id, { reps: 4, weight: 40 }, true);
    s = wk(id).exercises[0].sets[0];
    expect(s.type).toBe('drop'); // already a drop: type is kept
    expect(store.setDrops(s)).toHaveLength(2);
    expect(store.setRepsTotal(s)).toBe(8 + 6 + 4);
    expect(store.setVolumeKg(s)).toBe(8 * 80 + 6 * 60 + 4 * 40);

    vi.setSystemTime(T0 + 45_000);
    const newId = store.duplicateSet(id, ex.id, s0.id)!;
    const sets = wk(id).exercises[0].sets;
    expect(sets.map((x) => x.id)).toEqual([s0.id, newId]);
    expect(sets.map((x) => x.position)).toEqual([0, 1]);
    expect(sets[1].restSec).toBe(45);
    expect(sets[1].drops).toEqual(sets[0].drops);
    expect(sets[1].drops).not.toBe(sets[0].drops);
  });

  it('reverse drop is chosen for a fresh set when asked', () => {
    const id = start();
    const ex = store.addExercise(id, 'Bench Press');
    store.upsertSet(id, ex.id, setIn());
    store.addDropToSet(id, ex.id, wk(id).exercises[0].sets[0].id, { reps: 3, weight: 90 }, true);
    expect(wk(id).exercises[0].sets[0].type).toBe('reverse-drop');
  });

  it('deleteSet, reorderExercises, replaceExercise, setCardioMachine, renameExercise', () => {
    const id = start();
    const a = store.addExercise(id, 'Bench Press');
    const b = store.addExercise(id, 'Running, Treadmill');
    store.upsertSet(id, a.id, setIn());
    store.deleteSet(id, a.id, wk(id).exercises[0].sets[0].id);
    expect(wk(id).exercises[0].sets).toEqual([]);

    store.reorderExercises(id, [b.id]); // incomplete list is rejected
    expect(wk(id).exercises.map((e) => e.id)).toEqual([a.id, b.id]);
    store.reorderExercises(id, [b.id, a.id]);
    expect(wk(id).exercises.map((e) => [e.id, e.position])).toEqual([
      [b.id, 0],
      [a.id, 1],
    ]);

    store.replaceExercise(id, a.id, '  Dumbbell Curl ', 'strength', { primaryMuscle: 'biceps' });
    const rep = wk(id).exercises.find((e) => e.id === a.id)!;
    expect(rep.name).toBe('Dumbbell Curl');
    expect(rep.primaryMuscle).toBe('biceps');

    store.setCardioMachine(id, b.id, 'cardio-bike', 'Bike');
    let cardio = wk(id).exercises.find((e) => e.id === b.id)!;
    expect(cardio.name).toBe('Bike');
    expect(cardio.equipmentItems).toEqual(['cardio-bike']);
    store.setCardioMachine(id, b.id, null, 'Run');
    cardio = wk(id).exercises.find((e) => e.id === b.id)!;
    expect(cardio.equipmentItems).toEqual([]);

    store.setMarkerStarted(id, b.id, 123);
    expect(wk(id).exercises.find((e) => e.id === b.id)!.markerAt).toBe(123);
  });
});

describe('supersets and circuits', () => {
  it('groups, letters, rounds, ungroup', () => {
    const w = store.startWorkout()!;
    const a = store.addExercise(w.id, 'Bench Press', 'strength', { plannedSets: 3 });
    const b = store.addExercise(w.id, 'Bent Over Barbell Row');
    const c = store.addExercise(w.id, 'Squat');
    store.groupAsSuperset(w.id, [a.id]); // fewer than two: ignored
    expect(store.sessionBlocks(wk(w.id)).every((x) => x.kind === 'single')).toBe(true);

    store.groupAsSuperset(w.id, [b.id, a.id]);
    const blocks = store.sessionBlocks(wk(w.id));
    expect(blocks.map((x) => x.kind)).toEqual(['group', 'single']);
    const g = (blocks[0] as { kind: 'group'; group: import('./store').SupersetGroup }).group;
    expect(g.letter).toBe('A');
    expect(g.exercises.map((e) => e.id)).toEqual([b.id, a.id]);
    expect(g.circuit).toBe(false);
    expect(store.nextSupersetLetter(wk(w.id))).toBe('B');
    expect(store.groupRounds(g)).toBe(3);
    expect(store.groupCurrentRound(g)).toBe(1);

    store.upsertSet(w.id, a.id, setIn());
    store.upsertSet(w.id, b.id, setIn());
    const g2 = (
      store.sessionBlocks(wk(w.id))[0] as { kind: 'group'; group: import('./store').SupersetGroup }
    ).group;
    expect(store.groupCurrentRound(g2)).toBe(2);

    store.setCircuitRounds(w.id, g.groupId, 99);
    expect(wk(w.id).exercises.find((e) => e.id === a.id)!.plannedSets).toBe(20);
    store.setCircuitRounds(w.id, g.groupId, 0);
    expect(wk(w.id).exercises.find((e) => e.id === b.id)!.plannedSets).toBe(1);
    expect(wk(w.id).exercises.find((e) => e.id === c.id)!.plannedSets).toBeNull();

    store.ungroupSuperset(w.id, g.groupId);
    expect(store.sessionBlocks(wk(w.id)).every((x) => x.kind === 'single')).toBe(true);
  });

  it('a group with a single surviving member is shown as a single', () => {
    const w = store.startWorkout()!;
    const a = store.addExercise(w.id, 'Bench Press');
    const b = store.addExercise(w.id, 'Bent Over Barbell Row');
    store.groupAsSuperset(w.id, [a.id, b.id]);
    store.deleteExercise(w.id, b.id);
    expect(store.sessionBlocks(wk(w.id))).toEqual([expect.objectContaining({ kind: 'single' })]);
  });
});

describe('muscles, volume, equipment, day names', () => {
  const mk = () => {
    const w = store.startWorkout()!;
    const bench = store.addExercise(w.id, 'Bench Press');
    store.upsertSet(w.id, bench.id, setIn({ weight: 100, reps: 5 }));
    store.upsertSet(w.id, bench.id, setIn({ weight: 100, reps: 5 }));
    return w.id;
  };

  it('counts primary sets fully and secondary half, ordered primary first', () => {
    const id = mk();
    const sets = store.muscleSetsInWorkout(wk(id));
    expect(sets.get('chest')).toBe(2);
    expect([...sets.keys()].some((m) => m !== 'chest')).toBe(true);
    const sorted = store.muscleWorkSorted(wk(id));
    expect(sorted[0]).toMatchObject({ muscle: 'chest', sets: 2, primary: true });
    expect(sorted.slice(1).every((x) => !x.primary)).toBe(true);
    expect(store.muscleVolumeKg([wk(id)]).get('chest')).toBe(1000);
  });

  it('resolveMuscles: catalog wins, ad-hoc exercises use the stored muscles, else nothing', () => {
    expect(store.resolveMuscles({ name: 'Bench Press', primaryMuscle: 'quads' }).primary).toBe(
      'chest',
    );
    expect(
      store.resolveMuscles({
        name: 'My Odd Move',
        primaryMuscle: 'calves',
        secondaryMuscles: ['quads'],
      }),
    ).toEqual({ primary: 'calves', secondary: ['quads'] });
    expect(store.resolveMuscles({ name: 'My Odd Move' })).toEqual({ primary: null, secondary: [] });
    expect(
      store.resolveMuscles({ name: 'Bench Press', kind: 'cardio', primaryMuscle: 'chest' }).primary,
    ).toBe('chest');
  });

  it('day readout and equipment', () => {
    const id = mk();
    expect(store.workoutDayReadout(wk(id))).not.toBeNull();
    expect(store.workoutEquipment(wk(id))).toEqual(['barbell']);
    expect(store.equipmentFor({ name: 'x', equipment: ['cable'] })).toEqual(['cable']);
    expect(store.equipmentFor({ name: 'Unknown thing' })).toEqual([]);
    expect(store.exerciseNeeds('Bench Press')).toEqual(['barbell']);
    const gym = { inventory: ['dumbbell'] } as Gym;
    expect(store.missingAtGym(gym, ['barbell', 'dumbbell'])).toEqual(['barbell']);
    expect(store.missingAtGym({} as Gym, ['barbell'])).toEqual([]);
    expect(store.missingAtGym(null, ['barbell'])).toEqual([]);
  });

  it('sidesMode / perHandFactor classify paired, unilateral and single loads', () => {
    expect(store.sidesMode({ name: 'Dumbbell Bench Press', equipment: ['dumbbell'] })).toBe('pair');
    expect(store.perHandFactor({ name: 'Dumbbell Bench Press', equipment: ['dumbbell'] })).toBe(2);
    expect(store.sidesMode({ name: 'Goblet Squat', equipment: ['dumbbell'] })).toBe('single');
    expect(store.sidesMode({ name: 'Bulgarian Split Squat' })).toBe('unilateral');
    expect(store.sidesMode({ name: 'One-Arm Row' })).toBe('unilateral');
    expect(store.sidesMode({ name: 'Cable Fly', equipment: ['cable'] })).toBe('pair');
    expect(store.sidesMode({ name: 'Cable Row', equipment: ['cable'] })).toBe('single');
    expect(store.sidesMode({ name: 'Kettlebell Swing', equipment: ['kettlebell'] })).toBe('single');
    expect(store.sidesMode({ name: 'Double Kettlebell Clean', equipment: ['kettlebell'] })).toBe(
      'pair',
    );
    expect(store.sidesMode({ name: 'Iso-lateral Row' })).toBe('pair');
    expect(store.sidesMode({ name: 'Squat', equipment: ['barbell'] })).toBe('single');
  });

  it('programDayNameFor: own day name must still match the trained muscles, else the program names the weekday', () => {
    const base = {
      id: 'w',
      startedAt: T0,
      finishedAt: T0 + 1,
      autoFinished: false,
      gymId: null,
    } as Workout;
    const chest = store.addExercise(store.startWorkout()!.id, 'Bench Press');
    expect(chest.id).toBeTruthy();
    const trained = {
      ...base,
      dayName: 'Chest Day',
      targetMuscles: ['chest'],
      exercises: [{ ...chest, sets: [{} as SetEntry] }],
    } as Workout;
    expect(store.programDayNameFor(trained, [])).toBe('Chest Day');
    expect(store.programDayNameFor({ ...trained, targetMuscles: ['quads'] }, [])).toBeNull();

    setProgramMemory(null);
    expect(store.programDayNameFor({ ...base, exercises: [] }, [])).toBeNull();
    setProgramMemory({
      week: 2,
      program: {
        dayNames: { '3': 'Push 1' },
        targetMuscles: { '3': ['chest'] },
        items: [{ day: 3 }, { day: 5 }],
      },
    });
    expect(store.weekdayOf(T0)).toBe(3);
    expect(
      store.programDayNameFor({ ...base, exercises: [trained.exercises[0]], dayName: null }, []),
    ).toBe('Push 1');
    // trained something else on that weekday: not labelled
    expect(
      store.programDayNameFor(
        {
          ...base,
          exercises: [{ ...trained.exercises[0], name: 'Squat', primaryMuscle: 'quads' }],
        },
        [],
      ),
    ).toBeNull();
    // too old for a 2-week-old program
    expect(
      store.programDayNameFor(
        { ...base, startedAt: T0 - 60 * 86_400_000, exercises: [trained.exercises[0]] },
        [{ ...base, startedAt: T0 }],
      ),
    ).toBeNull();
    expect([...store.prescribedTrainingDays()].sort()).toEqual([3, 5]);
    expect(store.programLookbackDays()).toBe(20);
    expect(store.programDayNameForWeekday(3)).toBe('Push 1');
    expect(store.programDayNameForWeekday(4)).toBeNull();
    setProgramMemory(null);
    expect(store.prescribedTrainingDays().size).toBe(0);
    expect(store.programLookbackDays()).toBe(0);
    expect(store.programDayNameForWeekday(3)).toBeNull();
  });
});

describe('auto-finish and live housekeeping', () => {
  it('a stale live session finishes itself at the 8h mark and is then synced; an empty stale draft is dropped', async () => {
    const w = store.startWorkout()!;
    store.addExercise(w.id, 'Squat');
    const draft = store.startWorkout()!; // replaces nothing: the first is auto-closed on start
    expect(draft.id).not.toBe(w.id);
    expect(wk(w.id).finishedAt).not.toBeNull(); // closed by starting another
    await settle();
    expect(wWrites(w.id)).toHaveLength(1);

    vi.setSystemTime(T0 + 9 * 3600 * 1000);
    store.applyAutoFinish();
    expect(st().workouts.find((x) => x.id === draft.id)).toBeUndefined(); // empty draft dropped
  });

  it('an 8h-old live session with an exercise is finished at start+8h and flagged autoFinished', async () => {
    const w = store.startWorkout()!;
    store.addExercise(w.id, 'Squat');
    vi.setSystemTime(T0 + 9 * 3600 * 1000);
    store.applyAutoFinish();
    expect(wk(w.id).finishedAt).toBe(T0 + 8 * 3600 * 1000);
    expect(wk(w.id).autoFinished).toBe(true);
    await settle();
    expect(wWrites(w.id)).toHaveLength(1);
    expect(wWrites(w.id)[0].data.autoFinished).toBe(true);
  });

  it('startWorkout refuses while an activity or a night is running', () => {
    const act = store.startActivity('Run', 'conditioning');
    expect(act).not.toBeNull();
    expect(store.startWorkout()).toBeNull();
  });

  it('pruneEmptyLiveWorkouts keeps the named one and sessions with exercises', () => {
    const a = store.startWorkout()!;
    expect(st().workouts).toHaveLength(1);
    store.pruneEmptyLiveWorkouts(a.id);
    expect(st().workouts).toHaveLength(1);
    store.pruneEmptyLiveWorkouts();
    expect(st().workouts).toHaveLength(0);
    store.pruneEmptyLiveWorkouts();
  });
});
