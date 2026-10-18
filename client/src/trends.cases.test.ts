import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { computeTrends } from './trends';
import type { Insight, TrendsResult } from './trends';
import { LOCALES, fmtWeekday, getLocale, setLocale } from './i18n';
import type { BodyMetrics, Exercise, SetEntry, Workout } from './types';

const DAY = 24 * 3600 * 1000;
const NOW = new Date(2026, 9, 15, 12).getTime(); // Thursday
const T = LOCALES.en.trends;
const M = LOCALES.en.muscleGroups as Record<string, string>;
const noBody = { weights: [] } as unknown as BodyMetrics;

let seq = 0;
function set(weight: number | null, reps = 5, o: Partial<SetEntry> = {}): SetEntry {
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
/** Ad-hoc lift (non-catalog name): muscles come from the stored primary. */
function lift(name: string, primary: string, sets: SetEntry[]): Exercise {
  return {
    id: `e${seq++}`,
    name,
    kind: 'strength',
    position: 0,
    primaryMuscle: primary,
    secondaryMuscles: [],
    sets,
  } as Exercise;
}
/** `n` identical working sets of `kg`. */
const sets = (n: number, kg: number | null = 50, reps = 5): SetEntry[] =>
  Array.from({ length: n }, () => set(kg, reps));
function sess(daysAgo: number, exercises: Exercise[], durationMin: number | null = 60): Workout {
  const startedAt = NOW - daysAgo * DAY;
  return {
    id: `w${seq++}`,
    startedAt,
    finishedAt: durationMin === null ? null : startedAt + durationMin * 60_000,
    autoFinished: false,
    exercises,
  } as Workout;
}
const trends = (ws: Workout[], body: BodyMetrics = noBody): TrendsResult =>
  computeTrends(ws, body, NOW);
const find = (r: TrendsResult, key: string): Insight | undefined =>
  r.insights.find((i) => i.key === key);
const keys = (r: TrendsResult): string[] => r.insights.map((i) => i.key);

let prevLocale: ReturnType<typeof getLocale>;
beforeAll(() => {
  prevLocale = getLocale();
  setLocale('en');
});
afterAll(() => setLocale(prevLocale));

describe('readiness', () => {
  it('needs 3+ sessions spread over 3+ training weeks', () => {
    const w = (d: number) => sess(d, [lift('Zed A', 'chest', sets(3))]);
    const ok = trends([w(1), w(8), w(15)]);
    expect(ok).toMatchObject({ ready: true, weeksTracked: 3 });
    // three sessions in one week -> not ready, but insights are still computed
    const one = trends([w(1), w(2), w(3)]);
    expect(one).toMatchObject({ ready: false, weeksTracked: 1 });
    expect(one.insights.length).toBeGreaterThan(0);
    expect(trends([w(1), w(8)])).toMatchObject({ ready: false, weeksTracked: 2 });
  });

  it('with no history the two horizon cards still render as empty stubs', () => {
    const r = trends([]);
    expect(r).toMatchObject({ ready: false, weeksTracked: 0 });
    expect(keys(r).sort()).toEqual(['hz-sess', 'hz-vol']);
    const vol = find(r, 'hz-vol')!;
    expect(vol.bars!.map((b) => [b.label, b.value, b.raw])).toEqual([
      ['30d', '—', 0],
      ['90d', '—', 0],
      ['180d', '—', 0],
      ['1y', '—', 0],
    ]);
    expect(vol).toMatchObject({ level: 'info', severity: 78, headline: T.weeklyVolume });
  });

  it('weeks split on the training-week start (Monday by default)', () => {
    // Sunday 2026-10-11 and Monday 2026-10-12 belong to different weeks
    const sun = {
      ...sess(0, [lift('Zed A', 'chest', sets(1))]),
      startedAt: new Date(2026, 9, 11, 12).getTime(),
    };
    const mon = {
      ...sess(0, [lift('Zed A', 'chest', sets(1))]),
      startedAt: new Date(2026, 9, 12, 12).getTime(),
    };
    expect(trends([sun, mon]).weeksTracked).toBe(2);
    expect(
      trends([mon, { ...mon, id: 'x', startedAt: mon.startedAt + 3 * DAY }]).weeksTracked,
    ).toBe(1);
  });

  it('insights come back sorted by severity, highest first', () => {
    const w = [10, 20, 30, 40, 50, 60].map((d) => sess(d, [lift('Zed A', 'chest', sets(4, 100))]));
    const sev = trends(w).insights.map((i) => i.severity);
    expect([...sev].sort((a, b) => b - a)).toEqual(sev);
  });
});

describe('push / pull and upper / lower balance (90-day window)', () => {
  const day = (daysAgo: number, push: number, pull: number, legs = 0) =>
    sess(daysAgo, [
      ...(push ? [lift('Zed Press', 'chest', sets(push))] : []),
      ...(pull ? [lift('Zed Row', 'lats', sets(pull))] : []),
      ...(legs ? [lift('Zed Squat', 'quads', sets(legs))] : []),
    ]);

  it('is omitted below 12 total sets', () => {
    const r = trends([day(5, 6, 5)]);
    expect(find(r, 'balance-pp')).toBeUndefined();
    expect(find(r, 'balance-ul')).toBeUndefined();
  });

  it('flags a thin pull side as a risk and names what to add', () => {
    const c = find(trends([day(5, 12, 4)]), 'balance-pp')!;
    expect(c).toMatchObject({
      type: 'balance',
      level: 'risk',
      severity: 88,
      attention: true,
      kicker: T.needsAttention,
      headline: T.balLow(T.pull),
      detail: T.balAdd(T.addRows),
      aLabel: T.push,
      bLabel: T.pull,
      aVal: 12,
      bVal: 4,
      lowSide: 'b',
    });
  });

  it('flags a thin push side the other way round', () => {
    const c = find(trends([day(5, 4, 12)]), 'balance-pp')!;
    expect(c).toMatchObject({
      level: 'risk',
      headline: T.balLow(T.push),
      detail: T.balAdd(T.addPress),
      lowSide: 'a',
    });
  });

  it('the skew threshold is strict: low exactly 60% of high is still balanced', () => {
    const ok = find(trends([day(5, 10, 6)]), 'balance-pp')!;
    expect(ok).toMatchObject({ level: 'good', severity: 60, attention: false, lowSide: undefined });
    expect(ok.headline).toBe(T.balOk(T.push, T.pull));
    expect(ok.detail).toBe(T.balEven(10, 6));
    expect(ok.kicker).toBe(`${T.push} / ${T.pull}`);
    const bad = find(trends([day(5, 10, 5)]), 'balance-pp')!;
    expect(bad.level).toBe('risk');
  });

  it('upper / lower uses a 50% threshold and recommends legs', () => {
    const bad = find(trends([day(5, 6, 6, 5)]), 'balance-ul')!;
    expect(bad).toMatchObject({
      level: 'risk',
      aVal: 12,
      bVal: 5,
      headline: T.balLow(T.lowerBody),
      detail: T.balAdd(T.addSquats),
      lowSide: 'b',
    });
    const edge = find(trends([day(5, 6, 6, 6)]), 'balance-ul')!;
    expect(edge).toMatchObject({ level: 'good', aVal: 12, bVal: 6 });
    const upperLow = find(trends([day(5, 2, 2, 12)]), 'balance-ul')!;
    expect(upperLow).toMatchObject({
      level: 'risk',
      headline: T.balLow(T.upperBody),
      detail: T.balAdd(T.addRowsUpper),
      lowSide: 'a',
    });
  });

  it('only counts working sets of strength lifts from the last 90 days', () => {
    const warm = lift('Zed Press', 'chest', [
      ...sets(8),
      set(20, 5, { type: 'warmup', isWarmup: true }),
    ]);
    const run = { ...lift('Treadmill', 'quads', sets(20)), kind: 'cardio' } as Exercise;
    const none = { ...lift('Zed Unknown', 'chest', sets(20)), primaryMuscle: null } as Exercise;
    const r = trends([
      sess(5, [warm, lift('Zed Row', 'lats', sets(4)), run, none]),
      day(91, 0, 40),
    ]);
    expect(find(r, 'balance-pp')).toMatchObject({ aVal: 8, bVal: 4 });
  });

  it('the 90-day edge is inclusive', () => {
    expect(find(trends([day(90, 6, 6)]), 'balance-pp')).toMatchObject({ aVal: 6, bVal: 6 });
    expect(find(trends([day(90.01, 6, 6)]), 'balance-pp')).toBeUndefined();
  });
});

describe('least / most trained areas (4 weeks)', () => {
  const area = (name: string, primary: string, n: number) => lift(name, primary, sets(n));

  it('needs four trained areas', () => {
    const three = sess(5, [
      area('A', 'chest', 10),
      area('B', 'lats', 10),
      area('C', 'shoulders', 10),
    ]);
    expect(find(trends([three]), 'least')).toBeUndefined();
    expect(find(trends([three]), 'most')).toBeUndefined();
  });

  it('lists the three least and three most trained, scaled to the busiest area', () => {
    const w = sess(5, [
      area('A', 'chest', 20),
      area('B', 'lats', 15),
      area('C', 'shoulders', 10),
      area('D', 'quads', 8),
      area('E', 'core', 1),
    ]);
    const r = trends([w]);
    const least = find(r, 'least')!;
    expect(least).toMatchObject({
      type: 'muscleList',
      level: 'risk',
      severity: 95,
      kicker: T.least,
    });
    expect(least.muscles).toEqual([
      { label: 'Core', frac: 0.08, worst: true }, // 1/20 clamps up to 0.08
      { label: 'Legs', frac: 8 / 20, worst: false },
      { label: 'Shoulders', frac: 0.5, worst: false },
    ]);
    expect(least.detail).toBe(T.leastDetail('Core'));
    const most = find(r, 'most')!;
    expect(most).toMatchObject({ level: 'info', severity: 56, kicker: T.most });
    expect(most.muscles!.map((m) => [m.label, m.frac, m.worst])).toEqual([
      ['Chest', 1, false],
      ['Back', 0.75, false],
      ['Shoulders', 0.5, false],
    ]);
    expect(most.detail).toBe(T.mostDetail('Chest'));
  });

  it('risk only when the weakest area is under half the median; otherwise a warning', () => {
    const mk = (core: number) =>
      sess(5, [
        area('A', 'chest', 10),
        area('B', 'lats', 10),
        area('C', 'shoulders', 10),
        area('D', 'core', core),
      ]);
    // sorted counts [core,10,10,10]: median index 2 = 10
    expect(find(trends([mk(4)]), 'least')).toMatchObject({ level: 'risk', severity: 95 });
    expect(find(trends([mk(5)]), 'least')).toMatchObject({ level: 'warn', severity: 70 });
    expect(find(trends([mk(9)]), 'least')).toMatchObject({ level: 'warn', severity: 70 });
  });

  it('only the last 30 days count, and the legacy generic "back" rolls into Back', () => {
    const w = sess(5, [
      area('A', 'chest', 10),
      area('B', 'back', 10),
      area('C', 'shoulders', 10),
      area('D', 'core', 10),
    ]);
    const old = sess(31, [area('E', 'quads', 30)]);
    const r = trends([w, old]);
    const labels = find(r, 'most')!.muscles!.map((m) => m.label);
    expect(labels).not.toContain('Legs');
    expect(labels).toContain('Back');
  });

  it('flags a neglected sub-muscle inside a well-trained area (back without lower back)', () => {
    const w = sess(5, [
      area('A', 'lats', 20),
      area('B', 'lower_back', 1),
      area('C', 'chest', 10),
      area('D', 'shoulders', 10),
      area('E', 'biceps', 10),
    ]);
    const gap = find(trends([w]), 'gap:lower_back')!;
    expect(gap).toMatchObject({
      type: 'tip',
      level: 'warn',
      severity: 82,
      attention: true,
      icon: 'warning-circle',
      headline: T.gapHead('Back', M.lower_back),
      detail: T.gapDetail(M.lower_back, T.gapHintHinge),
    });
  });

  it('no sub-muscle gap below 8 area sets or when the member holds 12% or more', () => {
    const small = sess(5, [
      area('A', 'lats', 7),
      area('C', 'chest', 10),
      area('D', 'shoulders', 10),
      area('E', 'biceps', 10),
    ]);
    expect(keys(trends([small])).some((k) => k.startsWith('gap:'))).toBe(false);
    // lower back = 12% of the back area (3 of 25) is not a gap
    const ok = sess(5, [
      area('A', 'lats', 22),
      area('B', 'lower_back', 3),
      area('C', 'chest', 10),
      area('D', 'shoulders', 10),
      area('E', 'biceps', 10),
    ]);
    expect(keys(trends([ok])).some((k) => k.startsWith('gap:'))).toBe(false);
  });

  it('with several gaps, the one in the biggest area wins', () => {
    const w = sess(5, [
      area('A', 'lats', 14), // back area 14 sets, no lower back
      area('B', 'quads', 30), // legs 30 sets, no hamstrings or calves
      area('C', 'chest', 10),
      area('D', 'shoulders', 10),
    ]);
    const gaps = keys(trends([w])).filter((k) => k.startsWith('gap:'));
    // legs (30 sets) beats back (14); hamstrings comes before calves and an equal area does not replace it
    expect(gaps).toEqual(['gap:hamstrings']);
  });
});

describe('weekly volume and frequency horizons', () => {
  /** A session carrying exactly `kg` of volume (1 set x 1 rep). */
  const vol = (daysAgo: number, kg: number) =>
    sess(daysAgo, [lift('Zed A', 'chest', [set(kg, 1)])]);

  it('averages tonnage per week over four non-overlapping eras', () => {
    // span 200 d: era0 30 d (4.2857 wk), era1 60 d (8.5714 wk), era2 90 d (12.857 wk), era3 hi = min(365, 200) = 200 -> 20 d (2.857 wk)
    const ws = [vol(10, 3000), vol(60, 6000), vol(150, 9000), vol(200, 2000)];
    const bars = find(trends(ws), 'hz-vol')!.bars!;
    expect(bars.map((b) => b.label)).toEqual(['30d', '90d', '180d', '1y']);
    const wk = (days: number) => days / 7;
    expect(bars[0].raw).toBeCloseTo(3000 / wk(30), 6);
    expect(bars[1].raw).toBeCloseTo(6000 / wk(60), 6);
    expect(bars[2].raw).toBeCloseTo(9000 / wk(90), 6);
    expect(bars[3].raw).toBeCloseTo(2000 / wk(20), 6);
    expect(bars[0].value).toBe(`${(bars[0].raw / 1000).toFixed(1)}t`);
    expect(bars[0].value).toBe('0.7t');
  });

  it('an era older than the history shows an empty stub, not a repeat', () => {
    const bars = find(trends([vol(10, 3000), vol(40, 3000)]), 'hz-vol')!.bars!;
    expect(bars[2]).toEqual({ label: '180d', raw: 0, value: '—' });
    expect(bars[3]).toEqual({ label: '1y', raw: 0, value: '—' });
  });

  it('a partial era divides by its covered weeks, with a half-week floor', () => {
    // history only 3 days old: era0 covers (3 - 0)/7 = 0.43 wk -> floored to 0.5
    const bars = find(trends([vol(3, 1000)]), 'hz-vol')!.bars!;
    expect(bars[0].raw).toBe(2000);
  });

  it('level follows the recent era vs the most recent earlier era with data (>=110% up, <=82% down)', () => {
    const era = (recentKg: number) => [vol(10, recentKg), vol(50, 1000), vol(100, 1000)];
    // history spans 100 d, so the 30-90d era is 60 d (8.57 wk) and the recent era 30 d (4.29 wk): per-week rates compare directly.
    const rate = (kg: number, days: number) => kg / (days / 7);
    const priorRate = rate(1000, 60);
    const recentFor = (mult: number) => mult * priorRate * (30 / 7);
    const up = find(trends(era(recentFor(1.1))), 'hz-vol')!;
    expect(up).toMatchObject({
      level: 'good',
      severity: 78,
      headline: T.volUp,
      detail: T.volUpDetail,
    });
    const flat = find(trends(era(recentFor(1.09))), 'hz-vol')!;
    expect(flat).toMatchObject({
      level: 'info',
      headline: T.weeklyVolume,
      detail: T.volFlatDetail,
    });
    const down = find(trends(era(recentFor(0.82))), 'hz-vol')!;
    expect(down).toMatchObject({
      level: 'risk',
      severity: 84,
      headline: T.volDown,
      detail: T.volDownDetail,
    });
    const mild = find(trends(era(recentFor(0.83))), 'hz-vol')!;
    expect(mild.level).toBe('info');
  });

  it('sessions per week: a drop to 82% of the earlier rhythm warns', () => {
    // 30 d era 4.29 wk, 30-90 d era 8.57 wk (history 100 d)
    const mk = (recent: number, prior: number) => [
      ...Array.from({ length: recent }, (_, i) => vol(1 + i, 100)),
      ...Array.from({ length: prior }, (_, i) => vol(35 + i, 100)),
      vol(100, 100),
    ];
    // 6 sessions in the last 30 d = 1.4/wk ; 20 in the prior 60 d (+1 at exactly 100 d) -> ~2.3/wk
    const less = find(trends(mk(6, 20)), 'hz-sess')!;
    expect(less).toMatchObject({
      level: 'warn',
      severity: 76,
      headline: T.sessLess,
      detail: T.sessLessDetail,
    });
    const steady = find(trends(mk(12, 20)), 'hz-sess')!;
    expect(steady).toMatchObject({
      level: 'info',
      severity: 72,
      headline: T.sessFreq,
      detail: T.sessDetail,
    });
    expect(steady.bars![0].value).toBe((12 / (30 / 7)).toFixed(1));
  });
});

describe('top-lift horizon', () => {
  const lifts = (name: string, pts: [number, number][]) =>
    pts.map(([d, kg]) => sess(d, [lift(name, 'chest', [set(kg, 5)])]));

  it('needs 4+ sessions of the most-trained lift spanning 21+ days', () => {
    const base = lifts('Zed Bench', [
      [2, 100],
      [9, 100],
      [16, 100],
      [22, 100],
    ]);
    expect(find(trends(base), 'hz-lift')).toBeDefined();
    expect(
      find(
        trends(
          lifts('Zed Bench', [
            [2, 100],
            [9, 100],
            [16, 100],
          ]),
        ),
        'hz-lift',
      ),
    ).toBeUndefined();
    expect(
      find(
        trends(
          lifts('Zed Bench', [
            [2, 100],
            [5, 100],
            [10, 100],
            [20, 100],
          ]),
        ),
        'hz-lift',
      ),
    ).toBeUndefined();
    expect(
      find(
        trends(
          lifts('Zed Bench', [
            [2, 100],
            [5, 100],
            [10, 100],
            [21, 100],
          ]),
        ),
        'hz-lift',
      ),
    ).toBeDefined();
  });

  it('averages the top set per era and flags a heavier recent era', () => {
    const ws = lifts('Zed Bench', [
      [5, 112],
      [15, 112],
      [40, 100],
      [60, 100],
      [100, 100],
    ]);
    const c = find(trends(ws), 'hz-lift')!;
    expect(c).toMatchObject({
      type: 'horizon',
      level: 'good',
      severity: 80,
      kicker: T.topSet('Zed Bench'),
      headline: T.liftHeavier('Zed Bench'),
      detail: T.liftUpDetail,
    });
    expect(c.bars!.map((b) => b.value)).toEqual(['112', '100', '100', '—']);
    const flat = find(
      trends(
        lifts('Zed Bench', [
          [5, 100],
          [15, 100],
          [40, 100],
          [60, 100],
          [100, 100],
        ]),
      ),
      'hz-lift',
    )!;
    expect(flat).toMatchObject({
      level: 'info',
      headline: T.liftTop('Zed Bench'),
      detail: T.liftFlatDetail,
    });
  });

  it('is built for the most frequently trained lift only', () => {
    const ws = [
      ...lifts('Zed Often', [
        [2, 50],
        [9, 50],
        [16, 50],
        [22, 50],
        [30, 50],
      ]),
      ...lifts('Zed Rare', [
        [3, 90],
        [10, 90],
        [17, 90],
        [23, 90],
      ]),
    ];
    const c = find(trends(ws), 'hz-lift')!;
    expect(c.kicker).toBe(T.topSet('Zed Often'));
  });
});

describe('strength trend and all-time best', () => {
  const lifts = (name: string, pts: [number, number][]) =>
    pts.map(([d, kg]) => sess(d, [lift(name, 'chest', [set(kg, 5)])]));

  it('flags a lift whose recent best beats the 45-135 day best by 2.5 kg or more', () => {
    const ws = lifts('Zed Squat', [
      [3, 102.5],
      [20, 100],
      [50, 100],
      [80, 100],
      [120, 100],
    ]);
    const c = find(trends(ws), 'progress:Zed Squat')!;
    expect(c).toMatchObject({
      type: 'trend',
      level: 'good',
      severity: 66,
      icon: 'chart-line-up',
      kicker: T.strength,
      headline: T.liftClimbing('Zed Squat'),
      detail: T.liftClimbDetail(3), // round(2.5) = 3
      hero: '103',
      heroUnit: T.kgTop,
      deltaPct: 3, // round(2.5 / 100 * 100)
    });
    expect(c.spark).toEqual([100, 100, 100, 100, 102.5]);
    const below = lifts('Zed Squat', [
      [3, 102.4],
      [20, 100],
      [50, 100],
      [80, 100],
      [120, 100],
    ]);
    expect(find(trends(below), 'progress:Zed Squat')).toBeUndefined();
  });

  it('needs 5 data points and at least 45 days of history', () => {
    const few = lifts('Zed Squat', [
      [3, 110],
      [20, 100],
      [50, 100],
      [80, 100],
    ]);
    expect(find(trends(few), 'progress:Zed Squat')).toBeUndefined();
    const young = lifts('Zed Squat', [
      [3, 110],
      [10, 100],
      [20, 100],
      [30, 100],
      [44, 100],
    ]);
    expect(find(trends(young), 'progress:Zed Squat')).toBeUndefined();
  });

  it('spark shows the last ten top weights, oldest first', () => {
    const pts: [number, number][] = [[3, 120]];
    for (let i = 0; i < 12; i++) pts.push([20 + i * 8, 100 + i]);
    const c = find(trends(lifts('Zed Squat', pts)), 'progress:Zed Squat')!;
    expect(c.spark).toHaveLength(10);
    expect(c.spark!.at(-1)).toBe(120);
  });

  it('only the top two lifts are considered, and only the first match is reported', () => {
    const climbing = (n: string, count: number) =>
      lifts(n, [
        [3, 110],
        ...Array.from({ length: count - 1 }, (_, i) => [50 + i * 20, 100] as [number, number]),
      ]);
    const ws = [...climbing('Zed C', 8), ...climbing('Zed B', 7), ...climbing('Zed A', 6)];
    const k = keys(trends(ws)).filter((x) => x.startsWith('progress:'));
    expect(k).toEqual(['progress:Zed C']);
    const third = [
      ...climbing('Zed C', 8).map((w) => ({
        ...w,
        exercises: [lift('Zed C', 'chest', [set(100, 5)])],
      })),
      ...climbing('Zed B', 7).map((w) => ({
        ...w,
        exercises: [lift('Zed B', 'chest', [set(100, 5)])],
      })),
      ...climbing('Zed A', 6),
    ];
    expect(keys(trends(third)).some((x) => x === 'progress:Zed A')).toBe(false);
  });

  it('all-time heaviest set across lifts, working sets only, bodyweight ignored', () => {
    const ws = [
      sess(5, [
        lift('Zed Squat', 'quads', [set(140, 3), set(200, 3, { type: 'warmup', isWarmup: true })]),
      ]),
      sess(9, [lift('Zed Deadlift', 'lower_back', [set(180.4, 1)])]),
      sess(12, [lift('Zed Pull Up', 'lats', [set(null, 10)])]),
    ];
    const c = find(trends(ws), 'stat-best')!;
    expect(c).toMatchObject({
      type: 'stat',
      level: 'good',
      severity: 54,
      kicker: T.heaviest,
      detail: T.heaviestDetail('Zed Deadlift'),
      hero: '180',
      heroUnit: 'kg',
      deltaPct: null,
    });
    expect(
      find(trends([sess(5, [lift('Zed Pull Up', 'lats', [set(null, 10)])])]), 'stat-best'),
    ).toBeUndefined();
  });

  describe('bodyweight', () => {
    const w = (daysAgo: number, kg: number) => ({
      id: `b${seq++}`,
      at: NOW - daysAgo * DAY,
      weight: kg,
    });
    const body = (ws: ReturnType<typeof w>[]) => ({ weights: ws }) as unknown as BodyMetrics;

    it('needs four weigh-ins spanning 45+ days; compares the latest with a weigh-in 60+ days old', () => {
      const c = find(trends([], body([w(100, 90), w(70, 88), w(30, 86), w(1, 81)])), 'bw-trend')!;
      expect(c).toMatchObject({
        type: 'trend',
        level: 'info',
        severity: 34,
        icon: 'scales',
        kicker: T.bodyweight,
        headline: '81.0 kg',
        hero: '81.0',
        heroUnit: 'kg',
        deltaPct: -10, // (81 - 90) / 90: the oldest weigh-in at least 60 days old is the 100-day-old 90 kg
      });
    });

    it('baseline is the OLDEST weigh-in that is at least 60 days old', () => {
      const c = find(trends([], body([w(100, 100), w(70, 90), w(30, 90), w(1, 90)])), 'bw-trend')!;
      expect(c.deltaPct).toBe(-10);
    });

    it('with no weigh-in 60 days old it falls back to the first one; an unchanged weight reads null', () => {
      const c = find(trends([], body([w(50, 80), w(30, 80), w(10, 80), w(1, 80)])), 'bw-trend')!;
      expect(c.deltaPct).toBeNull();
      const up = find(trends([], body([w(50, 80), w(30, 82), w(10, 84), w(1, 88)])), 'bw-trend')!;
      expect(up.deltaPct).toBe(10);
    });

    it('is omitted for fewer than four weigh-ins or a history under 45 days; spark = last ten', () => {
      expect(find(trends([], body([w(100, 90), w(50, 88), w(1, 85)])), 'bw-trend')).toBeUndefined();
      expect(
        find(trends([], body([w(40, 90), w(30, 88), w(10, 86), w(1, 85)])), 'bw-trend'),
      ).toBeUndefined();
      const many = Array.from({ length: 12 }, (_, i) => w(100 - i * 9, 90 - i));
      expect(find(trends([], body(many)), 'bw-trend')!.spark).toHaveLength(10);
    });

    it('tolerates missing body metrics', () => {
      expect(() => computeTrends([], undefined as unknown as BodyMetrics, NOW)).not.toThrow();
    });
  });
});

describe('plateau tip', () => {
  const series = (pts: [number, number][]) =>
    pts.map(([d, kg]) => sess(d, [lift('Zed Bench', 'chest', [set(kg, 5)])]));

  it('flags a lift whose top weight has been flat for 5+ weeks despite regular sessions', () => {
    // high of 100 set 80 days ago and matched (not beaten) since
    const ws = series([
      [120, 90],
      [100, 95],
      [80, 100],
      [40, 100],
      [20, 100],
    ]);
    const c = find(trends(ws), 'plateau:Zed Bench')!;
    expect(c).toMatchObject({
      type: 'tip',
      level: 'risk',
      severity: 92,
      attention: true,
      icon: 'chart-line-up',
      headline: T.liftStalling('Zed Bench'),
      detail: T.stallDetail(11), // floor(80 / 7)
    });
    expect(find(trends(ws), 'progress:Zed Bench')).toBeUndefined();
  });

  it('is not raised when the lift is progressing, too young, or rarely trained', () => {
    const progressing = series([
      [120, 90],
      [100, 95],
      [80, 100],
      [40, 100],
      [20, 105],
    ]);
    expect(find(trends(progressing), 'plateau:Zed Bench')).toBeUndefined();
    const fresh = series([
      [120, 90],
      [100, 95],
      [30, 100],
      [20, 100],
      [10, 100],
    ]);
    expect(find(trends(fresh), 'plateau:Zed Bench')).toBeUndefined(); // new high only 30 days ago (4 weeks)
    const sparse = series([
      [120, 90],
      [100, 95],
      [80, 100],
      [60, 100],
      [44, 100],
    ]);
    expect(find(trends(sparse), 'plateau:Zed Bench')).toBeUndefined(); // no sessions in the last 42 days
    const four = series([
      [100, 95],
      [80, 100],
      [40, 100],
      [20, 100],
    ]);
    expect(find(trends(four), 'plateau:Zed Bench')).toBeUndefined(); // fewer than 5 data points
  });

  it('reports one plateau at most, for the first stalled lift by frequency', () => {
    const stuck = (name: string) =>
      [
        [120, 90],
        [100, 95],
        [80, 100],
        [40, 100],
        [20, 100],
      ].map(([d, kg]) => sess(d, [lift(name, 'chest', [set(kg, 5)])]));
    const ws = [...stuck('Zed A'), ...stuck('Zed B')];
    expect(keys(trends(ws)).filter((k) => k.startsWith('plateau:'))).toHaveLength(1);
  });
});

describe('recovery tip', () => {
  const chestDay = (daysAgo: number, n = 3) => sess(daysAgo, [lift('Zed Press', 'chest', sets(n))]);

  it('flags the same muscle hit hard three times within 5 days', () => {
    const c = find(trends([chestDay(10), chestDay(8), chestDay(6)]), 'recovery')!;
    expect(c).toMatchObject({
      type: 'tip',
      level: 'warn',
      severity: 64,
      icon: 'clock-countdown',
      headline: T.recovery(M.chest),
      detail: T.recoveryDetail(5), // span 4 days + 1
    });
  });

  it('a 6-day span is fine, as are light sessions (<3 sets) and non-major muscles', () => {
    expect(find(trends([chestDay(12), chestDay(9), chestDay(6)]), 'recovery')).toBeUndefined();
    expect(
      find(trends([chestDay(10, 2), chestDay(8, 2), chestDay(6, 2)]), 'recovery'),
    ).toBeUndefined();
    const forearm = (d: number) => sess(d, [lift('Zed Wrist', 'forearms', sets(5))]);
    expect(find(trends([forearm(10), forearm(8), forearm(6)]), 'recovery')).toBeUndefined();
  });

  it('only the last 28 days are considered', () => {
    expect(find(trends([chestDay(40), chestDay(38), chestDay(36)]), 'recovery')).toBeUndefined();
  });

  it('two sessions on the same calendar day count as one training day', () => {
    const w = [chestDay(10), { ...chestDay(10), id: 'dup' }, chestDay(9)];
    expect(find(trends(w), 'recovery')).toBeUndefined();
  });

  it('reports the tightest cluster across muscles', () => {
    const legDay = (d: number) => sess(d, [lift('Zed Squat', 'quads', sets(4))]);
    const c = find(
      trends([chestDay(14), chestDay(12), chestDay(9), legDay(10), legDay(9), legDay(8)]),
      'recovery',
    )!;
    expect(c.headline).toBe(T.recovery(M.quads));
    expect(c.detail).toBe(T.recoveryDetail(3));
  });
});

describe('long rests tip', () => {
  /** Sets logged `gapSec` apart; 5 reps -> 30 s of work netted out of each gap. */
  const paced = (name: string, n: number, gapSec: number, daysAgo: number) => {
    const t0 = NOW - daysAgo * DAY;
    const ex = lift(
      name,
      'chest',
      Array.from({ length: n }, (_, i) => set(50, 5, { loggedAt: t0 + i * gapSec * 1000 })),
    );
    return { ...sess(daysAgo, [ex]), startedAt: t0 - 1000 };
  };

  it('flags an exercise averaging more than 2.5 minutes of rest over 5+ measured sets', () => {
    // 6 sets, 5 gaps of 300 s -> rest 270 s each = 4.5 min
    const c = find(trends([paced('Zed Curl', 6, 300, 3)]), 'rest')!;
    expect(c).toMatchObject({
      type: 'tip',
      level: 'warn',
      severity: 46,
      headline: T.longRests,
      detail: T.longRestsDetail(5, 'Zed Curl'), // round(270 / 60) = 5 (4.5 rounds up)
    });
  });

  it('needs 5 measured rests and an average above 150 s', () => {
    expect(find(trends([paced('Zed Curl', 5, 300, 3)]), 'rest')).toBeUndefined(); // only 4 gaps
    expect(find(trends([paced('Zed Curl', 6, 180, 3)]), 'rest')).toBeUndefined(); // 150 s exactly
    expect(find(trends([paced('Zed Curl', 6, 181, 3)]), 'rest')).toBeDefined(); // 151 s
  });

  it('picks the slowest exercise and ignores warm-ups and sessions older than 28 days', () => {
    const slow = paced('Zed Slow', 6, 400, 3);
    const medium = paced('Zed Medium', 6, 300, 4);
    expect(find(trends([medium, slow]), 'rest')!.detail).toBe(T.longRestsDetail(6, 'Zed Slow'));
    expect(find(trends([paced('Zed Old', 6, 400, 30)]), 'rest')).toBeUndefined();
    const t0 = NOW - 3 * DAY;
    const warm = lift(
      'Zed W',
      'chest',
      Array.from({ length: 6 }, (_, i) =>
        set(20, 5, { type: 'warmup', isWarmup: true, loggedAt: t0 + i * 400_000 }),
      ),
    );
    expect(find(trends([{ ...sess(3, [warm]), startedAt: t0 - 1000 }]), 'rest')).toBeUndefined();
  });
});

describe('short session day tip', () => {
  const at = (day: number, durationMin: number | null) => {
    const w = sess(0, [lift('Zed A', 'chest', sets(3))], durationMin);
    const startedAt = new Date(2026, 9, day, 12).getTime();
    return {
      ...w,
      startedAt,
      finishedAt: durationMin === null ? null : startedAt + durationMin * 60_000,
    };
  };

  it('names the weekday whose sessions run well short of the usual', () => {
    // Fridays (Oct 2, 9) run 30 min; other days 90 min. Oct 2026: Fri 2, 9
    const ws = [at(2, 30), at(9, 30), at(5, 90), at(6, 90), at(7, 90), at(12, 90)];
    const c = find(trends(ws), 'timing')!;
    const friday = fmtWeekday(new Date(2024, 0, 7 + 5).getTime());
    expect(c).toMatchObject({
      type: 'tip',
      level: 'warn',
      severity: 44,
      headline: T.timeOn(friday),
      detail: T.timeOnDetail(30),
      action: T.addToDay(friday),
      actionHref: '#/programs',
    });
  });

  it('needs two sessions on the day, under 42 minutes, and 8+ minutes below average', () => {
    expect(
      find(trends([at(2, 30), at(5, 90), at(6, 90), at(7, 90), at(12, 90)]), 'timing'),
    ).toBeUndefined(); // one Friday only
    const notShort = [at(2, 45), at(9, 45), at(5, 90), at(6, 90), at(7, 90), at(12, 90)];
    expect(find(trends(notShort), 'timing')).toBeUndefined(); // 45 min is not "short"
    const closeToAvg = [at(2, 40), at(9, 40), at(5, 45), at(6, 45), at(7, 45), at(12, 45)];
    expect(find(trends(closeToAvg), 'timing')).toBeUndefined(); // overall ~44: not 8 min lower
  });

  it('ignores unfinished, trivially short (<5 min) and overlong (>240 min) sessions', () => {
    const ws = [
      at(2, 30),
      at(9, 30),
      at(5, 90),
      at(6, 90),
      at(7, 90),
      at(12, 90),
      at(14, 1),
      at(14, 300),
      at(14, null),
    ];
    expect(find(trends(ws), 'timing')!.detail).toBe(T.timeOnDetail(30));
  });
});

describe('neglected lift tip', () => {
  const lifts = (name: string, daysAgo: number[]) =>
    daysAgo.map((d) => sess(d, [lift(name, 'chest', sets(1))]));

  it('flags a lift trained 5+ times in days 30-180 and not at all for the last 30', () => {
    const c = find(trends(lifts('Zed Deadlift', [40, 50, 60, 70, 80, 90])), 'neglect')!;
    expect(c).toMatchObject({
      type: 'tip',
      level: 'warn',
      severity: 50,
      headline: T.neglect('Zed Deadlift', 5), // last done 40 days ago = 5 whole weeks
      detail: T.neglectDetail,
    });
  });

  it('not when it was trained within the last 30 days, or too rarely', () => {
    expect(find(trends(lifts('Zed D', [10, 50, 60, 70, 80, 90])), 'neglect')).toBeUndefined();
    expect(find(trends(lifts('Zed D', [40, 50, 60, 70])), 'neglect')).toBeUndefined();
    // 30 days ago still counts as recent; 31 days ago is a lapse of four whole weeks
    expect(find(trends(lifts('Zed D', [30, 50, 60, 70, 80, 90])), 'neglect')).toBeUndefined();
    expect(find(trends(lifts('Zed D', [31, 50, 60, 70, 80, 90])), 'neglect')!.headline).toBe(
      T.neglect('Zed D', 4),
    );
  });

  it('picks the lift with the longer history', () => {
    const ws = [
      ...lifts('Zed Short', [40, 50, 60, 70, 80]),
      ...lifts('Zed Long', [41, 51, 61, 71, 81, 91, 101]),
    ];
    expect(find(trends(ws), 'neglect')!.headline).toBe(T.neglect('Zed Long', 5));
  });
});

describe('no rest day tip', () => {
  const run = (days: number[]) => days.map((d) => sess(d, [lift('Zed A', 'chest', sets(1))]));

  it('flags six training days in a row within the last two weeks', () => {
    const c = find(trends(run([0, 1, 2, 3, 4, 5])), 'no-rest')!;
    expect(c).toMatchObject({
      type: 'tip',
      level: 'warn',
      severity: 68,
      icon: 'warning-circle',
      headline: T.noRest,
      detail: T.noRestDetail(6),
    });
    expect(find(trends(run([0, 1, 2, 3, 4, 5, 6, 7])), 'no-rest')!.detail).toBe(T.noRestDetail(8));
  });

  it('five in a row, or a gap in the chain, is fine', () => {
    expect(find(trends(run([0, 1, 2, 3, 4])), 'no-rest')).toBeUndefined();
    expect(find(trends(run([0, 1, 2, 4, 5, 6])), 'no-rest')).toBeUndefined();
  });

  it('looks back 16 days only', () => {
    expect(find(trends(run([20, 21, 22, 23, 24, 25])), 'no-rest')).toBeUndefined();
  });
});

describe('volume spike tip', () => {
  const vol = (daysAgo: number, kg: number) =>
    sess(daysAgo, [lift('Zed A', 'chest', [set(kg, 1)])]);

  it('flags a recent two-week rate 40%+ above the prior four weeks', () => {
    // recent 14 d: 2800 kg -> 1400/wk ; prior 14-42 d: 2000 kg -> 500/wk ... use a ratio of exactly 2
    const c = find(trends([vol(60, 1), vol(5, 2000), vol(20, 1000)]), 'vol-spike')!;
    // recent = 2000 / 2 = 1000 ; prior = 1000 / 4 = 250 -> +300%
    expect(c).toMatchObject({
      type: 'tip',
      level: 'warn',
      severity: 66,
      icon: 'chart-line-up',
      headline: T.volSpike,
      detail: T.volSpikeDetail(300),
    });
  });

  it('the 40% line is inclusive on the recent side and needs a prior baseline and 30 days of history', () => {
    // prior = 4000/4 = 1000/wk ; recent must be >= 1400/wk -> 2800 kg in 14 d
    const edge = find(trends([vol(60, 1), vol(5, 2800), vol(20, 4000)]), 'vol-spike')!;
    expect(edge.detail).toBe(T.volSpikeDetail(40));
    expect(find(trends([vol(60, 1), vol(5, 2790), vol(20, 4000)]), 'vol-spike')).toBeUndefined();
    expect(find(trends([vol(60, 1), vol(5, 2000)]), 'vol-spike')).toBeUndefined(); // no prior volume
    expect(find(trends([vol(5, 2000), vol(20, 100)]), 'vol-spike')).toBeUndefined(); // history under 30 days
  });
});

describe('area on pause tip', () => {
  const area = (daysAgo: number, primary: string, n: number) =>
    sess(daysAgo, [lift('Zed X', primary, sets(n))]);

  it('flags an area with 8+ sets between 14 and 90 days ago and nothing in the last 14', () => {
    const c = find(
      trends([area(30, 'lats', 5), area(40, 'traps', 3), area(3, 'chest', 5)]),
      'stale',
    )!;
    expect(c).toMatchObject({
      type: 'tip',
      level: 'warn',
      severity: 62,
      icon: 'warning-circle',
      headline: T.onPause('Back'),
      detail: T.onPauseDetail,
    });
  });

  it('is quiet when the whole area still gets some work (any member), or history is thin', () => {
    expect(find(trends([area(30, 'lats', 8), area(3, 'traps', 1)]), 'stale')).toBeUndefined();
    expect(find(trends([area(30, 'lats', 7)]), 'stale')).toBeUndefined();
    expect(find(trends([area(95, 'lats', 12)]), 'stale')).toBeUndefined(); // too old
    expect(find(trends([area(14, 'lats', 12)]), 'stale')).toBeUndefined(); // 14 days is still "recent"
  });

  it('names the stale area with the most history', () => {
    const c = find(trends([area(30, 'lats', 8), area(30, 'quads', 12)]), 'stale')!;
    expect(c.headline).toBe(T.onPause('Legs'));
  });
});

describe('long sessions tip', () => {
  const longish = (daysAgo: number, min: number) =>
    sess(daysAgo, [lift('Zed A', 'chest', sets(1))], min);

  it('flags an average above 100 minutes over 3+ recent sessions', () => {
    const c = find(trends([longish(2, 110), longish(5, 105), longish(9, 120)]), 'long-sessions')!;
    expect(c).toMatchObject({
      type: 'tip',
      level: 'warn',
      severity: 48,
      icon: 'clock-countdown',
      headline: T.longSessions,
      detail: T.longSessionsDetail(112),
    });
  });

  it('needs three sessions, an average over 100, and drops outliers (>=300 or <=5 min) and unfinished ones', () => {
    expect(find(trends([longish(2, 130), longish(5, 130)]), 'long-sessions')).toBeUndefined();
    expect(
      find(trends([longish(2, 100), longish(5, 100), longish(9, 100)]), 'long-sessions'),
    ).toBeUndefined();
    const noisy = [
      longish(2, 120),
      longish(5, 120),
      longish(9, 120),
      longish(10, 300),
      longish(11, 5),
      sess(12, [], null),
    ];
    expect(find(trends(noisy), 'long-sessions')!.detail).toBe(T.longSessionsDetail(120));
    expect(
      find(trends([longish(2, 120), longish(5, 120), longish(30, 120)]), 'long-sessions'),
    ).toBeUndefined();
  });
});

describe('weekly streak tip', () => {
  // The streak steps back in exact 7 x 24 h blocks, which only lands on local week starts when no DST change falls inside the run.
  let tzBefore: string | undefined;
  beforeEach(() => {
    tzBefore = process.env.TZ;
    process.env.TZ = 'UTC';
  });
  afterEach(() => {
    if (tzBefore === undefined) delete process.env.TZ;
    else process.env.TZ = tzBefore;
  });

  const weekly = (n: number, startOffset = 0) =>
    Array.from({ length: n }, (_, i) =>
      sess(startOffset + i * 7, [lift('Zed A', 'chest', sets(1))]),
    );

  it('counts consecutive training weeks ending this week', () => {
    const c = find(trends(weekly(5)), 'streak')!;
    expect(c).toMatchObject({
      type: 'tip',
      level: 'good',
      severity: 42,
      icon: 'calendar-check',
      headline: T.streak(5),
      detail: T.streakDetail(5),
    });
    expect(find(trends(weekly(4)), 'streak')!.headline).toBe(T.streak(4));
  });

  it('three weeks is not yet a streak; a missed week breaks it', () => {
    expect(find(trends(weekly(3)), 'streak')).toBeUndefined();
    expect(find(trends([...weekly(2), ...weekly(3, 28)]), 'streak')).toBeUndefined();
  });

  it('an empty current week does not break the streak (grace until the week ends)', () => {
    // NOW is Thursday; train Mon of this week? no: start from last week (7-13 days ago)
    expect(find(trends(weekly(4, 7)), 'streak')!.headline).toBe(T.streak(4));
    // but a gap of a full week does
    expect(find(trends(weekly(4, 14)), 'streak')).toBeUndefined();
  });
});

describe('localisation', () => {
  it('headlines follow the active locale and fall back to the raw exercise name', () => {
    setLocale('uk');
    try {
      const uk = LOCALES.uk.trends;
      const ws = [10, 20, 30].map((d) =>
        sess(d, [lift('Zed Press', 'chest', sets(12)), lift('Zed Row', 'lats', sets(3))]),
      );
      const c = find(trends(ws), 'balance-pp')!;
      expect(c.headline).toBe(uk.balLow(uk.pull));
      expect(c.headline).not.toBe(T.balLow(T.pull));
      const stat = find(
        trends([sess(5, [lift('Zed Squat', 'quads', sets(1, 100))])]),
        'stat-best',
      )!;
      expect(stat.detail).toBe(uk.heaviestDetail('Zed Squat'));
    } finally {
      setLocale('en');
    }
  });
});
