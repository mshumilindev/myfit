import { describe, expect, it } from 'vitest';
import { MONTH_UNLOCK, availableRecaps, buildRecap, recapRefFromId } from './recaps';
import type { RecapRef } from './recaps';
import { EMPTY_GOALS } from './goals';
import type { FitGoals } from './goals';
import type { Activity, Exercise, SetEntry, Workout } from './types';

const DAY = 86_400_000;
/** Local date-time, so day / month boundaries are timezone independent. */
const L = (y: number, m: number, d: number, h = 12): number => new Date(y, m - 1, d, h).getTime();

let seq = 0;
function set(reps: number, weight: number | null, o: Partial<SetEntry> = {}): SetEntry {
  return {
    id: `s${seq++}`,
    position: 0,
    reps,
    weight,
    isWarmup: false,
    type: 'working',
    ...o,
  } as SetEntry;
}
function lift(
  name: string,
  sets: SetEntry[],
  primary = 'quads',
  secondary: string[] = [],
): Exercise {
  return {
    id: `e${seq++}`,
    name,
    kind: 'strength',
    position: 0,
    primaryMuscle: primary,
    secondaryMuscles: secondary,
    sets,
  } as Exercise;
}
/** A session: one working set of `reps` x `kg` on a non-catalog lift (volume = reps x kg). */
function wk(
  startedAt: number,
  exercises: Exercise[] = [lift('Zed Squat', [set(5, 100)])],
  durationMin = 45,
  finished = true,
): Workout {
  return {
    id: `w${seq++}`,
    startedAt,
    finishedAt: finished ? startedAt + durationMin * 60_000 : null,
    autoFinished: false,
    exercises,
  } as Workout;
}
const act = (startedAt: number, o: Partial<Activity> = {}): Activity =>
  ({
    id: `a${seq++}`,
    type: 'run',
    category: 'conditioning',
    startedAt,
    finishedAt: startedAt + 1800_000,
    durationMin: 30,
    ...o,
  }) as Activity;

const ref = (id: string): RecapRef => recapRefFromId(id)!;
const build = (
  id: string,
  ws: Workout[],
  acts: Activity[] = [],
  goals: FitGoals = EMPTY_GOALS,
  kg: number | null = 80,
) => buildRecap(ref(id), ws, acts, goals, kg);

describe('recapRefFromId', () => {
  it('parses month, quarter and year ids with half-open [start, end) bounds', () => {
    expect(ref('2026-M7')).toEqual({
      id: '2026-M7',
      kind: 'month',
      year: 2026,
      index: 7,
      start: L(2026, 8, 1, 0),
      end: L(2026, 9, 1, 0),
    });
    expect(ref('2026-Q3')).toMatchObject({
      kind: 'quarter',
      index: 3,
      start: L(2026, 7, 1, 0),
      end: L(2026, 10, 1, 0),
    });
    expect(ref('2026-Q4').end).toBe(L(2027, 1, 1, 0));
    expect(ref('2026-Y')).toMatchObject({
      kind: 'year',
      index: 0,
      start: L(2026, 1, 1, 0),
      end: L(2027, 1, 1, 0),
    });
    expect(ref('2026-M11').end).toBe(L(2027, 1, 1, 0));
  });

  it.each(['', 'abc', '2026', '26-M1', '2026-X1', '2026-M7x', ' 2026-M7', '2026-m7'])(
    'rejects %j',
    (id) => {
      expect(recapRefFromId(id)).toBeNull();
    },
  );
});

describe('availableRecaps', () => {
  const now = L(2026, 9, 3);

  it('lists the current month as building, even when empty, and omits empty closed periods', () => {
    const entries = availableRecaps([], now);
    expect(entries.map((e) => [e.ref.id, e.status, e.sessions])).toEqual([
      ['2026-Y', 'building', 0],
      ['2026-M8', 'building', 0],
      ['2026-Q3', 'building', 0],
    ]);
  });

  it('a closed month unlocks at exactly MONTH_UNLOCK sessions; fewer is thin', () => {
    const month = (n: number) => Array.from({ length: n }, (_, i) => wk(L(2026, 8, 1 + i * 3)));
    const find = (ws: Workout[]) => availableRecaps(ws, now).find((e) => e.ref.id === '2026-M7')!;
    expect(find(month(MONTH_UNLOCK))).toMatchObject({ status: 'ready', sessions: 6 });
    expect(find(month(MONTH_UNLOCK - 1))).toMatchObject({ status: 'thin', sessions: 5 });
  });

  it('closed quarters and years need only a single session', () => {
    const ws = [wk(L(2025, 11, 15))];
    const byId = Object.fromEntries(availableRecaps(ws, now).map((e) => [e.ref.id, e]));
    expect(byId['2025-Q4']).toMatchObject({ status: 'ready', sessions: 1 });
    expect(byId['2025-Y']).toMatchObject({ status: 'ready', sessions: 1 });
    expect(byId['2025-M10']).toMatchObject({ status: 'thin', sessions: 1 });
  });

  it('sorts newest period first; for equal ends the shorter (later-starting) period leads', () => {
    const ws = [wk(L(2026, 9, 2)), wk(L(2026, 6, 10))];
    const ids = availableRecaps(ws, now).map((e) => e.ref.id);
    expect(ids.slice(0, 4)).toEqual(['2026-Y', '2026-M8', '2026-Q3', '2026-M5']);
    expect(ids.indexOf('2026-Q2')).toBeGreaterThan(ids.indexOf('2026-Q3'));
  });

  it('reaches back 14 months, 6 quarters and 3 years', () => {
    const old = (y: number, m: number) => wk(L(y, m, 10));
    const ws = [old(2025, 8), old(2025, 7), old(2024, 6), old(2023, 6), old(2025, 2)];
    const ids = new Set(availableRecaps(ws, now).map((e) => e.ref.id));
    expect(ids.has('2025-M7')).toBe(true); // Aug 2025 = 13 months back
    expect(ids.has('2025-M6')).toBe(false); // Jul 2025 = 14 months back (only 0..13 listed)
    expect(ids.has('2025-Q2')).toBe(false); // 6 quarters: Q3'26 .. Q2'25 -> Q2'25 is the 6th
    expect(ids.has('2024-Y')).toBe(true);
    expect(ids.has('2023-Y')).toBe(false);
  });

  it('wraps cleanly across a year boundary (January looks back into last year)', () => {
    const jan = L(2027, 1, 10);
    const ids = availableRecaps([wk(L(2026, 12, 5)), wk(L(2026, 11, 5))], jan).map((e) => e.ref.id);
    expect(ids).toContain('2026-M11');
    expect(ids).toContain('2026-M10');
    expect(ids).toContain('2026-Q4');
    expect(ids).toContain('2027-Y');
    expect(ids).toContain('2027-Q1');
  });

  it('ignores unfinished sessions and respects the exclusive period end', () => {
    const ws = [
      wk(L(2026, 7, 31, 23), undefined, 45, false), // unfinished
      wk(L(2026, 8, 1, 0)), // first instant of August
      wk(L(2026, 9, 1, 0)), // first instant of September -> not August
    ];
    const entries = availableRecaps(ws, now);
    expect(entries.find((e) => e.ref.id === '2026-M7')!.sessions).toBe(1);
    expect(entries.find((e) => e.ref.id === '2026-M8')!.sessions).toBe(1);
    expect(entries.find((e) => e.ref.id === '2026-M6')).toBeUndefined();
  });
});

describe('totals', () => {
  it('sums sessions, tonnage, sets, reps (drops included) and time', () => {
    const a = wk(
      L(2026, 8, 3),
      [
        lift('Zed Squat', [set(5, 100), set(5, 100, { type: 'warmup', isWarmup: true })]),
        lift(
          'Zed Curl',
          [set(6, 20, { type: 'drop', drops: [{ weight: 10, reps: 4 }] })],
          'biceps',
        ),
      ],
      60,
    );
    const b = wk(L(2026, 8, 5), [lift('Zed Press', [set(10, 50)], 'chest')], 30);
    const r = build('2026-M7', [a, b]);
    expect(r.sessions).toBe(2);
    expect(r.volumeKg).toBe(500 + 500 + (6 * 20 + 4 * 10) + 500);
    expect(r.sets).toBe(4);
    expect(r.reps).toBe(5 + 5 + 6 + 4 + 10);
    expect(r.timeHours).toBeCloseTo(1.5, 10);
  });

  it('caps a single session at 6 hours and clamps negative durations to zero', () => {
    const long = wk(L(2026, 8, 3), undefined, 600);
    const backwards = { ...wk(L(2026, 8, 4)), finishedAt: L(2026, 8, 4) - 1000 } as Workout;
    expect(build('2026-M7', [long]).timeHours).toBe(6);
    expect(build('2026-M7', [backwards]).timeHours).toBe(0);
  });

  it('calories need a bodyweight', () => {
    const w = [wk(L(2026, 8, 3), undefined, 60)];
    expect(build('2026-M7', w, [], EMPTY_GOALS, null).calories).toBe(0);
    expect(build('2026-M7', w, [], EMPTY_GOALS, 0).calories).toBe(0);
    expect(build('2026-M7', w, [], EMPTY_GOALS, 80).calories).toBeGreaterThan(200);
  });

  it('only counts finished sessions inside the period', () => {
    const r = build('2026-M7', [
      wk(L(2026, 7, 31, 23)),
      wk(L(2026, 8, 15)),
      wk(L(2026, 8, 20), undefined, 45, false),
      wk(L(2026, 9, 1, 0)),
    ]);
    expect(r.sessions).toBe(1);
  });

  it('an empty period is all zeros with no records or muscles', () => {
    const r = build('2026-M7', []);
    expect(r).toMatchObject({
      sessions: 0,
      volumeKg: 0,
      sets: 0,
      reps: 0,
      prCount: 0,
      heaviestSet: null,
      biggestSession: null,
      trainingDays: 0,
      longestStreak: 0,
      perfectWeeks: 0,
      leastMuscle: null,
      goal: null,
      volumeIsPeak: false,
      headline: 'firstPeriod',
    });
    expect(r.muscles).toEqual([]);
    expect(r.weekdayMask).toEqual(Array(7).fill(false));
  });
});

describe('deltas versus the previous period', () => {
  it('are fractions of the previous value, negative for a drop', () => {
    const prev = [
      wk(L(2026, 7, 3), [lift('Zed Squat', [set(10, 100)])]),
      wk(L(2026, 7, 8), [lift('Zed Squat', [set(10, 100)])]),
    ];
    const cur = [wk(L(2026, 8, 3), [lift('Zed Squat', [set(10, 150)])])];
    const r = build('2026-M7', [...prev, ...cur]);
    expect(r.prevExists).toBe(true);
    expect(r.d.sessions).toBeCloseTo(-0.5, 10);
    expect(r.d.volume).toBeCloseTo((1500 - 2000) / 2000, 10);
    expect(r.d.sets).toBeCloseTo(-0.5, 10);
  });

  it('are null with no previous period and for a zero baseline', () => {
    const r = build('2026-M7', [wk(L(2026, 8, 3))]);
    expect(r.prevExists).toBe(false);
    expect(r.d).toEqual({ sessions: null, volume: null, time: null, sets: null, calories: null });
    // previous month exists but its calories are 0 (no bodyweight) -> that delta is null
    const both = build('2026-M7', [wk(L(2026, 7, 3)), wk(L(2026, 8, 3))], [], EMPTY_GOALS, null);
    expect(both.d.sessions).toBe(0);
    expect(both.d.calories).toBeNull();
  });

  it('January compares with December of the previous year; Q1 with Q4; a year with the year before', () => {
    const ws = [wk(L(2025, 12, 10)), wk(L(2026, 1, 10)), wk(L(2025, 11, 10))];
    expect(build('2026-M0', ws).prevExists).toBe(true);
    expect(build('2026-Q1', ws).prevExists).toBe(true);
    expect(build('2026-Y', [wk(L(2025, 5, 5)), wk(L(2026, 5, 5))]).prevExists).toBe(true);
    expect(build('2026-Q2', [wk(L(2026, 5, 5))]).prevExists).toBe(false);
  });
});

describe('volume peak and headline', () => {
  const vol = (id: string, kg: number, day = 5) => {
    const r = ref(id);
    return wk(r.start + day * DAY + 12 * 3600_000, [lift('Zed Squat', [set(1, kg)])]);
  };

  it('firstPeriod when nothing precedes', () => {
    const r = build('2026-M7', [vol('2026-M7', 100)]);
    expect(r.headline).toBe('firstPeriod');
  });

  it('highestVolume: biggest of its kind on record and above the previous period', () => {
    const r = build('2026-M7', [vol('2026-M5', 100), vol('2026-M6', 150), vol('2026-M7', 200)]);
    expect(r.volumeIsPeak).toBe(true);
    expect(r.headline).toBe('highestVolume');
  });

  it('an equal earlier peak means this is not the peak (ties lose)', () => {
    const r = build('2026-M7', [vol('2026-M5', 200), vol('2026-M6', 100), vol('2026-M7', 200)]);
    expect(r.volumeIsPeak).toBe(false);
  });

  it('only periods of the same kind are compared', () => {
    const r = build('2026-M7', [vol('2026-Q1', 5000), vol('2026-M6', 100), vol('2026-M7', 200)]);
    // the Q1 session sits in January; months before July were Jan..Jun, and January's month holds 5000
    expect(r.volumeIsPeak).toBe(false);
    const clean = build('2026-M7', [vol('2026-M6', 100), vol('2026-M7', 200)]);
    expect(clean.volumeIsPeak).toBe(true);
  });

  it('records when not a volume peak but two or more lifts set PRs', () => {
    const big = vol('2026-M5', 1000);
    const prev = wk(L(2026, 7, 5), [lift('Zed A', [set(5, 50)]), lift('Zed B', [set(5, 50)])]);
    const cur = wk(L(2026, 8, 5), [lift('Zed A', [set(5, 60)]), lift('Zed B', [set(5, 60)])]);
    const r = build('2026-M7', [big, prev, cur]);
    expect(r.volumeIsPeak).toBe(false);
    expect(r.prCount).toBe(2);
    expect(r.headline).toBe('records');
  });

  it('consistency: at least max(2, weeks - 1) perfect (3+ session) weeks', () => {
    const big = vol('2026-M5', 1000);
    const prev = wk(L(2026, 7, 5), [lift('Zed Squat', [set(5, 120)])]);
    // Aug 1 2026 is a Saturday; weeks are counted from the 1st: days 1-7, 8-14, 15-21, 22-28, 29-31
    const week = (startDay: number) =>
      [0, 1, 2].map((i) => wk(L(2026, 8, startDay + i), [lift('Zed Squat', [set(1, 10)])]));
    const four = [...week(1), ...week(8), ...week(15), ...week(22)];
    const r = build('2026-M7', [big, prev, ...four]);
    expect(r.weeksInPeriod).toBe(5);
    expect(r.perfectWeeks).toBe(4);
    expect(r.headline).toBe('consistency');
    const three = [...week(1), ...week(8), ...week(15)];
    expect(build('2026-M7', [big, prev, ...three]).headline).not.toBe('consistency');
  });

  it('comeback: more than 5% above the previous period without being a peak', () => {
    const big = vol('2026-M5', 1000);
    const prev = vol('2026-M6', 100);
    expect(build('2026-M7', [big, prev, vol('2026-M7', 106)]).headline).toBe('comeback');
    expect(build('2026-M7', [big, prev, vol('2026-M7', 105)]).headline).toBe('steady');
    expect(build('2026-M7', [big, prev, vol('2026-M7', 90)]).headline).toBe('steady');
  });
});

describe('records', () => {
  const prior = wk(L(2026, 7, 5), [lift('Zed Squat', [set(5, 100)])]); // e1RM 117
  it('a PR must beat the all-time best from before the period; the single best set per lift is kept', () => {
    const cur = wk(L(2026, 8, 5), [
      lift('Zed Squat', [set(5, 100), set(5, 110), set(3, 120)]),
      lift('Zed Bench', [set(5, 60)], 'chest'),
    ]);
    const r = build('2026-M7', [prior, cur]);
    expect(r.records.map((x) => [x.name, x.weightKg, x.e1rm])).toEqual([
      ['Zed Squat', 120, 132],
      ['Zed Bench', 60, 70],
    ]);
    expect(r.prCount).toBe(2);
  });

  it('matching the previous best is not a PR; neither is a lighter lift', () => {
    const r = build('2026-M7', [prior, wk(L(2026, 8, 5), [lift('Zed Squat', [set(5, 100)])])]);
    expect(r.prCount).toBe(0);
    expect(
      build('2026-M7', [prior, wk(L(2026, 8, 5), [lift('Zed Squat', [set(5, 90)])])]).prCount,
    ).toBe(0);
  });

  it('ignores warm-ups, zero-load and out-of-range reps; unfinished earlier sessions set no baseline', () => {
    const unfinished = wk(L(2026, 7, 6), [lift('Zed Squat', [set(5, 500)])], 45, false);
    const cur = wk(L(2026, 8, 5), [
      lift('Zed Squat', [set(5, 300, { type: 'warmup', isWarmup: true }), set(12, 100), set(5, 0)]),
    ]);
    const r = build('2026-M7', [prior, unfinished, cur]);
    expect(r.prCount).toBe(0);
    const only = build('2026-M7', [
      unfinished,
      wk(L(2026, 8, 5), [lift('Zed Squat', [set(5, 100)])]),
    ]);
    expect(only.prCount).toBe(1); // unfinished 500 kg does not block the debut record
  });

  it('records are sorted by e1RM, strongest first', () => {
    const r = build('2026-M7', [
      wk(L(2026, 8, 5), [
        lift('Zed Light', [set(5, 20)], 'biceps'),
        lift('Zed Heavy', [set(5, 200)]),
      ]),
    ]);
    expect(r.records.map((x) => x.name)).toEqual(['Zed Heavy', 'Zed Light']);
  });

  it('heaviest set: the heaviest single weight (drops included); biggest session by tonnage', () => {
    const light = wk(L(2026, 8, 3), [lift('Zed Squat', [set(10, 80)])]);
    const heavy = wk(L(2026, 8, 6), [
      lift('Zed Squat', [set(3, 140)]),
      lift('Zed Curl', [set(5, 20, { type: 'drop', drops: [{ weight: 150, reps: 1 }] })], 'biceps'),
    ]);
    const r = build('2026-M7', [light, heavy]);
    expect(r.heaviestSet).toEqual({ name: 'Zed Curl', weightKg: 150, reps: 5 });
    // heavy day: 3x140 + 5x20 + 1x150 = 670 kg; the light day moved 10x80 = 800 kg
    expect(r.biggestSession).toEqual({ volumeKg: 800, ts: light.startedAt });
    expect(
      build('2026-M7', [wk(L(2026, 8, 3), [lift('Zed Pull Up', [set(10, null)])])]).heaviestSet,
    ).toBeNull();
  });

  it('non-strength exercises never produce records', () => {
    const cardio = { ...lift('Run', [set(1, 100)]), kind: 'cardio' } as Exercise;
    expect(build('2026-M7', [wk(L(2026, 8, 3), [cardio])]).prCount).toBe(0);
  });
});

describe('muscle distribution', () => {
  const day = wk(L(2026, 8, 3), [
    lift(
      'Zed Squat',
      Array.from({ length: 6 }, () => set(5, 100)),
      'quads',
    ),
    lift(
      'Zed Press',
      Array.from({ length: 3 }, () => set(5, 60)),
      'chest',
      ['triceps'],
    ),
    lift(
      'Zed Row',
      Array.from({ length: 2 }, () => set(5, 60)),
      'lats',
    ),
    lift('Zed Curl', [set(5, 20)], 'biceps'),
  ]);

  it('shares are rounded percentages of fractional sets, largest first', () => {
    const r = build('2026-M7', [day]);
    // quads 6, chest 3, lats 2, biceps 1, triceps 1.5 (secondary): total 13.5
    expect(r.muscles.map((m) => [m.group, m.sets, m.pct])).toEqual([
      ['quads', 6, 44],
      ['chest', 3, 22],
      ['lats', 2, 15],
      ['triceps', 1.5, 11],
      ['biceps', 1, 7],
    ]);
  });

  it('highlights the whole of each top-five group (chest -> both sub-regions) without duplicates', () => {
    const r = build('2026-M7', [day]);
    expect(r.growMuscles).toEqual([
      'quads',
      'chest-upper',
      'chest-lower',
      'lats',
      'triceps',
      'biceps',
    ]);
    expect(new Set(r.growMuscles).size).toBe(r.growMuscles.length);
  });

  it('the least-trained muscle is only named once four or more muscles were trained', () => {
    expect(build('2026-M7', [day]).leastMuscle).toBe('biceps');
    const three = wk(L(2026, 8, 3), [
      lift('Zed Squat', [set(5, 100)], 'quads'),
      lift('Zed Press', [set(5, 60)], 'chest'),
      lift('Zed Row', [set(5, 60)], 'lats'),
    ]);
    expect(build('2026-M7', [three]).leastMuscle).toBeNull();
  });
});

describe('consistency', () => {
  it('counts distinct training days and flags the weekdays trained (Monday first)', () => {
    // 2026-08-03 Mon, 08-05 Wed, 08-09 Sun; two sessions on the 5th
    const ws = [wk(L(2026, 8, 3)), wk(L(2026, 8, 5, 8)), wk(L(2026, 8, 5, 18)), wk(L(2026, 8, 9))];
    const r = build('2026-M7', ws);
    expect(r.trainingDays).toBe(3);
    expect(r.weekdayMask).toEqual([true, false, true, false, false, false, true]);
  });

  it('longest streak = longest run of consecutive calendar days', () => {
    const days = [3, 4, 5, 9, 10, 11, 12, 13, 20];
    const r = build(
      '2026-M7',
      days.map((d) => wk(L(2026, 8, d))),
    );
    expect(r.longestStreak).toBe(5);
    expect(build('2026-M7', [wk(L(2026, 8, 3)), wk(L(2026, 8, 7))]).longestStreak).toBe(1);
  });

  it('a streak survives month-end and DST because it is measured in calendar days', () => {
    const r = build('2026-Q3', [wk(L(2026, 7, 31)), wk(L(2026, 8, 1)), wk(L(2026, 8, 2))]);
    expect(r.longestStreak).toBe(3);
    const oct = build('2026-Q4', [
      wk(L(2026, 10, 24)),
      wk(L(2026, 10, 25)),
      wk(L(2026, 10, 26)),
      wk(L(2026, 10, 27)),
    ]);
    expect(oct.longestStreak).toBe(4);
  });

  it('weeks in period are rounded up: 28-day February = 4, 31-day August = 5, a year = 53', () => {
    expect(build('2026-M1', []).weeksInPeriod).toBe(4);
    expect(build('2026-M7', []).weeksInPeriod).toBe(5);
    expect(build('2026-Y', []).weeksInPeriod).toBe(53);
    expect(build('2026-Q1', []).weeksInPeriod).toBe(13);
  });

  it('a perfect week needs 3 sessions inside one 7-day block counted from the period start', () => {
    const r = build('2026-M7', [
      wk(L(2026, 8, 1)),
      wk(L(2026, 8, 2)),
      wk(L(2026, 8, 7)), // block 0: 3 sessions
      wk(L(2026, 8, 8)),
      wk(L(2026, 8, 9)), // block 1: 2 sessions
    ]);
    expect(r.perfectWeeks).toBe(1);
  });
});

describe('trend', () => {
  it('month view: one bar per week (W1..), tonnes, with the peak week flagged', () => {
    const ws = [
      wk(L(2026, 8, 3), [lift('Zed Squat', [set(10, 100)])]), // week 1: 1000 kg
      wk(L(2026, 8, 10), [lift('Zed Squat', [set(10, 300)])]), // week 2: 3000 kg
      wk(L(2026, 8, 31), [lift('Zed Squat', [set(10, 100)])]), // week 5: 1000 kg
    ];
    const t = build('2026-M7', ws).trend;
    expect(t.map((b) => b.label)).toEqual(['W1', 'W2', 'W3', 'W4', 'W5']);
    expect(t.map((b) => b.value)).toEqual([1, 3, 0, 0, 1]);
    expect(t.map((b) => b.peak)).toEqual([false, true, false, false, false]);
  });

  it('tied peak weeks are all flagged; an empty period has no peak', () => {
    const w = (d: number) => wk(L(2026, 8, d), [lift('Zed Squat', [set(10, 100)])]);
    expect(build('2026-M7', [w(3), w(10)]).trend.map((b) => b.peak)).toEqual([
      true,
      true,
      false,
      false,
      false,
    ]);
    expect(build('2026-M7', []).trend.every((b) => !b.peak && b.value === 0)).toBe(true);
  });

  it('quarter view: three month bars carrying the real month number', () => {
    const ws = [
      wk(L(2026, 4, 10), [lift('Zed Squat', [set(10, 100)])]),
      wk(L(2026, 6, 10), [lift('Zed Squat', [set(10, 200)])]),
    ];
    const t = build('2026-Q2', ws).trend;
    expect(t.map((b) => [b.month, b.value, b.peak])).toEqual([
      [3, 1, false],
      [4, 0, false],
      [5, 2, true],
    ]);
    expect(t[0].label).toBeUndefined();
  });

  it('year view: twelve month bars', () => {
    const t = build('2026-Y', [wk(L(2026, 12, 10), [lift('Zed Squat', [set(10, 100)])])]).trend;
    expect(t).toHaveLength(12);
    expect(t[11]).toMatchObject({ month: 11, value: 1, peak: true });
    expect(t[0]).toMatchObject({ month: 0, value: 0 });
  });
});

describe('goals', () => {
  const press = lift('Zed Press', [set(5, 60)], 'chest');
  const goals = (emphasis: Record<string, 'grow' | 'ease'>, archetype?: string): FitGoals =>
    ({
      focus: { label: 'B', startedAt: 0, weeks: 4, emphasis },
      ...(archetype ? { physique: { archetype, sex: 'male', setAt: 0 } } : {}),
    }) as unknown as FitGoals;

  it('is null without a physique or focus goal', () => {
    expect(build('2026-M7', [wk(L(2026, 8, 3), [press])]).goal).toBeNull();
  });

  it('adherence = share of "grow" targets actually trained in the period', () => {
    const r = build(
      '2026-M7',
      [wk(L(2026, 8, 3), [press])],
      [],
      goals(
        { 'chest-upper': 'grow', lats: 'grow', biceps: 'ease', quads: 'hold' as never },
        'v-taper',
      ),
    );
    expect(r.goal).toEqual({
      archetype: 'v-taper',
      adherencePct: 50,
      hits: [
        { muscle: 'chest-upper', ok: true },
        { muscle: 'lats', ok: false },
      ],
    });
  });

  it('a focus with no grow targets reads 0% and an empty archetype', () => {
    const r = build('2026-M7', [wk(L(2026, 8, 3), [press])], [], goals({ biceps: 'ease' }));
    expect(r.goal).toEqual({ archetype: '', adherencePct: 0, hits: [] });
  });

  it('a physique goal alone still yields an entry', () => {
    const r = build('2026-M7', [wk(L(2026, 8, 3), [press])], [], {
      physique: { archetype: 'v-taper', sex: 'male', setAt: 0 },
    } as unknown as FitGoals);
    expect(r.goal).toEqual({ archetype: 'v-taper', adherencePct: 0, hits: [] });
  });
});

describe('activities', () => {
  it('splits recovery from conditioning minutes, rounds, and honours the period bounds', () => {
    const acts = [
      act(L(2026, 8, 3), { durationMin: 30 }),
      act(L(2026, 8, 4), { durationMin: 0, finishedAt: L(2026, 8, 4) + 20.4 * 60000 }),
      act(L(2026, 8, 5), { category: 'recovery', type: 'sauna', durationMin: 25 }),
      act(L(2026, 8, 6), { durationMin: 99, finishedAt: null }), // unfinished
      act(L(2026, 7, 31, 23), { durationMin: 99 }), // before
      act(L(2026, 9, 1, 0), { durationMin: 99 }), // after (exclusive end)
    ];
    const r = build('2026-M7', [], acts);
    expect(r.conditioningMin).toBe(50); // 30 + 20.4 -> 50.4 -> 50
    expect(r.recoveryMin).toBe(25);
  });
});
