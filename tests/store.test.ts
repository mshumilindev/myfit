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
  resetLocalData,
  reopenWorkout,
  restoreExercise,
  restoreSet,
  startWorkout,
  startSyncLoop,
  sync,
  toggleFavorite,
  topSet,
  upsertGym,
  upsertSet,
  updateWorkoutTimes,
  workoutSets,
  workoutVolumeKg,
} from '../client/src/store';
import { setAuth } from '../client/src/api';

function state(patch: Partial<StoreState> = {}): StoreState {
  return {
    workouts: [],
    gyms: [],
    reminders: [],
    queue: [],
    syncStatus: 'pending',
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
    expect(workoutVolumeKg(finished!)).toBe(1100);
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

  it('drops permanently rejected queue items and still refetches server truth', async () => {
    setAuth('token', 'demo');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
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
        ],
      }),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === 'PUT') {
          return new Response(JSON.stringify({ error: 'bad payload' }), { status: 400 });
        }
        if (url.endsWith('/api/tracker/state')) {
          return new Response(JSON.stringify({ workouts: [], gyms: [], reminders: [] }), {
            status: 200,
          });
        }
        throw new Error('unexpected request');
      }),
    );

    await sync();

    expect(warn).toHaveBeenCalledWith(
      'sync: dropping rejected mutation',
      expect.objectContaining({ id: 'bad' }),
      'bad payload',
    );
    expect(__getStateForTests().queue).toEqual([]);
    expect(__getStateForTests().syncStatus).toBe('synced');
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
