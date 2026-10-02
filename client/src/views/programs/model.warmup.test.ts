import { beforeEach, describe, expect, it } from 'vitest';
import {
  addWarmupExercise,
  normalizeProgram,
  patchWarmupExercise,
  removeWarmupExercise,
  sanitizeWarmupItems,
  toSaved,
  type Program,
  type ProgramItem,
} from './model';
import { startProgramDaySession } from '../../data/programMine';
import { __getStateForTests, __replaceStateForTests } from '../../store';
import { warmupItemsOf } from '../../warmupLog';

const marker = (over: Partial<ProgramItem> = {}): ProgramItem => ({
  id: 'wu',
  day: 1,
  position: 0,
  name: 'Warm-up',
  kind: 'warmup',
  sets: 1,
  reps: 0,
  durationMin: 10,
  equipment: [],
  ...over,
});
const prog = (items: ProgramItem[]): Program => ({
  id: 'p',
  name: 'P',
  weeks: 4,
  daysPerWeek: 1,
  status: 'active',
  authorId: 'u',
  dayNames: { '1': 'Upper' },
  targetMuscles: {},
  items,
});

beforeEach(() => __replaceStateForTests({ ...__getStateForTests(), workouts: [] }));

describe('program warm-up exercises', () => {
  it('keeps references only: catalog name + id + one target, no free text', () => {
    expect(
      sanitizeWarmupItems([
        null,
        { name: ' ' },
        {
          id: 'a',
          name: 'Band Pull Apart',
          exerciseId: 'Band_Pull_Apart',
          reps: 15.4,
          durationSec: 20,
          note: 'secret',
        },
        { name: 'Cat Stretch', durationSec: -1 },
      ]),
    ).toEqual([
      { id: 'a', name: 'Band Pull Apart', exerciseId: 'Band_Pull_Apart', durationSec: 20 },
      { id: expect.any(String), name: 'Cat Stretch' },
    ]);
    expect(sanitizeWarmupItems(undefined)).toEqual([]);
  });

  it('add / patch / remove only act on a warm-up marker and drop the field when empty', () => {
    let p = prog([marker(), { ...marker({ id: 'cd', kind: 'cooldown', position: 1 }) }]);
    p = addWarmupExercise(p, 'cd', { name: 'Cat Stretch' });
    expect(p.items[1].warmupItems).toBeUndefined();
    p = addWarmupExercise(p, 'wu', {
      name: 'Band Pull Apart',
      exerciseId: 'Band_Pull_Apart',
      reps: 15,
    });
    const id = p.items[0].warmupItems![0].id;
    p = patchWarmupExercise(p, 'wu', id, { durationSec: 40 });
    expect(p.items[0].warmupItems![0]).toMatchObject({ durationSec: 40 });
    expect(p.items[0].warmupItems![0].reps).toBeUndefined();
    p = removeWarmupExercise(p, 'wu', id);
    expect('warmupItems' in p.items[0]).toBe(false);
  });

  it('a target weight is optional, kept with reps, dropped with seconds, and copied on start', () => {
    expect(
      sanitizeWarmupItems([
        { id: 'a', name: 'Dumbbell Bicep Curl', reps: 10, weight: 7.5 },
        { id: 'b', name: 'Cat Stretch', durationSec: 30, weight: 5 },
        { id: 'c', name: 'Arm Circles', reps: 10, weight: -1 },
      ]),
    ).toEqual([
      { id: 'a', name: 'Dumbbell Bicep Curl', reps: 10, weight: 7.5 },
      { id: 'b', name: 'Cat Stretch', durationSec: 30 },
      { id: 'c', name: 'Arm Circles', reps: 10 },
    ]);
    let p = addWarmupExercise(prog([marker()]), 'wu', {
      name: 'Dumbbell Bicep Curl',
      reps: 10,
      weight: 7.5,
    });
    const wid = p.items[0].warmupItems![0].id;
    p = patchWarmupExercise(p, 'wu', wid, { reps: 12, weight: 10 });
    expect(p.items[0].warmupItems![0]).toMatchObject({ reps: 12, weight: 10 });
    p = patchWarmupExercise(p, 'wu', wid, { weight: 0 });
    expect(p.items[0].warmupItems![0].weight).toBeUndefined();
    p = patchWarmupExercise(p, 'wu', wid, { weight: 7.5 });
    const id = startProgramDaySession(
      {
        program: p,
        assignedBy: null,
        week: 1,
        done: 0,
        total: 1,
        expectedSoFar: 0,
        adherence: null,
      } as never,
      1,
      'Upper',
    )!;
    const m = __getStateForTests()
      .workouts.find((x) => x.id === id)!
      .exercises.find((e) => e.kind === 'warmup')!;
    expect(warmupItemsOf(m)[0]).toMatchObject({ weight: 7.5, reps: 12, done: false });
  });

  it('old programs (no field) normalise and save unchanged; saved docs carry the references', () => {
    const old = prog([marker(), marker({ id: 'x', kind: 'cooldown', position: 1 })]);
    const n = normalizeProgram(old);
    expect(n.items.every((i) => !('warmupItems' in i))).toBe(true);
    expect(toSaved(n, 'u', 'P').items.every((i) => !('warmupItems' in i))).toBe(true);
    const withEx = addWarmupExercise(n, 'wu', {
      name: 'Cat Stretch',
      exerciseId: 'Cat_Stretch',
      durationSec: 30,
    });
    const saved = toSaved(withEx, 'u', 'P');
    expect(saved.items[0].warmupItems).toEqual([
      { id: expect.any(String), name: 'Cat Stretch', exerciseId: 'Cat_Stretch', durationSec: 30 },
    ]);
    // never on a lift or a cool-down, even if junk slipped in
    const junk = toSaved(
      prog([marker({ id: 'cd', kind: 'cooldown', warmupItems: [{ id: 'z', name: 'Nope' }] })]),
      'u',
      'P',
    );
    expect(junk.items[0].warmupItems).toBeUndefined();
  });

  it('starting the day copies the exercises onto the session warm-up (fresh ids, not done)', () => {
    const withEx = addWarmupExercise(prog([marker()]), 'wu', {
      name: 'Band Pull Apart',
      exerciseId: 'Band_Pull_Apart',
      reps: 15,
    });
    const id = startProgramDaySession(
      {
        program: withEx,
        assignedBy: null,
        week: 1,
        done: 0,
        total: 1,
        expectedSoFar: 0,
        adherence: null,
      } as never,
      1,
      'Upper',
    )!;
    const w = __getStateForTests().workouts.find((x) => x.id === id)!;
    const m = w.exercises.find((e) => e.kind === 'warmup')!;
    expect(m.sets).toEqual([]);
    expect(m.plannedDurationMin).toBeNull();
    const items = warmupItemsOf(m);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      name: 'Band Pull Apart',
      exerciseId: 'Band_Pull_Apart',
      reps: 15,
      done: false,
    });
    expect(items[0].id).not.toBe(withEx.items[0].warmupItems![0].id);
  });

  it('an old program day still starts: a generic warm-up with its minutes', () => {
    const id = startProgramDaySession(
      {
        program: prog([marker()]),
        assignedBy: null,
        week: 1,
        done: 0,
        total: 1,
        expectedSoFar: 0,
        adherence: null,
      } as never,
      1,
      'Upper',
    )!;
    const m = __getStateForTests().workouts.find((x) => x.id === id)!.exercises[0];
    expect(m.plannedDurationMin).toBe(10);
    expect(m.warmupItems).toBeUndefined();
  });
});
