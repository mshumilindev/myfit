import { describe, expect, it } from 'vitest';
import {
  defaultWarmupValue,
  findLastWarmup,
  isTimedWarmupName,
  lastWarmupValues,
  warmupUsesWeight,
  warmupItemsOf,
  warmupSummary,
} from './warmupLog';
import {
  __getStateForTests,
  __replaceStateForTests,
  addExercise,
  addWarmupItem,
  duplicateExercise,
  finishWorkoutClean,
  removeWarmupItem,
  setWarmupItems,
  setWarmupMinutes,
  startWorkout,
  logWarmupItem,
  updateWarmupItem,
  upsertSet,
  workoutSets,
  workoutVolumeKg,
  isMarkerExercise,
  setTypeOf,
} from './store';
import type { Exercise, Workout } from './types';

const marker = (over: Partial<Exercise> = {}): Exercise => ({
  id: 'm',
  name: 'Warm-up',
  kind: 'warmup',
  position: 0,
  sets: [],
  ...over,
});
const find = (wid: string, id: string) =>
  __getStateForTests()
    .workouts.find((w) => w.id === wid)!
    .exercises.find((e) => e.id === id)!;

describe('old warm-up markers (backward compat)', () => {
  it('a marker without items is a generic warm-up', () => {
    const ex = marker({ plannedDurationMin: 5 });
    expect(isMarkerExercise(ex)).toBe(true);
    expect(warmupItemsOf(ex)).toEqual([]);
    expect(warmupSummary(ex)).toEqual({ count: 0, total: 0, minutes: 5 });
    expect(warmupSummary(marker()).minutes).toBeNull();
  });
  it('items present show, whatever the retired warmupDetailed flag says', () => {
    const items = [{ id: 'a', name: 'Cat Stretch', durationSec: 60, done: true }];
    for (const flag of [true, false, undefined]) {
      const ex = marker({
        warmupItems: items,
        ...(flag === undefined ? {} : { warmupDetailed: flag }),
      } as never);
      expect(warmupItemsOf(ex)).toHaveLength(1);
      expect(warmupSummary(ex)).toEqual({ count: 1, total: 1, minutes: 1 });
    }
  });
  it('ignores malformed items in storage', () => {
    const ex = marker({
      warmupItems: [
        null,
        { id: 1 },
        { id: 'a', name: ' ', done: true },
        { id: 'b', name: 'Cat Stretch', durationSec: -3, done: 'yes' },
      ] as never,
    });
    expect(warmupItemsOf(ex)).toEqual([{ id: 'b', name: 'Cat Stretch', done: false }]);
  });
});

describe('defaultWarmupValue', () => {
  it('logs stretches, holds and cardio in seconds, the rest in reps', () => {
    expect(defaultWarmupValue('Cat Stretch')).toEqual({ durationSec: 30 });
    expect(defaultWarmupValue('Plank')).toEqual({ durationSec: 30 });
    expect(defaultWarmupValue('Walking, Treadmill')).toHaveProperty('durationSec');
    expect(defaultWarmupValue('Band Pull Apart')).toEqual({ reps: 12 });
    expect(isTimedWarmupName('Band Pull Apart')).toBe(false);
  });
});

describe('warm-up store actions', () => {
  it('adds exercises, edits the one value and keeps the marker minutes in step', () => {
    const w = startWorkout(null)!;
    const ex = addExercise(w.id, 'Warm-up', 'warmup');
    setWarmupMinutes(w.id, ex.id, 7);
    expect(find(w.id, ex.id).plannedDurationMin).toBe(7);

    const a = addWarmupItem(w.id, ex.id, { name: 'Arm Circles', reps: 10 })!;
    const b = addWarmupItem(w.id, ex.id, { name: 'Cat Stretch', durationSec: 90 })!;
    expect(addWarmupItem(w.id, ex.id, { name: '  ' })).toBeNull();
    expect(warmupItemsOf(find(w.id, ex.id)).map((i) => i.name)).toEqual([
      'Arm Circles',
      'Cat Stretch',
    ]);
    // nothing done yet → no minutes from items
    expect(find(w.id, ex.id).plannedDurationMin).toBeNull();

    // pending until Log is pressed: editing values never logs
    updateWarmupItem(w.id, ex.id, a.id, { reps: 12, weight: 10 });
    expect(warmupItemsOf(find(w.id, ex.id))[0]).toMatchObject({
      done: false,
      reps: 12,
      weight: 10,
    });

    logWarmupItem(w.id, ex.id, b.id, { durationSec: 90 });
    let cur = find(w.id, ex.id);
    expect(warmupItemsOf(cur).find((i) => i.id === b.id)).toMatchObject({ done: true });
    expect(warmupItemsOf(cur).find((i) => i.id === b.id)?.at).toBeTypeOf('number');
    expect(cur.plannedDurationMin).toBe(2); // 90 s → 2 min (rounded)
    logWarmupItem(w.id, ex.id, a.id, { reps: 15, weight: 0 });
    cur = find(w.id, ex.id);
    expect(warmupItemsOf(cur)[0]).toMatchObject({ done: true, reps: 15 });
    expect(warmupItemsOf(cur)[0].weight).toBeUndefined(); // 0 clears
    expect(cur.plannedDurationMin).toBe(2);
    // editing a logged item keeps it logged
    updateWarmupItem(w.id, ex.id, b.id, { durationSec: 30 });
    cur = find(w.id, ex.id);
    expect(warmupItemsOf(cur).find((i) => i.id === b.id)).toMatchObject({
      done: true,
      durationSec: 30,
    });
    expect(cur.plannedDurationMin).toBe(1); // 30 s → min 1

    removeWarmupItem(w.id, ex.id, a.id);
    expect(warmupItemsOf(find(w.id, ex.id))).toHaveLength(1);
    // the last one goes: back to a plain generic warm-up
    removeWarmupItem(w.id, ex.id, b.id);
    cur = find(w.id, ex.id);
    expect(cur.warmupItems).toBeUndefined();
    expect(warmupSummary(cur).total).toBe(0);
    expect(cur.sets).toEqual([]);
  });

  it('strips the retired warmupDetailed flag on the next write', () => {
    const w = startWorkout(null)!;
    const ex = addExercise(w.id, 'Warm-up', 'warmup');
    const state = __getStateForTests();
    __replaceStateForTests({
      ...state,
      workouts: state.workouts.map((x) =>
        x.id === w.id
          ? {
              ...x,
              exercises: x.exercises.map((e) =>
                e.id === ex.id ? ({ ...e, warmupDetailed: true, warmupItems: [] } as typeof e) : e,
              ),
            }
          : x,
      ),
    });
    addWarmupItem(w.id, ex.id, { name: 'Arm Circles', reps: 10 });
    expect('warmupDetailed' in find(w.id, ex.id)).toBe(false);
  });

  it('a block can start with exercises (program day / auto proposal)', () => {
    const w = startWorkout(null)!;
    const ex = addExercise(w.id, 'Warm-up', 'warmup', {
      warmupItems: [{ name: 'Band Pull Apart', exerciseId: 'Band_Pull_Apart', reps: 15 }],
    });
    const items = warmupItemsOf(find(w.id, ex.id));
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ name: 'Band Pull Apart', reps: 15, done: false });
  });

  it('only acts on warm-up markers', () => {
    const w = startWorkout(null)!;
    const lift = addExercise(w.id, 'Barbell Squat');
    const cd = addExercise(w.id, 'Cool-down', 'cooldown');
    expect(addWarmupItem(w.id, lift.id, { name: 'Cat Stretch' })).toBeNull();
    expect(addWarmupItem(w.id, cd.id, { name: 'Cat Stretch' })).toBeNull();
  });

  it('repeat replaces the list with fresh ids, nothing done', () => {
    const w = startWorkout(null)!;
    const ex = addExercise(w.id, 'Warm-up', 'warmup');
    setWarmupItems(w.id, ex.id, [
      { name: 'Arm Circles', reps: 10, done: true },
      { name: 'Cat Stretch', durationSec: 30 },
      { name: '' },
    ]);
    const items = warmupItemsOf(find(w.id, ex.id));
    expect(items.map((i) => [i.name, i.done])).toEqual([
      ['Arm Circles', false],
      ['Cat Stretch', false],
    ]);
    duplicateExercise(w.id, ex.id);
    const copy = __getStateForTests()
      .workouts.find((x) => x.id === w.id)!
      .exercises.at(-1)!;
    expect(copy.warmupItems).toHaveLength(2);
    expect(copy.warmupItems![0].id).not.toBe(items[0].id);
  });
});

describe('stats stay clear of warm-up items', () => {
  it('a warm-up with exercises adds no sets and no volume; ramp sets still count as warm-up', () => {
    const w = startWorkout(null)!;
    const ex = addExercise(w.id, 'Warm-up', 'warmup');
    addWarmupItem(w.id, ex.id, { name: 'Arm Circles', reps: 10, done: true });
    const lift = addExercise(w.id, 'Barbell Squat');
    upsertSet(w.id, lift.id, { reps: 10, weight: 40, isWarmup: true });
    upsertSet(w.id, lift.id, { reps: 5, weight: 100, isWarmup: false });
    const done = finishWorkoutClean(w.id)!;
    const m = done.exercises.find((e) => e.kind === 'warmup')!;
    expect(m.sets).toHaveLength(0);
    expect(isMarkerExercise(m)).toBe(true);
    const liftsOnly = { ...done, exercises: done.exercises.filter((e) => e.kind !== 'warmup') };
    expect(workoutSets(done)).toBe(workoutSets(liftsOnly));
    expect(workoutVolumeKg(done)).toBe(workoutVolumeKg(liftsOnly));
    const squat = done.exercises.find((e) => e.name === 'Barbell Squat')!;
    expect(squat.sets.map(setTypeOf)).toEqual(['warmup', 'working']);
  });
});

describe('findLastWarmup', () => {
  const day = (n: number) => Date.UTC(2026, 8, n, 9);
  const wk = (id: string, startedAt: number, ex: Exercise | null, dayName?: string): Workout => ({
    id,
    startedAt,
    finishedAt: startedAt + 3600_000,
    autoFinished: false,
    dayName: dayName ?? null,
    exercises: ex ? [ex] : [],
  });
  const detailed = marker({
    warmupItems: [{ id: 'a', name: 'Cat Stretch', done: true, durationSec: 60 }],
  });
  const single = marker({ plannedDurationMin: 5 });

  it('prefers the same day name, then weekday, then the latest', () => {
    const list = [
      wk('push', day(1), detailed, 'Push'),
      wk('pull', day(8), single, 'Pull'),
      wk('x', day(22), single, 'Legs'),
    ];
    expect(findLastWarmup(list, { dayName: 'push' })?.items).toHaveLength(1);
    expect(findLastWarmup(list, { dayName: 'Nope', weekday: 1 })?.startedAt).toBe(day(22)); // Tue 22nd
    expect(findLastWarmup(list, {})?.startedAt).toBe(day(22));
  });
  it('skips unfinished sessions, the excluded one and empty warm-ups', () => {
    const live = { ...wk('live', day(29), single), finishedAt: null };
    const empty = wk('e', day(28), marker());
    const emptyDetailed = wk('d', day(27), marker({ warmupItems: [] }));
    expect(findLastWarmup([live, empty, emptyDetailed], {})).toBeNull();
    const one = wk('one', day(3), single);
    expect(findLastWarmup([one], { excludeId: 'one' })).toBeNull();
    expect(findLastWarmup([one], {})).toMatchObject({ minutes: 5, items: [] });
  });
});

describe('weight and history', () => {
  it('weights only for loaded equipment, never for timed or bodyweight moves', () => {
    expect(warmupUsesWeight('Band Pull Apart')).toBe(false);
    expect(warmupUsesWeight('Cat Stretch')).toBe(false);
    expect(warmupUsesWeight('Dumbbell Bicep Curl')).toBe(true);
    expect(warmupUsesWeight('Barbell Squat')).toBe(true);
  });
  it('keeps a stored weight and drops junk; old done items stay logged', () => {
    const ex = marker({
      warmupItems: [
        { id: 'a', name: 'Dumbbell Bicep Curl', reps: 10, weight: 7.5, done: true },
        { id: 'b', name: 'Arm Circles', reps: 10, weight: -2 as never, done: false },
      ],
    });
    const items = warmupItemsOf(ex);
    expect(items[0]).toMatchObject({ weight: 7.5, done: true });
    expect(items[1].weight).toBeUndefined();
    expect(items[1].done).toBe(false);
  });
  it('pre-fills from the last logged set of that exercise (pending ones do not count)', () => {
    const mk = (id: string, t: number, items: never[]): Workout =>
      ({
        id,
        startedAt: t,
        finishedAt: t + 1,
        autoFinished: false,
        exercises: [marker({ warmupItems: items })],
      }) as Workout;
    const hist = [
      mk('o', 1, [
        { id: 'x', name: 'Dumbbell Bicep Curl', reps: 8, weight: 5, done: true },
      ] as never),
      mk('n', 2, [
        { id: 'y', name: 'Dumbbell Bicep Curl', reps: 12, weight: 7.5, done: true },
        { id: 'z', name: 'Arm Circles', reps: 20, done: false },
      ] as never),
    ];
    expect(lastWarmupValues(hist, 'dumbbell bicep curl')).toEqual({ reps: 12, weight: 7.5 });
    expect(lastWarmupValues(hist, 'Arm Circles')).toBeNull();
    expect(lastWarmupValues(hist, 'Dumbbell Bicep Curl', 'n')).toEqual({ reps: 8, weight: 5 });
  });
  it('summary counts only logged items', () => {
    const ex = marker({
      warmupItems: [
        { id: 'a', name: 'Arm Circles', reps: 10, done: true },
        { id: 'b', name: 'Cat Stretch', durationSec: 30, done: false },
      ],
    });
    expect(warmupSummary(ex).count).toBe(1);
  });
});
