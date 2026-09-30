import { describe, expect, it } from 'vitest';
import { findLastWarmup, isDetailedWarmup, warmupItemsOf, warmupSummary } from './warmupLog';
import {
  __getStateForTests,
  addExercise,
  addWarmupItem,
  duplicateExercise,
  finishWorkoutClean,
  moveWarmupItem,
  removeWarmupItem,
  setWarmupDetailed,
  setWarmupItems,
  setWarmupMinutes,
  startWorkout,
  toggleWarmupItem,
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
  it('a marker without the new fields is a single warm-up', () => {
    const ex = marker({ plannedDurationMin: 5 });
    expect(isMarkerExercise(ex)).toBe(true);
    expect(isDetailedWarmup(ex)).toBe(false);
    expect(warmupItemsOf(ex)).toEqual([]);
    expect(warmupSummary(ex)).toEqual({ detailed: false, count: 0, total: 0, minutes: 5 });
    expect(warmupSummary(marker()).minutes).toBeNull();
  });
  it('ignores malformed items in storage', () => {
    const ex = marker({
      warmupDetailed: true,
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

describe('warm-up store actions', () => {
  it('toggles into detailed mode, edits items and keeps the marker minutes in step', () => {
    const w = startWorkout(null)!;
    const ex = addExercise(w.id, 'Warm-up', 'warmup');
    setWarmupMinutes(w.id, ex.id, 7);
    expect(find(w.id, ex.id).plannedDurationMin).toBe(7);

    setWarmupDetailed(w.id, ex.id, true);
    expect(isDetailedWarmup(find(w.id, ex.id))).toBe(true);
    const a = addWarmupItem(w.id, ex.id, { name: 'Arm Circles', reps: 10 })!;
    const b = addWarmupItem(w.id, ex.id, { name: 'Cat Stretch', durationSec: 90 })!;
    expect(addWarmupItem(w.id, ex.id, { name: '  ' })).toBeNull();
    expect(warmupItemsOf(find(w.id, ex.id)).map((i) => i.name)).toEqual([
      'Arm Circles',
      'Cat Stretch',
    ]);
    // nothing done yet → no minutes from items
    expect(find(w.id, ex.id).plannedDurationMin).toBeNull();

    toggleWarmupItem(w.id, ex.id, b.id);
    let cur = find(w.id, ex.id);
    expect(warmupItemsOf(cur).find((i) => i.id === b.id)).toMatchObject({ done: true });
    expect(warmupItemsOf(cur).find((i) => i.id === b.id)?.at).toBeTypeOf('number');
    expect(cur.plannedDurationMin).toBe(2); // 90 s → 2 min (rounded)
    updateWarmupItem(w.id, ex.id, a.id, { done: true, durationSec: 30 });
    expect(find(w.id, ex.id).plannedDurationMin).toBe(2); // 120 s
    toggleWarmupItem(w.id, ex.id, b.id, false);
    cur = find(w.id, ex.id);
    expect(warmupItemsOf(cur).find((i) => i.id === b.id)?.at).toBeUndefined();
    expect(cur.plannedDurationMin).toBe(1); // 30 s → min 1

    moveWarmupItem(w.id, ex.id, b.id, -1);
    expect(warmupItemsOf(find(w.id, ex.id)).map((i) => i.id)).toEqual([b.id, a.id]);
    moveWarmupItem(w.id, ex.id, b.id, -1); // already first: no-op
    expect(warmupItemsOf(find(w.id, ex.id)).map((i) => i.id)).toEqual([b.id, a.id]);
    removeWarmupItem(w.id, ex.id, a.id);
    expect(warmupItemsOf(find(w.id, ex.id))).toHaveLength(1);

    // back to "one warm-up": items are kept, the mode is single again
    setWarmupDetailed(w.id, ex.id, false);
    cur = find(w.id, ex.id);
    expect(isDetailedWarmup(cur)).toBe(false);
    expect(warmupItemsOf(cur)).toHaveLength(1);
    expect(warmupSummary(cur).detailed).toBe(false);
    expect(cur.sets).toEqual([]);
  });

  it('only acts on warm-up markers', () => {
    const w = startWorkout(null)!;
    const lift = addExercise(w.id, 'Barbell Squat');
    const cd = addExercise(w.id, 'Cool-down', 'cooldown');
    expect(addWarmupItem(w.id, lift.id, { name: 'Cat Stretch' })).toBeNull();
    expect(addWarmupItem(w.id, cd.id, { name: 'Cat Stretch' })).toBeNull();
    setWarmupDetailed(w.id, lift.id, true);
    expect(find(w.id, lift.id).warmupDetailed).toBeUndefined();
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
  it('a detailed warm-up adds no sets and no volume; ramp sets still count as warm-up', () => {
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
    warmupDetailed: true,
    warmupItems: [{ id: 'a', name: 'Cat Stretch', done: true, durationSec: 60 }],
  });
  const single = marker({ plannedDurationMin: 5 });

  it('prefers the same day name, then weekday, then the latest', () => {
    const list = [
      wk('push', day(1), detailed, 'Push'),
      wk('pull', day(8), single, 'Pull'),
      wk('x', day(22), single, 'Legs'),
    ];
    expect(findLastWarmup(list, { dayName: 'push' })?.detailed).toBe(true);
    expect(findLastWarmup(list, { dayName: 'Nope', weekday: 1 })?.startedAt).toBe(day(22)); // Tue 22nd
    expect(findLastWarmup(list, {})?.startedAt).toBe(day(22));
  });
  it('skips unfinished sessions, the excluded one and empty warm-ups', () => {
    const live = { ...wk('live', day(29), single), finishedAt: null };
    const empty = wk('e', day(28), marker());
    const emptyDetailed = wk('d', day(27), marker({ warmupDetailed: true, warmupItems: [] }));
    expect(findLastWarmup([live, empty, emptyDetailed], {})).toBeNull();
    const one = wk('one', day(3), single);
    expect(findLastWarmup([one], { excludeId: 'one' })).toBeNull();
    expect(findLastWarmup([one], {})).toMatchObject({ detailed: false, minutes: 5, items: [] });
  });
});
