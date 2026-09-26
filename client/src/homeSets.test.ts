import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  EMPTY_HOME,
  HOME_CATALOG,
  HOME_IDLE_MS,
  homeMoveForExercise,
  homeTotals,
  isStopwatchExercise,
  lastRunOf,
  lastSetsOf,
  ownMoveNameError,
  type HomeState,
} from './homeSets';
import {
  __getStateForTests,
  __replaceStateForTests,
  addHomeMoveToWorkout,
  applyAutoFinish,
  backfillHomeSet,
  deleteHomeMove,
  saveHomeMove,
  saveHomeSet,
  startActivity,
  startHomeSet,
  upsertSet,
} from './store';
import type { SetEntry, Workout } from './types';

const reset = () =>
  __replaceStateForTests({
    ...__getStateForTests(),
    workouts: [],
    activities: [],
    sleeps: [],
    home: { ...EMPTY_HOME },
  });

const hold = (sec: number, at: number): SetEntry => ({
  id: `s${at}`,
  position: 0,
  reps: 1,
  weight: null,
  isWarmup: false,
  type: 'static-dynamic',
  durationMin: sec / 60,
  loggedAt: at,
});

afterEach(() => {
  vi.useRealTimers();
  reset();
});

describe('home move catalog', () => {
  it('uses real base names and marks the holds', () => {
    const vacuum = HOME_CATALOG.find((m) => m.id === 'Stomach Vacuum');
    expect(vacuum?.measure).toBe('hold');
    expect(HOME_CATALOG.find((m) => m.id === 'Pullups')?.measure).toBe('reps');
  });

  it('refuses empty and clashing own-move names', () => {
    const home: HomeState = {
      sets: [],
      moves: [
        {
          id: 'a',
          name: 'Doorframe hang',
          measure: 'hold',
          muscle: 'forearms',
          icon: 'hand',
          custom: true,
        },
      ],
    };
    expect(ownMoveNameError(home, '  ')).toBe('empty');
    expect(ownMoveNameError(home, 'doorframe HANG')).toBe('taken');
    expect(ownMoveNameError(home, 'Pullups')).toBe('taken');
    expect(ownMoveNameError(home, 'Doorframe hang', 'a')).toBeNull();
    expect(ownMoveNameError(home, 'Towel row')).toBeNull();
  });

  it('resolves the move behind a session exercise by name', () => {
    const home: HomeState = {
      sets: [],
      moves: [
        {
          id: 'x',
          name: 'Doorframe hang',
          measure: 'hold',
          muscle: 'forearms',
          icon: 'hand',
          custom: true,
        },
      ],
    };
    expect(homeMoveForExercise(home, { name: 'doorframe hang' })?.id).toBe('x');
    expect(homeMoveForExercise(home, { name: 'Pushups' })?.id).toBe('Pushups');
    expect(homeMoveForExercise(home, { name: 'Bench Press' })).toBeNull();
  });
});

describe('home sets in the store', () => {
  it('saves, renames and deletes a set; own moves leave every set on delete', () => {
    reset();
    const own = saveHomeMove({
      name: 'Doorframe hang',
      measure: 'hold',
      muscle: 'forearms',
      icon: 'hand',
    });
    const set = saveHomeSet({
      name: 'Morning',
      moves: ['Stomach Vacuum', own.id, 'Stomach Vacuum'],
    });
    expect(set.moves).toEqual(['Stomach Vacuum', own.id]);
    saveHomeSet({ id: set.id, name: 'Morning 2', moves: set.moves });
    expect(__getStateForTests().home.sets[0].name).toBe('Morning 2');
    deleteHomeMove(own.id);
    expect(__getStateForTests().home.moves).toHaveLength(0);
    expect(__getStateForTests().home.sets[0].moves).toEqual(['Stomach Vacuum']);
  });

  it('starts a home session with its moves, holds marked for the stopwatch', () => {
    reset();
    const set = saveHomeSet({ name: 'Morning', moves: ['Stomach Vacuum', 'Pullups'] });
    const w = startHomeSet({ set, name: set.name, moves: set.moves });
    expect(w?.kind).toBe('home');
    expect(w?.homeSetId).toBe(set.id);
    expect(w?.gymId).toBeNull();
    expect(w?.dayName).toBe('Morning');
    expect(w?.exercises.map((e) => e.name)).toEqual(['Stomach Vacuum', 'Pullups']);
    expect(isStopwatchExercise(w!.exercises[0])).toBe(true);
    expect(isStopwatchExercise(w!.exercises[1])).toBe(false);
  });

  it('is locked while another live thing runs', () => {
    reset();
    expect(startActivity('run', 'conditioning')).not.toBeNull();
    expect(startHomeSet({ set: null, name: 'Quick', moves: ['Pushups'] })).toBeNull();
  });

  it('finishes an idle home set at its last set and drops empty moves', () => {
    reset();
    vi.useFakeTimers();
    const t0 = new Date('2026-09-26T07:30:00Z').getTime();
    vi.setSystemTime(t0);
    const w = startHomeSet({ set: null, name: 'Morning', moves: ['Stomach Vacuum', 'Pullups'] })!;
    const vac = w.exercises[0];
    upsertSet(w.id, vac.id, hold(25, t0 + 60_000));
    vi.setSystemTime(t0 + 60_000 + HOME_IDLE_MS + 1000);
    applyAutoFinish();
    const done = __getStateForTests().workouts.find((x) => x.id === w.id)!;
    expect(done.finishedAt).toBe(t0 + 60_000);
    expect(done.autoFinished).toBe(false);
    expect(done.exercises.map((e) => e.name)).toEqual(['Stomach Vacuum']);
  });

  it('drops an idle home set that never got a set', () => {
    reset();
    vi.useFakeTimers();
    const t0 = new Date('2026-09-26T07:30:00Z').getTime();
    vi.setSystemTime(t0);
    const w = startHomeSet({ set: null, name: 'Morning', moves: ['Pullups'] })!;
    vi.setSystemTime(t0 + HOME_IDLE_MS + 1000);
    applyAutoFinish();
    expect(__getStateForTests().workouts.find((x) => x.id === w.id)).toBeUndefined();
  });

  it('backfills a finished home set prefilled with the chosen set', () => {
    reset();
    const set = saveHomeSet({ name: 'Core only', moves: ['Stomach Vacuum', 'Plank'] });
    const start = new Date('2026-09-25T20:30:00').getTime();
    const w = backfillHomeSet(start, 10 * 60_000, set);
    expect(w.kind).toBe('home');
    expect(w.finishedAt).toBe(start + 10 * 60_000);
    expect(w.dayName).toBe('Core only');
    expect(w.exercises.map((e) => e.name)).toEqual(['Stomach Vacuum', 'Plank']);
  });

  it('adds an own move with its muscle and measure', () => {
    reset();
    const own = saveHomeMove({
      name: 'Doorframe hang',
      measure: 'time',
      muscle: 'forearms',
      icon: 'hand',
    });
    const w = startHomeSet({ set: null, name: 'x', moves: [] });
    expect(w).not.toBeNull();
    const ex = addHomeMoveToWorkout(w!.id, own);
    expect(ex.primaryMuscle).toBe('forearms');
    expect(ex.measure).toBe('time');
  });
});

describe('home history helpers', () => {
  const w = (over: Partial<Workout>): Workout => ({
    id: over.id ?? 'w',
    startedAt: over.startedAt ?? 0,
    finishedAt: over.finishedAt ?? 600_000,
    autoFinished: false,
    exercises: over.exercises ?? [],
    ...over,
  });

  it('reads the last run of a set and the last sets of a move', () => {
    const list = [
      w({
        id: 'a',
        kind: 'home',
        homeSetId: 's1',
        startedAt: 1000,
        finishedAt: 1000 + 12 * 60_000,
      }),
      w({ id: 'b', kind: 'home', homeSetId: 's1', startedAt: 500, finishedAt: 500 + 60_000 }),
      w({
        id: 'c',
        startedAt: 2000,
        finishedAt: 3000,
        exercises: [
          {
            id: 'e',
            name: 'Stomach Vacuum',
            position: 0,
            measure: 'hold',
            sets: [hold(25, 1), hold(28, 2)],
          },
        ],
      }),
    ];
    expect(lastRunOf(list, 's1')).toEqual({ at: 1000, durationMin: 12 });
    expect(lastRunOf(list, 'nope')).toBeNull();
    expect(lastSetsOf(list, 'stomach vacuum')).toEqual({ at: 2000, values: [25, 28], hold: true });
  });

  it('totals reps and hold seconds', () => {
    const t = homeTotals(
      w({
        exercises: [
          { id: 'a', name: 'Stomach Vacuum', position: 0, measure: 'hold', sets: [hold(25, 1)] },
          {
            id: 'b',
            name: 'Pullups',
            position: 1,
            sets: [
              { id: 'p1', position: 0, reps: 5, weight: null, isWarmup: false },
              { id: 'p2', position: 1, reps: 6, weight: null, isWarmup: false },
            ],
          },
        ],
      }),
    );
    expect(t).toEqual({ sets: 3, reps: 11, holdSec: 25 });
  });
});
