import { describe, expect, it } from 'vitest';
import { dayKeyOf } from '../components/ui/calendarDays';
import type { StoreState } from '../store';
import type { Activity, Exercise, SetEntry, SleepNight, Workout } from '../types';
import { countRange, dayMap, prRecords } from './calendarData';

// Local-noon timestamps so the local day key is stable in any timezone.
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m, d, h).getTime();
const key = (y: number, m: number, d: number) => dayKeyOf(y, m, d);

const set = (weight: number, reps: number, extra: Partial<SetEntry> = {}): SetEntry => ({
  id: `s${weight}x${reps}`,
  reps,
  weight,
  isWarmup: false,
  position: 0,
  ...extra,
});
const ex = (name: string, sets: SetEntry[], extra: Partial<Exercise> = {}): Exercise =>
  ({ id: `e-${name}`, name, position: 0, sets, ...extra }) as Exercise;
const wk = (
  id: string,
  startedAt: number,
  exercises: Exercise[],
  finished: number | null = startedAt + 3_600_000,
): Workout =>
  ({ id, startedAt, finishedAt: finished, autoFinished: false, exercises }) as unknown as Workout;

const store = (p: Partial<StoreState> = {}): StoreState =>
  ({
    workouts: [],
    activities: [],
    sleeps: [],
    restPeriods: [],
    injuries: [],
    bodyMetrics: undefined,
    ...p,
  }) as unknown as StoreState;

describe('prRecords', () => {
  it('first session sets the bar; only a strictly higher e1RM is a record', () => {
    const w1 = wk('w1', at(2026, 0, 5), [ex('Bench Press', [set(100, 5)])]); // e1rm 117
    const w2 = wk('w2', at(2026, 0, 12), [ex('Bench Press', [set(100, 5)])]); // equal: no PR
    const w3 = wk('w3', at(2026, 0, 19), [ex('bench press ', [set(110, 5)])]); // 128, name trimmed+lowercased
    const out = prRecords([w3, w1, w2]); // input unsorted
    expect(out).toEqual([
      { name: 'bench press ', e1rm: 128, prev: 117, at: w3.startedAt, workoutId: 'w3' },
    ]);
  });

  it('an equal e1RM is not a record', () => {
    const w1 = wk('a', at(2026, 1, 1), [ex('Squat', [set(100, 3)])]);
    const w2 = wk('b', at(2026, 1, 8), [ex('Squat', [set(100, 3)])]);
    expect(prRecords([w1, w2])).toEqual([]);
  });

  it('ignores unfinished workouts, cardio, warm-ups and zero-load sets', () => {
    const live = wk('live', at(2026, 2, 1), [ex('Row', [set(100, 5)])], null);
    const first = wk('f', at(2026, 2, 2), [ex('Row', [set(60, 5)])]);
    const cardio = wk('c', at(2026, 2, 3), [
      ex('Row', [set(200, 5)], { kind: 'cardio' } as Partial<Exercise>),
    ]);
    const warm = wk('wu', at(2026, 2, 4), [ex('Row', [set(300, 5, { isWarmup: true })])]);
    const bodyweight = wk('bw', at(2026, 2, 5), [ex('Row', [set(0, 10)])]);
    expect(prRecords([live, first, cardio, warm, bodyweight])).toEqual([]);
  });

  it('is cached on the array identity and recomputed for a new array', () => {
    const list = [
      wk('1', at(2026, 3, 1), [ex('Press', [set(50, 5)])]),
      wk('2', at(2026, 3, 8), [ex('Press', [set(60, 5)])]),
    ];
    const a = prRecords(list);
    expect(a).toHaveLength(1);
    expect(prRecords(list)).toBe(a);
    const b = prRecords([...list]);
    expect(b).not.toBe(a);
    expect(b).toEqual(a);
  });
});

describe('dayMap', () => {
  const NOW = at(2026, 5, 10);

  it('groups finished workouts and activities by local day, sorted by start', () => {
    const late = wk('late', at(2026, 5, 3, 18), [ex('Curl', [set(20, 10)])]);
    const early = wk('early', at(2026, 5, 3, 7), [ex('Curl', [set(20, 10)])]);
    const live = wk('live', at(2026, 5, 4), [ex('Curl', [set(20, 10)])], null);
    const act = {
      id: 'a1',
      type: 'run',
      category: 'cardio',
      startedAt: at(2026, 5, 3, 9),
      finishedAt: at(2026, 5, 3, 10),
    } as unknown as Activity;
    const liveAct = { ...act, id: 'a2', startedAt: at(2026, 5, 4), finishedAt: null } as Activity;
    const m = dayMap(store({ workouts: [late, early, live], activities: [act, liveAct] }), NOW);
    expect(m.get(key(2026, 5, 3))!.workouts.map((w) => w.id)).toEqual(['early', 'late']);
    expect(m.get(key(2026, 5, 3))!.activity).toBe(true);
    expect(m.get(key(2026, 5, 3))!.activities).toEqual([act]);
    expect(m.has(key(2026, 5, 4))).toBe(false); // unfinished ones are not on the calendar
  });

  it('attributes a night to the morning it ended; naps and live nights are skipped', () => {
    const night: SleepNight = {
      id: 'n1',
      date: '2026-06-02',
      bedtime: at(2026, 5, 1, 23),
      wake: at(2026, 5, 2, 7),
      source: 'backfill',
    } as SleepNight;
    const nap = {
      ...night,
      id: 'n2',
      kind: 'nap',
      bedtime: at(2026, 5, 2, 14),
      wake: at(2026, 5, 2, 15),
    } as SleepNight;
    const live = { ...night, id: 'n3', wake: null } as SleepNight;
    const m = dayMap(store({ sleeps: [night, nap, live] }), NOW);
    const d = m.get(key(2026, 5, 2))!;
    expect(d.sleep).toBe(true);
    expect(d.sleepMin).toBe(480); // the nap is not added
    expect(m.has(key(2026, 5, 1))).toBe(false);
  });

  it('two sleeps ending the same morning add up', () => {
    const mk = (id: string, b: number, w: number) =>
      ({ id, date: 'x', bedtime: b, wake: w, source: 'backfill', kind: 'sleep' }) as SleepNight;
    const m = dayMap(
      store({
        sleeps: [
          mk('a', at(2026, 5, 1, 22), at(2026, 5, 2, 2)),
          mk('b', at(2026, 5, 2, 3), at(2026, 5, 2, 7)),
        ],
      }),
      NOW,
    );
    expect(m.get(key(2026, 5, 2))!.sleepMin).toBe(480);
  });

  it('keeps the latest weigh-in of a day regardless of input order', () => {
    const weights = [
      { at: at(2026, 5, 6, 20), weight: 81.5 },
      { at: at(2026, 5, 6, 7), weight: 82.4 },
      { at: at(2026, 5, 7, 7), weight: 80 },
    ];
    const m = dayMap(
      store({ bodyMetrics: { weights } as unknown as StoreState['bodyMetrics'] }),
      NOW,
    );
    expect(m.get(key(2026, 5, 6))!.weight).toBe(81.5);
    expect(m.get(key(2026, 5, 7))!.weight).toBe(80);
  });

  it('maps rest periods to kinds and caps closed ones at 400 days; open ones run to today', () => {
    const s = key(2026, 4, 1);
    const store1 = store({
      restPeriods: [
        { id: 'r1', startDay: s, endDay: s + 2, mode: 'illness' },
        { id: 'r2', startDay: s + 10, endDay: s + 11, mode: 'off' },
        { id: 'r3', startDay: s + 20, endDay: s + 21, mode: 'rest' },
        { id: 'r4', startDay: key(2024, 0, 1), endDay: key(2024, 0, 1) + 5000, mode: 'rest' },
        { id: 'r5', startDay: key(2026, 5, 8), endDay: 0, mode: 'illness', open: true },
      ] as unknown as StoreState['restPeriods'],
    });
    const m = dayMap(store1, NOW);
    expect(m.get(s)!.health).toBe('sick');
    expect(m.get(s + 2)!.health).toBe('sick');
    expect(m.has(s + 3)).toBe(false);
    expect(m.get(s + 10)!.health).toBe('off');
    expect(m.get(s + 20)!.health).toBe('rest');
    expect(m.get(key(2024, 0, 1) + 400)!.health).toBe('rest');
    expect(m.has(key(2024, 0, 1) + 401)).toBe(false);
    expect(m.get(key(2026, 5, 10))!.health).toBe('sick'); // open: through today
    expect(m.has(key(2026, 5, 11))).toBe(false);
  });

  it('injury covers the full-rest window (end exclusive), the healed day, or just the day itself, without overriding rest', () => {
    const s = key(2026, 3, 1);
    const inj = (o: Record<string, unknown>) => ({ id: 'i', startDay: s, ...o });
    const m1 = dayMap(
      store({
        injuries: [inj({ fullRestUntil: s + 3 })] as unknown as StoreState['injuries'],
      }),
      NOW,
    );
    expect([0, 1, 2, 3].map((i) => m1.get(s + i)?.health ?? null)).toEqual([
      'injury',
      'injury',
      'injury',
      null,
    ]);
    const m2 = dayMap(
      store({
        injuries: [inj({ healedDay: s + 1 })] as unknown as StoreState['injuries'],
      }),
      NOW,
    );
    // no full-rest window: only the day it happened
    expect(m2.get(s)!.health).toBe('injury');
    expect(m2.has(s + 1)).toBe(false);
    const m3 = dayMap(
      store({
        injuries: [
          inj({ fullRestUntil: s + 5, healedDay: s + 1 }),
        ] as unknown as StoreState['injuries'],
      }),
      NOW,
    );
    expect(m3.get(s + 1)!.health).toBe('injury');
    expect(m3.has(s + 2)).toBe(false); // healed earlier than the window end
    const m4 = dayMap(
      store({
        restPeriods: [
          { id: 'r', startDay: s, endDay: s + 1, mode: 'off' },
        ] as unknown as StoreState['restPeriods'],
        injuries: [inj({ fullRestUntil: s + 3 })] as unknown as StoreState['injuries'],
      }),
      NOW,
    );
    expect(m4.get(s)!.health).toBe('off'); // rest wins where both exist
    expect(m4.get(s + 2)!.health).toBe('injury');
  });

  it('marks the PR day and counts the records set that day', () => {
    const w1 = wk('p1', at(2026, 4, 1), [ex('Dead', [set(100, 5)]), ex('Row', [set(50, 5)])]);
    const w2 = wk('p2', at(2026, 4, 8), [ex('Dead', [set(120, 5)]), ex('Row', [set(60, 5)])]);
    const m = dayMap(store({ workouts: [w1, w2] }), NOW);
    expect(m.get(key(2026, 4, 1))!.pr).toBe(false);
    expect(m.get(key(2026, 4, 8))).toMatchObject({ pr: true, prs: 2 });
  });

  it('is cached while the inputs keep their identity, rebuilt when one changes or the day rolls over', () => {
    const s = store({ workouts: [wk('c', at(2026, 5, 1), [ex('X', [set(10, 5)])])] });
    const a = dayMap(s, NOW);
    expect(dayMap(s, NOW + 3_600_000)).toBe(a); // same day, same arrays
    expect(dayMap(s, at(2026, 5, 11))).not.toBe(a); // new "today"
    const s2 = { ...s, workouts: [...s.workouts] } as StoreState;
    const c = dayMap(s2, at(2026, 5, 11));
    expect(dayMap(s2, at(2026, 5, 11))).toBe(c);
    expect(c.get(key(2026, 5, 1))!.workouts).toHaveLength(1);
  });
});

describe('countRange', () => {
  it('totals trained / logged days, PRs, volume and health inside an inclusive range', () => {
    const w1 = wk('r1', at(2026, 6, 1), [ex('Squat', [set(100, 5)])]); // volume 500
    const w2 = wk('r2', at(2026, 6, 3), [ex('Squat', [set(110, 5)])]); // volume 550, PR
    const w3 = wk('r3', at(2026, 6, 20), [ex('Squat', [set(200, 5)])]); // outside the range
    const m = dayMap(
      store({
        workouts: [w1, w2, w3],
        restPeriods: [
          { id: 'x', startDay: key(2026, 6, 4), endDay: key(2026, 6, 5), mode: 'off' },
          { id: 'y', startDay: key(2026, 6, 5), endDay: key(2026, 6, 5), mode: 'illness' },
        ] as unknown as StoreState['restPeriods'],
        bodyMetrics: {
          weights: [{ at: at(2026, 6, 7), weight: 80 }],
        } as unknown as StoreState['bodyMetrics'],
      }),
      at(2026, 6, 30),
    );
    const r = countRange(m, key(2026, 6, 1), key(2026, 6, 7));
    expect(r.trained).toBe(2);
    expect(r.logged).toBe(5); // 1st, 3rd, 4th (off), 5th (sick), 7th (weigh-in)
    expect(r.volumeKg).toBe(1050);
    expect(r.prDays).toBe(1);
    expect(r.prs).toBe(1);
    expect(r.health).toEqual({ rest: 0, sick: 1, off: 1, injury: 0 });
  });

  it('is empty for an empty map and for an inverted range', () => {
    const empty = { trained: 0, logged: 0, prDays: 0, prs: 0, volumeKg: 0 };
    expect(countRange(new Map(), 1, 10)).toMatchObject(empty);
    const m = dayMap(
      store({ workouts: [wk('z', at(2026, 7, 1), [ex('X', [set(10, 5)])])] }),
      at(2026, 7, 2),
    );
    expect(countRange(m, key(2026, 7, 5), key(2026, 7, 1))).toMatchObject(empty);
  });

  it('counts weigh-in-only and activity-only days as logged but not trained', () => {
    const m = dayMap(
      store({
        activities: [
          {
            id: 'a',
            type: 'run',
            category: 'cardio',
            startedAt: at(2026, 7, 9),
            finishedAt: at(2026, 7, 9, 13),
          },
        ] as unknown as StoreState['activities'],
      }),
      at(2026, 7, 20),
    );
    expect(countRange(m, key(2026, 7, 9), key(2026, 7, 9))).toMatchObject({
      trained: 0,
      logged: 1,
    });
  });
});
