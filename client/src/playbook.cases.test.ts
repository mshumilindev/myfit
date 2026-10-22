import { describe, expect, it } from 'vitest';
import { computePlaybook, playForWeekday } from './playbook';
import type { Play } from './playbook';
import type { Exercise, SetEntry, Workout } from './types';

const DAY = 86400000;
// Monday 2026-10-05, local noon (weekdays are read in local time).
const MON = new Date(2026, 9, 5, 12).getTime();
const NOW = MON + 60 * DAY;

interface Spec {
  /** [reps, weight] per set; a third element marks a warm-up. */
  sets?: [number, number | null, boolean?][];
  primary?: string;
  secondary?: string[];
  kind?: Exercise['kind'];
}
let seq = 0;
/** Non-catalog name -> muscles come from the stored primary/secondary. */
function ex(name: string, position: number, s: Spec = {}): Exercise {
  const sets = (s.sets ?? [[8, 50]]).map(
    ([reps, weight, warm], i) =>
      ({
        id: `s${seq++}`,
        position: i,
        reps,
        weight,
        isWarmup: !!warm,
        type: warm ? 'warmup' : 'working',
      }) as SetEntry,
  );
  return {
    id: `e${seq++}`,
    name,
    kind: s.kind ?? 'strength',
    position,
    primaryMuscle: s.primary ?? 'chest',
    secondaryMuscles: s.secondary ?? [],
    sets,
  } as Exercise;
}
function wk(startedAt: number, exercises: Exercise[], dayName?: string, finished = true): Workout {
  return {
    id: `W${seq++}`,
    startedAt,
    finishedAt: finished ? startedAt + 3600_000 : null,
    autoFinished: false,
    dayName: dayName ?? null,
    gymId: null,
    exercises,
  } as Workout;
}
const only = (plays: Play[]): Play => {
  expect(plays).toHaveLength(1);
  return plays[0];
};

describe('readiness and filtering', () => {
  it('is not ready (and has no plays) below two finished sessions', () => {
    const r = computePlaybook([wk(MON, [ex('Bench', 0)], 'Push')], NOW);
    expect(r.ready).toBe(false);
    expect(r.plays).toEqual([]);
    expect(computePlaybook([], NOW)).toEqual({ ready: false, plays: [], recent: [] });
  });

  it('unfinished sessions never count', () => {
    const r = computePlaybook(
      [wk(MON, [ex('Bench', 0)], 'Push'), wk(MON + DAY, [ex('Bench', 0)], 'Push', false)],
      NOW,
    );
    expect(r.ready).toBe(false);
    expect(r.recent).toHaveLength(1);
  });

  it('two sessions of a named day make a play; a one-off day does not', () => {
    const r = computePlaybook(
      [
        wk(MON, [ex('Bench', 0)], 'Push'),
        wk(MON + 7 * DAY, [ex('Bench', 0)], 'Push'),
        wk(MON + 8 * DAY, [ex('Squat', 0, { primary: 'quads' })], 'Legs'),
      ],
      NOW,
    );
    expect(r.ready).toBe(true);
    expect(r.plays.map((p) => p.name)).toEqual(['Push']);
  });
});

describe('named-day clustering', () => {
  it('matches day names ignoring case and surrounding whitespace, keeping the first spelling', () => {
    const r = computePlaybook(
      [
        wk(MON, [ex('Bench', 0)], ' Chest 2 '),
        wk(MON + 7 * DAY, [ex('Bench', 0)], 'chest 2'),
        wk(MON + 14 * DAY, [ex('Bench', 0)], 'CHEST 2'),
      ],
      NOW,
    );
    const p = only(r.plays);
    expect(p.name).toBe('Chest 2');
    expect(p.id).toBe('name:chest 2');
    expect(p.sessions).toBe(3);
  });

  it('a blank day name is treated as unnamed', () => {
    const r = computePlaybook(
      [wk(MON, [ex('Bench', 0)], '   '), wk(MON + 7 * DAY, [ex('Bench', 0)])],
      NOW,
    );
    const p = only(r.plays);
    expect(p.name).toBeNull();
    expect(p.id.startsWith('sig:')).toBe(true);
  });
});

describe('unnamed-day clustering by lifts and muscles', () => {
  const push = (t: number, order: 'a' | 'b' = 'a') =>
    wk(
      t,
      order === 'a'
        ? [
            ex('Zed Bench', 0, { primary: 'chest' }),
            ex('Zed Fly', 1, { primary: 'chest' }),
            ex('Zed Dip', 2, { primary: 'triceps' }),
          ]
        : [
            ex('Zed Dip', 0, { primary: 'triceps' }),
            ex('Zed Fly', 1, { primary: 'chest' }),
            ex('Zed Bench', 2, { primary: 'chest' }),
          ],
    );
  const legs = (t: number) =>
    wk(t, [ex('Zed Squat', 0, { primary: 'quads' }), ex('Zed Curl', 1, { primary: 'hamstrings' })]);

  it('groups the same lifts together regardless of order, and keeps different days apart', () => {
    const r = computePlaybook(
      [push(MON), legs(MON + DAY), push(MON + 7 * DAY, 'b'), legs(MON + 8 * DAY)],
      NOW,
    );
    expect(r.plays).toHaveLength(2);
    const byFirst = (n: string) => r.plays.find((p) => p.exercises.some((e) => e.name === n))!;
    expect(byFirst('Zed Bench').sessions).toBe(2);
    expect(byFirst('Zed Squat').sessions).toBe(2);
    expect(byFirst('Zed Bench').id).toBe('sig:chest+triceps');
    expect(byFirst('Zed Squat').id).toBe('sig:hamstrings+quads');
  });

  it('disambiguates two distinct days that train the same muscles (":2" suffix)', () => {
    const a = (t: number) => wk(t, [ex('Alpha One', 0, { primary: 'chest' })]);
    const b = (t: number) => wk(t, [ex('Beta Two', 0, { primary: 'chest' })]);
    const r = computePlaybook([a(MON), b(MON + DAY), a(MON + 7 * DAY), b(MON + 8 * DAY)], NOW);
    expect(r.plays.map((p) => p.id).sort()).toEqual(['sig:chest', 'sig:chest:2']);
  });

  it('a session with no usable strength work falls into the "other" bucket', () => {
    const run = (t: number) => wk(t, [ex('Treadmill', 0, { kind: 'cardio' })]);
    const r = computePlaybook([run(MON), run(MON + DAY)], NOW);
    // clustered (2 sessions) but there is no strength exercise to build a play from
    expect(r.plays).toEqual([]);
    expect(r.recent).toHaveLength(1);
  });
});

describe('synthesised exercises', () => {
  const week = (i: number) => MON + i * 7 * DAY;

  it('frequency thresholds: 75% is staple, 50% core, below 50% dropped', () => {
    const base = (i: number, extra: Exercise[]) => wk(week(i), [ex('Always', 0), ...extra], 'Day');
    const r = computePlaybook(
      [
        base(0, [ex('Three Of Four', 1), ex('Half', 2), ex('Once', 3)]),
        base(1, [ex('Three Of Four', 1), ex('Half', 2)]),
        base(2, [ex('Three Of Four', 1)]),
        base(3, []),
      ],
      NOW,
    );
    const p = only(r.plays);
    const get = (n: string) => p.exercises.find((e) => e.name === n);
    expect(get('Always')).toMatchObject({ frequency: 1, staple: true });
    expect(get('Three Of Four')).toMatchObject({ frequency: 0.75, staple: true });
    expect(get('Half')).toMatchObject({ frequency: 0.5, staple: false }); // 2 of 4
    expect(get('Once')).toBeUndefined(); // 1 of 4 = 0.25 -> dropped
  });

  it('exactly half of the sessions keeps an exercise as core but not staple', () => {
    const r = computePlaybook(
      [
        wk(week(0), [ex('Always', 0), ex('Half', 1)], 'Day'),
        wk(week(1), [ex('Always', 0), ex('Half', 1)], 'Day'),
        wk(week(2), [ex('Always', 0), ex('Once', 1)], 'Day'),
        wk(week(3), [ex('Always', 0)], 'Day'),
      ],
      NOW,
    );
    const p = only(r.plays);
    expect(p.exercises.map((e) => e.name)).toEqual(['Always', 'Half']);
    expect(p.exercises[1]).toMatchObject({ frequency: 0.5, staple: false });
  });

  it('a day yields a play only when some lift recurs in half of its sessions', () => {
    const r = computePlaybook(
      [wk(week(0), [ex('A', 0)], 'Day'), wk(week(1), [ex('B', 0)], 'Day')],
      NOW,
    );
    // each lift appears in 1 of 2 sessions = 0.5 -> core, so a play exists
    expect(
      only(r.plays)
        .exercises.map((e) => e.name)
        .sort(),
    ).toEqual(['A', 'B']);
    const three = computePlaybook(
      [
        wk(week(0), [ex('A', 0)], 'Day'),
        wk(week(1), [ex('B', 0)], 'Day'),
        wk(week(2), [ex('C', 0)], 'Day'),
      ],
      NOW,
    );
    expect(three.plays).toEqual([]);
  });

  it('the set count is the median working-set count (warm-ups excluded, minimum 1)', () => {
    const sets = (n: number, warm = 0): [number, number | null, boolean?][] => [
      ...Array.from({ length: warm }, () => [10, 20, true] as [number, number, boolean]),
      ...Array.from({ length: n }, () => [8, 60] as [number, number]),
    ];
    const r = computePlaybook(
      [
        wk(week(0), [ex('Lift', 0, { sets: sets(3, 2) })], 'Day'),
        wk(week(1), [ex('Lift', 0, { sets: sets(4) })], 'Day'),
        wk(week(2), [ex('Lift', 0, { sets: sets(6) })], 'Day'),
        wk(week(3), [ex('Lift', 0, { sets: sets(5, 1) })], 'Day'),
      ],
      NOW,
    );
    // working counts 3,4,5,6 -> median 4.5 -> rounds to 5
    expect(only(r.plays).exercises[0].sets).toBe(5);

    const warmOnly = computePlaybook(
      [
        wk(week(0), [ex('W', 0, { sets: [[10, 20, true]] })], 'Day'),
        wk(week(1), [ex('W', 0, { sets: [[10, 20, true]] })], 'Day'),
      ],
      NOW,
    );
    expect(only(warmOnly.plays).exercises[0]).toMatchObject({ sets: 1, repLow: 0, repHigh: 0 });
  });

  it('the rep range is the 25th-75th percentile of pooled working reps', () => {
    const r = computePlaybook(
      [
        wk(
          week(0),
          [
            ex('Lift', 0, {
              sets: [
                [5, 60],
                [6, 60],
              ],
            }),
          ],
          'Day',
        ),
        wk(
          week(1),
          [
            ex('Lift', 0, {
              sets: [
                [8, 60],
                [10, 60],
              ],
            }),
          ],
          'Day',
        ),
        wk(
          week(2),
          [
            ex('Lift', 0, {
              sets: [
                [12, 60],
                [15, 60, true],
              ],
            }),
          ],
          'Day',
        ), // warm-up ignored
      ],
      NOW,
    );
    // pooled [5,6,8,10,12]: p25 -> idx 1 = 6, p75 -> idx 3 = 10
    expect(only(r.plays).exercises[0]).toMatchObject({ repLow: 6, repHigh: 10 });
  });

  it('identical reps give a fixed target (low === high)', () => {
    const r = computePlaybook(
      [
        wk(
          week(0),
          [
            ex('Lift', 0, {
              sets: [
                [8, 60],
                [8, 60],
              ],
            }),
          ],
          'Day',
        ),
        wk(week(1), [ex('Lift', 0, { sets: [[8, 60]] })], 'Day'),
      ],
      NOW,
    );
    expect(only(r.plays).exercises[0]).toMatchObject({ repLow: 8, repHigh: 8 });
  });

  it('orders exercises by their typical position in the session', () => {
    const r = computePlaybook(
      [
        wk(week(0), [ex('Last', 5), ex('First', 0), ex('Middle', 2)], 'Day'),
        wk(week(1), [ex('Middle', 3), ex('First', 1), ex('Last', 4)], 'Day'),
      ],
      NOW,
    );
    expect(only(r.plays).exercises.map((e) => e.name)).toEqual(['First', 'Middle', 'Last']);
  });

  it('ignores cardio / non-strength and blank-named exercises', () => {
    const r = computePlaybook(
      [
        wk(week(0), [ex('Lift', 0), ex('Run', 1, { kind: 'cardio' }), ex('  ', 2)], 'Day'),
        wk(week(1), [ex('Lift', 0), ex('Run', 1, { kind: 'cardio' }), ex('  ', 2)], 'Day'),
      ],
      NOW,
    );
    expect(only(r.plays).exercises.map((e) => e.name)).toEqual(['Lift']);
  });

  it('trims exercise names when aggregating', () => {
    const r = computePlaybook(
      [wk(week(0), [ex(' Lift ', 0)], 'Day'), wk(week(1), [ex('Lift', 0)], 'Day')],
      NOW,
    );
    const p = only(r.plays);
    expect(p.exercises).toHaveLength(1);
    expect(p.exercises[0]).toMatchObject({ name: 'Lift', frequency: 1 });
  });

  it('the same lift twice in one session counts once toward frequency', () => {
    const r = computePlaybook(
      [wk(week(0), [ex('Lift', 0), ex('Lift', 1)], 'Day'), wk(week(1), [ex('Lift', 0)], 'Day')],
      NOW,
    );
    expect(only(r.plays).exercises[0].frequency).toBe(1);
  });
});

describe('representative top weight', () => {
  it('is the heaviest working set within 120 days; warm-ups and older sessions do not count', () => {
    const r = computePlaybook(
      [
        wk(NOW - 130 * DAY, [ex('Lift', 0, { sets: [[5, 150]] })], 'Day'),
        wk(
          NOW - 100 * DAY,
          [
            ex('Lift', 0, {
              sets: [
                [5, 80],
                [5, 300, true],
              ],
            }),
          ],
          'Day',
        ),
        wk(NOW - 10 * DAY, [ex('Lift', 0, { sets: [[5, 90]] })], 'Day'),
      ],
      NOW,
    );
    expect(only(r.plays).exercises[0].topWeight).toBe(90);
  });

  it('120 days old is inside the window, 120 days and a millisecond is outside', () => {
    const inside = computePlaybook(
      [
        wk(NOW - 120 * DAY, [ex('Lift', 0, { sets: [[5, 100]] })], 'Day'),
        wk(NOW - 130 * DAY, [ex('Lift', 0, { sets: [[5, 50]] })], 'Day'),
      ],
      NOW,
    );
    expect(only(inside.plays).exercises[0].topWeight).toBe(100);
    const outside = computePlaybook(
      [
        wk(NOW - 120 * DAY - 1, [ex('Lift', 0, { sets: [[5, 100]] })], 'Day'),
        wk(NOW - 130 * DAY, [ex('Lift', 0, { sets: [[5, 50]] })], 'Day'),
      ],
      NOW,
    );
    expect(only(outside.plays).exercises[0].topWeight).toBeNull();
  });

  it('is null for bodyweight / unloaded lifts', () => {
    const r = computePlaybook(
      [
        wk(NOW - 3 * DAY, [ex('Pull Up', 0, { sets: [[10, null]] })], 'Day'),
        wk(NOW - 2 * DAY, [ex('Pull Up', 0, { sets: [[12, 0]] })], 'Day'),
      ],
      NOW,
    );
    expect(only(r.plays).exercises[0].topWeight).toBeNull();
  });
});

describe('coverage (fractional set counting)', () => {
  it('primary sets count fully, secondary half; primaries sort first, then by sets', () => {
    const three = (): [number, number][] => [
      [8, 60],
      [8, 60],
      [8, 60],
    ];
    const day = (t: number) =>
      wk(
        t,
        [
          ex('Press', 0, { sets: three(), primary: 'chest', secondary: ['triceps', 'shoulders'] }),
          ex('Pushdown', 1, {
            sets: [
              [10, 30],
              [10, 30],
            ],
            primary: 'triceps',
          }),
        ],
        'Day',
      );
    const p = only(computePlaybook([day(MON), day(MON + 7 * DAY)], NOW).plays);
    expect(p.coverage).toEqual([
      { muscle: 'triceps', sets: 3.5, primary: true }, // 2 direct + 1.5 as synergist
      { muscle: 'chest', sets: 3, primary: true },
      { muscle: 'shoulders', sets: 1.5, primary: false },
    ]);
  });

  it('a muscle listed as its own secondary is not double counted', () => {
    const day = (t: number) =>
      wk(t, [ex('Press', 0, { primary: 'chest', secondary: ['chest'] })], 'Day');
    const p = only(computePlaybook([day(MON), day(MON + 7 * DAY)], NOW).plays);
    expect(p.coverage).toEqual([{ muscle: 'chest', sets: 1, primary: true }]);
  });
});

describe('play metadata', () => {
  const day = (t: number) => wk(t, [ex('Bench', 0)], 'Push');
  it('tracks weekday histogram, last trained and the most recent sample session', () => {
    const a = day(MON); // Monday
    const b = day(MON + 9 * DAY); // Wednesday
    const c = day(MON + 7 * DAY); // Monday
    const p = only(computePlaybook([a, b, c], NOW).plays);
    expect(p.weekdays).toEqual([0, 2, 0, 1, 0, 0, 0]);
    expect(p.lastTrainedAt).toBe(MON + 9 * DAY);
    expect(p.sampleWorkoutId).toBe(b.id);
    expect(p.sessions).toBe(3);
  });

  it('plays are listed most recently trained first', () => {
    const r = computePlaybook(
      [
        wk(MON, [ex('Bench', 0)], 'Push'),
        wk(MON + 7 * DAY, [ex('Bench', 0)], 'Push'),
        wk(MON + 1 * DAY, [ex('Squat', 0, { primary: 'quads' })], 'Legs'),
        wk(MON + 20 * DAY, [ex('Squat', 0, { primary: 'quads' })], 'Legs'),
      ],
      NOW,
    );
    expect(r.plays.map((p) => p.name)).toEqual(['Legs', 'Push']);
  });

  it('infers the day type from the dominant working-set volume of its sessions', () => {
    const push = (t: number) => wk(t, [ex('Bench', 0, { primary: 'chest' })], 'My Day');
    const legs = (t: number) => wk(t, [ex('Squat', 0, { primary: 'quads' })], 'Other Day');
    const r = computePlaybook(
      [push(MON), push(MON + 7 * DAY), legs(MON + DAY), legs(MON + 8 * DAY)],
      NOW,
    );
    expect(r.plays.find((p) => p.name === 'My Day')!.dayType).toBe('push');
    expect(r.plays.find((p) => p.name === 'Other Day')!.dayType).toBe('legs');
  });

  it('recent: newest first, one per day, at most six', () => {
    const days = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    const ws = days.map((d, i) => wk(MON + i * DAY, [ex('Bench', 0)], d));
    ws.push(wk(MON + 10 * DAY, [ex('Bench', 0)], 'A')); // newer duplicate of day A
    const r = computePlaybook(ws, NOW);
    expect(r.recent).toHaveLength(6);
    expect(r.recent[0].startedAt).toBe(MON + 10 * DAY);
    expect(r.recent.map((w) => w.dayName)).toEqual(['A', 'G', 'F', 'E', 'D', 'C']);
  });
});

describe('suggestions', () => {
  const chestOnly = (t: number, extra: Exercise[] = [], day = 'Push') =>
    wk(
      t,
      [
        ex('Bench', 0, {
          primary: 'chest',
          secondary: ['triceps'],
          sets: [
            [8, 100],
            [8, 100],
          ],
        }),
        ...extra,
      ],
      day,
    );

  it('gap: names the first muscle of the day type the play does not train directly', () => {
    const p = only(computePlaybook([chestOnly(MON), chestOnly(MON + 7 * DAY)], NOW).plays);
    expect(p.dayType).toBe('push');
    // triceps is only a synergist at 1 set (2 x 0.5 = 1) -> covered; shoulders is missing
    expect(p.suggestions).toContainEqual({ kind: 'add', reason: 'gap', muscle: 'shoulders' });
  });

  it('a synergist worth less than one set does not cover a muscle', () => {
    const half = (t: number) =>
      wk(
        t,
        [ex('Bench', 0, { primary: 'chest', secondary: ['shoulders'], sets: [[8, 100]] })],
        'Push',
      );
    const p = only(computePlaybook([half(MON), half(MON + 7 * DAY)], NOW).plays);
    // shoulders gets 0.5 sets -> still a gap
    expect(p.suggestions[0]).toEqual({ kind: 'add', reason: 'gap', muscle: 'shoulders' });
  });

  it('no gap is raised when every muscle of the day type is covered', () => {
    const full = (t: number) =>
      wk(
        t,
        [
          ex('Bench', 0, { primary: 'chest' }),
          ex('OHP', 1, { primary: 'shoulders' }),
          ex('Pushdown', 2, { primary: 'triceps' }),
        ],
        'Push',
      );
    const p = only(computePlaybook([full(MON), full(MON + 7 * DAY)], NOW).plays);
    expect(p.suggestions.filter((s) => s.kind === 'add' && s.reason === 'gap')).toEqual([]);
  });

  it('favourite: the most frequent outside lift of the day type (4+ sessions) is offered', () => {
    const fly = (t: number) => wk(t, [ex('Cable Fly', 0, { primary: 'chest' })], 'Fly Day');
    const flyBig = (t: number) => wk(t, [ex('Pec Deck', 0, { primary: 'chest' })], 'Deck Day');
    const ws = [
      chestOnly(MON),
      chestOnly(MON + 7 * DAY),
      ...[0, 1, 2, 3].map((i) => fly(MON + i * DAY + 2 * DAY)),
      ...[0, 1, 2, 3, 4].map((i) => flyBig(MON + i * DAY + 30 * DAY)),
    ];
    const push = computePlaybook(ws, NOW).plays.find((p) => p.name === 'Push')!;
    expect(push.suggestions).toContainEqual({
      kind: 'add',
      reason: 'favorite',
      exercise: 'Pec Deck',
      muscle: 'chest',
    });
  });

  it('favourite: needs four sessions, skips lifts already in the play and other day types', () => {
    const fly = (t: number) => wk(t, [ex('Cable Fly', 0, { primary: 'chest' })], 'Fly Day');
    const squat = (t: number) => wk(t, [ex('Squat', 0, { primary: 'quads' })], 'Leg Day');
    const ws = [
      chestOnly(MON),
      chestOnly(MON + 7 * DAY),
      ...[0, 1, 2].map((i) => fly(MON + i * DAY + 2 * DAY)), // only 3 + 0 in push play
      ...[0, 1, 2, 3, 4].map((i) => squat(MON + i * DAY + 20 * DAY)), // legs, not push
    ];
    const push = computePlaybook(ws, NOW).plays.find((p) => p.name === 'Push')!;
    expect(push.suggestions.some((s) => s.kind === 'add' && s.reason === 'favorite')).toBe(false);
    // 'Bench' is frequent but already in the play
    const withBench = [0, 1, 2, 3].map((i) => chestOnly(MON + i * 7 * DAY));
    const p2 = only(computePlaybook(withBench, NOW).plays);
    expect(p2.suggestions.some((s) => s.kind === 'add' && s.reason === 'favorite')).toBe(false);
  });

  it('plateau: a staple whose recent best does not beat its earlier best asks for a swap', () => {
    const lift = (daysAgo: number, kg: number) =>
      wk(NOW - daysAgo * DAY, [ex('Bench', 0, { sets: [[5, kg]] })], 'Push');
    const stuck = only(computePlaybook([lift(100, 100), lift(80, 100), lift(10, 100)], NOW).plays);
    expect(stuck.suggestions).toContainEqual({
      kind: 'swap',
      reason: 'plateau',
      exercise: 'Bench',
    });
    // recent 105 > prior 100 -> progress, no swap
    const up = only(computePlaybook([lift(100, 100), lift(80, 100), lift(10, 105)], NOW).plays);
    expect(up.suggestions.some((s) => s.kind === 'swap')).toBe(false);
  });

  it('plateau needs history in both bands (0-45 and 45-150 days)', () => {
    const lift = (daysAgo: number, kg: number) =>
      wk(NOW - daysAgo * DAY, [ex('Bench', 0, { sets: [[5, kg]] })], 'Push');
    const onlyRecent = only(computePlaybook([lift(5, 100), lift(10, 100)], NOW).plays);
    expect(onlyRecent.suggestions.some((s) => s.kind === 'swap')).toBe(false);
    const tooOld = only(
      computePlaybook([lift(160, 100), lift(155, 100), lift(10, 100)], NOW).plays,
    );
    // the two old sessions are > 150 days: no prior band -> no swap
    expect(tooOld.suggestions.some((s) => s.kind === 'swap')).toBe(false);
  });

  it('plateau ignores non-staple lifts', () => {
    const mk = (daysAgo: number, kg: number, withHalf: boolean) =>
      wk(
        NOW - daysAgo * DAY,
        [
          ex('Anchor', 0, { sets: [[5, 60]] }),
          ...(withHalf ? [ex('Half', 1, { sets: [[5, kg]] })] : []),
        ],
        'Push',
      );
    const p = only(
      computePlaybook(
        [mk(100, 100, true), mk(80, 100, false), mk(10, 100, true), mk(5, 60, false)],
        NOW,
      ).plays,
    );
    expect(p.exercises.find((e) => e.name === 'Half')).toMatchObject({ staple: false });
    expect(p.suggestions.some((s) => s.kind === 'swap' && s.exercise === 'Half')).toBe(false);
  });

  it('at most one plateau swap is raised, for the first stalled staple in play order', () => {
    const lift = (daysAgo: number) =>
      wk(
        NOW - daysAgo * DAY,
        [ex('First Lift', 0, { sets: [[5, 100]] }), ex('Second Lift', 1, { sets: [[5, 80]] })],
        'Push',
      );
    const p = only(computePlaybook([lift(100), lift(80), lift(10)], NOW).plays);
    expect(p.suggestions.filter((s) => s.kind === 'swap')).toEqual([
      { kind: 'swap', reason: 'plateau', exercise: 'First Lift' },
    ]);
  });
});

describe('playForWeekday', () => {
  const mk = (id: string, weekdays: number[], lastTrainedAt: number): Play =>
    ({ id, weekdays, lastTrainedAt }) as Play;

  it('returns the play with most sessions on that weekday', () => {
    const a = mk('a', [0, 2, 0, 0, 0, 0, 0], 100);
    const b = mk('b', [0, 3, 0, 0, 0, 0, 0], 50);
    expect(playForWeekday([a, b], 1)).toBe(b);
  });

  it('ties go to the more recently trained play', () => {
    const a = mk('a', [0, 2, 0, 0, 0, 0, 0], 100);
    const b = mk('b', [0, 2, 0, 0, 0, 0, 0], 200);
    expect(playForWeekday([a, b], 1)).toBe(b);
    expect(playForWeekday([b, a], 1)).toBe(b);
  });

  it('requires at least `min` sessions (default 2) on that weekday', () => {
    const a = mk('a', [0, 1, 0, 0, 0, 0, 0], 100);
    expect(playForWeekday([a], 1)).toBeNull();
    expect(playForWeekday([a], 1, 1)).toBe(a);
    expect(playForWeekday([a], 2)).toBeNull();
    expect(playForWeekday([], 1)).toBeNull();
  });

  it('works with plays computed from history', () => {
    const r = computePlaybook(
      [wk(MON, [ex('Bench', 0)], 'Push'), wk(MON + 7 * DAY, [ex('Bench', 0)], 'Push')],
      NOW,
    );
    expect(playForWeekday(r.plays, 1)?.name).toBe('Push');
    expect(playForWeekday(r.plays, 2)).toBeNull();
  });
});
