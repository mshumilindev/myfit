import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { STREAK_MAX_GAP, computeStreak } from './streak';
import { __getStateForTests, __replaceStateForTests, consistencyStreak, dayKey } from './store';
import { setProgramMemory } from './data/programMemory';
import type { Activity, Injury, RestPeriod, Workout } from './types';

// Pure rule: days are plain integers, today = 100.
const run = (trained: number[], prot: number[] = [], floor = 0, today = 100) =>
  computeStreak({
    trained: new Set(trained),
    isProtected: (d) => prot.includes(d),
    today,
    floorDay: floor,
  });
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

describe('computeStreak (rule)', () => {
  it('counts consecutive trained days', () => {
    expect(run([98, 99, 100], [], 90)).toBe(3);
  });

  it('empty today does not break it', () => {
    expect(run([97, 98, 99], [], 90)).toBe(3);
  });

  it('forgives up to STREAK_MAX_GAP uncovered days (bridged, not counted)', () => {
    const t = [90, 91, 92, 99, 100]; // gap 93..98 is 6 days -> too long
    expect(run(t, [], 90)).toBe(2);
    expect(STREAK_MAX_GAP).toBe(2);
    expect(run([90, 91, 94, 95], [], 90, 95)).toBe(4); // gap 92,93 = 2 -> bridged
    expect(run([90, 91, 95, 96], [], 90, 96)).toBe(2); // gap 92,93,94 = 3 -> broken
  });

  it('a week without training resets the streak (SPO-42: 21-day streak after an idle week)', () => {
    const t = range(70, 92); // 23 days, then 7 idle days up to and incl. today=99
    expect(run(t, [], 70, 99)).toBe(0);
  });

  it('three missed days are over the limit even right after a long streak', () => {
    expect(run(range(70, 96), [], 70, 100)).toBe(0); // 97,98,99 missed, today empty
    expect(run(range(70, 97), [], 70, 100)).toBe(28); // 98,99 missed -> still alive
  });

  it('protected days (rest, illness, injury, program rest) keep it alive and count', () => {
    const t = range(70, 90);
    expect(run(t, range(91, 99), 70, 100)).toBe(21 + 9);
  });

  it('a protected stretch longer than the gap does not make later gaps free', () => {
    expect(run([80], [...range(81, 85)], 80, 100)).toBe(0);
  });

  it('never reaches before the floor day', () => {
    expect(run(range(50, 100), [], 95)).toBe(6);
  });

  it('is 0 with nothing trained and nothing protected', () => {
    expect(run([], [], 0)).toBe(0);
  });
});

// Store-level: local day keys, rest periods, rehab, program rest, activities, time zone.
const at = (m: number, d: number, h = 18) => new Date(2026, m - 1, d, h, 0).getTime();
const NOW = at(9, 26, 12); // Sat 26 Sep 2026
const D = (m: number, d: number) => dayKey(at(m, d, 12));
const w = (id: string, m: number, d: number, h = 18): Workout => ({
  id,
  startedAt: at(m, d, h),
  finishedAt: at(m, d, h) + 3_000_000,
  autoFinished: false,
  exercises: [],
});
const seed = (p: {
  workouts?: Workout[];
  restPeriods?: RestPeriod[];
  injuries?: Injury[];
  activities?: Activity[];
}) =>
  __replaceStateForTests({
    ...__getStateForTests(),
    workouts: p.workouts ?? [],
    restPeriods: p.restPeriods ?? [],
    injuries: p.injuries ?? [],
    activities: p.activities ?? [],
  });
// 21 consecutive days: 25 Aug .. 14 Sep
const block = () => Array.from({ length: 21 }, (_, i) => w(`b${i}`, 8, 25 + i));

describe('consistencyStreak (store)', () => {
  beforeEach(() => setProgramMemory(null));
  afterEach(() => setProgramMemory(null));

  it('21 days of training then a week off is 0 (the SPO-42 report)', () => {
    seed({ workouts: block() }); // last session 14 Sep; now 26 Sep
    expect(consistencyStreak(NOW)).toBe(0);
  });

  it('one or two missed days keep the streak, and today empty is fine', () => {
    seed({ workouts: block() });
    expect(consistencyStreak(at(9, 16, 12))).toBe(21); // 15 missed, 16 still open
    expect(consistencyStreak(at(9, 17, 12))).toBe(21); // 15, 16 missed (2), 17 still open
    expect(consistencyStreak(at(9, 18, 12))).toBe(0); // 15, 16, 17 missed (3) -> reset
  });

  it('logging today after a break starts a fresh streak at 1', () => {
    seed({ workouts: [...block(), w('t', 9, 26, 9)] });
    expect(consistencyStreak(NOW)).toBe(1);
  });

  it('illness / rest periods keep the streak alive across the gap', () => {
    const rp: RestPeriod = {
      id: 'r',
      mode: 'illness',
      startDay: D(9, 15),
      endDay: D(9, 25),
      createdAt: 1,
    };
    seed({ workouts: block(), restPeriods: [rp] });
    expect(consistencyStreak(NOW)).toBe(21 + 11);
  });

  it('an active injury keeps it alive; a healed one only up to the healed day', () => {
    const inj = {
      id: 'i',
      reason: 'injury',
      bodyPart: 'knee',
      muscles: [],
      stage: 0,
      startDay: D(9, 15),
      createdAt: 1,
      checkins: [],
      healedDay: null,
    } as unknown as Injury;
    seed({ workouts: block(), injuries: [inj] });
    expect(consistencyStreak(NOW)).toBe(21 + 12);
    seed({ workouts: block(), injuries: [{ ...inj, healedDay: D(9, 18) }] });
    expect(consistencyStreak(NOW)).toBe(0); // 19..26 uncovered
  });

  it('program rest weekdays keep it alive', () => {
    // Program trains only Mon (1); every other weekday is a planned rest day.
    setProgramMemory({ program: { items: [{ day: 1 }] } });
    seed({ workouts: [w('m', 9, 21)] }); // Mon 21 Sep
    // Tue 22 .. Sat 26 are program rest days.
    expect(consistencyStreak(NOW)).toBe(6);
  });

  it('a finished activity counts as an active day', () => {
    const act = {
      id: 'a',
      startedAt: at(9, 25),
      finishedAt: at(9, 25) + 1_800_000,
    } as unknown as Activity;
    seed({ workouts: [w('x', 9, 24)], activities: [act] });
    expect(consistencyStreak(NOW)).toBe(2);
  });

  it('ignores unfinished workouts', () => {
    seed({ workouts: [{ ...w('u', 9, 25), finishedAt: null }] });
    expect(consistencyStreak(NOW)).toBe(0);
  });

  it('offline sync replay (same workouts twice, any order) gives the same value', () => {
    const a = block();
    seed({ workouts: [...a, ...a].reverse() });
    const dup = consistencyStreak(at(9, 16, 12));
    seed({ workouts: a });
    expect(dup).toBe(consistencyStreak(at(9, 16, 12)));
  });

  it('late-night session belongs to its local day (time-zone / midnight edge)', () => {
    seed({ workouts: [w('n', 9, 25, 23)] });
    expect(consistencyStreak(at(9, 26, 0))).toBe(1);
    expect(consistencyStreak(at(9, 26, 23))).toBe(1);
  });
});
