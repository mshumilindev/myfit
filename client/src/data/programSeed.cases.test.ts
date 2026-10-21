import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Exercise, SetEntry, Workout } from '../types';
import {
  buildProgramSeed,
  clearProgramSeed,
  peekProgramSeed,
  programSuggestionReadiness,
  setProgramSeed,
  takeProgramSeed,
  type ProgramSeed,
} from './programSeed';

// Local-time based weekday (the module uses getDay()). 2026-01-05 is a Monday.
const DAY = 24 * 3_600_000;
const MON = new Date(2026, 0, 5, 18, 0, 0).getTime();
const at = (dayOffset: number) => MON + dayOffset * DAY; // 0=Mon … 6=Sun

let seq = 0;
function set(reps: number, over: Partial<SetEntry> = {}): SetEntry {
  return { id: `s${++seq}`, reps, weight: 50, isWarmup: false, position: 0, ...over };
}
function ex(name: string, over: Partial<Exercise> = {}): Exercise {
  return {
    id: `e${++seq}`,
    name,
    kind: 'strength',
    position: 0,
    sets: [set(8), set(8)],
    ...over,
  };
}
function wo(startedAt: number, exercises: Exercise[], over: Partial<Workout> = {}): Workout {
  return {
    id: `w${++seq}`,
    startedAt,
    finishedAt: startedAt + 3_600_000,
    autoFinished: false,
    exercises,
    ...over,
  };
}

beforeEach(() => {
  seq = 0;
  vi.spyOn(crypto, 'randomUUID').mockImplementation(
    () => `uuid-${++seq}` as `${string}-${string}-${string}-${string}-${string}`,
  );
  takeProgramSeed();
});
afterEach(() => {
  vi.restoreAllMocks();
  takeProgramSeed();
});

const SEED: ProgramSeed = {
  name: 'S',
  weeks: 8,
  daysPerWeek: 3,
  dayNames: {},
  targetMuscles: {},
  items: [],
};

describe('seed hand-off', () => {
  it('peek reads without clearing, take returns once then null', () => {
    expect(peekProgramSeed()).toBeNull();
    setProgramSeed(SEED);
    expect(peekProgramSeed()).toBe(SEED);
    expect(peekProgramSeed()).toBe(SEED);
    expect(takeProgramSeed()).toBe(SEED);
    expect(takeProgramSeed()).toBeNull();
  });

  it('a later seed replaces an earlier one', () => {
    const other = { ...SEED, name: 'Other' };
    setProgramSeed(SEED);
    setProgramSeed(other);
    expect(takeProgramSeed()).toBe(other);
  });

  it('clear removes only the seed it was given', () => {
    setProgramSeed(SEED);
    clearProgramSeed({ ...SEED }); // different object
    expect(peekProgramSeed()).toBe(SEED);
    clearProgramSeed(null);
    expect(peekProgramSeed()).toBe(SEED);
    clearProgramSeed(SEED);
    expect(peekProgramSeed()).toBeNull();
  });
});

describe('programSuggestionReadiness', () => {
  const lift = () => [ex('Barbell Full Squat')];

  it('is not ready with no history', () => {
    expect(programSuggestionReadiness([])).toEqual({
      ready: false,
      finishedCount: 0,
      trainedDays: 0,
      liftSessions: 0,
    });
  });

  it('needs three lift sessions on at least two weekdays', () => {
    const two = [wo(at(0), lift()), wo(at(2), lift())];
    expect(programSuggestionReadiness(two).ready).toBe(false);
    const sameDay = [wo(at(0), lift()), wo(at(7), lift()), wo(at(14), lift())];
    expect(programSuggestionReadiness(sameDay)).toMatchObject({
      ready: false,
      liftSessions: 3,
      trainedDays: 1,
    });
    const ok = [wo(at(0), lift()), wo(at(2), lift()), wo(at(7), lift())];
    expect(programSuggestionReadiness(ok)).toMatchObject({
      ready: true,
      liftSessions: 3,
      trainedDays: 2,
    });
  });

  it('ignores unfinished workouts', () => {
    const list = [wo(at(0), lift()), wo(at(1), lift()), wo(at(2), lift(), { finishedAt: null })];
    const r = programSuggestionReadiness(list);
    expect(r.finishedCount).toBe(2);
    expect(r.ready).toBe(false);
  });

  it('does not count cardio-only sessions or empty/unnamed lifts as lift sessions', () => {
    const list = [
      wo(at(0), [ex('Run', { kind: 'cardio', sets: [set(1)] })]),
      wo(at(1), [ex('   ', { sets: [set(5)] })]),
      wo(at(2), [ex('Curl', { sets: [] })]),
      wo(at(3), lift()),
    ];
    const r = programSuggestionReadiness(list);
    expect(r.finishedCount).toBe(4);
    expect(r.liftSessions).toBe(1);
  });

  it('counts a planned-but-unlogged lift and warm-up/cool-down kinds', () => {
    const list = [
      wo(at(0), [ex('Squat', { sets: [], plannedSets: 3 })]),
      wo(at(1), [ex('Warm', { kind: 'warmup' })]),
      wo(at(2), [ex('Cool', { kind: 'cooldown' })]),
    ];
    expect(programSuggestionReadiness(list)).toMatchObject({ liftSessions: 3, ready: true });
  });

  it('counts a kind-less exercise as a lift', () => {
    const list = [wo(at(0), [ex('Squat', { kind: undefined })])];
    expect(programSuggestionReadiness(list).liftSessions).toBe(1);
  });

  it('looks only at the 14 most recent finished sessions', () => {
    const old = Array.from({ length: 5 }, (_, i) => wo(at(-100 - i), lift()));
    const recent = Array.from({ length: 14 }, (_, i) => wo(at(i), [ex('Run', { kind: 'cardio' })]));
    const r = programSuggestionReadiness([...old, ...recent]);
    expect(r.finishedCount).toBe(14);
    expect(r.liftSessions).toBe(0);
    expect(r.ready).toBe(false);
  });

  it('does not mutate the caller array order', () => {
    const list = [wo(at(0), lift()), wo(at(5), lift())];
    const ids = list.map((w) => w.id);
    programSuggestionReadiness(list);
    expect(list.map((w) => w.id)).toEqual(ids);
  });

  it('maps Sunday to day 7 (distinct from Monday)', () => {
    const list = [wo(at(0), lift()), wo(at(6), lift()), wo(at(7), lift())];
    expect(programSuggestionReadiness(list).trainedDays).toBe(2);
  });
});

describe('buildProgramSeed', () => {
  it('returns an 8-week one-day shell for no history', () => {
    expect(buildProgramSeed([], true, 'Mine')).toEqual({
      name: 'Mine',
      weeks: 8,
      daysPerWeek: 1,
      dayNames: {},
      targetMuscles: {},
      items: [],
    });
  });

  it('derives training days from recent weekdays (Mon=1 … Sun=7) and clamps daysPerWeek', () => {
    const list = Array.from({ length: 7 }, (_, i) => wo(at(i), [ex('Squat')]));
    expect(buildProgramSeed(list, false, 'x').daysPerWeek).toBe(7);
    const three = [wo(at(0), []), wo(at(2), []), wo(at(6), [])];
    expect(buildProgramSeed(three, false, 'x').daysPerWeek).toBe(3);
  });

  it('keeps the newest day name per weekday', () => {
    const list = [
      wo(at(0), [], { dayName: 'Old Monday' }),
      wo(at(7), [], { dayName: 'New Monday' }),
      wo(at(2), [], { dayName: '' }),
      wo(at(3), [], { dayName: 'Thursday push' }),
    ];
    expect(buildProgramSeed(list, false, 'x').dayNames).toEqual({
      '1': 'New Monday',
      '4': 'Thursday push',
    });
  });

  it('adds no items unless withLifts, but still infers target muscles', () => {
    const list = [wo(at(0), [ex('Squat', { primaryMuscle: 'quads' })])];
    const seed = buildProgramSeed(list, false, 'x');
    expect(seed.items).toEqual([]);
    expect(seed.targetMuscles).toEqual({ '1': ['quads'] });
  });

  it('ranks target muscles by sets, caps at four, skips cardio and uses the catalog for unknown tags', () => {
    const w = wo(at(0), [
      ex('A', { position: 0, primaryMuscle: 'biceps', sets: [set(8)] }),
      ex('B', { position: 1, primaryMuscle: 'chest', sets: [set(8), set(8), set(8)] }),
      ex('C', { position: 2, primaryMuscle: 'cardio', sets: [set(8), set(8), set(8), set(8)] }),
      ex('D', { position: 3, primaryMuscle: 'lats', sets: [set(8), set(8)] }),
      ex('E', { position: 4, primaryMuscle: 'calves', sets: [] }),
      ex('F', { position: 5, primaryMuscle: 'core', sets: [set(8)] }),
      ex('G', { position: 6, primaryMuscle: 'glutes', sets: [set(8)] }),
    ]);
    // sets (min 1 each): chest 3, lats 2, biceps 1, calves 1, core 1, glutes 1 -> top four, ties keep position order
    expect(buildProgramSeed([w], false, 'x').targetMuscles['1']).toEqual([
      'chest',
      'lats',
      'biceps',
      'calves',
    ]);
  });

  it('falls back to the catalog primary muscle when the exercise carries none', () => {
    const w = wo(at(1), [ex('Barbell Deadlift', { primaryMuscle: undefined })]);
    const seed = buildProgramSeed([w], false, 'x');
    expect(seed.targetMuscles['2']).toHaveLength(1);
    expect(seed.targetMuscles['2'][0]).not.toBe('cardio');
  });

  it('omits a day with no usable muscles', () => {
    const w = wo(at(0), [ex('Mystery move zzz', { primaryMuscle: null })]);
    expect(buildProgramSeed([w], false, 'x').targetMuscles).toEqual({});
  });

  it('prefills lifts from the most recent session per weekday, in order, without load', () => {
    const older = wo(at(0), [ex('Old Lift')]);
    const newer = wo(at(7), [
      ex('Squat', { sets: [set(5, { weight: 100 }), set(5, { weight: 100 })] }),
      ex('Run', { kind: 'cardio', sets: [set(1)] }),
      ex('Warm-up', { kind: 'warmup', sets: [set(10)] }),
    ]);
    const seed = buildProgramSeed([older, newer], true, 'x');
    expect(seed.items.map((i) => [i.day, i.position, i.name, i.kind])).toEqual([
      [1, 0, 'Squat', 'strength'],
      [1, 1, 'Warm-up', 'warmup'],
    ]);
    expect(JSON.stringify(seed.items)).not.toContain('100');
    expect(seed.items[0]).toMatchObject({ id: expect.stringMatching(/^uuid-/), durationMin: null });
  });

  it('counts working sets, ignoring warm-up sets, and falls back through the chain', () => {
    const seed = buildProgramSeed(
      [
        wo(at(0), [
          ex('Working', { sets: [set(10, { isWarmup: true }), set(6), set(6), set(6)] }),
          ex('OnlyWarm', { sets: [set(10, { isWarmup: true }), set(10, { isWarmup: true })] }),
          ex('Planned', { sets: [], plannedSets: 5, plannedReps: 12 }),
          ex('Nothing', { sets: [] }),
        ]),
      ],
      true,
      'x',
    );
    expect(seed.items.map((i) => [i.name, i.sets, i.reps])).toEqual([
      ['Working', 3, 6],
      ['OnlyWarm', 2, 10],
      ['Planned', 5, 12],
      ['Nothing', 3, 10],
    ]);
  });

  it('picks reps: planned first, else first working set with reps, else first set, else 10; minimum 1', () => {
    const seed = buildProgramSeed(
      [
        wo(at(0), [
          ex('P', { plannedReps: 15, sets: [set(5)] }),
          ex('W', { sets: [set(0), set(7)] }),
          ex('Zero', { sets: [set(0), set(0)] }),
          ex('WarmFirst', { sets: [set(9, { isWarmup: true }), set(0)] }),
        ]),
      ],
      true,
      'x',
    );
    expect(seed.items.map((i) => i.reps)).toEqual([15, 7, 1, 9]);
  });

  it('copies equipment instead of sharing the array', () => {
    const e = ex('Squat', { equipment: ['barbell'] });
    const seed = buildProgramSeed([wo(at(0), [e])], true, 'x');
    expect(seed.items[0].equipment).toEqual(['barbell']);
    seed.items[0].equipment.push('x');
    expect(e.equipment).toEqual(['barbell']);
    const none = buildProgramSeed([wo(at(0), [ex('Plain')])], true, 'x');
    expect(none.items[0].equipment).toEqual([]);
  });

  it('defaults a kind-less exercise to strength', () => {
    const seed = buildProgramSeed([wo(at(0), [ex('Squat', { kind: undefined })])], true, 'x');
    expect(seed.items[0].kind).toBe('strength');
  });

  it('only uses the 14 newest sessions', () => {
    const list = Array.from({ length: 15 }, (_, i) => wo(at(-i * 7), [ex(`Lift ${i}`)]));
    // all fall on Monday; the oldest (index 14) must not matter, newest wins the day
    const seed = buildProgramSeed(list, true, 'x');
    expect(seed.items.map((i) => i.name)).toEqual(['Lift 0']);
    const dropped = Array.from({ length: 15 }, (_, i) =>
      wo(at(i < 14 ? i % 2 : 2 - 100), [ex(`L${i}`)], { dayName: i === 14 ? 'Ancient' : null }),
    );
    expect(Object.values(buildProgramSeed(dropped, false, 'x').dayNames)).not.toContain('Ancient');
  });
});
