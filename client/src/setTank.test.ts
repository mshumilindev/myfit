import { describe, expect, it } from 'vitest';
import {
  TANK_PARAMS,
  displayHeight,
  referenceE1rm,
  setE1rm,
  setTanks,
  tankColour,
  type TankExercise,
} from './setTank';
import { T0, W, WU, chain, lift } from './setTank.testHelpers';

const ids = (p: string, n: number) => Array.from({ length: n }, (_, i) => `${p}${i + 1}`);
const col = (
  ex: TankExercise[],
  key: 'tank' | 'before' | 'barHeight' | 'fat',
  p: string,
  n: number,
  ready = new Map<string, number>(),
) => {
  const r = setTanks({ exercises: ex, readiness: ready });
  return ids(p, n).map((id) => r.get(id)![key]);
};
const near = (got: number[], want: number[], digits = 3) =>
  want.forEach((w, i) => expect(got[i]).toBeCloseTo(w, digits));

const exA = (rest = 90) =>
  lift(
    'a',
    'chest',
    chain('a', [WU(8, 60), WU(8, 100, rest), WU(8, 130, rest), W(5, 150, rest, { rpe: 6 })]),
    {
      e1rmRef: 195,
    },
  );
const exB = () =>
  lift(
    'b',
    'chest',
    chain('b', [WU(15, 40), W(8, 60, 59, { rpe: 6 }), W(8, 60, 26, { rpe: 7.5 })]),
    {
      e1rmRef: 84,
    },
  );

describe('Example A: warm-ups then a working set (spec §3.1)', () => {
  it('tank at the end of each set (bar = after the set)', () => {
    near(col([exA()], 'tank', 'a', 4), [0.982, 0.9178, 0.7605, 0.6219]);
  });
  it('start-of-set levels reproduce the spec model values', () => {
    near(col([exA()], 'before', 'a', 4), [1, 0.982, 0.9178, 0.7605]);
  });
  it('display heights are the concave stretch and strictly fall', () => {
    const h = col([exA()], 'barHeight', 'a', 4);
    near(h, [0.866, 0.7133, 0.5106, 0.3851]);
    for (let i = 1; i < h.length; i++) expect(h[i]).toBeLessThan(h[i - 1]);
  });
  it('order is preserved for other rests; longer rest never lowers the working bar', () => {
    let last = 0;
    for (const rest of [45, 90, 180, 300]) {
      const t = col([exA(rest)], 'tank', 'a', 4);
      for (let i = 1; i < 4; i++) expect(t[i]).toBeLessThan(t[i - 1]);
      expect(t[3]).toBeGreaterThanOrEqual(last);
      last = t[3];
    }
  });
});

describe('Example B: no second wind (spec §3.2)', () => {
  it('tanks and start levels', () => {
    near(col([exB()], 'tank', 'b', 3), [0.8652, 0.6579, 0.4654]);
    near(col([exB()], 'before', 'b', 3), [1, 0.8652, 0.6579]);
  });
  it('the third bar is lower than the second, by >= 0.15 of tank', () => {
    const t = col([exB()], 'tank', 'b', 3);
    const h = col([exB()], 'barHeight', 'b', 3);
    expect(h[2]).toBeLessThan(h[1]);
    expect(t[1] - t[2]).toBeGreaterThanOrEqual(0.15);
    near(h, [0.6328, 0.4151, 0.2689]);
  });
  it('the third bar does not depend on its own RPE (no second wind)', () => {
    const base = col([exB()], 'before', 'b', 3)[2];
    for (const rpe of [5, 6, 7.5, 10]) {
      const ex = lift(
        'b',
        'chest',
        chain('b', [WU(15, 40), W(8, 60, 59, { rpe: 6 }), W(8, 60, 26, { rpe })]),
        {
          e1rmRef: 84,
        },
      );
      expect(col([ex], 'before', 'b', 3)[2]).toBeCloseTo(base, 12);
    }
  });
});

describe('Example C: drop set with 3 drops (spec §3.3)', () => {
  const sets = (drops: boolean) =>
    lift(
      'c',
      'chest',
      chain('c', [
        W(8, 100, 0, { rpe: 8 }),
        drops
          ? {
              reps: 8,
              weight: 100,
              rest: 120,
              type: 'drop',
              drops: [
                { weight: 80, reps: 8 },
                { weight: 60, reps: 10 },
                { weight: 50, reps: 12 },
              ],
            }
          : W(8, 100, 120, {}),
        W(6, 100, 120, { rpe: 8.5 }),
      ]),
      { e1rmRef: 133.3 },
    );
  it('three drops tire the next set much more than the plain set', () => {
    const d = col([sets(true)], 'before', 'c', 3);
    const p = col([sets(false)], 'before', 'c', 3);
    near(d, [1, 0.6852, 0.0946]);
    near(p, [1, 0.6852, 0.4694]);
    expect(p[2] - d[2]).toBeGreaterThanOrEqual(0.1);
  });
  it('the drop set bar sits on the floor and the bar never disappears', () => {
    expect(col([sets(true)], 'tank', 'c', 3)[1]).toBeCloseTo(0.0946, 3);
    expect(col([sets(true)], 'barHeight', 'c', 3)[1]).toBe(TANK_PARAMS.displayFloor);
  });
  it('reverse-drop is the same as drop in performed order', () => {
    const rev = lift(
      'c',
      'chest',
      chain('c', [
        {
          reps: 8,
          weight: 60,
          type: 'reverse-drop',
          drops: [
            { weight: 80, reps: 8 },
            { weight: 100, reps: 6 },
          ],
        },
      ]),
    );
    const drp = lift(
      'c',
      'chest',
      chain('c', [
        {
          reps: 8,
          weight: 60,
          type: 'drop',
          drops: [
            { weight: 80, reps: 8 },
            { weight: 100, reps: 6 },
          ],
        },
      ]),
    );
    expect(col([rev], 'tank', 'c', 1)).toEqual(col([drp], 'tank', 'c', 1));
  });
});

describe('Example D: superset A1 B1 A2 B2 by real timestamps (spec §3.4)', () => {
  const build = (order: 'superset' | 'sequential') => {
    const A = (i: number, at: number) => ({
      id: `A${i}`,
      position: i - 1,
      reps: 8,
      weight: 80,
      type: 'working' as const,
      rpe: 8,
      loggedAt: T0 + at * 1000,
    });
    const B = (i: number, at: number) => ({
      id: `B${i}`,
      position: i - 1,
      reps: 12,
      weight: 30,
      type: 'working' as const,
      rpe: 8,
      loggedAt: T0 + at * 1000,
    });
    const a = order === 'superset' ? [A(1, 0), A(2, 126)] : [A(1, 0), A(2, 66)];
    const b = order === 'superset' ? [B(1, 66), B(2, 192)] : [B(1, 126), B(2, 192)];
    return [lift('A', 'chest', a, { secondary: ['triceps'] }), lift('B', 'triceps', b)];
  };
  it('triceps bars follow the interleaved order, chest rest includes the partner set', () => {
    const r = setTanks({ exercises: build('superset'), readiness: new Map() });
    near([r.get('B1')!.before, r.get('B2')!.before], [0.8426, 0.4621]);
    near([r.get('B1')!.tank, r.get('B2')!.tank], [0.5484, 0.3007]);
    near([r.get('A2')!.before], [0.6852]);
  });
  it('the same sets done one lift after the other give different tanks', () => {
    const a = setTanks({ exercises: build('superset'), readiness: new Map() });
    const b = setTanks({ exercises: build('sequential'), readiness: new Map() });
    expect(Math.abs(a.get('B1')!.before - b.get('B1')!.before)).toBeGreaterThan(0.1);
  });
  it('secondary muscle credit: a lift with secondary triceps tires a later triceps lift', () => {
    const only = lift('B', 'triceps', [build('superset')[1].sets[0]]);
    const withA = setTanks({ exercises: build('superset'), readiness: new Map() }).get('B1')!;
    const alone = setTanks({ exercises: [only], readiness: new Map() }).get('B1')!;
    expect(withA.before).toBeLessThan(alone.before);
  });
});

describe('Example E: yesterday + readiness input (spec §3.5)', () => {
  const three = () =>
    lift(
      'e',
      'chest',
      chain('e', [W(8, 80, 0, { rpe: 8 }), W(8, 80, 120, { rpe: 8 }), W(8, 80, 120, { rpe: 8 })]),
    );
  it('start = 1 - λ(1 - readiness)', () => {
    near(col([three()], 'before', 'e', 3, new Map([['chest', 0.25]])), [0.8125, 0.5567, 0.3814], 3);
    near(col([three()], 'before', 'e', 3), [1, 0.6852, 0.4694], 3);
  });
  it('a muscle with no readiness data is fresh; out-of-range readiness is clamped', () => {
    expect(col([three()], 'before', 'e', 1, new Map([['back', 0]]))[0]).toBe(1);
    expect(col([three()], 'before', 'e', 1, new Map([['chest', -3]]))[0]).toBeCloseTo(0.75, 12);
    expect(col([three()], 'before', 'e', 1, new Map([['chest', 7]]))[0]).toBe(1);
  });
  it('no history and no RPE: reps in reserve default to 2, then a reference appears', () => {
    const ex = lift('n', 'chest', chain('n', [W(8, 100, 0), W(8, 100, 120), W(8, 100, 120)]));
    near(col([ex], 'before', 'n', 3), [1, 0.6852, 0.4694]);
    expect(setE1rm(ex.sets[0])).toBeCloseTo(100 * (1 + 10 / 30), 9);
  });
});

describe('RIR sources and edge cases (spec §4)', () => {
  const one = (o: Parameters<typeof W>[3], ex: Partial<TankExercise> = {}, w = 100, reps = 5) =>
    col([lift('x', 'chest', chain('x', [W(reps, w, 0, o)]), ex)], 'tank', 'x', 1)[0];
  it('failure, auto failure and partials all mean RIR 0 and beat RPE', () => {
    const f = one({ failure: 'manual', rpe: 5 });
    expect(f).toBeCloseTo(1 - TANK_PARAMS.failCost, 9);
    expect(one({ failure: 'auto' })).toBeCloseTo(f, 12);
    expect(one({ partials: 2, rpe: 6 })).toBeCloseTo(f, 12);
    expect(one({ failure: 'no', rpe: 10 })).toBeCloseTo(f, 12); // RPE 10 = RIR 0
  });
  it('rpe beats rpeAuto beats e1RM beats the default', () => {
    const rpe = one({ rpe: 9, rpeAuto: 5 });
    expect(rpe).toBeCloseTo(one({ rpe: 9 }), 12);
    expect(one({ rpeAuto: 9 })).toBeCloseTo(rpe, 12);
    // e1RM path: 100 kg x5 against a 120 reference -> RTF 30*(1.2-1)=6 -> RIR 1
    expect(one({}, { e1rmRef: 120 })).toBeCloseTo(one({ rpe: 9 }), 12);
    expect(one({}, { e1rmRef: 0 })).toBeCloseTo(one({ rpe: 8 }), 12); // default RIR 2
  });
  it('a heavier-than-reference set with no RPE is read as to failure', () => {
    expect(one({}, { e1rmRef: 90 })).toBeCloseTo(one({ failure: 'manual' }), 12);
  });
  it('an unrated warm-up without reference uses the fixed share; with one, Epley', () => {
    const wu = (ex: Partial<TankExercise>) =>
      col([lift('w', 'chest', chain('w', [WU(8, 60)]), ex)], 'tank', 'w', 1)[0];
    expect(wu({})).toBeCloseTo(1 - TANK_PARAMS.failCost * TANK_PARAMS.warmUnknownU ** 1.5, 12);
    expect(wu({ e1rmRef: 195 })).toBeCloseTo(0.982, 3);
  });
  it('bodyweight / band / assist: no Epley path, default RIR; warm-up uses the fixed share', () => {
    const bw = (weighted: boolean, weight: number | null) =>
      col(
        [lift('b', 'chest', chain('b', [W(8, weight as number)]), { weighted, e1rmRef: 200 })],
        'tank',
        'b',
        1,
      )[0];
    expect(bw(true, null)).toBeCloseTo(bw(false, 50), 12);
    expect(bw(true, null)).toBeCloseTo(one({ rpe: 8 }, {}, 100, 8), 12);
    const bwWarm = lift('b', 'chest', chain('b', [WU(8, 0)]), { weighted: false, e1rmRef: 200 });
    expect(col([bwWarm], 'tank', 'b', 1)[0]).toBeCloseTo(
      1 - TANK_PARAMS.failCost * TANK_PARAMS.warmUnknownU ** 1.5,
      12,
    );
    expect(setE1rm(bwWarm.sets[0], false)).toBe(0);
  });
  it('timed holds: reps are duration / 3 s, weight and reference are ignored', () => {
    const hold = (dur: number, extra = {}) =>
      col(
        [
          lift(
            'h',
            'abs',
            chain('h', [
              { reps: 1, weight: 20, type: 'static-dynamic', durationMin: dur, rpe: 8, ...extra },
            ]),
            { e1rmRef: 999 },
          ),
        ],
        'tank',
        'h',
        1,
      )[0];
    const reps = 60 / 3;
    expect(hold(1)).toBeCloseTo(1 - TANK_PARAMS.failCost * (reps / (reps + 2)) ** 1.5, 12);
    expect(hold(2)).toBeLessThan(hold(1));
    expect(hold(1, { weight: null })).toBeCloseTo(hold(1), 12);
    expect(
      setE1rm({
        id: 'h',
        reps: 1,
        weight: 20,
        type: 'static-dynamic',
        durationMin: 1,
        position: 0,
      }),
    ).toBe(0);
  });
  it('zero or negative reps cost nothing', () => {
    expect(one({}, {}, 100, 0)).toBe(1);
    expect(one({}, {}, 100, -3)).toBe(1);
  });
  it('an exercise with no known muscle gets a private fresh tank', () => {
    const a = lift('p', null, chain('p', [W(8, 100, 0, { rpe: 8 })]));
    const b = lift('q', null, chain('q', [W(8, 100, 0, { rpe: 8 })]));
    const r = setTanks({ exercises: [a, b], readiness: new Map() });
    expect(r.get('p1')!.before).toBe(1);
    expect(r.get('q1')!.before).toBe(1);
  });
  it('a warm-up after a working set never feeds the reference; working sets do, causally', () => {
    const ex = lift('r', 'chest', chain('r', [W(5, 100, 0, { rpe: 8 }), WU(8, 100, 90)]));
    const warmAfter = col([ex], 'tank', 'r', 2)[1];
    const ex2 = lift('r', 'chest', chain('r', [W(5, 100, 0, { rpe: 8 }), WU(8, 100, 90)]), {
      e1rmRef: 0,
    });
    expect(warmAfter).toBe(col([ex2], 'tank', 'r', 2)[1]);
    // set 1 itself is not influenced by its own e1RM
    const solo = lift('r', 'chest', [ex.sets[0]]);
    expect(col([solo], 'tank', 'r', 1)[0]).toBe(col([ex], 'tank', 'r', 2)[0]);
  });
  it('missing timestamps: positional order and restSec ?? 90 s', () => {
    const mk = (restSec: number | null | undefined) =>
      lift('m', 'chest', [
        { id: 'm1', position: 0, reps: 8, weight: 100, rpe: 8 },
        { id: 'm2', position: 1, reps: 8, weight: 100, rpe: 8, restSec },
      ]);
    const r = (restSec?: number | null) =>
      setTanks({ exercises: [mk(restSec)], readiness: new Map() }).get('m2')!.before;
    // The ratchet is on the END level: a rest (fallback 90 s or stored) cannot lift the next start.
    const end1 = 1 - TANK_PARAMS.failCost * 0.8 ** 1.5;
    expect(r()).toBeCloseTo(end1, 9);
    expect(r(300)).toBeCloseTo(end1, 9);
    expect(r(0)).toBeCloseTo(end1, 9);
  });
  it('a gap of 3 h or a cool-down in between is a full rest of the fast part', () => {
    const ex = (gapMin: number) =>
      lift('g', 'chest', [
        { id: 'g1', position: 0, reps: 8, weight: 100, rpe: 8, loggedAt: T0 },
        { id: 'g2', position: 1, reps: 8, weight: 100, rpe: 8, loggedAt: T0 + gapMin * 60000 },
      ]);
    const ds = (1 - TANK_PARAMS.fastShare) * TANK_PARAMS.failCost * 0.8 ** 1.5;
    expect(setTanks({ exercises: [ex(200)], readiness: new Map() }).get('g2')!.before).toBeCloseTo(
      1 - ds,
      9,
    );
    const cut = setTanks({ exercises: [ex(20)], readiness: new Map(), breaks: [T0 + 600000] });
    expect(cut.get('g2')!.before).toBeCloseTo(1 - ds, 9);
    // 20 min without a break is NOT a full rest: the start stays at the end level of set 1.
    const noCut = setTanks({ exercises: [ex(20)], readiness: new Map() });
    expect(noCut.get('g2')!.before).toBeCloseTo(1 - TANK_PARAMS.failCost * 0.8 ** 1.5, 9);
  });
  it('a deleted set: later rest is measured to the new previous set (never above the level before it)', () => {
    const full = lift(
      'd',
      'chest',
      chain('d', [W(8, 100, 0, { rpe: 9 }), W(8, 100, 60, { rpe: 9 }), W(8, 100, 60, { rpe: 9 })]),
    );
    const without = lift('d', 'chest', [full.sets[0], full.sets[2]]);
    const a = setTanks({ exercises: [full], readiness: new Map() });
    const b = setTanks({ exercises: [without], readiness: new Map() });
    expect(b.get('d3')!.before).toBeGreaterThan(a.get('d3')!.before);
    expect(b.get('d3')!.before).toBeLessThanOrEqual(a.get('d1')!.before);
    expect(b.get('d1')).toEqual(a.get('d1'));
  });
});

describe('Colour, display and reference helpers', () => {
  it('colour = worse of tank loss and measured rep loss', () => {
    expect(tankColour(1, 0)).toBe(0);
    expect(tankColour(0.6, 0)).toBeCloseTo(0.5, 12);
    expect(tankColour(0.75, 0)).toBeCloseTo(0.3125, 12);
    expect(tankColour(0.2, 0)).toBe(1);
    expect(tankColour(0.95, 0.05)).toBeCloseTo(0.5, 12);
    expect(tankColour(0.95, 0.05, 0.2)).toBeCloseTo(0.25, 12);
    expect(tankColour(0.95, 0.5, 0)).toBeCloseTo(0.0625, 12);
  });
  it('rep loss from performanceDrops paints a set red even when the tank is high', () => {
    const ex = lift(
      'f',
      'chest',
      chain('f', [W(8, 100, 0, { rpe: 6 }), W(8, 100, 300, { rpe: 6 })]),
      {
        perfDrop: new Map([['f2', 0.12]]),
      },
    );
    const r = setTanks({ exercises: [ex], readiness: new Map() });
    expect(r.get('f2')!.fat).toBe(1);
    expect(r.get('f1')!.fat).toBeLessThan(0.7);
  });
  it('display mapping: monotone, floored, 1 at full tank, stateless', () => {
    expect(displayHeight(1)).toBe(1);
    expect(displayHeight(0)).toBe(TANK_PARAMS.displayFloor);
    expect(displayHeight(0.99)).toBeCloseTo(0.9, 12);
    let last = 2;
    for (let t = 1; t >= -0.1; t -= 0.01) {
      const h = displayHeight(t);
      expect(h).toBeLessThanOrEqual(last);
      last = h;
    }
    expect(displayHeight(1.5)).toBe(1);
  });
  it('referenceE1rm: recent window first, else the best ever; reps in reserve count', () => {
    const day = 86400000;
    const s = (rpe: number) => [
      { id: 's', reps: 5, weight: 150, type: 'working' as const, rpe, position: 0 },
    ];
    expect(referenceE1rm([{ startedAt: T0 - day, sets: s(6) }], T0)).toBeCloseTo(195, 9);
    const old = { startedAt: T0 - 100 * day, sets: s(6) };
    const recent = { startedAt: T0 - 2 * day, sets: s(9) };
    expect(referenceE1rm([old, recent], T0)).toBeCloseTo(150 * (1 + 6 / 30), 9);
    expect(referenceE1rm([old], T0)).toBeCloseTo(195, 9);
    expect(referenceE1rm([], T0)).toBe(0);
  });
});
