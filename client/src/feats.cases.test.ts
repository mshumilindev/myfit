import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CATEGORIES, computeFeats, featDesc, featLabel, fmtAchValue } from './feats';
import type { FeatGroup, FeatUnit, FeatsResult } from './feats';
import { LOCALES, setLocale } from './i18n';
import type { Exercise, SetEntry, Workout } from './types';

const HOUR = 3_600_000;
/** Local date-time (months 1-12). */
const L = (y: number, m: number, d: number, h = 12, min = 0): number =>
  new Date(y, m - 1, d, h, min).getTime();

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
function ex(name: string, sets: SetEntry[], kind: Exercise['kind'] = 'strength'): Exercise {
  return {
    id: `e${seq++}`,
    name,
    kind,
    position: 0,
    primaryMuscle: 'chest',
    secondaryMuscles: [],
    sets,
  } as Exercise;
}
function wk(
  startedAt: number,
  exercises: Exercise[] = [],
  durationMin: number | null = 60,
): Workout {
  return {
    id: `w${seq++}`,
    startedAt,
    finishedAt: durationMin === null ? null : startedAt + durationMin * 60_000,
    autoFinished: false,
    exercises,
  } as Workout;
}
const val = (r: FeatsResult, g: FeatGroup): number => r.byGroup[g][0].value;
const tier = (r: FeatsResult, g: FeatGroup, threshold: number) =>
  r.byGroup[g].find((a) => a.threshold === threshold)!;

/** The weekly-streak maths steps back in exact 7x24 h blocks, which only matches local week starts without DST. */
let tzBefore: string | undefined;
beforeAll(() => {
  tzBefore = process.env.TZ;
  process.env.TZ = 'UTC';
  setLocale('en');
});
afterAll(() => {
  if (tzBefore === undefined) delete process.env.TZ;
  else process.env.TZ = tzBefore;
});

describe('catalogue', () => {
  it('has the nineteen groups, each with strictly ascending tiers', () => {
    expect(CATEGORIES).toHaveLength(19);
    expect(new Set(CATEGORIES.map((c) => c.group)).size).toBe(19);
    for (const c of CATEGORIES) {
      const v = c.tiers.map((t) => t.value);
      expect([...v].sort((a, b) => a - b)).toEqual(v);
      expect(new Set(v).size).toBe(v.length);
      expect(v[0]).toBeGreaterThan(0);
    }
  });
});

describe('empty history', () => {
  const r = computeFeats([]);
  it('unlocks nothing and counts every tier', () => {
    expect(r.unlockedCount).toBe(0);
    expect(r.total).toBe(CATEGORIES.reduce((n, c) => n + c.tiers.length, 0));
    for (const c of CATEGORIES) {
      expect(r.byGroup[c.group]).toHaveLength(c.tiers.length);
      expect(
        r.byGroup[c.group].every(
          (a) => !a.unlocked && a.progress === 0 && a.unlockAt === undefined,
        ),
      ).toBe(true);
    }
  });
  it('the first tier of the first group is the "next up" tie-break winner', () => {
    expect(r.nextUp?.key).toBe('volume:30');
  });
});

describe('tiers and progress', () => {
  it('a tier unlocks at exactly its threshold and progress runs from the previous tier', () => {
    // 5 sessions unlocks "5 sessions"; tier "10 sessions" is 0% done, "15" etc untouched
    const r = computeFeats(Array.from({ length: 5 }, (_, i) => wk(L(2026, 3, 1 + i))));
    expect(val(r, 'sessions')).toBe(5);
    expect(tier(r, 'sessions', 5)).toMatchObject({
      unlocked: true,
      progress: 1,
      prev: 0,
      value: 5,
      key: 'sessions:5',
      unit: 'sessions',
    });
    expect(tier(r, 'sessions', 10)).toMatchObject({ unlocked: false, progress: 0, prev: 5 });
    const seven = computeFeats(Array.from({ length: 7 }, (_, i) => wk(L(2026, 3, 1 + i))));
    expect(tier(seven, 'sessions', 10).progress).toBeCloseTo(2 / 5, 10);
    const four = computeFeats(Array.from({ length: 4 }, (_, i) => wk(L(2026, 3, 1 + i))));
    expect(tier(four, 'sessions', 5)).toMatchObject({ unlocked: false });
    expect(tier(four, 'sessions', 5).progress).toBeCloseTo(4 / 5, 10);
  });

  it('counts unlocked tiers across all groups', () => {
    const r = computeFeats(Array.from({ length: 10 }, (_, i) => wk(L(2026, 3, 1 + i))));
    const manual = CATEGORIES.flatMap((c) => r.byGroup[c.group]).filter((a) => a.unlocked).length;
    expect(r.unlockedCount).toBe(manual);
    expect(r.unlockedCount).toBeGreaterThan(0);
  });

  it('nextUp is the locked tier closest (by progress) to being unlocked', () => {
    // 9 one-minute sessions on one day: "10 sessions" is 80% done; every other locked tier is further away
    const r = computeFeats(Array.from({ length: 9 }, (_, i) => wk(L(2026, 3, 2, 12, i), [], 1)));
    expect(r.nextUp?.key).toBe('sessions:10');
    expect(r.nextUp?.progress).toBeCloseTo(0.8, 10);
  });

  it('records the unlock moment as the finish of the session that crossed the threshold', () => {
    const ws = Array.from({ length: 5 }, (_, i) => wk(L(2026, 3, 1 + i, 9), [], 30));
    const r = computeFeats(ws);
    expect(tier(r, 'sessions', 5).unlockAt).toBe(L(2026, 3, 5, 9) + 30 * 60_000);
  });

  it('replays in chronological order whatever the input order, using start time for unfinished sessions', () => {
    const a = wk(L(2026, 3, 1), []);
    const b = wk(L(2026, 3, 2), []);
    const live = wk(L(2026, 3, 3), [], null);
    const shuffled = computeFeats([live, a, b, wk(L(2026, 3, 4)), wk(L(2026, 3, 5))]);
    expect(tier(shuffled, 'sessions', 5).unlockAt).toBe(L(2026, 3, 5) + HOUR);
    const withLive = computeFeats([a, b, live, wk(L(2026, 3, 4), []), wk(L(2026, 3, 5), [])]);
    expect(withLive.byGroup.sessions[0].unlocked).toBe(true);
  });

  it('a threshold crossed later keeps its own, later date', () => {
    const r = computeFeats(Array.from({ length: 10 }, (_, i) => wk(L(2026, 3, 1 + i))));
    expect(tier(r, 'sessions', 10).unlockAt).toBeGreaterThan(tier(r, 'sessions', 5).unlockAt!);
  });
});

describe('metrics', () => {
  it('volume = weight x reps over strength sets; bigDay = best single session', () => {
    const r = computeFeats([
      wk(L(2026, 3, 1), [ex('Bench', [set(10, 100)])]), // 1000
      wk(L(2026, 3, 2), [ex('Squat', [set(5, 200), set(5, 200)])]), // 2000
      wk(L(2026, 3, 3), [ex('Curl', [set(10, 20)])]), // 200
    ]);
    expect(val(r, 'volume')).toBe(3200);
    expect(val(r, 'bigDay')).toBe(2000);
    expect(tier(r, 'volume', 30).unlocked).toBe(true);
    expect(tier(r, 'bigDay', 1000).unlocked).toBe(true);
    expect(tier(r, 'bigDay', 2500).unlocked).toBe(false);
  });

  it('sets and reps count every set (warm-ups and drop parts included); cardio sets too', () => {
    const r = computeFeats([
      wk(L(2026, 3, 1), [
        ex('Bench', [
          set(10, 60),
          set(8, 60, { type: 'warmup', isWarmup: true }),
          set(6, 50, { type: 'drop', drops: [{ weight: 40, reps: 4 }] }),
        ]),
        ex('Run', [set(1, null)], 'cardio'),
      ]),
    ]);
    expect(val(r, 'sets')).toBe(4);
    expect(val(r, 'reps')).toBe(10 + 8 + 10 + 1);
  });

  it('hours = session time capped at six hours each; longest session capped at 360 minutes', () => {
    const r = computeFeats([
      wk(L(2026, 3, 1), [], 90),
      wk(L(2026, 3, 2), [], 600),
      wk(L(2026, 3, 3), [], 30),
    ]);
    expect(val(r, 'hours')).toBeCloseTo(1.5 + 6 + 0.5, 10);
    expect(val(r, 'longestSession')).toBe(360);
    expect(tier(r, 'longestSession', 240).unlocked).toBe(true);
    const short = computeFeats([wk(L(2026, 3, 1), [], 45)]);
    expect(val(short, 'longestSession')).toBe(45);
  });

  it('a session that ends before it starts adds no time', () => {
    const bad = { ...wk(L(2026, 3, 1)), finishedAt: L(2026, 3, 1) - HOUR } as Workout;
    const r = computeFeats([bad]);
    expect(val(r, 'hours')).toBe(0);
    expect(val(r, 'longestSession')).toBe(0);
  });

  it('heaviest set ignores warm-ups but counts drop weights; strength level uses the best e1RM', () => {
    const r = computeFeats([
      wk(L(2026, 3, 1), [
        ex('Squat', [
          set(3, 100),
          set(1, 300, { type: 'warmup', isWarmup: true }),
          set(2, 120, { type: 'drop', drops: [{ weight: 140, reps: 2 }] }),
        ]),
      ]),
    ]);
    expect(val(r, 'heaviestSet')).toBe(140);
    // e1RM: round(100 * 1.1) = 110 ; round(120*(1+2/30)) = 128 ; drop 140 x2 -> 149
    expect(val(r, 'strength')).toBe(149);
    expect(tier(r, 'strength', 140).unlocked).toBe(true);
    expect(tier(r, 'strength', 150).unlocked).toBe(false);
  });

  it('PRs: each new e1RM best on a lift counts, the very first does not, lifts are tracked separately', () => {
    const lift = (name: string, kg: number) => ex(name, [set(5, kg)]);
    const r = computeFeats([
      wk(L(2026, 3, 1), [lift('Bench', 100), lift('Squat', 140)]), // baselines
      wk(L(2026, 3, 3), [lift('Bench', 100)]), // equal: no
      wk(L(2026, 3, 5), [lift('Bench', 105), lift('Squat', 130)]), // bench PR, squat lower
      wk(L(2026, 3, 7), [lift('Squat', 150), lift('Bench', 110)]), // two PRs
    ]);
    expect(val(r, 'prs')).toBe(3);
    expect(tier(r, 'prs', 3).unlocked).toBe(true);
    expect(tier(r, 'prs', 5).unlocked).toBe(false);
  });

  it('PRs ignore reps above the e1RM ceiling, zero loads, warm-ups and non-strength entries', () => {
    const r = computeFeats([
      wk(L(2026, 3, 1), [ex('Bench', [set(5, 100)])]),
      wk(L(2026, 3, 2), [
        ex('Bench', [set(12, 200), set(5, 0), set(5, 300, { type: 'warmup', isWarmup: true })]),
        ex('Run', [set(5, 500)], 'cardio'),
      ]),
    ]);
    expect(val(r, 'prs')).toBe(0);
  });

  it('variety counts distinct strength exercise names, case and space insensitive', () => {
    const r = computeFeats([
      wk(L(2026, 3, 1), [
        ex('Bench', [set(5, 50)]),
        ex(' bench ', [set(5, 50)]),
        ex('BENCH', [set(5, 50)]),
        ex('Squat', [set(5, 50)]),
        ex('Run', [set(1, null)], 'cardio'),
      ]),
    ]);
    expect(val(r, 'variety')).toBe(2);
  });

  it('distance sums every set distance, strength or cardio, and tolerates missing values', () => {
    const r = computeFeats([
      wk(L(2026, 3, 1), [
        ex(
          'Run',
          [set(1, null, { distanceKm: 5 }), set(1, null, { distanceKm: 2.5 }), set(1, null)],
          'cardio',
        ),
        ex('Farmer carry', [set(1, 40, { distanceKm: 0.1 })]),
      ]),
    ]);
    expect(val(r, 'distance')).toBeCloseTo(7.6, 10);
    expect(tier(r, 'distance', 5).unlocked).toBe(true);
    expect(tier(r, 'distance', 10).unlocked).toBe(false);
  });

  it('months and training days count distinct calendar buckets', () => {
    const r = computeFeats([
      wk(L(2026, 1, 31, 8)),
      wk(L(2026, 1, 31, 20)),
      wk(L(2026, 2, 1)),
      wk(L(2027, 1, 5)), // same month number, different year
    ]);
    expect(val(r, 'months')).toBe(3);
    expect(val(r, 'trainingDays')).toBe(3);
    expect(val(r, 'sessions')).toBe(4);
  });
});

describe('time-of-day and weekday counters', () => {
  it('early bird is strictly before 07:00, night owl is 21:00 or later', () => {
    const r = computeFeats([
      wk(L(2026, 3, 2, 6, 59)), // early
      wk(L(2026, 3, 3, 7, 0)), // not early
      wk(L(2026, 3, 4, 20, 59)), // not night
      wk(L(2026, 3, 5, 21, 0)), // night
      wk(L(2026, 3, 6, 23, 30)), // night
      wk(L(2026, 3, 9, 0, 15)), // 00:15 counts as early
    ]);
    expect(val(r, 'earlyBird')).toBe(2);
    expect(val(r, 'nightOwl')).toBe(2);
  });

  it('weekend warrior counts Saturdays and Sundays only', () => {
    // 2026-03-06 Fri, 07 Sat, 08 Sun, 09 Mon
    const r = computeFeats([
      wk(L(2026, 3, 6)),
      wk(L(2026, 3, 7)),
      wk(L(2026, 3, 8)),
      wk(L(2026, 3, 9)),
    ]);
    expect(val(r, 'weekend')).toBe(2);
  });
});

describe('solid weeks and weekly streak', () => {
  // Weeks start on Monday: 2026-03-02 is a Monday
  it('a week becomes solid at its third session and is counted once', () => {
    const three = computeFeats([wk(L(2026, 3, 2)), wk(L(2026, 3, 3)), wk(L(2026, 3, 4))]);
    expect(val(three, 'perfectWeeks')).toBe(1);
    const five = computeFeats([2, 3, 4, 5, 6].map((d) => wk(L(2026, 3, d))));
    expect(val(five, 'perfectWeeks')).toBe(1);
    const two = computeFeats([wk(L(2026, 3, 2)), wk(L(2026, 3, 3))]);
    expect(val(two, 'perfectWeeks')).toBe(0);
    const split = computeFeats([wk(L(2026, 3, 1)), wk(L(2026, 3, 2)), wk(L(2026, 3, 3))]); // Sunday belongs to the previous week
    expect(val(split, 'perfectWeeks')).toBe(0);
    expect(tier(three, 'perfectWeeks', 1).unlocked).toBe(true);
  });

  it('streak is the longest run of consecutive trained weeks ever, in days', () => {
    const weekly = (n: number, skip: number[] = []) =>
      Array.from({ length: n }, (_, i) => i)
        .filter((i) => !skip.includes(i))
        .map((i) => wk(L(2026, 3, 2 + i * 7)));
    expect(val(computeFeats(weekly(1)), 'streak')).toBe(7);
    expect(val(computeFeats(weekly(4)), 'streak')).toBe(28);
    expect(val(computeFeats(weekly(5, [2])), 'streak')).toBe(14); // weeks 3,4 after the gap
    expect(val(computeFeats([]), 'streak')).toBe(0);
    expect(tier(computeFeats(weekly(2)), 'streak', 14).unlocked).toBe(true);
    expect(tier(computeFeats(weekly(2)), 'streak', 21).unlocked).toBe(false);
  });

  it('SPO-152: a shorter run after a longer one never lowers the streak, and a pause does not decay it', () => {
    const weekly = (weeks: number[]) => weeks.map((i) => wk(L(2026, 3, 2 + i * 7)));
    const r = computeFeats(weekly([0, 1, 2, 3, 6])); // 4 weeks, a gap, then 1 week
    expect(val(r, 'streak')).toBe(28);
    expect(tier(r, 'streak', 21).unlocked).toBe(true);
    // the same history plus a long pause (no new sessions) keeps the achievement
    expect(val(computeFeats(weekly([0, 1, 2, 3])), 'streak')).toBe(28);
    // a longer later run replaces the earlier best
    expect(val(computeFeats(weekly([0, 1, 4, 5, 6])), 'streak')).toBe(21);
  });

  it('several sessions in one week are still one week of streak', () => {
    const r = computeFeats([
      wk(L(2026, 3, 2)),
      wk(L(2026, 3, 3)),
      wk(L(2026, 3, 4)),
      wk(L(2026, 3, 9)),
    ]);
    expect(val(r, 'streak')).toBe(14);
  });
});

describe('titles', () => {
  it('volume tiers use the localized creature names, other groups the localized pattern', () => {
    const r = computeFeats([]);
    const f = LOCALES.en.feats;
    expect(tier(r, 'volume', 30).title).toBe(f.volumeTiers[0]);
    expect(tier(r, 'volume', 1_000_000_000).title).toBe('Jupiter');
    expect(tier(r, 'strength', 100).title).toBe('100 kg club');
    expect(tier(r, 'sessions', 5).title).toBe('5 sessions');
  });

  it('large thresholds are compacted: 1500 -> 1.5k, 20000 -> 20k, 1 000 000 -> 1M', () => {
    const r = computeFeats([]);
    expect(tier(r, 'sets', 1500).title).toBe('1.5k sets');
    expect(tier(r, 'sets', 20000).title).toBe('20k sets');
    expect(tier(r, 'reps', 1_000_000).title).toBe('1M reps');
    expect(tier(r, 'reps', 500).title).toBe('500 reps');
    expect(tier(r, 'bigDay', 2500).title).toBe('2.5k kg day');
    expect(tier(r, 'distance', 5).title).toBe('5 km');
    // groups outside the compact set print plain numbers
    expect(tier(r, 'trainingDays', 1000).title).toBe('1000 days');
  });

  it('follows the active locale', () => {
    setLocale('uk');
    try {
      const r = computeFeats([]);
      expect(tier(r, 'sessions', 5).title).toBe(LOCALES.uk.feats.tierTitle.sessions('5'));
      expect(tier(r, 'sessions', 5).title).not.toBe('5 sessions');
      expect(tier(r, 'volume', 30).title).toBe(LOCALES.uk.feats.volumeTiers[0]);
      expect(featLabel('volume')).toBe(LOCALES.uk.feats.labels.volume);
      expect(featDesc('volume')).toBe(LOCALES.uk.feats.descs.volume);
    } finally {
      setLocale('en');
    }
  });

  it('labels and descriptions come from the active dictionary', () => {
    expect(featLabel('earlyBird')).toBe('Sunrise lifter');
    expect(featDesc('weekend')).toBe('Sessions trained on a Saturday or Sunday.');
    for (const c of CATEGORIES) {
      expect(featLabel(c.group).length).toBeGreaterThan(0);
      expect(featDesc(c.group).length).toBeGreaterThan(0);
    }
  });
});

describe('fmtAchValue', () => {
  it.each<[FeatUnit, number, string]>([
    ['kg', 0, '0 kg'],
    ['kg', 999.4, '999 kg'],
    ['kg', 1000, '1.0 t'],
    ['kg', 12_345, '12.3 t'],
    ['kg', 99_999, '100.0 t'],
    ['kg', 100_000, '100 t'],
    ['kg', 1_234_567, '1235 t'],
    ['sessions', 7.6, '8'],
    ['days', 28, '28 d'],
    ['prs', 3.2, '3'],
    ['hours', 12.5, '13 h'],
    ['sets', 99.5, '100'],
    ['reps', 1234, '1234'],
    ['count', 4.4, '4'],
    ['months', 11.5, '12'],
    ['min', 59.6, '60 min'],
    ['km', 2.4, '2 km'],
  ])('%s %f -> %s', (unit, v, out) => {
    expect(fmtAchValue(unit, v)).toBe(out);
  });
});
