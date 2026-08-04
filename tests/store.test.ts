import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StoreState } from '../client/src/store';
import type { Workout } from '../client/src/types';
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
  startSyncLoop,
  sync,
  retrySync,
  discardBlockingChange,
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
  groupAsSuperset,
  ungroupSuperset,
  missingAtGym,
  attachGymToWorkout,
  addDropToSet,
  saveCatalogExercise,
  updateExerciseMeta,
} from '../client/src/store';
import { setAuth, setRole } from '../client/src/api';
import { customExercises, registerCustomExercise } from '../client/src/data/exercises';
import type { Exercise, SetEntry } from '../client/src/types';

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

describe('F-03 Workout store', () => {
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
    expect(s.queue.map((q) => q.method)).toEqual(['PUT', 'PUT', 'PUT']);
  });

  it('auto-finishes stale open workouts at startedAt + 8h', () => {
    const startedAt = Date.now() - 9 * 3600_000;
    __replaceStateForTests(
      state({ workouts: [workout({ id: 'old', startedAt, finishedAt: null })] }),
    );

    applyAutoFinish();

    const old = __getStateForTests().workouts[0];
    expect(old).toMatchObject({ finishedAt: startedAt + 8 * 3600_000, autoFinished: true });
    expect(__getStateForTests().queue[0]).toMatchObject({
      method: 'PUT',
      url: '/api/tracker/workouts/old',
    });
  });

  it('adds exercises, upserts sets, computes volume and drops empty exercises on finish', () => {
    const w = startWorkout();
    const empty = addExercise(w.id, 'Empty');
    const squat = addExercise(w.id, 'Squat');
    upsertSet(w.id, squat.id, { reps: 8, weight: 100, isWarmup: false });
    upsertSet(w.id, squat.id, { reps: 5, weight: 60, isWarmup: true });

    const finished = finishWorkoutClean(w.id);

    expect(finished?.exercises.map((e) => e.name)).toEqual(['Squat']);
    expect(
      __getStateForTests().queue.some(
        (q) => q.url === `/api/tracker/exercises/${empty.id}` && q.method === 'DELETE',
      ),
    ).toBe(true);
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
    expect(
      __getStateForTests().queue.some(
        (q) => q.url.includes('/exercises/') && JSON.stringify(q.body).includes('"kind":"cardio"'),
      ),
    ).toBe(true);
    expect(
      __getStateForTests().queue.some(
        (q) => q.url.includes('/sets/') && JSON.stringify(q.body).includes('"durationMin":22'),
      ),
    ).toBe(true);
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
    expect(__getStateForTests().queue.map((q) => q.method)).toContain('DELETE');
  });

  it('reorders exercises and syncs their new positions idempotently', () => {
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
    expect(
      __getStateForTests().queue.filter(
        (q) => q.method === 'PUT' && q.url.includes(`/workouts/${w.id}/exercises/`),
      ),
    ).toHaveLength(6);
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
    const exerciseWrites = __getStateForTests().queue.filter((q) =>
      q.url.includes(`/workouts/${w.id}/exercises/`),
    );
    expect(exerciseWrites.at(-1)?.body).toMatchObject({
      plannedSets: 3,
      plannedReps: 8,
      equipment: ['barbell'],
    });
  });

  it('restores deleted set/exercise and duplicates exercises idempotently through queue', () => {
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
    const current = __getStateForTests().workouts.find((x) => x.id === w.id)!;
    expect(current.exercises).toHaveLength(3);
    expect(__getStateForTests().queue.some((q) => q.url.endsWith('/sets/restored-set'))).toBe(true);
    expect(
      __getStateForTests().queue.some((q) => q.url.endsWith('/sets/s1') && q.method === 'PUT'),
    ).toBe(true);
  });
});

describe('F-04 Offline queue and sync', () => {
  it('replays queue in order and fully replaces local state with server truth', async () => {
    setAuth('token', 'demo');
    __replaceStateForTests(
      state({
        workouts: [workout({ id: 'local' })],
        queue: [
          {
            id: 'q1',
            method: 'PUT',
            url: '/api/tracker/workouts/a',
            body: { startedAt: 1 },
            queuedAt: 1,
          },
          { id: 'q2', method: 'DELETE', url: '/api/tracker/workouts/b', queuedAt: 2 },
        ],
      }),
    );
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push(`${init?.method} ${url}`);
        if (url.endsWith('/api/tracker/state')) {
          return new Response(
            JSON.stringify({
              workouts: [workout({ id: 'server', startedAt: 99 })],
              gyms: [],
              reminders: [],
            }),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    );

    await sync();

    expect(calls).toEqual([
      'PUT /api/tracker/workouts/a',
      'DELETE /api/tracker/workouts/b',
      'GET /api/tracker/state',
    ]);
    expect(__getStateForTests().queue).toEqual([]);
    expect(__getStateForTests().workouts.map((w) => w.id)).toEqual(['server']);
    expect(__getStateForTests().syncStatus).toBe('synced');
  });

  it('keeps queue on network failure', async () => {
    setAuth('token', 'demo');
    __replaceStateForTests(
      state({ queue: [{ id: 'q1', method: 'PUT', url: '/api/tracker/workouts/a', queuedAt: 1 }] }),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('offline');
      }),
    );

    await sync();

    expect(__getStateForTests().queue).toHaveLength(1);
    expect(__getStateForTests().syncStatus).toBe('pending');
  });

  it('halts the queue and surfaces a permanent rejection (AC-SYNC-02, AC-SYNC-05)', async () => {
    setAuth('token', 'demo');
    __replaceStateForTests(
      state({
        queue: [
          {
            id: 'bad',
            method: 'PUT',
            url: '/api/tracker/workouts/bad',
            body: { startedAt: 'bad' },
            queuedAt: 1,
          },
          { id: 'next', method: 'DELETE', url: '/api/tracker/workouts/next', queuedAt: 2 },
        ],
      }),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === 'PUT') {
          return new Response(JSON.stringify({ error: 'bad payload' }), { status: 400 });
        }
        throw new Error('queue should have halted before this request');
      }),
    );

    await sync();

    // Halts at the blocking change rather than skipping it (AC-SYNC-02).
    expect(__getStateForTests().queue.map((q) => q.id)).toEqual(['bad', 'next']);
    expect(__getStateForTests().syncStatus).toBe('failed');
    expect(__getStateForTests().syncError?.status).toBe(400);
    expect(__getStateForTests().syncError?.statusLine).toContain('400');
  });

  it('discards the blocking change so the rest can replay (AC-SYNC-05)', () => {
    setAuth('token', 'demo');
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ workouts: [], gyms: [], reminders: [] }), { status: 200 }),
      ),
    );
    __replaceStateForTests(
      state({
        syncStatus: 'failed',
        syncError: { status: 400, statusLine: 'PUT /api/tracker/workouts/bad → 400 Bad Request' },
        queue: [
          { id: 'bad', method: 'PUT', url: '/api/tracker/workouts/bad', queuedAt: 1 },
          { id: 'next', method: 'DELETE', url: '/api/tracker/workouts/next', queuedAt: 2 },
        ],
      }),
    );

    discardBlockingChange();

    // The blocking change is dropped synchronously and the error is cleared.
    expect(__getStateForTests().queue.map((q) => q.id)).toEqual(['next']);
    expect(__getStateForTests().syncError).toBeNull();
  });

  it('retrySync clears the failed state before re-attempting (AC-SYNC-05)', () => {
    setAuth('token', 'demo');
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ workouts: [], gyms: [], reminders: [] }), { status: 200 }),
      ),
    );
    __replaceStateForTests(
      state({
        syncStatus: 'failed',
        syncError: { status: 409, statusLine: 'PUT /x → 409 Conflict' },
        queue: [{ id: 'bad', method: 'PUT', url: '/api/tracker/workouts/bad', queuedAt: 1 }],
      }),
    );

    retrySync();

    expect(__getStateForTests().syncError).toBeNull();
  });
});

describe('F-05 Gyms and reminders store', () => {
  it('queues gym upsert, retrospective workout and reminder dismiss', () => {
    const gym = upsertGym({ name: 'Smartfit', lat: 50.45, lng: 30.52, radiusM: 150 });
    __replaceStateForTests(
      state({
        gyms: [gym],
        reminders: [{ gymId: gym.id, gymName: gym.name, visitStart: 10, visitEnd: 70 }],
        queue: __getStateForTests().queue,
      }),
    );

    const retro = logVisitAsWorkout(__getStateForTests().reminders[0]);
    dismissReminder({ gymId: gym.id, gymName: gym.name, visitStart: 20, visitEnd: 30 });

    expect(retro).toMatchObject({ startedAt: 10, finishedAt: 70 });
    expect(__getStateForTests().reminders).toEqual([]);
    expect(__getStateForTests().queue.map((q) => q.method)).toContain('POST');
  });

  it('backfills a finished workout with optional gym id through the upsert queue', () => {
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
    expect(__getStateForTests().queue.at(-1)).toMatchObject({
      method: 'PUT',
      url: `/api/tracker/workouts/${retro.id}`,
      body: expect.objectContaining({ gymId: 'gym-1' }),
    });
  });

  it('updates and deletes gyms', () => {
    const gym = upsertGym({ id: 'g1', name: 'Old', lat: 1, lng: 2, radiusM: 150 });
    upsertGym({ ...gym, name: 'New', radiusM: 250 });
    toggleFavorite('g1');
    toggleFavorite('missing');
    expect(__getStateForTests().gyms[0]).toMatchObject({ name: 'New', favorite: true });
    deleteGym('g1');

    expect(__getStateForTests().gyms).toEqual([]);
    expect(__getStateForTests().queue.at(-1)).toMatchObject({
      method: 'DELETE',
      url: '/api/tracker/gyms/g1',
    });
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

    recordPresence();
    recordPresence();

    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(__getStateForTests().queue[0]).toMatchObject({
      method: 'PUT',
      url: expect.stringContaining('/api/tracker/pings/'),
    });
  });

  it('ignores presence without gyms, coarse GPS and outside radius', () => {
    recordPresence();
    expect(__getStateForTests().queue).toEqual([]);

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

    expect(__getStateForTests().queue).toEqual([]);
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

  it('starts and stops sync loop listeners', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');

    const stop = startSyncLoop();
    stop();

    expect(add).toHaveBeenCalledWith('online', expect.any(Function));
    expect(add).toHaveBeenCalledWith('focus', expect.any(Function));
    expect(remove).toHaveBeenCalledWith('online', expect.any(Function));
    expect(remove).toHaveBeenCalledWith('focus', expect.any(Function));
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
    // Held with both hands / one arm at a time → the entered load IS the total.
    expect(perHandFactor({ name: 'Goblet Squat', equipment: ['dumbbell'] })).toBe(1);
    expect(perHandFactor({ name: 'Dumbbell Pullover', equipment: ['dumbbell'] })).toBe(1);
    expect(perHandFactor({ name: 'One-arm Dumbbell Row', equipment: ['dumbbell'] })).toBe(1);
    expect(perHandFactor({ name: 'Single-arm Dumbbell Press', equipment: ['dumbbell'] })).toBe(1);
  });

  it('keeps single-stack cables ×1 but doubles bilateral two-cable moves', () => {
    expect(perHandFactor({ name: 'Lat Pulldown', equipment: ['cable'] })).toBe(1);
    expect(perHandFactor({ name: 'Triceps Pushdown', equipment: ['cable'] })).toBe(1);
    expect(perHandFactor({ name: 'Seated Cable Row', equipment: ['cable'] })).toBe(1);
    expect(perHandFactor({ name: 'Cable Pec Fly', equipment: ['cable'] })).toBe(2);
    expect(perHandFactor({ name: 'Cable Fly', equipment: ['cable'] })).toBe(2);
    expect(perHandFactor({ name: 'Cable Crossover', equipment: ['cable'] })).toBe(2);
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
    // 100×5 + 80×5 + 60×5 = 500 + 400 + 300
    expect(setVolumeKg(dropSet)).toBe(1200);
    expect(setRepsTotal(dropSet)).toBe(15);
  });

  it('applies the per-hand factor to a whole exercise and drops warm-up sets', () => {
    const curl = ex({
      name: 'Dumbbell Curl',
      equipment: ['dumbbell'],
      sets: [set({ reps: 10, weight: 20 }), set({ isWarmup: true, reps: 10, weight: 10 })],
    });
    // working set 20×10 = 200, warm-up excluded, ×2 hands = 400
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
    ).toEqual({ primary: 'chest', secondary: ['triceps'] });

    // Falls back to the catalog by name (Bench Press → chest).
    const byCatalog = resolveMuscles({ name: 'Bench Press' });
    expect(byCatalog.primary).toBe('chest');

    // Non-strength kinds and unknown names resolve to no muscle.
    expect(resolveMuscles({ name: 'Bench Press', kind: 'cardio' })).toEqual({
      primary: null,
      secondary: [],
    });
    expect(resolveMuscles({ name: 'No Such Lift 123' })).toEqual({
      primary: null,
      secondary: [],
    });
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
  it('prefers the exercise’s own equipment then the catalog, and lists a workout’s kit', () => {
    expect(equipmentFor({ name: 'Whatever', equipment: ['cable'] })).toEqual(['cable']);
    // Fallback via a registered custom exercise.
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
    // longest member: a1 planned 3 vs a2 logged 2 → 3 rounds
    expect(groupRounds(group.group)).toBe(3);
    // shortest member has 1 logged set → next round is 2
    expect(groupCurrentRound(group.group)).toBe(2);
    expect(nextSupersetLetter(w)).toBe('B');
  });

  it('treats a lone group member as a single block', () => {
    const w = workout({
      exercises: [ex({ id: 'x', name: 'Curl', position: 0, groupId: 'g9', groupOrder: 0 })],
    });
    expect(sessionBlocks(w).map((b) => b.kind)).toEqual(['single']);
  });

  it('groups and ungroups exercises through the queue', () => {
    const w = startWorkout();
    const a = addExercise(w.id, 'Bench');
    const b = addExercise(w.id, 'Row');
    const c = addExercise(w.id, 'Squat');

    groupAsSuperset(w.id, [a.id]); // too few — no-op
    expect(__getStateForTests().workouts[0].exercises.every((e) => !e.groupId)).toBe(true);

    groupAsSuperset(w.id, [a.id, b.id]);
    const grouped = __getStateForTests().workouts[0].exercises;
    const gid = grouped.find((e) => e.id === a.id)!.groupId;
    expect(gid).toBeTruthy();
    expect(grouped.find((e) => e.id === b.id)?.groupId).toBe(gid);
    expect(grouped.find((e) => e.id === c.id)?.groupId).toBeFalsy();
    expect(
      __getStateForTests().queue.filter(
        (q) => q.method === 'PUT' && String(q.url).includes('/exercises/'),
      ).length,
    ).toBeGreaterThanOrEqual(2);

    ungroupSuperset(w.id, gid!);
    expect(__getStateForTests().workouts[0].exercises.every((e) => e.groupId == null)).toBe(true);
  });
});

describe('EQ gym inventory gaps and session helpers', () => {
  it('flags missing kit only when the gym has an inventory list', () => {
    expect(missingAtGym(null, ['barbell'])).toEqual([]);
    expect(
      missingAtGym({ id: 'g', name: 'Empty', lat: 0, lng: 0, radiusM: 100 }, ['barbell']),
    ).toEqual([]);
    expect(
      missingAtGym(
        { id: 'g', name: 'Smart', lat: 0, lng: 0, radiusM: 100, inventory: ['dumbbell'] },
        ['barbell', 'dumbbell'],
      ),
    ).toEqual(['barbell']);
  });

  it('attaches a gym and appends drop sets on a logged lift', () => {
    const gym = upsertGym({ name: 'Home', lat: 1, lng: 2, radiusM: 100 });
    const w = startWorkout();
    const e = addExercise(w.id, 'Curl');
    upsertSet(w.id, e.id, { reps: 10, weight: 20, isWarmup: false, position: 0 });
    const setId = __getStateForTests().workouts[0].exercises[0].sets[0].id;

    attachGymToWorkout(w.id, gym.id);
    expect(__getStateForTests().workouts[0].gymId).toBe(gym.id);
    expect(
      __getStateForTests().queue.some(
        (q) => q.method === 'PUT' && q.url === `/api/tracker/workouts/${w.id}`,
      ),
    ).toBe(true);

    addDropToSet(w.id, e.id, setId, { reps: 8, weight: 15 });
    const logged = __getStateForTests().workouts[0].exercises[0].sets[0];
    expect(logged.type).toBe('drop');
    expect(logged.drops).toEqual([{ reps: 8, weight: 15 }]);

    addDropToSet(w.id, e.id, setId, { reps: 6, weight: 12 }, true);
    expect(__getStateForTests().workouts[0].exercises[0].sets[0].type).toBe('drop');
    expect(__getStateForTests().workouts[0].exercises[0].sets[0].drops).toHaveLength(2);
  });
});

describe('Custom catalog authoring', () => {
  it('only admins/trainers persist custom exercises; members stay local-only', () => {
    setAuth('token', 'demo', 'member');
    saveCatalogExercise({
      name: 'Member Move',
      primaryMuscle: 'chest',
      secondaryMuscles: [],
      equipment: ['machine'],
    });
    expect(customExercises().some((e) => e.name === 'Member Move')).toBe(false);

    setRole('admin');
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push(`${init?.method} ${url}`);
        return new Response(
          JSON.stringify({
            exercise: {
              id: 'srv-1',
              name: 'Admin Move',
              primaryMuscle: 'back',
              secondaryMuscles: ['biceps'],
              equipment: ['cable'],
            },
          }),
          { status: 200 },
        );
      }),
    );

    saveCatalogExercise({
      name: 'Admin Move',
      primaryMuscle: 'back',
      secondaryMuscles: ['biceps'],
      equipment: ['cable'],
    });
    // Registered locally right away (before the round-trip resolves).
    expect(customExercises().some((e) => e.name === 'Admin Move')).toBe(true);
    expect(calls.some((c) => c.includes('PUT') && c.includes('/api/exercises'))).toBe(true);
  });

  it('updates an exercise’s muscles/equipment in place and queues the change', () => {
    const w = startWorkout();
    const e = addExercise(w.id, 'Mystery Lift');
    updateExerciseMeta(w.id, e.id, {
      primaryMuscle: 'shoulders',
      secondaryMuscles: ['triceps'],
      equipment: ['dumbbell'],
    });

    const current = __getStateForTests().workouts.find((x) => x.id === w.id)!;
    expect(current.exercises[0]).toMatchObject({
      primaryMuscle: 'shoulders',
      secondaryMuscles: ['triceps'],
      equipment: ['dumbbell'],
    });
    expect(
      __getStateForTests().queue.some(
        (q) => q.method === 'PUT' && q.url.endsWith(`/exercises/${e.id}`),
      ),
    ).toBe(true);
  });
});
