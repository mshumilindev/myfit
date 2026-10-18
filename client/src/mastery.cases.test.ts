import { describe, expect, it } from 'vitest';
import {
  AXIS_WEIGHT,
  MASTERY_RANKS,
  PATTERN_FACTOR,
  computeMastery,
  rankIndexForRating,
  sublevelRoman,
} from './mastery';
import type { MasteryResult } from './mastery';
import type { BodyMetrics, Exercise, SetEntry, SleepNight, Workout } from './types';

const DAY = 24 * 3600 * 1000;
const NOW = Date.UTC(2026, 9, 15, 12);
const WINDOW_START = NOW - 56 * DAY;

type SetOpts = Partial<SetEntry> & { at?: number };
function mkSet(i: number, o: SetOpts = {}): SetEntry {
  const { at, ...rest } = o;
  return {
    id: `s${i}`,
    position: i,
    reps: 8,
    weight: 60,
    isWarmup: false,
    type: 'working',
    loggedAt: at,
    ...rest,
  } as SetEntry;
}

interface ExOpts {
  kind?: Exercise['kind'];
  primary?: string;
  secondary?: string[];
  sets?: SetEntry[];
  n?: number;
  markerAt?: number;
}
let exSeq = 0;
/** Ad-hoc (non-catalog) exercise: muscles come from the stored fields. */
function mkEx(name: string, o: ExOpts = {}): Exercise {
  return {
    id: `e${exSeq++}`,
    name,
    kind: o.kind,
    position: 0,
    primaryMuscle: o.primary ?? null,
    secondaryMuscles: o.secondary ?? [],
    markerAt: o.markerAt,
    sets: o.sets ?? Array.from({ length: o.n ?? 3 }, (_, i) => mkSet(i)),
  } as Exercise;
}

let wSeq = 0;
function mkW(startedAt: number, exercises: Exercise[] = [], finished = true): Workout {
  return {
    id: `w${wSeq++}`,
    startedAt,
    finishedAt: finished ? startedAt + 3600_000 : null,
    autoFinished: false,
    exercises,
  } as Workout;
}

/** `n` sessions spread evenly through the 8-week window, oldest first. */
function spread(n: number, make: (i: number) => Exercise[] = () => []): Workout[] {
  return Array.from({ length: n }, (_, i) =>
    mkW(WINDOW_START + ((i + 0.5) * (56 * DAY - 3600_000)) / n, make(i)),
  );
}

const noBody: BodyMetrics = { weights: [] } as unknown as BodyMetrics;
const male = (kg = 80): BodyMetrics =>
  ({ sex: 'male', weights: [{ id: 'b', at: NOW - DAY, weight: kg }] }) as unknown as BodyMetrics;
const female = (kg = 60): BodyMetrics =>
  ({ sex: 'female', weights: [{ id: 'b', at: NOW - DAY, weight: kg }] }) as unknown as BodyMetrics;

const calc = (
  workouts: Workout[],
  bodyMetrics: BodyMetrics = noBody,
  opts?: Parameters<typeof computeMastery>[2],
  extra: { sleeps?: SleepNight[]; goalMin?: number } = {},
): MasteryResult =>
  computeMastery(
    {
      workouts,
      bodyMetrics,
      sleeps: extra.sleeps,
      sleepSettings: extra.goalMin ? ({ goalMin: extra.goalMin } as never) : undefined,
    },
    NOW,
    opts,
  );
const sig = (r: MasteryResult, key: string) => r.practice.find((s) => s.key === key)!;

describe('constants', () => {
  it('axis weights sum to 1', () => {
    expect(Object.values(AXIS_WEIGHT).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
  });
  it('self-reported tenure is discounted by pattern', () => {
    expect(PATTERN_FACTOR).toEqual({ continuous: 1, occasional: 0.7, frequent: 0.5 });
  });
});

describe('rankIndexForRating', () => {
  it('maps every threshold edge to its own rank and the value just below to the previous', () => {
    MASTERY_RANKS.forEach((r, i) => {
      expect(rankIndexForRating(r.threshold)).toBe(i);
      if (i > 0) expect(rankIndexForRating(r.threshold - 1)).toBe(i - 1);
    });
  });
  it('clamps below zero to foundation and above 1000 to world class', () => {
    expect(rankIndexForRating(-50)).toBe(0);
    expect(rankIndexForRating(5000)).toBe(8);
  });
});

describe('sublevelRoman', () => {
  it('maps 1-3 and treats anything else as I', () => {
    expect([1, 2, 3].map(sublevelRoman)).toEqual(['I', 'II', 'III']);
    expect(sublevelRoman(0)).toBe('I');
    expect(sublevelRoman(4)).toBe('I');
  });
});

describe('empty history (exact baseline)', () => {
  const r = calc([]);

  it('rates 18/1000: only the neutral coverage floor (8) and rest default (50) score', () => {
    // practice = round((8 + 50) / 9) = 6 ; rating = round(0.3 * 6 * 10) = 18
    expect(r.axes.practice.score).toBe(6);
    expect(r.rating).toBe(18);
  });

  it('is foundation I with progress and distances derived from the 0-120 band', () => {
    expect(r.rank.id).toBe('foundation');
    expect(r.rankIndex).toBe(0);
    expect(r.sublevel).toBe(1);
    expect(r.rankProgress).toBeCloseTo(18 / 120, 10);
    expect(r.toNextSublevel).toBe(22); // boundary 40
    expect(r.toNextRank).toBe(102);
    expect(r.nextRank?.id).toBe('novice');
  });

  it('is calibrating with zero confidence and 16 sessions to firm', () => {
    expect(r).toMatchObject({
      calibrating: true,
      confidence: 'low',
      confidenceFrac: 0,
      sessions: 0,
      sessionsToFirm: 16,
    });
  });

  it('axes report their empty facts', () => {
    expect(r.axes.strength).toEqual({ key: 'strength', score: 0, facts: { known: false } });
    expect(r.axes.consistency.facts).toEqual({ perWeek: 0, activeWeeks: 0, streakDays: 0 });
    expect(r.axes.experience.facts).toEqual({
      years: 0,
      rawYears: 0,
      selfReported: false,
      pattern: null,
    });
  });

  it('lists all nine practice signals in a fixed order', () => {
    expect(r.practice.map((s) => s.key)).toEqual([
      'coverage',
      'progression',
      'volume',
      'warmup',
      'cooldown',
      'rest',
      'recovery',
      'cardio',
      'structure',
    ]);
    expect(sig(r, 'coverage').score).toBe(8);
    expect(sig(r, 'rest')).toMatchObject({ score: 50, status: 'watch' });
    expect(sig(r, 'warmup').status).toBe('low');
  });

  it('shortfalls: top six by weighted gap, impact bands 2 high / 2 med / 2 low', () => {
    expect(r.shortfalls.map((s) => [s.key, s.impact])).toEqual([
      ['sig-progression', 'high'],
      ['sig-volume', 'high'],
      ['sig-warmup', 'med'],
      ['sig-cooldown', 'med'],
      ['sig-recovery', 'low'],
      ['sig-cardio', 'low'],
    ]);
    expect(r.shortfalls[0]).toMatchObject({ axis: 'practice', signal: 'progression' });
  });
});

describe('sessions, confidence and calibration', () => {
  it('ignores unfinished sessions entirely', () => {
    const r = calc([...spread(3), mkW(NOW - DAY, [], false)]);
    expect(r.sessions).toBe(3);
  });

  it('is calibrating below 8 sessions even when the sex is known', () => {
    const r = calc(spread(7), male());
    expect(r.calibrating).toBe(true);
    expect(r.confidence).toBe('low');
  });

  it('with known sex, 8 sessions end calibration at medium confidence', () => {
    const r = calc(spread(8), male());
    expect(r.calibrating).toBe(false);
    expect(r.confidence).toBe('med');
    expect(r.sessionsToFirm).toBe(8);
    expect(r.confidenceFrac).toBe(0.5);
  });

  it('without a known sex it stays calibrating until 16 sessions', () => {
    expect(calc(spread(15)).calibrating).toBe(true);
    const r16 = calc(spread(16));
    expect(r16.calibrating).toBe(false);
    expect(r16.confidence).toBe('high');
    expect(r16.sessionsToFirm).toBe(0);
  });

  it('confidence fraction saturates at 1 and sessionsToFirm never goes negative', () => {
    const r = calc(spread(20), male());
    expect(r.confidenceFrac).toBe(1);
    expect(r.sessionsToFirm).toBe(0);
  });
});

describe('strength axis', () => {
  const press = (kg: number, reps = 3) => [
    mkEx('Overhead Press', {
      primary: 'shoulders',
      sets: [mkSet(0, { weight: kg, reps })],
    }),
  ];

  it('is unknown without a sex, or with no bodyweight on file', () => {
    expect(calc([mkW(NOW - DAY, press(80))], noBody).axes.strength.facts).toEqual({ known: false });
    const noWeight = { sex: 'male', weights: [] } as unknown as BodyMetrics;
    expect(calc([mkW(NOW - DAY, press(80))], noWeight).axes.strength.score).toBe(0);
    expect(calc([mkW(NOW - DAY, press(80))], noWeight).axes.strength.facts).toEqual({
      known: false,
    });
  });

  it('is known-but-untrained when no strength-level lift was logged', () => {
    const r = calc([mkW(NOW - DAY, [mkEx('Barbell Full Squat', { primary: 'quads' })])], male());
    // squat is a sport-classification lift, not a "level" lift: it does not feed this axis
    expect(r.axes.strength).toEqual({
      key: 'strength',
      score: 0,
      facts: { known: true, trained: 0 },
    });
  });

  it('scores a level lift as tier index + progress inside the band, out of 5 tiers', () => {
    // 80 kg man OHP tiers 32.5/47.5/62.5/80/97.5 ; 80 x3 -> e1RM 88 -> adv (idx 3), progress 8/17.5
    const r = calc([mkW(NOW - DAY, press(80))], male(80));
    expect(r.axes.strength.score).toBe(Math.round(((3 + 8 / 17.5) / 5) * 100));
    expect(r.axes.strength.facts).toEqual({
      known: true,
      trained: 1,
      topLift: 'Overhead press',
      topLevel: 'adv',
    });
  });

  it('a lift below the first tier scores 0 but still counts as trained', () => {
    const r = calc([mkW(NOW - DAY, press(10))], male(80));
    expect(r.axes.strength.score).toBe(0);
    expect(r.axes.strength.facts).toMatchObject({ trained: 1, topLevel: 'beg' });
  });

  it('a lift at the top tier scores 100', () => {
    const r = calc([mkW(NOW - DAY, press(120))], male(80));
    expect(r.axes.strength.score).toBe(100);
    expect(r.axes.strength.facts).toMatchObject({ topLevel: 'eli' });
  });

  it('averages over trained level lifts and names the strongest', () => {
    const rows = mkEx('Barbell Row', { primary: 'lats', sets: [mkSet(0, { weight: 10 })] });
    const r = calc([mkW(NOW - DAY, [...press(120), rows])], male(80));
    expect(r.axes.strength.score).toBe(50); // (100 + 0) / 2
    expect(r.axes.strength.facts).toMatchObject({ trained: 2, topLift: 'Overhead press' });
  });

  it('the same lift scores higher for a lighter body and for female standards', () => {
    const w = [mkW(NOW - DAY, press(60))];
    const heavy = calc(w, male(100)).axes.strength.score;
    const light = calc(w, male(70)).axes.strength.score;
    const woman = calc(w, female(70)).axes.strength.score;
    expect(light).toBeGreaterThan(heavy);
    expect(woman).toBeGreaterThan(light);
  });
});

describe('consistency axis', () => {
  it('rewards a steady rate and unbroken weeks (streak adds nothing without store history)', () => {
    // 16 sessions: 2/wk, present in every one of the 8 weeks -> 0.5*0.5 + 0.3*1 = 0.55
    const r = calc(spread(16));
    expect(r.axes.consistency.score).toBe(55);
    expect(r.axes.consistency.facts).toMatchObject({ perWeek: 2, activeWeeks: 8 });
  });

  it('4 sessions a week saturates the rate component', () => {
    const r = calc(spread(32));
    expect(r.axes.consistency.score).toBe(80); // 0.5 + 0.3
    const more = calc(spread(64));
    expect(more.axes.consistency.score).toBe(80);
  });

  it('counts distinct weeks, not sessions: eight sessions in one day = one active week', () => {
    const day = Array.from({ length: 8 }, (_, i) => mkW(NOW - DAY - i * 3600_000 * 2));
    const r = calc(day);
    expect(r.axes.consistency.facts).toMatchObject({ perWeek: 1, activeWeeks: 1 });
    expect(r.axes.consistency.score).toBe(Math.round((0.5 * 0.25 + 0.3 * (1 / 8)) * 100));
  });

  it('ignores sessions that finished before the 8-week window (boundary is inclusive)', () => {
    const justIn = mkW(WINDOW_START - 3600_000); // finishedAt === windowStart
    const justOut = mkW(WINDOW_START - 3600_000 - 1);
    expect(calc([justIn]).axes.consistency.facts).toMatchObject({ perWeek: 0.1, activeWeeks: 1 });
    expect(calc([justOut]).axes.consistency.facts).toMatchObject({ perWeek: 0, activeWeeks: 0 });
  });
});

describe('experience axis', () => {
  const w = [mkW(NOW - DAY)];

  it('uses the self-reported start year; 10 effective years saturates', () => {
    const r = calc(w, noBody, { trainingSinceYear: 2016 });
    expect(r.axes.experience.score).toBe(100);
    expect(r.axes.experience.facts).toEqual({
      years: 10,
      rawYears: 10,
      selfReported: true,
      pattern: 'continuous',
    });
    expect(calc(w, noBody, { trainingSinceYear: 2000 }).axes.experience.score).toBe(100);
  });

  it('discounts self-reported tenure for broken training patterns', () => {
    const occ = calc(w, noBody, { trainingSinceYear: 2016, trainingPattern: 'occasional' });
    expect(occ.axes.experience.score).toBe(70);
    expect(occ.axes.experience.facts).toMatchObject({
      years: 7,
      rawYears: 10,
      pattern: 'occasional',
    });
    const freq = calc(w, noBody, { trainingSinceYear: 2016, trainingPattern: 'frequent' });
    expect(freq.axes.experience.score).toBe(50);
    expect(freq.axes.experience.facts).toMatchObject({ years: 5, pattern: 'frequent' });
  });

  it('a start year in the current year is valid and worth zero years', () => {
    const r = calc(w, noBody, { trainingSinceYear: 2026 });
    expect(r.axes.experience.facts).toMatchObject({ selfReported: true, years: 0 });
  });

  it('rejects implausible start years and measures from the first logged session instead', () => {
    const old = mkW(NOW - 3 * 365 * DAY);
    for (const year of [1950, 1900, 2027, 0, null, undefined]) {
      const r = calc([old], noBody, { trainingSinceYear: year, trainingPattern: 'frequent' });
      expect(r.axes.experience.facts).toEqual({
        years: 3,
        rawYears: 3,
        selfReported: false,
        pattern: null,
      });
      expect(r.axes.experience.score).toBe(30);
    }
  });

  it('measured history is not discounted by the pattern and uses the earliest session', () => {
    const r = calc([mkW(NOW - 365 * DAY), mkW(NOW - 5 * 365 * DAY), mkW(NOW - DAY)]);
    expect(r.axes.experience.facts).toMatchObject({ rawYears: 5, years: 5 });
    expect(r.axes.experience.score).toBe(50);
  });

  it('1951 is accepted (just above the 1950 floor)', () => {
    const r = calc(w, noBody, { trainingSinceYear: 1951 });
    expect(r.axes.experience.facts).toMatchObject({ selfReported: true, rawYears: 75 });
    expect(r.axes.experience.score).toBe(100);
  });
});

describe('practice: coverage & balance', () => {
  it('one muscle only: 7 points, 100% push share, nine majors skipped', () => {
    const r = calc([mkW(NOW - DAY, [mkEx('Move', { primary: 'chest', n: 10 })])]);
    const c = sig(r, 'coverage');
    expect(c.score).toBe(7); // 0.7 * 1/10 + 0.3 * (1 - 1)
    expect(c.facts).toMatchObject({ pushShare: 100, pullShare: 0, legShare: 0 });
    expect((c.facts.skipped as string[]).length).toBe(9);
    expect(c.facts.skipped).not.toContain('chest');
    expect(c.status).toBe('low');
  });

  it('all ten major groups, equal weekly work -> 95 with 33/22/44 split', () => {
    const groups = [
      'chest',
      'back',
      'quads',
      'hamstrings',
      'glutes',
      'shoulders',
      'biceps',
      'triceps',
      'core',
      'calves',
    ];
    const r = calc([
      mkW(
        NOW - DAY,
        groups.map((g) => mkEx(`Move ${g}`, { primary: g, n: 8 })),
      ),
    ]);
    const c = sig(r, 'coverage');
    expect(c.facts.skipped).toEqual([]);
    expect(c.facts).toMatchObject({ pushShare: 33, pullShare: 22, legShare: 44 });
    expect(c.score).toBe(95); // 0.7 + 0.3 * (1 - 1/6)
    expect(c.status).toBe('good');
  });

  it('only counts the 8-week window', () => {
    const r = calc([mkW(WINDOW_START - 2 * 3600_000, [mkEx('Move', { primary: 'chest', n: 10 })])]);
    expect(sig(r, 'coverage').facts.skipped).toHaveLength(10);
  });
});

describe('practice: volume in range', () => {
  const sets = (primary: string, n: number) => mkEx(`Move ${primary}`, { primary, n });

  it('scores the share of trained major groups inside 6-22 weekly sets (inclusive edges)', () => {
    const r = calc([
      mkW(NOW - DAY, [
        sets('chest', 100), // 12.5/wk in range
        sets('quads', 8), // 1/wk below MEV
        sets('biceps', 200), // 25/wk above MRV
        sets('core', 48), // exactly 6/wk -> in range
        sets('calves', 176), // exactly 22/wk -> in range
        sets('lats', 400), // fine group outside the major list: ignored
      ]),
    ]);
    const v = sig(r, 'volume');
    expect(v.score).toBe(60);
    expect(v.facts).toEqual({ belowMEV: ['quads'], aboveMRV: ['biceps'], inRange: 3 });
  });

  it('just under MEV and just over MRV fall out of range', () => {
    const r = calc([mkW(NOW - DAY, [sets('chest', 47), sets('triceps', 177)])]);
    const v = sig(r, 'volume');
    expect(v.score).toBe(0);
    expect(v.facts).toMatchObject({ belowMEV: ['chest'], aboveMRV: ['triceps'], inRange: 0 });
  });

  it('is 0 when nothing major was trained', () => {
    expect(sig(calc([mkW(NOW - DAY, [sets('lats', 100)])]), 'volume').score).toBe(0);
  });
});

describe('practice: warm-up discipline', () => {
  it('measures the share of working lifts that had a warm-up set', () => {
    const warmed = mkEx('Lift A', {
      sets: [mkSet(0, { type: 'warmup' }), mkSet(1), mkSet(2)],
    });
    const bare = mkEx('Lift B', { sets: [mkSet(0), mkSet(1)] });
    const flagged = mkEx('Lift C', {
      sets: [mkSet(0, { type: undefined, isWarmup: true }), mkSet(1, { type: undefined })],
    });
    const warmOnly = mkEx('Lift D', { sets: [mkSet(0, { type: 'warmup' })] }); // no working set
    const cardio = mkEx('Run', { kind: 'cardio', sets: [mkSet(0)] });
    const r = calc([mkW(NOW - DAY, [warmed, bare, flagged, warmOnly, cardio])]);
    // 3 working lifts (A, B, C), 2 warmed (A, C via isWarmup) -> 67
    expect(sig(r, 'warmup')).toMatchObject({ score: 67, status: 'good' });
  });

  it('is 0 with no working lifts', () => {
    expect(sig(calc([mkW(NOW - DAY)]), 'warmup').score).toBe(0);
  });
});

describe('practice: cooldown and cardio', () => {
  it('cooldown = share of sessions that include a cooldown block', () => {
    const cd = mkEx('Stretch', { kind: 'cooldown', sets: [] });
    const r = calc([mkW(NOW - 3 * DAY, [cd]), mkW(NOW - 2 * DAY), mkW(NOW - DAY)]);
    expect(sig(r, 'cooldown')).toMatchObject({ score: 33, facts: { sessions: 1 } });
  });

  it('cardio: one session per fortnight (4 in 8 weeks) saturates', () => {
    const run = () => [mkEx('Run', { kind: 'cardio', sets: [] })];
    const two = calc([mkW(NOW - 2 * DAY, run()), mkW(NOW - DAY, run())]);
    expect(sig(two, 'cardio')).toMatchObject({ score: 50, facts: { sessions: 2 } });
    const five = calc(spread(5, run));
    expect(sig(five, 'cardio').score).toBe(100);
  });
});

describe('practice: rest between sets', () => {
  const T = NOW - 2 * DAY;
  // 8 reps -> 30 s of work is netted out of each gap
  const paced = (gaps: number[]) => {
    let t = T;
    return gaps.map((g, i) => {
      t += g * 1000;
      return mkSet(i, { at: t });
    });
  };

  it('classes rest as ok (45-240 s), short (<45) or long, from the logged timestamps', () => {
    // first set has no predecessor; gaps 100 (rest 70 ok), 70 (40 short), 400 (370 long), 275 (245 long)
    const sets = [mkSet(9, { at: T }), ...paced([100, 70, 400, 275])];
    const r = calc([mkW(T, [mkEx('Lift', { sets })])]);
    expect(sig(r, 'rest')).toMatchObject({ score: 25, facts: { pctOk: 25, shortish: 1 } });
  });

  it('edges: exactly 45 s and exactly 240 s rest are ok', () => {
    const sets = [mkSet(9, { at: T }), ...paced([75, 270])]; // rests 45 and 240
    const r = calc([mkW(T, [mkEx('Lift', { sets })])]);
    expect(sig(r, 'rest').score).toBe(100);
    const sets2 = [mkSet(9, { at: T }), ...paced([74, 271])]; // 44 and 241
    expect(sig(calc([mkW(T, [mkEx('Lift', { sets: sets2 })])]), 'rest').score).toBe(0);
  });

  it('carries across exercise cards (rest is measured between consecutive logged sets)', () => {
    const a = mkEx('Lift A', { sets: [mkSet(0, { at: T })] });
    const b = mkEx('Lift B', { sets: [mkSet(0, { at: T + 100_000 })] });
    expect(sig(calc([mkW(T, [a, b])]), 'rest').score).toBe(100);
  });

  it('a cool-down started in the gap means the gap is not rest', () => {
    const a = mkEx('Lift A', { sets: [mkSet(0, { at: T }), mkSet(1, { at: T + 100_000 })] });
    const cd = mkEx('Cooldown', { kind: 'cooldown', sets: [], markerAt: T + 50_000 });
    expect(sig(calc([mkW(T, [a, cd])]), 'rest').score).toBe(50); // no pairs -> neutral default
  });

  it('is a neutral 50 without timestamps, and ignores gaps of 3 h or more', () => {
    expect(sig(calc([mkW(T, [mkEx('Lift')])]), 'rest').score).toBe(50);
    const far = mkEx('Lift', { sets: [mkSet(0, { at: T }), mkSet(1, { at: T + 3 * 3600_000 })] });
    expect(sig(calc([mkW(T, [far])]), 'rest').score).toBe(50);
  });
});

describe('practice: recovery cadence', () => {
  it.each([
    [0, 0],
    [12, 50], // 1.5/wk -> 0.5
    [24, 100], // 3/wk
    [40, 100], // 5/wk: top of the sweet spot
    [48, 67], // 6/wk: one over -> 1 - 1/3
    [56, 33], // 7/wk
    [64, 0], // 8/wk: grind
    [96, 0], // beyond: clamped
  ])('%i sessions in 8 weeks -> recovery %i', (n, expected) => {
    expect(sig(calc(spread(n)), 'recovery').score).toBe(expected);
  });

  const nights = (count: number, hours: number, bedMsAgo = DAY): SleepNight[] =>
    Array.from({ length: count }, (_, i) => {
      const bedtime = NOW - bedMsAgo - i * DAY;
      return {
        id: `n${i}`,
        date: `d${i}`,
        bedtime,
        wake: bedtime + hours * 3600_000,
        source: 'backfill',
        kind: 'sleep',
      } as SleepNight;
    });

  it('blends in sleep once three nights exist: short sleep drags a perfect cadence down', () => {
    const w = spread(24); // cadence 1.0
    const none = calc(w);
    expect(sig(none, 'recovery').facts).toEqual({ perWeek: 3, sleepAvgMin: null });
    // 6 h vs the 8 h goal: duration .75, identical bedtimes -> consistency 1
    const r = calc(w, noBody, undefined, { sleeps: nights(10, 6) });
    expect(sig(r, 'recovery').facts).toEqual({ perWeek: 3, sleepAvgMin: 360 });
    expect(sig(r, 'recovery').score).toBe(93); // 0.55 + 0.45 * (0.6*0.75 + 0.4)
  });

  it('full-goal sleep keeps recovery at 100; the goal comes from sleep settings', () => {
    const w = spread(24);
    expect(sig(calc(w, noBody, undefined, { sleeps: nights(10, 8) }), 'recovery').score).toBe(100);
    // 6 h nights meet a 6 h goal
    const ok = calc(w, noBody, undefined, { sleeps: nights(10, 6), goalMin: 360 });
    expect(sig(ok, 'recovery').score).toBe(100);
  });

  it('two logged nights are not enough to move the score', () => {
    const r = calc(spread(24), noBody, undefined, { sleeps: nights(2, 4) });
    expect(sig(r, 'recovery')).toMatchObject({ score: 100, facts: { sleepAvgMin: null } });
  });

  it('naps, unfinished nights and nights outside the window do not count', () => {
    const naps = nights(5, 1).map((n) => ({ ...n, kind: 'nap' as const }));
    const live = nights(5, 8).map((n) => ({ ...n, wake: null }));
    const old = nights(5, 4, 60 * DAY);
    const r = calc(spread(24), noBody, undefined, { sleeps: [...naps, ...live, ...old] });
    expect(sig(r, 'recovery').score).toBe(100);
  });
});

describe('practice: session structure', () => {
  const compound = { secondary: ['a', 'b'] };
  const iso = { secondary: ['a'] };

  it('compound-first and sane working-set counts each earn half; both earn a full point', () => {
    const good = mkW(NOW - 5 * DAY, [mkEx('Squat', { primary: 'quads', ...compound, n: 4 })]);
    const sane = mkW(NOW - 4 * DAY, [mkEx('Curl', { primary: 'biceps', ...iso, n: 3 })]);
    const heavy = mkW(NOW - 3 * DAY, [
      mkEx('Squat', { primary: 'quads', ...compound, n: 4 }),
      mkEx('Volume Day', { primary: 'chest', ...iso, n: 7 }),
    ]);
    const bad = mkW(NOW - 2 * DAY, [mkEx('Curl', { primary: 'biceps', ...iso, n: 7 })]);
    const r = calc([good, sane, heavy, bad]);
    expect(sig(r, 'structure').score).toBe(50); // (1 + .5 + .5 + 0) / 4
  });

  it('6 working sets is still sane; 0 working sets (warm-up only) is not', () => {
    const six = mkW(NOW - DAY, [mkEx('Squat', { primary: 'quads', ...compound, n: 6 })]);
    expect(sig(calc([six]), 'structure').score).toBe(100);
    const warmOnly = mkW(NOW - DAY, [
      mkEx('Squat', { primary: 'quads', ...compound, sets: [mkSet(0, { type: 'warmup' })] }),
    ]);
    expect(sig(calc([warmOnly]), 'structure').score).toBe(50);
  });

  it('sessions without strength sets do not count against it', () => {
    const cardioOnly = mkW(NOW - 2 * DAY, [mkEx('Run', { kind: 'cardio' })]);
    const empty = mkW(NOW - 3 * DAY, [mkEx('Squat', { primary: 'quads', ...compound, sets: [] })]);
    const good = mkW(NOW - DAY, [mkEx('Squat', { primary: 'quads', ...compound, n: 4 })]);
    expect(sig(calc([cardioOnly, empty, good]), 'structure').score).toBe(100);
    expect(sig(calc([cardioOnly]), 'structure').score).toBe(0);
  });
});

describe('practice: load progression', () => {
  /** One exercise per session, oldest first; `tops` = [weight, reps] per session. */
  const history = (name: string, tops: [number, number][]) =>
    tops.map(([weight, reps], i) =>
      mkW(NOW - (tops.length - i) * 3 * DAY, [
        mkEx(name, { primary: 'chest', sets: [mkSet(0, { weight, reps })] }),
      ]),
    );

  it('a lift that hit the top of the rep range is "climbing"; a stalled one is "flat"', () => {
    const w = [
      ...history('Climber', [
        [60, 8],
        [60, 10],
      ]),
      ...history('Plateau', [
        [100, 6],
        [100, 6],
        [100, 6],
      ]),
    ];
    const p = sig(calc(w), 'progression');
    expect(p.facts).toEqual({ climbing: ['Climber'], flat: ['Plateau'] });
    expect(p.score).toBe(50);
  });

  it('chasing reps at the same weight ("hold") counts as flat', () => {
    const p = sig(
      calc(
        history('Held', [
          [60, 6],
          [60, 7],
        ]),
      ),
      'progression',
    );
    expect(p.facts).toEqual({ climbing: [], flat: ['Held'] });
    expect(p.score).toBe(0);
  });

  it('needs at least two sessions of a lift to judge it', () => {
    const p = sig(calc(history('Once', [[60, 10]])), 'progression');
    expect(p.facts).toEqual({ climbing: [], flat: [] });
    expect(p.score).toBe(0);
  });

  it('only the six most-trained lifts are judged', () => {
    const w: Workout[] = [];
    for (let k = 0; k < 7; k++) {
      // lift k appears (k + 2) times so the least-trained one (k = 0) drops out
      w.push(
        ...history(
          `Lift ${k}`,
          Array.from({ length: k + 2 }, (_, i) => [60 + i * 5, 10] as [number, number]),
        ),
      );
    }
    const p = sig(calc(w), 'progression');
    const judged = [...(p.facts.climbing as string[]), ...(p.facts.flat as string[])];
    expect(judged).toHaveLength(6);
    expect(judged).not.toContain('Lift 0');
  });
});

// Strong-practice fixture: 32 sessions with warm-ups, cooldown, cardio, paced rest, full coverage.
const groups = [
  'chest',
  'back',
  'quads',
  'hamstrings',
  'glutes',
  'shoulders',
  'biceps',
  'triceps',
  'core',
  'calves',
];
const strongSession = (i: number): Exercise[] => {
  const t0 = WINDOW_START + i * 1000;
  return [
    mkEx('Overhead Press', {
      primary: 'shoulders',
      secondary: ['triceps', 'chest'],
      sets: [
        mkSet(0, { type: 'warmup', at: t0 }),
        mkSet(1, { weight: 90 + i, reps: 3, at: t0 + 100_000 }),
        mkSet(2, { weight: 90 + i, reps: 3, at: t0 + 200_000 }),
      ],
    }),
    ...groups.map((g) => mkEx(`Move ${g}`, { primary: g, n: 2 })),
    mkEx('Run', { kind: 'cardio', sets: [] }),
    mkEx('Stretch', { kind: 'cooldown', sets: [] }),
  ];
};

describe('rank / sublevel arithmetic on real fixtures', () => {
  const fixtures: [string, MasteryResult][] = [
    ['empty', calc([])],
    ['novice', calc(spread(6), male())],
    ['strong', calc(spread(32, strongSession), male(80), { trainingSinceYear: 2010 })],
  ];

  it.each(fixtures)('%s: rank, sublevel and distances are mutually consistent', (_n, r) => {
    expect(r.rating).toBeGreaterThanOrEqual(0);
    expect(r.rating).toBeLessThanOrEqual(1000);
    expect(r.rankIndex).toBe(rankIndexForRating(r.rating));
    expect(r.rank).toBe(MASTERY_RANKS[r.rankIndex]);
    expect(r.nextRank).toBe(MASTERY_RANKS[r.rankIndex + 1] ?? null);
    const top = r.nextRank ? r.nextRank.threshold : 1000;
    const span = top - r.rank.threshold;
    expect(r.rankProgress).toBeCloseTo((r.rating - r.rank.threshold) / span, 10);
    expect(r.sublevel).toBe(Math.min(3, Math.floor(r.rankProgress * 3) + 1));
    expect(r.toNextSublevel).toBe(
      Math.max(0, Math.round(r.rank.threshold + (r.sublevel / 3) * span - r.rating)),
    );
    expect(r.toNextRank).toBe(r.nextRank ? Math.round(r.nextRank.threshold - r.rating) : null);
  });

  it('a strong, deliberate trainee rates far above an empty profile and reaches an upper rank', () => {
    const strong = fixtures[2][1];
    expect(strong.rating).toBeGreaterThan(fixtures[0][1].rating + 400);
    expect(strong.rankIndex).toBeGreaterThanOrEqual(4);
    expect(strong.calibrating).toBe(false);
    expect(strong.axes.experience.score).toBe(100);
    expect(strong.axes.practice.facts.good).toBeGreaterThanOrEqual(5);
  });

  it('rating = round(10 * sum(weight * axis score))', () => {
    const r = fixtures[2][1];
    const expected = Math.round(
      10 *
        (AXIS_WEIGHT.strength * r.axes.strength.score +
          AXIS_WEIGHT.consistency * r.axes.consistency.score +
          AXIS_WEIGHT.experience * r.axes.experience.score +
          AXIS_WEIGHT.practice * r.axes.practice.score),
    );
    expect(r.rating).toBe(expected);
  });
});

describe('shortfalls', () => {
  // 16 deliberate sessions: coverage / cooldown / rest / cardio / structure are good, consistency is not.
  const r = calc(spread(16, strongSession), male(80), { trainingSinceYear: 2010 });

  it('omits signals that are already good and axes scoring 70 or more', () => {
    const keys = r.shortfalls.map((s) => s.key);
    for (const good of ['coverage', 'cooldown', 'rest', 'cardio', 'structure']) {
      expect(sig(r, good).status).toBe('good');
      expect(keys).not.toContain(`sig-${good}`);
    }
    expect(r.axes.strength.score).toBe(100);
    expect(r.axes.experience.score).toBe(100);
    expect(keys).not.toContain('axis-strength');
    expect(keys).not.toContain('axis-experience');
  });

  it('ranks the weakest signals first and tags the axis-level item with its axis and facts', () => {
    expect(r.shortfalls.map((s) => [s.key, s.impact])).toEqual([
      ['sig-progression', 'high'],
      ['sig-warmup', 'high'],
      ['sig-volume', 'med'],
      ['axis-consistency', 'med'],
    ]);
    const item = r.shortfalls[3];
    expect(item.axis).toBe('consistency');
    expect(item.signal).toBeUndefined();
    expect(item.facts).toEqual(r.axes.consistency.facts);
    expect(r.shortfalls[0]).toMatchObject({ axis: 'practice', signal: 'progression' });
  });

  it('a signal shortfall carries that signal facts', () => {
    expect(r.shortfalls[0].facts).toEqual(sig(r, 'progression').facts);
  });
});
