import { describe, expect, it } from 'vitest';
import { DISCIPLINES, LEVELS, RANKS, computeStandards } from './standards';
import type { DiscResult } from './standards';
import type { Exercise, SetEntry, Workout } from './types';

/** reps = 3 -> e1RM = round(weight * 1.1): whole, predictable numbers. */
function set(weight: number, reps = 3, extra: Partial<SetEntry> = {}): SetEntry {
  return { id: `s${weight}-${reps}`, reps, weight, isWarmup: false, ...extra } as SetEntry;
}
function ex(name: string, sets: SetEntry[], kind?: Exercise['kind']): Exercise {
  return { id: `e-${name}`, name, position: 0, kind, sets } as Exercise;
}
function wk(...exercises: Exercise[]): Workout {
  return { id: 'w', startedAt: 1, finishedAt: 2, autoFinished: false, exercises } as Workout;
}
const byKey = (rs: DiscResult[], key: string): DiscResult => rs.find((r) => r.key === key)!;

const SQUAT = 'Barbell Full Squat';
const BENCH = 'Barbell Bench Press - Medium Grip';
const DEAD = 'Barbell Deadlift';

describe('discipline catalogue', () => {
  it('has unique keys, five rank lifts and level lifts with five ratios per sex', () => {
    const keys = DISCIPLINES.map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(DISCIPLINES.filter((d) => d.system === 'rank').map((d) => d.key)).toEqual([
      'total',
      'squat',
      'bench',
      'deadlift',
      'strictCurl',
    ]);
    for (const d of DISCIPLINES.filter((x) => x.system === 'level')) {
      expect(d.ratios!.M).toHaveLength(5);
      expect(d.ratios!.F).toHaveLength(5);
      // ratios rise tier by tier
      for (const sex of ['M', 'F'] as const) {
        const r = d.ratios![sex];
        expect([...r].sort((a, b) => a - b)).toEqual(r);
      }
    }
  });

  it('classification tables rise with every tier and with bodyweight class', () => {
    const r = computeStandards([], 60, 'M');
    for (const d of r.results.filter((x) => x.system === 'rank')) {
      expect(d.tierIds).toEqual(RANKS);
      expect([...d.thresholds].sort((a, b) => a - b)).toEqual(d.thresholds);
    }
  });
});

describe('computeStandards - sport classification', () => {
  it('places a squat in the right tier for the bodyweight class and reports the gap', () => {
    // 90 kg male squat row: III 140, II 162.5, I 177.5, KMS 202.5, MS 230, MSMK 262.5
    const sq = byKey(computeStandards([wk(ex(SQUAT, [set(180)]))], 90, 'M').results, 'squat');
    expect(sq.best).toBe(198); // 180 x3 -> 198
    expect(sq.thresholds).toEqual([140, 162.5, 177.5, 202.5, 230, 262.5]);
    expect(sq.classLabel).toBe('90');
    expect(sq.achievedIdx).toBe(2); // rank "I"
    expect(sq.tierIds[sq.achievedIdx]).toBe('I');
    expect(sq.nextIdx).toBe(3);
    expect(sq.toGo).toBe(4.5);
    expect(sq.progress).toBeCloseTo((198 - 177.5) / (202.5 - 177.5), 10);
    expect(sq.trained).toBe(true);
  });

  it('bodyweight class boundary: exactly on the upper edge stays in the class, a hair above moves up', () => {
    const w = [wk(ex(SQUAT, [set(100)]))];
    expect(byKey(computeStandards(w, 90, 'M').results, 'squat').classLabel).toBe('90');
    expect(byKey(computeStandards(w, 90.1, 'M').results, 'squat').classLabel).toBe('100');
  });

  it('the open top class is labelled "<previous>+" and uses the last row', () => {
    const sq = byKey(computeStandards([], 150, 'M').results, 'squat');
    expect(sq.classLabel).toBe('140+');
    expect(sq.thresholds).toEqual([175, 200, 215, 242.5, 275, 315]);
  });

  it('uses the female tables for sex F', () => {
    const sq = byKey(computeStandards([], 60, 'F').results, 'squat');
    expect(sq.thresholds).toEqual([65, 80, 90, 102.5, 120, 140]);
  });

  it('an exactly-met threshold counts as achieved (>=)', () => {
    // 90 kg squat III is 140: e1RM must reach exactly 140 -> weight 127.3 x3 = round(140.03)=140
    const sq = byKey(computeStandards([wk(ex(SQUAT, [set(127.3)]))], 90, 'M').results, 'squat');
    expect(sq.best).toBe(140);
    expect(sq.achievedIdx).toBe(0);
    const below = byKey(computeStandards([wk(ex(SQUAT, [set(127)]))], 90, 'M').results, 'squat');
    expect(below.best).toBe(140); // round(139.7) -> 140 as well
    const lower = byKey(computeStandards([wk(ex(SQUAT, [set(126)]))], 90, 'M').results, 'squat');
    expect(lower.best).toBe(139);
    expect(lower.achievedIdx).toBe(-1);
  });

  it('below the first tier: achievedIdx -1, progress measured from zero', () => {
    const sq = byKey(computeStandards([wk(ex(SQUAT, [set(70)]))], 90, 'M').results, 'squat');
    expect(sq.best).toBe(77);
    expect(sq.achievedIdx).toBe(-1);
    expect(sq.nextIdx).toBe(0);
    expect(sq.toGo).toBe(63);
    expect(sq.progress).toBeCloseTo(77 / 140, 10);
  });

  it('untrained lifts: best 0, not trained, progress 0', () => {
    const sq = byKey(computeStandards([], 90, 'M').results, 'squat');
    expect(sq).toMatchObject({ best: 0, trained: false, achievedIdx: -1, progress: 0 });
    expect(sq.toGo).toBe(140);
  });

  it('beyond the top tier: no next tier, toGo null, progress 1', () => {
    const sq = byKey(computeStandards([wk(ex(SQUAT, [set(300)]))], 90, 'M').results, 'squat');
    expect(sq.achievedIdx).toBe(5);
    expect(sq.nextIdx).toBeNull();
    expect(sq.toGo).toBeNull();
    expect(sq.progress).toBe(1);
  });

  it('keeps the best across sessions and exercises matching the same lift', () => {
    const r = computeStandards(
      [wk(ex(SQUAT, [set(100)])), wk(ex('Back Squat', [set(150), set(120)]))],
      90,
      'M',
    );
    expect(byKey(r.results, 'squat').best).toBe(165);
  });

  it('ignores warm-up sets (flag and explicit type)', () => {
    const r = computeStandards(
      [wk(ex(SQUAT, [set(250, 3, { isWarmup: true }), set(250, 3, { type: 'warmup' }), set(100)]))],
      90,
      'M',
    );
    expect(byKey(r.results, 'squat').best).toBe(110);
  });

  it('ignores reps above the e1RM ceiling (>10) and zero-weight sets', () => {
    const r = computeStandards([wk(ex(SQUAT, [set(100, 11), set(0, 5), set(100, 10)]))], 90, 'M');
    expect(byKey(r.results, 'squat').best).toBe(133); // 100 x10 -> 133
  });

  it('counts the heaviest drop part of a drop set', () => {
    const drop = set(60, 3, {
      type: 'drop',
      drops: [{ weight: 200, reps: 3 }],
    } as Partial<SetEntry>);
    const r = computeStandards([wk(ex(SQUAT, [drop]))], 90, 'M');
    expect(byKey(r.results, 'squat').best).toBe(220);
  });

  it('only strength exercises count (a cardio entry with a squat name is ignored)', () => {
    const r = computeStandards([wk(ex(SQUAT, [set(200)], 'cardio'))], 90, 'M');
    expect(byKey(r.results, 'squat').best).toBe(0);
  });

  it('powerlifting total needs all three lifts and sums their bests', () => {
    const partial = computeStandards([wk(ex(SQUAT, [set(100)]), ex(BENCH, [set(80)]))], 90, 'M');
    const tp = byKey(partial.results, 'total');
    expect(tp.trained).toBe(false);
    expect(tp.best).toBe(0);

    const full = computeStandards(
      [wk(ex(SQUAT, [set(100)]), ex(BENCH, [set(80)]), ex(DEAD, [set(150)]))],
      90,
      'M',
    );
    const t = byKey(full.results, 'total');
    expect(t.trained).toBe(true);
    expect(t.best).toBe(110 + 88 + 165);
    expect(t.thresholds).toEqual([352.5, 405, 457.5, 517.5, 595, 667.5]);
    expect(t.achievedIdx).toBe(0); // 363 >= 352.5
  });

  it('total is untrained if any one lift is missing', () => {
    for (const missing of [SQUAT, BENCH, DEAD]) {
      const lifts = [SQUAT, BENCH, DEAD].filter((n) => n !== missing);
      const r = computeStandards([wk(...lifts.map((n) => ex(n, [set(100)])))], 90, 'M');
      expect(byKey(r.results, 'total').trained).toBe(false);
    }
  });
});

describe('computeStandards - unknown bodyweight', () => {
  it('reports bodyKg 0 for zero or negative weight', () => {
    expect(computeStandards([], 0, 'M').bodyKg).toBe(0);
    expect(computeStandards([], -5, 'M').bodyKg).toBe(0);
  });

  it('rank lifts fall back to the middle bodyweight class of the table', () => {
    // TOTAL_M has 12 rows -> index 6 -> the 90 kg row
    const t = byKey(computeStandards([], 0, 'M').results, 'total');
    expect(t.classLabel).toBe('90');
    expect(t.thresholds).toEqual([352.5, 405, 457.5, 517.5, 595, 667.5]);
    // TOTAL_F has 11 rows -> index 5 -> the 67.5 kg row
    const f = byKey(computeStandards([], 0, 'F').results, 'total');
    expect(f.classLabel).toBe('67.5');
  });

  it('level lifts use a reference bodyweight of 80 kg (M) / 60 kg (F)', () => {
    const m = byKey(computeStandards([], 0, 'M').results, 'ohp');
    expect(m.thresholds).toEqual([32.5, 47.5, 62.5, 80, 97.5]);
    const f = byKey(computeStandards([], 0, 'F').results, 'ohp');
    // F ratios .2/.33/.52/.72/.95 x 60 = 12/19.8/31.2/43.2/57 -> nearest 2.5
    expect(f.thresholds).toEqual([12.5, 20, 30, 42.5, 57.5]);
  });
});

describe('computeStandards - strength levels', () => {
  it('scales ratio standards by bodyweight and rounds to 2.5 kg plates', () => {
    const r = computeStandards([], 100, 'M');
    expect(byKey(r.results, 'ohp').thresholds).toEqual([42.5, 60, 77.5, 100, 122.5]);
    expect(byKey(r.results, 'ohp').tierIds).toEqual(LEVELS);
    expect(byKey(r.results, 'ohp').classLabel).toBe('');
  });

  it('grades a level lift against the user bodyweight', () => {
    // 100 kg man, OHP 70 x3 -> 77 -> beginner(42.5) + novice(60) reached, int(77.5) not.
    const ohp = byKey(
      computeStandards([wk(ex('Overhead Press', [set(70)]))], 100, 'M').results,
      'ohp',
    );
    expect(ohp.best).toBe(77);
    expect(ohp.achievedIdx).toBe(1);
    expect(ohp.toGo).toBe(0.5);
    // the same lift is worth more to a lighter lifter
    const light = byKey(
      computeStandards([wk(ex('Overhead Press', [set(70)]))], 70, 'M').results,
      'ohp',
    );
    expect(light.achievedIdx).toBeGreaterThan(ohp.achievedIdx);
  });
});

describe('exercise-name matching (which lift an exercise counts toward)', () => {
  const keysFor = (name: string): string[] => {
    const r = computeStandards([wk(ex(name, [set(100)]))], 80, 'M').results;
    return r.filter((d) => d.key !== 'total' && d.trained).map((d) => d.key);
  };

  it.each([
    ['Barbell Full Squat', ['squat']],
    ['Back Squat', ['squat']],
    ['Front Squat', ['frontSquat']],
    ['Barbell Hack Squat', []],
    ['Goblet Squat', []],
    ['Bulgarian Split Squat', []],
    ['Jump Squat', []],
    ['Barbell Bench Press - Medium Grip', ['bench']],
    ['Barbell Incline Bench Press - Medium Grip', ['inclineBar']],
    ['Dumbbell Bench Press', ['dbBench']],
    ['Decline Barbell Bench Press', []],
    ['Close-Grip Barbell Bench Press', ['closeGrip']],
    ['Barbell Deadlift', ['deadlift']],
    ['Sumo Deadlift', ['deadlift']],
    ['Romanian Deadlift', ['rdl']],
    ['Stiff-Legged Barbell Deadlift', ['rdl']],
    ['Rack Pull', []],
    ['Barbell Curl', ['strictCurl']],
    ['EZ-Bar Curl', ['strictCurl']],
    ['Preacher Curl', []],
    ['Hammer Curls', []],
    ['Standing Military Press', ['ohp']],
    ['Overhead Press', ['ohp']],
    ['Dumbbell Shoulder Press', ['dbShoulder']],
    ['Seated Dumbbell Press', ['dbShoulder']],
    ['Incline Dumbbell Press', ['inclineDb']],
    ['Bent Over Barbell Row', ['row']],
    ['Barbell Row', ['row']],
    ['Seated Cable Rows', ['cableRow']],
    ['Wide-Grip Lat Pulldown', ['latPulldown']],
    ['Leg Press', ['legPress']],
    ['Leg Extensions', ['legExt']],
    ['Seated Leg Curl', ['legCurl']],
    ['Barbell Hip Thrust', ['hipThrust']],
    ['Side Lateral Raise', ['lateralRaise']],
    ['Barbell Shrug', []],
  ])('%s -> %j', (name, expected) => {
    expect(keysFor(name)).toEqual(expected);
  });

  it('is case-insensitive via the canonical name', () => {
    expect(keysFor('  barbell deadlift ')).toEqual(['deadlift']);
  });
});
