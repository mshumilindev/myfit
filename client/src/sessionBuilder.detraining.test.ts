/**
 * SPO-149: a muscle or lift that was not trained for weeks starts the day smaller and
 * lighter. Thresholds: docs/research/detraining.md section 4 (R0..R5).
 */
import { describe, expect, it } from 'vitest';
import { buildDay, sessionSetsForMuscle, warmupRamp, type BuildContext } from './sessionBuilder';
import { sessionSetsForMuscle as fromDose, warmupRamp as rampFromDose } from './sessionDose';
import type { Workout } from './types';

const local = (daysBack: number, hour = 9): number =>
  new Date(2026, 5, 15 - daysBack, hour).getTime();
const now = local(0, 12);

function workout(
  daysBack: number,
  name: string,
  primary: string,
  kg: number,
  reps: number,
): Workout {
  const startedAt = local(daysBack);
  return {
    id: `w${daysBack}`,
    startedAt,
    finishedAt: startedAt + 3_600_000,
    exercises: [
      {
        id: `e${daysBack}`,
        name,
        kind: 'strength',
        position: 0,
        primaryMuscle: primary,
        secondaryMuscles: [],
        sets: Array.from({ length: 3 }, (_, i) => ({
          id: `s${i}`,
          reps,
          weight: kg,
          isWarmup: false,
          type: 'working' as const,
        })),
      },
    ],
  } as unknown as Workout;
}

describe('the dose helpers stay reachable from sessionBuilder', () => {
  it('re-exports the same functions', () => {
    expect(sessionSetsForMuscle).toBe(fromDose);
    expect(warmupRamp).toBe(rampFromDose);
  });
});

describe('sessionSetsForMuscle with a muscle gap', () => {
  const lm = { mev: 8, mav: 16, mrv: 24 }; // 8 sets a session before any cut
  it('no gap, R0 and R1: as before', () => {
    const base = sessionSetsForMuscle(lm, 0, 2);
    expect(base).toBe(8);
    for (const g of [undefined, null, 0, 14, 15, 28])
      expect(sessionSetsForMuscle(lm, 0, 2, g)).toBe(base);
  });
  it.each([
    [28, 8],
    [29, 5], // x0.67
    [84, 5],
    [85, 5],
    [168, 5],
    [169, 4], // x0.5
    [364, 4],
    [365, 4],
  ])('gap %i days -> %i sets', (gap, sets) => {
    expect(sessionSetsForMuscle(lm, 0, 2, gap)).toBe(sets);
  });
  it('never goes below 2 sets and never above the normal dose', () => {
    const small = { mev: 2, mav: 4, mrv: 6 }; // normal floor is 3
    expect(sessionSetsForMuscle(small, 0, 2)).toBe(3);
    expect(sessionSetsForMuscle(small, 0, 2, 365)).toBe(2);
  });
});

describe('warmupRamp with a muscle gap', () => {
  const rungs = (kg: number, gapDays?: number | null) =>
    warmupRamp(kg, { gapDays }).map((s) => [s.weight, s.reps]);
  it('no gap, R0 and R1: the usual three-rung ramp', () => {
    const usual = [
      [20, 10],
      [60, 5],
      [80, 2],
    ];
    expect(rungs(100)).toEqual(usual);
    for (const g of [null, 0, 14, 15, 28]) expect(rungs(100, g)).toEqual(usual);
  });
  it('R2+ (29 days): one extra light rung of 40% x 8', () => {
    const extra = [
      [20, 10],
      [40, 8],
      [60, 5],
      [80, 2],
    ];
    for (const g of [29, 84, 85, 168, 169, 364, 365, 900]) expect(rungs(100, g)).toEqual(extra);
  });
  it('the extra rung is skipped when it would not sit above the empty bar', () => {
    // 50 kg: 40% = 20 = the bar
    expect(rungs(50, 60)).toEqual(rungs(50));
  });
  it('still no ramp for light, non-compound or non-weight work', () => {
    expect(warmupRamp(25, { gapDays: 90 })).toEqual([]);
    expect(warmupRamp(100, { gapDays: 90, compound: false })).toEqual([]);
    expect(warmupRamp(100, { gapDays: 90, loadType: 'band' })).toEqual([]);
    expect(warmupRamp(null, { gapDays: 90 })).toEqual([]);
  });
});

describe('buildDay after a break', () => {
  const ctxFor = (finished: Workout[], extra: Partial<BuildContext> = {}): BuildContext => ({
    finished,
    activities: [],
    body: null,
    goals: undefined,
    gym: null,
    now,
    intent: 'muscle',
    targetMuscles: ['chest'],
    bodyKg: 82,
    sex: 'male',
    ...extra,
  });
  // The lift the builder anchors chest with when there is no history (a catalog fact, not a literal).
  const LIFT = buildDay(ctxFor([])).main.find((e) => e.primary === 'chest')!.name;
  const bench = (daysBack: number) => [
    workout(daysBack, LIFT, 'chest', 80, 6),
    workout(daysBack + 7, LIFT, 'chest', 77.5, 6),
  ];
  const chestLift = (c: BuildContext) => buildDay(c).main.find((e) => e.name === LIFT)!;

  it('trained last week: unchanged (not a return)', () => {
    const lift = chestLift(ctxFor(bench(5)));
    expect(lift.progState).not.toBe('return');
    expect(lift.targetWeight).toBe(80);
  });

  it('a 2-3 week gap (R1) holds the weight, no jump', () => {
    const lift = chestLift(ctxFor(bench(21)));
    expect(lift.progState).toBe('return');
    expect(lift.targetWeight).toBe(80);
    expect(lift.deltaKg).toBe(0);
  });

  it('a 60-day gap (R2) starts lighter, with fewer sets and an extra warm-up rung', () => {
    const recent = chestLift(ctxFor(bench(5)));
    const lift = chestLift(ctxFor(bench(60)));
    expect(lift.progState).toBe('return');
    expect(lift.targetWeight).toBe(72.5); // 80 x 0.9
    expect(lift.deltaKg).toBe(-7.5);
    expect(lift.sets).toBeLessThanOrEqual(recent.sets);
    expect(lift.warmup.map((s) => s.weight)).toContain(30); // 40% of 72.5 -> 30
    expect(recent.warmup.length).toBeLessThan(lift.warmup.length);
  });

  it('total chest sets shrink after a long break', () => {
    const sets = (c: BuildContext) =>
      buildDay(c)
        .main.filter((e) => e.primary === 'chest')
        .reduce((t, e) => t + e.sets, 0);
    expect(sets(ctxFor(bench(400)))).toBeLessThanOrEqual(sets(ctxFor(bench(5))));
  });

  it('a rehab cap and a break do not multiply: the lower of the two wins', () => {
    // break alone gives 72.5; cap 0.95 of the last weight (80) is 76 -> 75, so the break wins
    const mild = chestLift(ctxFor(bench(60), { loadCaps: new Map([['chest', 0.95]]) }));
    expect(mild.targetWeight).toBe(72.5);
    // a cap of 0.5 of the last weight is 40, below the break cut
    const strict = chestLift(ctxFor(bench(60), { loadCaps: new Map([['chest', 0.5]]) }));
    expect(strict.targetWeight).toBe(40);
    // without a break the cap behaves as before (weight x cap)
    const plain = chestLift(ctxFor(bench(5), { loadCaps: new Map([['chest', 0.5]]) }));
    expect(plain.targetWeight).toBe(40);
  });
});
