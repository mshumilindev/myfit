import { describe, expect, it } from 'vitest';
import { queryChips, runQuery, type Query } from './query';
import type { AskCtx, Tr } from './intentKit';
import { richCtx } from './testCtx';
import type { Workout } from '../types';

const en = richCtx('en');
const uk = richCtx('uk');
const L: Tr = (e) => e;
const LU: Tr = (_e, u) => u;
const BENCH = 'Barbell Bench Press - Medium Grip';

const base: Query = {
  metric: 'volume',
  agg: 'sum',
  exercise: null,
  muscle: null,
  range: null,
  group: null,
  rank: false,
  top: 3,
  strong: true,
  down: false,
  signals: 3,
  said: { metric: true, agg: true, group: false },
};
const run = (o: Partial<Query>, c: AskCtx = en, tr = L) => runQuery(c, { ...base, ...o }, tr);

// The fixture's bench: 30 sessions x 3 sets x 8 reps, working weight 85 / 84 / 83 kg in rotation.
const benchSets = en.s.workouts.flatMap((w) =>
  w.exercises.filter((e) => e.name === BENCH).flatMap((e) => e.sets.map((s) => ({ w, s }))),
);

describe('fixture sanity (what the expectations below are computed from)', () => {
  it('has 30 sessions of 3 bench sets of 8 reps', () => {
    expect(en.s.workouts).toHaveLength(30);
    expect(benchSets).toHaveLength(90);
    expect(new Set(benchSets.map((x) => x.s.reps))).toEqual(new Set([8]));
  });
});

describe('runQuery: measures over one lift', () => {
  const totalKg = benchSets.reduce((a, x) => a + x.s.weight! * x.s.reps, 0);
  it('totals: sets, reps, volume, sessions', () => {
    expect(run({ metric: 'sets', exercise: BENCH })?.text).toBe(
      `Working sets, ${BENCH}, all time: 90.`,
    );
    expect(run({ metric: 'reps', exercise: BENCH })?.text).toBe(`Reps, ${BENCH}, all time: 720.`);
    expect(totalKg).toBe(60_480);
    expect(run({ exercise: BENCH })?.text).toBe(`Total volume, ${BENCH}, all time: 60.5 t.`);
    expect(run({ metric: 'sessions', agg: 'count' })?.text).toBe('Workouts, all time: 30.');
  });
  it('per-session averages, best and lowest with the date of the extreme', () => {
    expect(run({ agg: 'avg', exercise: BENCH })?.text).toBe(
      `Average volume, ${BENCH}, all time: 2\u202f016 kg.`,
    );
    expect(run({ agg: 'max', exercise: BENCH })?.text).toBe(
      `Best volume, ${BENCH}, all time: 2\u202f040 kg — Sep 21.`,
    );
    expect(run({ agg: 'min', exercise: BENCH })?.text).toBe(
      `Lowest volume, ${BENCH}, all time: 1\u202f992 kg — Sep 13.`,
    );
    expect(run({ metric: 'sets', agg: 'max', exercise: BENCH })?.text).toBe(
      `Best working sets, ${BENCH}, all time: 3 — Sep 21.`,
    );
    expect(run({ metric: 'sets', agg: 'avg', exercise: BENCH })?.text).toBe(
      `Average working sets, ${BENCH}, all time: 3.`,
    );
  });
  it('weights and estimated maxes: average, extremes with the lift and date', () => {
    expect(run({ metric: 'weight', agg: 'avg', exercise: BENCH })?.text).toBe(
      `Average working weight, ${BENCH}, all time: 84 kg.`,
    );
    expect(run({ metric: 'weight', agg: 'max', exercise: BENCH })?.text).toBe(
      `Best working weight, ${BENCH}, all time: 85 kg — ${BENCH}, Sep 21.`,
    );
    expect(run({ metric: 'weight', agg: 'min', exercise: BENCH })?.text).toBe(
      `Lowest working weight, ${BENCH}, all time: 83 kg — ${BENCH}, Sep 13.`,
    );
    expect(run({ metric: 'e1rm', agg: 'min', exercise: BENCH })?.text).toBe(
      `Lowest estimated max, ${BENCH}, all time: 105 kg — ${BENCH}, Sep 13.`,
    );
    expect(run({ metric: 'e1rm', agg: 'avg', exercise: BENCH })?.text).toBe(
      `Average estimated max, ${BENCH}, all time: 106.5 kg.`,
    );
  });
  it('reps per set: average and extremes', () => {
    expect(run({ metric: 'reps', agg: 'avg', exercise: BENCH })?.text).toBe(
      `Reps per set, ${BENCH}, all time: 8.`,
    );
    expect(run({ metric: 'reps', agg: 'min', exercise: BENCH })?.text).toBe(
      `Lowest reps, ${BENCH}, all time: 8 — ${BENCH}, Sep 21.`,
    );
  });
  it('a muscle is a subject like a lift', () => {
    expect(run({ muscle: 'chest' })?.text).toBe('Total volume, chest, all time: 60.5 t.');
  });
  it('nothing matching gives a plain “nothing logged”, an empty log says to finish a workout', () => {
    expect(run({ metric: 'weight', agg: 'max', exercise: 'Nonexistent Lift' })?.text).toBe(
      'Nothing logged for that (Nonexistent Lift, all time).',
    );
    const none = { ...en, s: { ...en.s, workouts: [] } };
    expect(run({}, none)?.text).toBe(
      'Nothing logged yet — finish a workout and I can count anything in it.',
    );
    expect(run({}, none, LU)?.text).toBe(
      'Ще нічого не записано — заверши тренування, і я порахую що завгодно.',
    );
  });
});

describe('runQuery: session length', () => {
  const lens = [30, 45, 60, 90];
  const c: AskCtx = {
    ...en,
    s: {
      ...en.s,
      workouts: en.s.workouts.map(
        (w, i) => ({ ...w, finishedAt: w.startedAt + lens[i % 4] * 60_000 }) as Workout,
      ),
    },
  };
  it('sums, averages and finds the extremes of workout length', () => {
    const total = en.s.workouts.reduce((a, _, i) => a + lens[i % 4], 0);
    expect(run({ metric: 'duration', agg: 'sum' }, c)?.text).toBe(
      `Total workout length, all time: ${total} min.`,
    );
    expect(run({ metric: 'duration', agg: 'avg' }, c)?.text).toBe(
      `Average workout length, all time: ${Math.round(total / 30)} min.`,
    );
    expect(run({ metric: 'duration', agg: 'max' }, c)?.text).toMatch(
      /^Longest workout length, all time: 90 min — Sep \d+\.$/,
    );
    expect(run({ metric: 'duration', agg: 'min' }, c)?.text).toMatch(
      /^Shortest workout length, all time: 30 min — /,
    );
  });
  it('only counts sessions that include the lift', () => {
    const only = {
      ...c,
      s: {
        ...c.s,
        workouts: c.s.workouts.map((w, i) =>
          i % 2
            ? ({
                ...w,
                exercises: w.exercises.filter(
                  (e) => e.name !== 'Barbell Curl' && e.name !== 'Pullups',
                ),
              } as Workout)
            : w,
        ),
      },
    };
    const r = run({ metric: 'duration', agg: 'avg', exercise: 'Pullups' }, only);
    expect(r?.text).toMatch(/^Average workout length, Pullups, all time: \d+ min\.$/);
  });
});

describe('runQuery: bodyweight lifts are counted in reps', () => {
  const bw: AskCtx = {
    ...en,
    s: {
      ...en.s,
      workouts: en.s.workouts.map(
        (w) =>
          ({
            ...w,
            exercises: w.exercises.map((e) =>
              e.name === 'Pullups'
                ? { ...e, sets: e.sets.map((s, i) => ({ ...s, weight: 0, reps: 6 + i })) }
                : e,
            ),
          }) as Workout,
      ),
    },
  };
  it('best, lowest and average describe reps, not kilograms', () => {
    const r = (agg: Query['agg']) => run({ metric: 'weight', agg, exercise: 'Pullups' }, bw)?.text;
    expect(r('max')).toMatch(/^Best .*Pullups, all time: 8\b/);
    expect(r('min')).toMatch(/^Lowest .*Pullups, all time: 6\b/);
    expect(r('avg')).toMatch(/^Average .*Pullups, all time: 7\b/);
    expect(r('max')).not.toMatch(/kg/);
  });
});

describe('runQuery: breakdowns', () => {
  it('ranks weekdays by workouts, computed from the dates', () => {
    const by = new Map<number, number>();
    for (const w of en.s.workouts)
      by.set(new Date(w.startedAt).getDay(), (by.get(new Date(w.startedAt).getDay()) ?? 0) + 1);
    const top = Math.max(...by.values());
    const r = run({ metric: 'sessions', agg: 'count', group: 'weekday', rank: true });
    expect(r?.text).toMatch(
      new RegExp(`^By workouts \\(all time\\), most: \\w+day \\(${top}\\)\\. Top 3: 1\\. `),
    );
    expect(r?.text.match(/\d\. /g)).toHaveLength(3);
  });
  it('ranks muscles and lifts', () => {
    expect(run({ metric: 'sets', group: 'muscle', rank: true })?.text).toMatch(
      /^By working sets \(all time\), most: back \(180\)\. Top 3: 1\. back — 180; 2\. chest — 90; 3\. quads — 90\.$/,
    );
    expect(run({ metric: 'weight', agg: 'max', group: 'lift', rank: true })?.text).toBe(
      `By working weight (all time), most: Barbell Deadlift (140 kg). Top 3: 1. Barbell Deadlift — 140 kg; 2. Barbell Full Squat — 110 kg; 3. ${BENCH} — 85 kg.`,
    );
  });
  it('time breakdowns come with a chart of that many points', () => {
    const wk = run({ group: 'week' });
    expect(wk?.text).toMatch(
      /^Volume \(all time\): ~12\.7 t a week on average; best Jul 6 — 16\.3 t\./,
    );
    expect(wk?.chart?.points).toHaveLength(13);
    const mo = run({ agg: 'avg', group: 'month' });
    expect(mo?.text).toMatch(
      /^Volume \(all time\): ~7\u202f717 kg a month on average; best Jun 26 — 7\u202f911 kg\./,
    );
    expect(mo?.chart?.points).toHaveLength(5);
  });
});

describe('runQuery: change over time', () => {
  it('compares the last four weeks with the four before, in kg and as a verdict', () => {
    expect(run({ agg: 'change' })?.text).toBe(
      'Volume: 54.4 t the last 4 weeks vs 55.9 t the period before — down (−3%).',
    );
    expect(run({ metric: 'e1rm', agg: 'change', exercise: BENCH })?.text).toBe(
      `Estimated max (${BENCH}): 108 kg the last 4 weeks vs 108 kg the period before — about the same (±0%).`,
    );
  });
  it('speaks Ukrainian', () => {
    expect(run({ agg: 'change' }, uk, LU)?.text).toMatch(/54,4 т/);
  });
});

describe('runQuery: edge cases that must stay honest', () => {
  const zeroLen: AskCtx = {
    ...en,
    s: {
      ...en.s,
      workouts: en.s.workouts.map((w) => ({ ...w, finishedAt: w.startedAt }) as Workout),
    },
  };
  const unloaded: AskCtx = {
    ...en,
    s: {
      ...en.s,
      workouts: en.s.workouts.map(
        (w) =>
          ({
            ...w,
            exercises: w.exercises.map((e) => ({
              ...e,
              sets: e.sets.map((x) => ({ ...x, weight: 0 })),
            })),
          }) as Workout,
      ),
    },
  };
  it('sessions with no recorded length have no length to report', () => {
    expect(run({ metric: 'duration', agg: 'max' }, zeroLen)?.text).toBe(
      'Nothing logged for that (all time).',
    );
  });
  it('a weight question over sets with no load has nothing to report', () => {
    expect(run({ metric: 'weight', agg: 'max' }, unloaded)?.text).toBe(
      'Nothing logged for that (all time).',
    );
  });
  it('a breakdown for a lift that was never done says so', () => {
    expect(run({ group: 'lift', rank: true, exercise: 'Nonexistent Lift' })?.text).toBe(
      'Nothing logged for that (Nonexistent Lift, all time).',
    );
  });
  it('a period compared with one that only has unloaded sets is not given as a percentage', () => {
    // sessions 28-56 days ago (the four weeks before "the last 4 weeks") carry no load
    const c: AskCtx = {
      ...en,
      s: {
        ...en.s,
        workouts: en.s.workouts.map((w) => {
          const daysAgo = (en.now - w.startedAt) / 86_400_000;
          if (daysAgo < 28 || daysAgo >= 56) return w;
          return {
            ...w,
            exercises: w.exercises.map((e) => ({
              ...e,
              sets: e.sets.map((x) => ({ ...x, weight: 0 })),
            })),
          } as Workout;
        }),
      },
    };
    const r = run({ agg: 'change', exercise: BENCH, metric: 'volume' }, c);
    expect(r?.text).toBe(
      `Volume (${BENCH}), the last 4 weeks: 14.1 t — none in the period before.`,
    );
    expect(run({ agg: 'change', exercise: BENCH, metric: 'volume' }, c, LU)?.text).toMatch(
      /за попередній такий самий період нічого\.$/,
    );
  });
});

describe('queryChips', () => {
  it('suggests the sensible next three, depending on what was asked', () => {
    expect(queryChips({ ...base }, L)).toEqual([
      'By week',
      'This month',
      'Which lift improved most?',
    ]);
    expect(queryChips({ ...base, group: 'week' }, L)).toEqual([
      'By month',
      'This month',
      'Which lift improved most?',
    ]);
    expect(
      queryChips(
        {
          ...base,
          agg: 'change',
          group: 'lift',
          range: { from: 0, to: 1, label: ['x', 'y'] } as never,
        },
        L,
      ),
    ).toEqual(['By week', 'Last month', 'Sets by muscle this month']);
    expect(
      queryChips(
        { ...base, group: 'muscle', range: { from: 0, to: 1, label: ['x', 'y'] } as never },
        L,
      ),
    ).toEqual(['By week', 'Last month', 'Which lift improved most?']);
  });
  it('translates', () => {
    expect(queryChips({ ...base }, LU)[0]).toBe('По тижнях');
  });
});
