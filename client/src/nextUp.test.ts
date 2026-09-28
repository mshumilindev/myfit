import { describe, expect, it } from 'vitest';
import {
  hasActivityAfter,
  nextUpLookbackCount,
  nextUpStrip,
  nextUpSuggestions,
  workoutDayType,
  type NextUpInput,
} from './nextUp';
import type { Activity, Exercise, Workout } from './types';

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
/** Sat 28 Sep 2026 17:00 UTC — the current session starts here. */
const T = Date.UTC(2026, 8, 28, 17, 0);

const ex = (primaryMuscle: string, sets = 3): Exercise => ({
  id: `e-${primaryMuscle}`,
  name: `Custom ${primaryMuscle}`,
  position: 0,
  primaryMuscle,
  sets: Array.from({ length: sets }, (_, i) => ({
    id: `s${i}`,
    reps: 8,
    weight: 60,
    isWarmup: false,
    position: i,
  })),
});

/** History workout i (1 = most recent): started i·3 days before T, 60 min long. */
const past = (i: number, muscle = 'chest', over: Partial<Workout> = {}): Workout => ({
  id: `w${i}`,
  startedAt: T - i * 3 * DAY,
  finishedAt: T - i * 3 * DAY + 60 * MIN,
  autoFinished: false,
  exercises: [ex(muscle)],
  ...over,
});
const endOf = (w: Workout) => w.finishedAt as number;

const current = (muscle = 'chest'): Workout => ({
  id: 'now',
  startedAt: T,
  finishedAt: T + 72 * MIN,
  autoFinished: false,
  exercises: [ex(muscle)],
});

let seq = 0;
/** An activity of `type` starting `after` min after workout `w` finished. */
const after = (w: Workout, type: string, minutes: number, afterMin = 10): Activity => {
  const startedAt = endOf(w) + afterMin * MIN;
  return {
    id: `a${++seq}`,
    type,
    category: ['sauna', 'mobility', 'cold', 'yoga', 'massage'].includes(type)
      ? 'recovery'
      : 'conditioning',
    startedAt,
    finishedAt: startedAt + minutes * MIN,
    durationMin: minutes,
  };
};

const history = (n: number, muscle = 'chest') =>
  Array.from({ length: n }, (_, k) => past(k + 1, muscle));

const run = (over: Partial<NextUpInput> & Pick<NextUpInput, 'workouts' | 'activities'>) =>
  nextUpSuggestions({ finishedWorkoutId: 'now', now: T + 75 * MIN, ...over });

describe('nextUpSuggestions — the sauna habit (p01)', () => {
  const ws = history(8);
  // Sauna after 6 of 8 (w1..w6), durations 18,20,22,20,19,25 → median 20.
  const sauna = [18, 20, 22, 20, 19, 25].map((m, k) => after(ws[k], 'sauna', m));

  it('suggests sauna · 20 min after 6 of the last 8 sessions', () => {
    const r = run({ workouts: [...ws, current()], activities: sauna });
    expect(r.top).toEqual({
      type: 'sauna',
      minutes: 20,
      count: 6,
      of: 8,
      reason: 'after_workouts',
    });
    expect(r.alternatives).toEqual([]);
  });

  it('is independent of input order', () => {
    const r1 = run({ workouts: [...ws, current()], activities: sauna });
    const r2 = run({
      workouts: [current(), ...ws].reverse(),
      activities: [...sauna].reverse(),
    });
    expect(r2).toEqual(r1);
  });

  it('works while the workout is still open (reference = now)', () => {
    const open = { ...current(), finishedAt: null };
    const r = run({ workouts: [...ws, open], activities: sauna });
    expect(r.top?.type).toBe('sauna');
  });
});

describe('follow window & counting', () => {
  it('counts 0–120 min after finish; not before, not at 121', () => {
    const ws = history(7);
    const acts = [
      after(ws[0], 'sauna', 20, 0), // at finish → counts
      after(ws[1], 'sauna', 20, 120), // exactly 120 → counts
      after(ws[2], 'sauna', 20, 60),
      after(ws[3], 'sauna', 20, 121), // too late
      after(ws[4], 'sauna', 20, -1), // started before finish
    ];
    const r = run({ workouts: [...ws, current()], activities: acts });
    expect(r.top).toMatchObject({ type: 'sauna', count: 3, of: 7 });
  });

  it('counts a type once per workout (two sauna rounds = 1)', () => {
    const ws = history(8);
    const acts = [
      after(ws[0], 'sauna', 10, 5),
      after(ws[0], 'sauna', 10, 30),
      after(ws[1], 'sauna', 10),
      after(ws[2], 'sauna', 10),
    ];
    // 3 of 8 = 37.5 % < 40 % → nothing, even though 4 sauna entries exist.
    expect(run({ workouts: [...ws, current()], activities: acts }).top).toBeNull();
  });

  it('ignores live (unfinished) activities as history', () => {
    const ws = history(4);
    const acts = ws.slice(0, 3).map((w) => after(w, 'walk', 20));
    acts[2] = { ...acts[2], finishedAt: null, runningSince: acts[2].startedAt };
    expect(run({ workouts: [...ws, current()], activities: acts }).top).toBeNull();
  });
});

describe('thresholds', () => {
  it('3 of 8 (37.5 %) does not qualify; 4 of 8 does', () => {
    const ws = history(8);
    const three = ws.slice(0, 3).map((w) => after(w, 'walk', 20));
    expect(run({ workouts: [...ws, current()], activities: three }).top).toBeNull();
    const four = ws.slice(0, 4).map((w) => after(w, 'walk', 20));
    expect(run({ workouts: [...ws, current()], activities: four }).top).toMatchObject({
      type: 'walk',
      count: 4,
      of: 8,
    });
  });

  it('3 of 7 (42.9 %) qualifies', () => {
    const ws = history(7);
    const acts = ws.slice(4).map((w) => after(w, 'walk', 20));
    expect(run({ workouts: [...ws, current()], activities: acts }).top).toMatchObject({
      type: 'walk',
      count: 3,
      of: 7,
    });
  });

  it('too few workouts (3) → no suggestion even at 3 of 3', () => {
    const ws = history(3);
    const acts = ws.map((w) => after(w, 'sauna', 20));
    expect(run({ workouts: [...ws, current()], activities: acts })).toEqual({
      top: null,
      alternatives: [],
    });
  });

  it('no history at all / unknown workout id → null', () => {
    expect(run({ workouts: [current()], activities: [] }).top).toBeNull();
    const ws = history(8);
    const acts = ws.map((w) => after(w, 'sauna', 20));
    expect(
      run({ workouts: [...ws, current()], activities: acts, finishedWorkoutId: 'nope' }).top,
    ).toBeNull();
  });
});

describe('lookback window', () => {
  it('reads only the last 8 sessions', () => {
    const ws = history(12);
    // Sauna after w5..w12: only w5..w8 are inside the last 8 → 4 of 8.
    const acts = ws.slice(4).map((w) => after(w, 'sauna', 20));
    expect(run({ workouts: [...ws, current()], activities: acts }).top).toMatchObject({
      count: 4,
      of: 8,
    });
  });

  it('drops workouts older than 10 weeks', () => {
    // w1..w4 recent; w30..w33 are 90–99 days back.
    const ws = [...history(4), past(30), past(31), past(32), past(33)];
    const acts = ws.slice(4).map((w) => after(w, 'sauna', 20));
    // Only 4 recent workouts count, none with sauna.
    expect(run({ workouts: [...ws, current()], activities: acts }).top).toBeNull();
  });

  it('skips auto-finished sessions (synthetic finish time)', () => {
    const ws = history(8).map((w, k) => (k >= 4 ? { ...w, autoFinished: true } : w));
    const acts = ws.map((w) => after(w, 'walk', 20));
    // 4 genuine sessions, walk after all 4.
    expect(run({ workouts: [...ws, current()], activities: acts }).top).toMatchObject({
      type: 'walk',
      count: 4,
      of: 4,
    });
  });

  it('ignores workouts after this one started', () => {
    const ws = history(4);
    const later: Workout = { ...past(1), id: 'later', startedAt: T + DAY, finishedAt: T + DAY + 1 };
    const acts = ws.map((w) => after(w, 'walk', 20));
    expect(run({ workouts: [...ws, later, current()], activities: acts }).top).toMatchObject({
      of: 4,
    });
  });
});

describe('minutes', () => {
  it('uses the median, rounded to 5 (even count averages the middle pair)', () => {
    const ws = history(4);
    // 10, 14, 16, 40 → median 15 → 15.
    const acts = [10, 14, 16, 40].map((m, k) => after(ws[k], 'mobility', m));
    expect(run({ workouts: [...ws, current()], activities: acts }).top?.minutes).toBe(15);
  });

  it('rounds 12 → 10, 13 → 15 and never below 5', () => {
    const ws = history(4);
    const mk = (m: number) => ws.slice(0, 3).map((w) => after(w, 'walk', m));
    const at = (m: number) => run({ workouts: [...ws, current()], activities: mk(m) }).top?.minutes;
    expect(at(12)).toBe(10);
    expect(at(13)).toBe(15);
    expect(at(2)).toBe(5);
  });
});

describe('ranking & ties', () => {
  it('higher ratio wins, then higher count', () => {
    const ws = history(8);
    const acts = [
      ...ws.slice(0, 4).map((w) => after(w, 'walk', 20)), // 4/8
      ...ws.slice(0, 5).map((w) => after(w, 'sauna', 20, 30)), // 5/8
    ];
    const r = run({ workouts: [...ws, current()], activities: acts });
    expect(r.top?.type).toBe('sauna');
    expect(r.alternatives.map((a) => a.type)).toEqual(['walk']);
  });

  it('equal ratio and count → the more recent habit wins', () => {
    const ws = history(8);
    const acts = [
      ...[0, 2, 4, 6].map((k) => after(ws[k], 'walk', 20)), // latest: w1
      ...[1, 3, 5, 7].map((k) => after(ws[k], 'sauna', 20)), // latest: w2
    ];
    const r = run({ workouts: [...ws, current()], activities: acts });
    expect(r.top?.type).toBe('walk');
    expect(r.alternatives[0].type).toBe('sauna');
  });

  it('full tie (same workouts) → alphabetical by type key', () => {
    const ws = history(8);
    const acts = ws.slice(0, 4).flatMap((w) => [after(w, 'walk', 20), after(w, 'cold', 5, 40)]);
    const r = run({ workouts: [...ws, current()], activities: acts });
    expect(r.top?.type).toBe('cold');
    expect(r.alternatives.map((a) => a.type)).toEqual(['walk']);
  });
});

describe('exclusions', () => {
  const ws = history(8);
  const acts = [
    ...ws.slice(0, 6).map((w) => after(w, 'sauna', 20)),
    ...ws.slice(0, 4).map((w) => after(w, 'walk', 20, 30)),
  ];

  it('drops types the athlete turned off', () => {
    const r = run({ workouts: [...ws, current()], activities: acts, off: ['sauna'] });
    expect(r.top).toMatchObject({ type: 'walk', count: 4, of: 8 });
    expect(r.alternatives).toEqual([]);
  });

  it('drops a type already logged after THIS workout', () => {
    const cur = current();
    const done = after(cur, 'sauna', 15, 2);
    const r = run({ workouts: [...ws, cur], activities: [...acts, done] });
    expect(r.top?.type).toBe('walk');
    expect(hasActivityAfter([...ws, cur], [...acts, done], 'now')).toBe(true);
  });

  it('a live one already running after this workout also excludes it', () => {
    const cur = current();
    const live = { ...after(cur, 'sauna', 0, 1), finishedAt: null, runningSince: T };
    const r = run({ workouts: [...ws, cur], activities: [...acts, live] });
    expect(r.top?.type).toBe('walk');
  });

  it('everything off → null', () => {
    const r = run({ workouts: [...ws, current()], activities: acts, off: ['sauna', 'walk'] });
    expect(r).toEqual({ top: null, alternatives: [] });
  });
});

describe('alternatives', () => {
  it('fills with qualifying types, then recovery types seen ≥ 2 times, max 2', () => {
    const ws = history(8);
    const acts = [
      ...ws.slice(0, 6).map((w) => after(w, 'sauna', 20)), // top 6/8
      ...ws.slice(0, 2).map((w) => after(w, 'mobility', 10, 45)), // recovery 2/8
      ...ws.slice(2, 4).map((w) => after(w, 'cold', 5, 45)), // recovery 2/8, older
      ...ws.slice(0, 2).map((w) => after(w, 'walk', 20, 60)), // conditioning 2/8 → no
    ];
    const r = run({ workouts: [...ws, current()], activities: acts });
    expect(r.top).toMatchObject({ type: 'sauna', minutes: 20, count: 6, of: 8 });
    // mobility and cold both 2/8; mobility followed w1 (more recent) → first.
    expect(r.alternatives).toEqual([
      { type: 'mobility', minutes: 10, count: 2, of: 8, reason: 'after_workouts' },
      { type: 'cold', minutes: 5, count: 2, of: 8, reason: 'after_workouts' },
    ]);
  });

  it('a recovery type seen once is not offered', () => {
    const ws = history(8);
    const acts = [
      ...ws.slice(0, 6).map((w) => after(w, 'sauna', 20)),
      after(ws[0], 'mobility', 10, 45),
    ];
    expect(run({ workouts: [...ws, current()], activities: acts }).alternatives).toEqual([]);
  });

  it('qualifying types come before recovery fillers', () => {
    const ws = history(8);
    const acts = [
      ...ws.slice(0, 6).map((w) => after(w, 'sauna', 20)),
      ...ws.slice(0, 4).map((w) => after(w, 'walk', 20, 40)), // qualifies 4/8
      ...ws.slice(0, 3).map((w) => after(w, 'run', 30, 50)), // 3/8, conditioning → no
      ...ws.slice(0, 3).map((w) => after(w, 'mobility', 10, 60)), // recovery 3/8
    ];
    const r = run({ workouts: [...ws, current()], activities: acts });
    expect(r.alternatives.map((a) => a.type)).toEqual(['walk', 'mobility']);
  });
});

describe('after_day_type', () => {
  // Alternating: odd = legs (quads), even = push (chest). Walk after 3 of 4 leg days.
  const ws = Array.from({ length: 8 }, (_, k) => past(k + 1, k % 2 === 0 ? 'quads' : 'chest'));
  const legs = ws.filter((_, k) => k % 2 === 0); // w1, w3, w5, w7
  const walks = legs.slice(0, 3).map((w) => after(w, 'walk', 20));

  it('detects the day type from primary muscles', () => {
    expect(workoutDayType(ws[0])).toBe('legs');
    expect(workoutDayType(ws[1])).toBe('push');
    expect(workoutDayType({ ...ws[0], exercises: [] })).toBeNull();
  });

  it('walk after 3 of 4 leg days → suggested on a leg day', () => {
    // Overall 3 of 8 (37.5 %) would not qualify.
    const r = run({ workouts: [...ws, current('quads')], activities: walks });
    expect(r.top).toEqual({
      type: 'walk',
      minutes: 20,
      count: 3,
      of: 4,
      reason: 'after_day_type',
      dayType: 'legs',
    });
  });

  it('not suggested on a push day', () => {
    expect(run({ workouts: [...ws, current('chest')], activities: walks }).top).toBeNull();
  });

  it('when both qualify, the higher ratio decides (day type 4/4 beats 4/8)', () => {
    const acts = legs.map((w) => after(w, 'walk', 20));
    const r = run({ workouts: [...ws, current('quads')], activities: acts });
    expect(r.top).toMatchObject({ type: 'walk', count: 4, of: 4, reason: 'after_day_type' });
  });

  it('equal ratios keep the broader after_workouts reason', () => {
    const acts = ws.map((w) => after(w, 'walk', 20)); // 8/8 and 4/4
    const r = run({ workouts: [...ws, current('quads')], activities: acts });
    expect(r.top).toMatchObject({ count: 8, of: 8, reason: 'after_workouts' });
    expect(r.top?.dayType).toBeUndefined();
  });

  it('a day-type pattern outranks a weaker general one (100 % vs 75 %)', () => {
    const acts = [
      ...ws.slice(0, 6).map((w) => after(w, 'sauna', 20, 30)), // 6/8
      ...legs.map((w) => after(w, 'walk', 20)), // 4/4 legs
    ];
    const r = run({ workouts: [...ws, current('quads')], activities: acts });
    expect(r.top?.type).toBe('walk');
    expect(r.alternatives[0]).toMatchObject({ type: 'sauna', count: 6, of: 8 });
  });

  it('accepts a custom day-type classifier', () => {
    const dayTypeOf = (w: Workout) => (w.id === 'now' || w.id === 'w2' ? 'x' : 'y');
    // Only w2 is the same type → fewer than 3 → no day-type branch.
    const r = run({ workouts: [...ws, current('quads')], activities: walks, dayTypeOf });
    expect(r.top).toBeNull();
  });
});

describe('hasActivityAfter', () => {
  const ws = history(2);
  it('true only for an activity starting 0–120 min after the finish', () => {
    expect(hasActivityAfter(ws, [after(ws[0], 'walk', 20, 30)], 'w1')).toBe(true);
    expect(hasActivityAfter(ws, [after(ws[0], 'walk', 20, 130)], 'w1')).toBe(false);
    expect(hasActivityAfter(ws, [after(ws[0], 'walk', 20, -5)], 'w1')).toBe(false);
    expect(hasActivityAfter(ws, [after(ws[0], 'walk', 20, 30)], 'w2')).toBe(false);
    expect(hasActivityAfter(ws, [], 'missing')).toBe(false);
  });
});

describe('performance', () => {
  it('handles 500 workouts + 1500 activities in ≤ 2 ms per call (averaged)', () => {
    const ws: Workout[] = [];
    const acts: Activity[] = [];
    for (let i = 1; i <= 500; i++) {
      const w = { ...past(i, i % 3 === 0 ? 'quads' : 'chest'), startedAt: T - (i * DAY) / 2 };
      w.finishedAt = w.startedAt + 60 * MIN;
      ws.push(w);
      acts.push(after(w, 'sauna', 20), after(w, 'walk', 15, 30), after(w, 'run', 30, 400));
    }
    const input = { workouts: [...ws, current('quads')], activities: acts };
    run(input); // warm-up
    const N = 50;
    const t0 = performance.now();
    for (let k = 0; k < N; k++) run(input);
    const per = (performance.now() - t0) / N;
    expect(per).toBeLessThan(2);
  });
});

describe('nextUpStrip / nextUpLookbackCount — the evidence under the card', () => {
  it('marks the sessions the type followed, oldest first, with the duration range', () => {
    const ws = history(8);
    const sauna = [18, 20, 22, 20, 19, 25].map((m, k) => after(ws[k], 'sauna', m));
    const input: NextUpInput = {
      workouts: [...ws, current()],
      activities: sauna,
      finishedWorkoutId: 'now',
      now: T + 75 * MIN,
    };
    const top = nextUpSuggestions(input).top!;
    // w8, w7 had none; w6…w1 had sauna.
    expect(nextUpStrip(input, top)).toEqual({
      hits: [false, false, true, true, true, true, true, true],
      minMin: 18,
      maxMin: 25,
    });
    expect(nextUpLookbackCount(input)).toBe(8);
  });

  it('reads the same-day-type sessions for a day-type reason', () => {
    const ws = [1, 2, 3, 4, 5, 6].map((i) => past(i, i % 2 === 0 ? 'quads' : 'chest'));
    const legs = ws.filter((w) => w.exercises[0].primaryMuscle === 'quads');
    const input: NextUpInput = {
      workouts: [...ws, current('quads')],
      activities: legs.map((w) => after(w, 'walk', 20)),
      finishedWorkoutId: 'now',
      now: T + 75 * MIN,
    };
    const top = nextUpSuggestions(input).top!;
    expect(top.reason).toBe('after_day_type');
    expect(nextUpStrip(input, top).hits).toEqual([true, true, true]);
    expect(nextUpLookbackCount(input)).toBe(6);
  });

  it('unknown workout → empty', () => {
    const input: NextUpInput = { workouts: [], activities: [], finishedWorkoutId: 'x', now: T };
    expect(nextUpLookbackCount(input)).toBe(0);
    expect(
      nextUpStrip(input, { type: 'sauna', minutes: 20, count: 3, of: 4, reason: 'after_workouts' }),
    ).toEqual({ hits: [], minMin: 0, maxMin: 0 });
  });
});
