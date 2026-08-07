import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import type { StoreState } from '../client/src/store';
import type { Exercise, SetEntry, Workout } from '../client/src/types';
import {
  __getStateForTests,
  __replaceStateForTests,
  addExercise,
  applyAutoFinish,
  backfillWorkout,
  clearSets,
  deleteGym,
  deleteExercise,
  deleteSet,
  deleteWorkout,
  dismissReminder,
  duplicateExercise,
  est1rm,
  finishWorkoutClean,
  getCurrentPositionOnce,
  getOpenWorkout,
  knownExercises,
  logVisitAsWorkout,
  prevLift,
  recordPresence,
  repeatWorkout,
  recordWeight,
  renameExercise,
  reorderExercises,
  resetLocalData,
  reopenWorkout,
  restoreExercise,
  restoreSet,
  startWorkout,
  toggleFavorite,
  topSet,
  upsertGym,
  upsertSet,
  updateWorkoutTimes,
  workoutSets,
  workoutCardioDistanceKm,
  workoutCardioMinutes,
  workoutVolumeKg,
  perHandFactor,
  setVolumeKg,
  setRepsTotal,
  exerciseVolumeKg,
  muscleVolumeKg,
  muscleSetsInWorkout,
  equipmentFor,
  workoutEquipment,
  resolveMuscles,
  sessionBlocks,
  nextSupersetLetter,
  groupRounds,
  groupCurrentRound,
  saveCatalogExercise,
  updateExerciseMeta,
} from '../client/src/store';
import { setRole } from '../client/src/api';
import { CURATED, customExercises, registerCustomExercise } from '../client/src/data/exercises';
import { setFlag } from '../client/src/data/flags';

function state(patch: Partial<StoreState> = {}): StoreState {
  return {
    workouts: [],
    gyms: [],
    reminders: [],
    queue: [],
    syncStatus: 'pending',
    syncError: null,
    lastSyncAt: null,
    ...patch,
  };
}

function workout(patch: Partial<Workout> = {}): Workout {
  return {
    id: crypto.randomUUID(),
    startedAt: Date.now() - 1000,
    finishedAt: Date.now(),
    autoFinished: false,
    exercises: [],
    ...patch,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-31T12:00:00Z'));
  resetLocalData();
});

describe('F-03 Workout store (local state)', () => {
  it('starts one open workout and auto-closes the previous one', () => {
    const first = startWorkout();
    expect(getOpenWorkout()?.id).toBe(first.id);
    vi.setSystemTime(new Date('2026-07-31T12:05:00Z'));
    const second = startWorkout();
    const s = __getStateForTests();

    expect(s.workouts.find((w) => w.id === first.id)).toMatchObject({
      finishedAt: Date.now(),
      autoFinished: true,
    });
    expect(s.workouts.find((w) => w.id === second.id)?.finishedAt).toBe(null);
  });

  it('auto-finishes stale open workouts at startedAt + 8h', () => {
    const startedAt = Date.now() - 9 * 3600_000;
    __replaceStateForTests(
      state({ workouts: [workout({ id: 'old', startedAt, finishedAt: null })] }),
    );

    applyAutoFinish();

    expect(__getStateForTests().workouts[0]).toMatchObject({
      finishedAt: startedAt + 8 * 3600_000,
      autoFinished: true,
    });
  });

  it('adds exercises, upserts sets, computes volume and drops empty exercises on finish', () => {
    const w = startWorkout();
    addExercise(w.id, 'Empty');
    const squat = addExercise(w.id, 'Squat');
    upsertSet(w.id, squat.id, { reps: 8, weight: 100, isWarmup: false });
    upsertSet(w.id, squat.id, { reps: 5, weight: 60, isWarmup: true });

    const finished = finishWorkoutClean(w.id);

    expect(finished?.exercises.map((e) => e.name)).toEqual(['Squat']);
    expect(workoutSets(finished!)).toBe(2);
    expect(workoutVolumeKg(finished!)).toBe(800);
  });

  it('logs cardio, warm-up and cool-down entries without polluting strength volume', () => {
    const w = startWorkout();
    const bike = addExercise(w.id, 'Bike', 'cardio');
    const warm = addExercise(w.id, 'Warm-up', 'warmup');
    upsertSet(w.id, bike.id, {
      reps: 0,
      weight: null,
      isWarmup: false,
      durationMin: 22,
      distanceKm: 7.5,
      calories: 180,
      rpe: 6,
    });
    upsertSet(w.id, warm.id, {
      reps: 0,
      weight: null,
      isWarmup: true,
      durationMin: 8,
      distanceKm: null,
      calories: null,
      rpe: 3,
    });

    const current = __getStateForTests().workouts.find((x) => x.id === w.id)!;
    expect(workoutSets(current)).toBe(0);
    expect(workoutVolumeKg(current)).toBe(0);
    expect(workoutCardioMinutes(current)).toBe(30);
    expect(workoutCardioDistanceKm(current)).toBe(7.5);
  });

  it('updates, deletes and reopens workouts and sets', () => {
    const w = startWorkout();
    const ex = addExercise(w.id, 'Press');
    upsertSet(w.id, ex.id, { id: 'set-a', reps: 5, weight: 50, isWarmup: false });
    upsertSet(w.id, ex.id, { id: 'set-a', reps: 6, weight: 55, isWarmup: false });
    updateWorkoutTimes(w.id, 100, 200, true);
    deleteSet(w.id, ex.id, 'set-a');
    reopenWorkout(w.id);
    deleteWorkout(w.id);

    expect(__getStateForTests().workouts).toEqual([]);
  });

  it('reorders exercises and rewrites their positions', () => {
    const w = startWorkout();
    const squat = addExercise(w.id, 'Squat');
    const bench = addExercise(w.id, 'Bench');
    const row = addExercise(w.id, 'Row');

    reorderExercises(w.id, [row.id, squat.id, bench.id]);

    const current = __getStateForTests().workouts.find((x) => x.id === w.id)!;
    expect(current.exercises.map((e) => [e.name, e.position])).toEqual([
      ['Row', 0],
      ['Squat', 1],
      ['Bench', 2],
    ]);
  });

  it('keeps program prescription metadata on add, rename and duplicate', () => {
    const w = startWorkout();
    const ex = addExercise(w.id, 'Bench', 'strength', {
      plannedSets: 3,
      plannedReps: 8,
      equipment: ['barbell'],
    });

    renameExercise(w.id, ex.id, 'Paused bench');
    duplicateExercise(w.id, ex.id);

    const current = __getStateForTests().workouts.find((x) => x.id === w.id)!;
    expect(current.exercises[0]).toMatchObject({
      name: 'Paused bench',
      plannedSets: 3,
      plannedReps: 8,
      equipment: ['barbell'],
    });
    expect(current.exercises[1]).toMatchObject({
      plannedSets: 3,
      plannedReps: 8,
      equipment: ['barbell'],
    });
  });

  it('restores deleted set/exercise and duplicates exercises', () => {
    const w = startWorkout();
    const ex = addExercise(w.id, 'Bench');
    upsertSet(w.id, ex.id, { id: 's1', reps: 6, weight: 80, isWarmup: false });
    clearSets(w.id, ex.id);
    restoreSet(w.id, ex.id, { id: 's1', reps: 6, weight: 80, isWarmup: false, position: 0 });
    deleteExercise(w.id, ex.id);
    restoreExercise(w.id, ex);
    duplicateExercise(w.id, ex.id);
    restoreExercise(w.id, {
      id: 'restored-with-sets',
      name: 'Bench',
      position: 2,
      sets: [{ id: 'restored-set', reps: 3, weight: 90, isWarmup: false, position: 0 }],
    });

    expect(__getStateForTests().workouts.find((x) => x.id === w.id)!.exercises).toHaveLength(3);
  });
});

describe('F-05 Gyms and reminders store', () => {
  it('logs a retrospective workout and dismisses reminders', () => {
    const gym = upsertGym({ name: 'Smartfit', lat: 50.45, lng: 30.52, radiusM: 150 });
    __replaceStateForTests(
      state({
        gyms: [gym],
        reminders: [{ gymId: gym.id, gymName: gym.name, visitStart: 10, visitEnd: 70 }],
      }),
    );

    const retro = logVisitAsWorkout(__getStateForTests().reminders[0]);
    dismissReminder({ gymId: gym.id, gymName: gym.name, visitStart: 20, visitEnd: 30 });

    expect(retro).toMatchObject({ startedAt: 10, finishedAt: 70 });
    expect(__getStateForTests().reminders).toEqual([]);
    expect(__getStateForTests().workouts.some((w) => w.id === retro.id)).toBe(true);
  });

  it('backfills a finished workout with an optional gym id', () => {
    const startedAt = Date.now() - 3600_000;
    const retro = backfillWorkout(startedAt, 45 * 60_000, 'gym-1');
    expect(retro).toMatchObject({
      startedAt,
      finishedAt: startedAt + 45 * 60_000,
      autoFinished: false,
      gymId: 'gym-1',
      exercises: [],
    });
    expect(__getStateForTests().workouts[0]).toMatchObject({ id: retro.id });
  });

  it('updates and deletes gyms', () => {
    const gym = upsertGym({ id: 'g1', name: 'Old', lat: 1, lng: 2, radiusM: 150 });
    upsertGym({ ...gym, name: 'New', radiusM: 250 });
    toggleFavorite('g1');
    toggleFavorite('missing');
    expect(__getStateForTests().gyms[0]).toMatchObject({ name: 'New', favorite: true });
    deleteGym('g1');
    expect(__getStateForTests().gyms).toEqual([]);
  });

  it('records presence only inside a gym radius and throttles pings', () => {
    __replaceStateForTests(
      state({ gyms: [{ id: 'g1', name: 'Gym', lat: 50, lng: 30, radiusM: 200 }] }),
    );
    const getCurrentPosition = vi.fn((ok: PositionCallback) =>
      ok({
        coords: { latitude: 50.0001, longitude: 30.0001, accuracy: 20 },
      } as GeolocationPosition),
    );
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    });

    // Presence is behind a flag that ships off: no flag, no location request.
    recordPresence();
    expect(getCurrentPosition).not.toHaveBeenCalled();

    setFlag('gymPresence', true);
    recordPresence();
    recordPresence();

    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('spotter.lastPingAt')).not.toBeNull();
  });

  it('ignores presence without gyms, coarse GPS and outside radius', () => {
    setFlag('gymPresence', true);
    recordPresence();
    expect(localStorage.getItem('spotter.lastPingAt')).toBeNull();

    __replaceStateForTests(
      state({ gyms: [{ id: 'g1', name: 'Gym', lat: 50, lng: 30, radiusM: 30 }] }),
    );
    const getCurrentPosition = vi
      .fn()
      .mockImplementationOnce((ok: PositionCallback) =>
        ok({ coords: { latitude: 50, longitude: 30, accuracy: 600 } } as GeolocationPosition),
      )
      .mockImplementationOnce((ok: PositionCallback) =>
        ok({ coords: { latitude: 51, longitude: 31, accuracy: 20 } } as GeolocationPosition),
      );
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    });

    recordPresence();
    vi.setSystemTime(Date.now() + 6 * 60_000);
    recordPresence();

    expect(localStorage.getItem('spotter.lastPingAt')).toBeNull();
  });

  it('resolves and rejects one-shot geolocation lookup', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (ok: PositionCallback) =>
          ok({ coords: { latitude: 50, longitude: 30, accuracy: 15 } } as GeolocationPosition),
      },
    });
    await expect(getCurrentPositionOnce()).resolves.toEqual({ lat: 50, lng: 30, accuracy: 15 });

    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (_ok: PositionCallback, fail: PositionErrorCallback) =>
          fail({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError),
      },
    });
    await expect(getCurrentPositionOnce()).rejects.toThrow('Доступ до геолокації заборонено');
  });
});

describe('F-06 Derived progress/history data', () => {
  it('finds top sets, previous lifts, records and repeat workout templates', () => {
    const past = workout({
      id: 'past',
      startedAt: 10,
      finishedAt: 20,
      exercises: [
        {
          id: 'e1',
          name: 'Squat',
          position: 0,
          sets: [
            { id: 'w', reps: 12, weight: 40, isWarmup: true, position: 0 },
            { id: 'a', reps: 8, weight: 100, isWarmup: false, position: 1 },
            { id: 'b', reps: 5, weight: 110, isWarmup: false, position: 2 },
          ],
        },
      ],
    });
    __replaceStateForTests(state({ workouts: [past] }));

    expect(topSet(past.exercises[0].sets)).toMatchObject({ id: 'b' });
    expect(prevLift('squat')).toEqual({ reps: 5, weight: 110 });
    expect(recordWeight('squat')).toBe(110);
    expect(recordWeight('squat', 'past')).toBe(0);
    expect(knownExercises()).toEqual([{ name: 'Squat', last: { reps: 5, weight: 110 } }]);
    expect(est1rm(100, 6)).toBe(120);

    const repeated = repeatWorkout('past');
    expect(repeated?.exercises.map((e) => e.name)).toEqual(['Squat']);
  });

  it('scores records on the parent set only — a heavier drop never counts', () => {
    const past = workout({
      id: 'drops',
      exercises: [
        {
          id: 'e1',
          name: 'Squat',
          position: 0,
          sets: [
            {
              id: 'a',
              reps: 8,
              weight: 100,
              isWarmup: false,
              position: 0,
              type: 'reverse-drop',
              drops: [{ reps: 3, weight: 140 }],
            },
          ],
        },
      ],
    });
    __replaceStateForTests(state({ workouts: [past] }));

    expect(recordWeight('squat')).toBe(100);
  });

  it('returns safe fallbacks for missing history', () => {
    __replaceStateForTests(state());
    expect(
      topSet([{ id: 'warm', reps: 10, weight: 20, isWarmup: true, position: 0 }]),
    ).toBeUndefined();
    expect(prevLift('missing')).toBeUndefined();
    expect(repeatWorkout('missing')).toBeUndefined();
  });
});

// --- Volume math, per-hand loading, supersets and muscle resolution ---------

function set(patch: Partial<SetEntry> = {}): SetEntry {
  return { id: crypto.randomUUID(), reps: 8, weight: 100, isWarmup: false, position: 0, ...patch };
}
function ex(patch: Partial<Exercise> = {}): Exercise {
  return { id: crypto.randomUUID(), name: 'Move', position: 0, sets: [], ...patch };
}

describe('EQ per-hand loading (perHandFactor)', () => {
  it('doubles dumbbell moves but keeps single-dumbbell and one-arm variants ×1', () => {
    expect(perHandFactor({ name: 'Dumbbell Curl', equipment: ['dumbbell'] })).toBe(2);
    expect(perHandFactor({ name: 'Dumbbell Bench Press', equipment: ['dumbbell'] })).toBe(2);
    expect(perHandFactor({ name: 'Goblet Squat', equipment: ['dumbbell'] })).toBe(1);
    expect(perHandFactor({ name: 'Dumbbell Pullover', equipment: ['dumbbell'] })).toBe(1);
    expect(perHandFactor({ name: 'One-arm Dumbbell Row', equipment: ['dumbbell'] })).toBe(1);
    expect(perHandFactor({ name: 'Single-arm Dumbbell Press', equipment: ['dumbbell'] })).toBe(1);
    // Catalog name without "dumbbell" in the title — resolve via muscleInfoByName.
    expect(perHandFactor({ name: 'Alternate Hammer Curl', equipment: [] })).toBe(2);
  });

  it('keeps single-stack cables ×1 but doubles bilateral two-cable moves', () => {
    expect(perHandFactor({ name: 'Lat Pulldown', equipment: ['cable'] })).toBe(1);
    expect(perHandFactor({ name: 'Triceps Pushdown', equipment: ['cable'] })).toBe(1);
    expect(perHandFactor({ name: 'Seated Cable Row', equipment: ['cable'] })).toBe(1);
    expect(perHandFactor({ name: 'Cable Crunch', equipment: ['cable'] })).toBe(1);
    expect(perHandFactor({ name: 'Rope Crunch', equipment: ['cable'] })).toBe(1);
    expect(perHandFactor({ name: 'Cable Lateral Raise', equipment: ['cable'] })).toBe(1);
    expect(perHandFactor({ name: 'Cable Pec Fly', equipment: ['cable'] })).toBe(2);
    expect(perHandFactor({ name: 'Cable Fly', equipment: ['cable'] })).toBe(2);
    expect(perHandFactor({ name: 'Cable Crossover', equipment: ['cable'] })).toBe(2);
    // Plural spelling and the two-stack presses used to slip through the regex.
    expect(perHandFactor({ name: 'Flat Bench Cable Flyes', equipment: ['cable'] })).toBe(2);
    expect(perHandFactor({ name: 'Cable Iron Cross', equipment: ['cable'] })).toBe(2);
    expect(perHandFactor({ name: 'Cable Chest Press', equipment: ['cable'] })).toBe(2);
    expect(perHandFactor({ name: 'Single-Arm Cable Crossover', equipment: ['cable'] })).toBe(1);
  });

  it('doubles kettlebell pairs but not single-bell moves', () => {
    expect(perHandFactor({ name: 'Kettlebell Swing', equipment: ['kettlebell'] })).toBe(1);
    expect(perHandFactor({ name: 'Goblet Squat', equipment: ['kettlebell'] })).toBe(1);
    expect(perHandFactor({ name: 'Two-Arm Kettlebell Row', equipment: ['kettlebell'] })).toBe(2);
    expect(perHandFactor({ name: 'Double Kettlebell Jerk', equipment: ['kettlebell'] })).toBe(2);
  });

  it('classifies by the English catalog name, whatever locale the set was logged in', () => {
    // uk name of Cable Crossover — two stacks, so still ×2.
    expect(perHandFactor({ name: 'Зведення рук у кросовері', equipment: [] })).toBe(2);
    // uk name of Cable Crunch — one stack.
    expect(perHandFactor({ name: 'Скручування на блоці', equipment: [] })).toBe(1);
  });

  it('keeps the client and Cloud Functions copies of per-side.json identical', () => {
    const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
    expect(JSON.parse(read('../functions/src/data/per-side.json'))).toEqual({
      ...JSON.parse(read('../client/src/data/per-side.json')),
      _comment: expect.any(String),
    });
  });

  it('leaves barbell and machine moves at ×1', () => {
    expect(perHandFactor({ name: 'Bench Press', equipment: ['barbell'] })).toBe(1);
    expect(perHandFactor({ name: 'Leg Press', equipment: ['machine'] })).toBe(1);
    expect(perHandFactor({ name: 'Pull-up', equipment: [] })).toBe(1);
  });
});

describe('EQ set and exercise volume', () => {
  it('sums start weight plus drops and ignores warm-ups', () => {
    expect(setVolumeKg(set({ reps: 8, weight: 100 }))).toBe(800);
    expect(setVolumeKg(set({ isWarmup: true, reps: 10, weight: 40 }))).toBe(0);
    const dropSet = set({
      reps: 5,
      weight: 100,
      type: 'drop',
      drops: [
        { reps: 5, weight: 80 },
        { reps: 5, weight: 60 },
      ],
    });
    expect(setVolumeKg(dropSet)).toBe(1200);
    expect(setRepsTotal(dropSet)).toBe(15);
  });

  it('applies the per-hand factor to a whole exercise and drops warm-up sets', () => {
    const curl = ex({
      name: 'Dumbbell Curl',
      equipment: ['dumbbell'],
      sets: [set({ reps: 10, weight: 20 }), set({ isWarmup: true, reps: 10, weight: 10 })],
    });
    expect(exerciseVolumeKg(curl)).toBe(400);
    const bench = ex({
      name: 'Bench Press',
      equipment: ['barbell'],
      sets: [set({ reps: 5, weight: 100 })],
    });
    expect(exerciseVolumeKg(bench)).toBe(500);
  });
});

describe('MG muscle resolution and per-muscle volume', () => {
  it('prefers the exercise’s own muscle fields, then the catalog, then null', () => {
    expect(
      resolveMuscles({ name: 'Anything', primaryMuscle: 'chest', secondaryMuscles: ['triceps'] }),
    ).toEqual({
      primary: 'chest',
      secondary: ['triceps'],
    });
    expect(resolveMuscles({ name: 'Bench Press' }).primary).toBe('chest');
    expect(resolveMuscles({ name: 'Bench Press', kind: 'cardio' })).toEqual({
      primary: null,
      secondary: [],
    });
    expect(resolveMuscles({ name: 'No Such Lift 123' })).toEqual({ primary: null, secondary: [] });
  });

  it('sums volume and set counts per primary muscle across workouts', () => {
    const w = workout({
      exercises: [
        ex({
          name: 'Bench Press',
          equipment: ['barbell'],
          primaryMuscle: 'chest',
          sets: [set({ reps: 5, weight: 100 }), set({ reps: 5, weight: 100 })],
        }),
        ex({
          name: 'Back Squat',
          equipment: ['barbell'],
          primaryMuscle: 'quads',
          sets: [set({ reps: 5, weight: 140 })],
        }),
      ],
    });
    const vol = muscleVolumeKg([w]);
    expect(vol.get('chest')).toBe(1000);
    expect(vol.get('quads')).toBe(700);
    const counts = muscleSetsInWorkout(w);
    expect(counts.get('chest')).toBe(2);
    expect(counts.get('quads')).toBe(1);
  });
});

describe('EQ equipment resolution', () => {
  it('gives every curated exercise equipment, in any locale', () => {
    const blank = CURATED.filter((e) => !e.equipment).map((e) => e.id);
    expect(blank).toEqual([]);
    // Locale does not change the resolution: uk name of Dumbbell Fly.
    expect(equipmentFor({ name: 'Розведення гантелей лежачи', equipment: [] })).toEqual([
      'dumbbell',
    ]);
    expect(perHandFactor({ name: 'Розведення гантелей лежачи', equipment: [] })).toBe(2);
    // One dumbbell shared by both hands — equipment says dumbbell, volume is ×1.
    expect(perHandFactor({ name: 'Concentration Curl', equipment: [] })).toBe(1);
    expect(perHandFactor({ name: 'Пуловер з гантеллю', equipment: [] })).toBe(1);
  });

  it('prefers the exercise’s own equipment then the catalog, and lists a workout’s kit', () => {
    expect(equipmentFor({ name: 'Whatever', equipment: ['cable'] })).toEqual(['cable']);
    registerCustomExercise({
      id: 'test-machine',
      name: 'Test Machine Move',
      primaryMuscle: 'chest',
      secondaryMuscles: ['triceps'],
      equipment: ['machine'],
    });
    expect(equipmentFor({ name: 'Test Machine Move', equipment: [] })).toEqual(['machine']);
    const w = workout({
      exercises: [
        ex({ name: 'A', equipment: ['barbell'] }),
        ex({ name: 'B', equipment: ['cable'] }),
        ex({ name: 'C', equipment: ['barbell'] }),
      ],
    });
    expect(workoutEquipment(w)).toEqual(['barbell', 'cable']);
  });
});

describe('SS supersets', () => {
  it('groups exercises into blocks and counts rounds', () => {
    const w = workout({
      exercises: [
        ex({ id: 'solo', name: 'Squat', position: 0 }),
        ex({
          id: 'a1',
          name: 'Bench',
          position: 1,
          groupId: 'g1',
          groupOrder: 0,
          plannedSets: 3,
          sets: [set()],
        }),
        ex({
          id: 'a2',
          name: 'Row',
          position: 2,
          groupId: 'g1',
          groupOrder: 1,
          sets: [set(), set()],
        }),
      ],
    });
    const blocks = sessionBlocks(w);
    expect(blocks.map((b) => b.kind)).toEqual(['single', 'group']);
    const group = blocks.find((b) => b.kind === 'group')!;
    if (group.kind !== 'group') throw new Error('expected group');
    expect(group.group.letter).toBe('A');
    expect(group.group.exercises.map((e) => e.id)).toEqual(['a1', 'a2']);
    expect(groupRounds(group.group)).toBe(3);
    expect(groupCurrentRound(group.group)).toBe(2);
    expect(nextSupersetLetter(w)).toBe('B');
  });

  it('treats a lone group member as a single block', () => {
    const w = workout({
      exercises: [ex({ id: 'x', name: 'Curl', position: 0, groupId: 'g9', groupOrder: 0 })],
    });
    expect(sessionBlocks(w).map((b) => b.kind)).toEqual(['single']);
  });
});

describe('Custom catalog authoring', () => {
  it('only admins/trainers register custom exercises; members stay out', () => {
    setRole('member');
    saveCatalogExercise({
      name: 'Member Move',
      primaryMuscle: 'chest',
      secondaryMuscles: [],
      equipment: ['machine'],
    });
    expect(customExercises().some((e) => e.name === 'Member Move')).toBe(false);

    setRole('admin');
    saveCatalogExercise({
      name: 'Admin Move',
      primaryMuscle: 'back',
      secondaryMuscles: ['biceps'],
      equipment: ['cable'],
    });
    // Registered locally right away (the Firestore write is a no-op while signed out in tests).
    expect(customExercises().some((e) => e.name === 'Admin Move')).toBe(true);
  });

  it('updates an exercise’s muscles/equipment in place', () => {
    const w = startWorkout();
    const e = addExercise(w.id, 'Mystery Lift');
    updateExerciseMeta(w.id, e.id, {
      primaryMuscle: 'shoulders',
      secondaryMuscles: ['triceps'],
      equipment: ['dumbbell'],
    });
    expect(__getStateForTests().workouts.find((x) => x.id === w.id)!.exercises[0]).toMatchObject({
      primaryMuscle: 'shoulders',
      secondaryMuscles: ['triceps'],
      equipment: ['dumbbell'],
    });
  });
});
