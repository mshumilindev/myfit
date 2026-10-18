import { afterEach, describe, expect, it, vi } from 'vitest';
import { TANK_PARAMS, setTanks, type SetTank, type TankExercise } from './setTank';
import { T0, W, WU, chain, lift, prng, type Spec } from './setTank.testHelpers';

const CASES = 2000;

function randSpec(r: () => number, stated: boolean, first = false): Spec {
  const reps = 1 + Math.floor(r() * 20);
  const weight = r() < 0.1 ? null : 20 + Math.floor(r() * 180);
  const kind = r();
  const s: Spec = kind < 0.2 ? WU(reps, weight ?? 0) : W(reps, weight ?? 0);
  if (kind > 0.85) {
    s.type = r() < 0.5 ? 'drop' : 'reverse-drop';
    s.drops = Array.from({ length: 1 + Math.floor(r() * 3) }, () => ({
      reps: 1 + Math.floor(r() * 12),
      weight: 10 + Math.floor(r() * 100),
    }));
  }
  s.rest = first ? 0 : Math.floor(r() * 600);
  if (stated || r() < 0.6) s.rpe = 5 + Math.floor(r() * 11) / 2;
  if (!stated && r() < 0.1) s.failure = r() < 0.5 ? 'manual' : 'auto';
  if (!stated && r() < 0.05) s.partials = 2;
  return s;
}

function randLift(r: () => number, stated: boolean, n?: number) {
  const len = n ?? 1 + Math.floor(r() * 30);
  const specs = Array.from({ length: len }, (_, i) => randSpec(r, stated, i === 0));
  const ref = stated || r() < 0.3 ? 0 : 60 + r() * 200;
  return { specs, ref };
}

const run = (specs: Spec[], ref: number, ready = 1, id = 'x') =>
  setTanks({
    exercises: [lift(id, 'chest', chain(id, specs), { e1rmRef: ref })],
    readiness: new Map([['chest', ready]]),
  });
const list = (r: Map<string, SetTank>, n: number, id = 'x') =>
  Array.from({ length: n }, (_, i) => r.get(`${id}${i + 1}`)!);

describe('property tests (seeded, 2000 cases each)', () => {
  it('bounds, ratchet and monotone start levels', () => {
    const r = prng(1);
    for (let c = 0; c < CASES; c++) {
      const { specs, ref } = randLift(r, false);
      const out = list(run(specs, ref, r()), specs.length);
      out.forEach((o, i) => {
        for (const v of [o.tank, o.before, o.fat]) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
        }
        expect(o.barHeight).toBeGreaterThanOrEqual(TANK_PARAMS.displayFloor);
        expect(o.barHeight).toBeLessThanOrEqual(1);
        expect(o.tank).toBeLessThanOrEqual(o.before + 1e-12);
        if (i > 0) {
          expect(o.before).toBeLessThanOrEqual(out[i - 1].before + 1e-12); // no second wind
          expect(o.tank).toBeLessThanOrEqual(out[i - 1].before + 1e-12);
        }
      });
    }
  });

  it('with no rest, bars fall set after set', () => {
    const r = prng(2);
    for (let c = 0; c < CASES; c++) {
      const { specs, ref } = randLift(r, false);
      const nr = specs.map((s) => ({ ...s, rest: 0 }));
      const out = list(run(nr, ref), nr.length);
      for (let i = 1; i < out.length; i++)
        expect(out[i].tank).toBeLessThanOrEqual(out[i - 1].tank + 1e-12);
    }
  });

  it('more rest before a set never gives a lower tank and never exceeds the level before the previous set', () => {
    const r = prng(3);
    for (let c = 0; c < CASES; c++) {
      const { specs, ref } = randLift(r, false, 2 + Math.floor(r() * 12));
      const k = 1 + Math.floor(r() * (specs.length - 1));
      const lo = Math.floor(r() * 300);
      const hi = lo + 1 + Math.floor(r() * 600);
      const a = list(
        run(
          specs.map((s, i) => (i === k ? { ...s, rest: lo } : s)),
          ref,
        ),
        specs.length,
      );
      const b = list(
        run(
          specs.map((s, i) => (i === k ? { ...s, rest: hi } : s)),
          ref,
        ),
        specs.length,
      );
      expect(b[k].before).toBeGreaterThanOrEqual(a[k].before - 1e-12);
      expect(b[k].tank).toBeGreaterThanOrEqual(a[k].tank - 1e-12);
      expect(b[k].before).toBeLessThanOrEqual(a[k - 1].before + 1e-12);
      for (let i = 0; i < k; i++) expect(b[i]).toEqual(a[i]);
    }
  });

  it('more reps or weight in a set never give a higher tank for that set', () => {
    const r = prng(4);
    for (let c = 0; c < CASES; c++) {
      const { specs, ref } = randLift(r, false, 1 + Math.floor(r() * 8));
      const k = Math.floor(r() * specs.length);
      const more = specs.map((s, i) =>
        i === k
          ? {
              ...s,
              reps: s.reps + 1 + Math.floor(r() * 5),
              weight: (s.weight ?? 0) > 0 ? (s.weight as number) + Math.floor(r() * 30) : s.weight,
            }
          : s,
      );
      const a = list(run(specs, ref), specs.length)[k];
      const b = list(run(more, ref), specs.length)[k];
      expect(b.tank).toBeLessThanOrEqual(a.tank + 1e-12);
      expect(b.before).toBeCloseTo(a.before, 12);
    }
  });

  it('a harder set never leaves a higher start for the NEXT set (stated RPE, same rests)', () => {
    const r = prng(5);
    for (let c = 0; c < CASES; c++) {
      const { specs } = randLift(r, true, 2 + Math.floor(r() * 10));
      const k = Math.floor(r() * (specs.length - 1));
      const harder = specs.map((s, i) =>
        i === k ? { ...s, reps: s.reps + 1 + Math.floor(r() * 5), rpe: 10 } : s,
      );
      const a = list(run(specs, 0), specs.length);
      const b = list(run(harder, 0), specs.length);
      // Guaranteed one step ahead only: later sets can differ by a fraction of a percent
      // because a loss is a share of the CURRENT tank (spec §2.2, «Що не гарантується»).
      expect(b[k + 1].before).toBeLessThanOrEqual(a[k + 1].before + 1e-12);
      expect(b[k + 1].tank).toBeLessThanOrEqual(a[k + 1].tank + 1e-12);
    }
  });

  it('no second wind: the start of a set does not depend on its own RPE / failure / weight', () => {
    const r = prng(6);
    for (let c = 0; c < CASES; c++) {
      const { specs, ref } = randLift(r, false, 1 + Math.floor(r() * 10));
      const k = Math.floor(r() * specs.length);
      const edit = (s: Spec): Spec => ({
        ...s,
        rpe: 5 + Math.floor(r() * 11) / 2,
        failure: r() < 0.5 ? 'manual' : null,
        partials: r() < 0.3 ? 3 : null,
        weight: (s.weight ?? 0) + Math.floor(r() * 50),
      });
      const a = list(run(specs, ref), specs.length);
      const b = list(
        run(
          specs.map((s, i) => (i === k ? edit(s) : s)),
          ref,
        ),
        specs.length,
      );
      expect(b[k].before).toBeCloseTo(a[k].before, 12);
      for (let i = 0; i < k; i++) expect(b[i]).toEqual(a[i]);
    }
  });

  it('causality: appending or editing a later set leaves earlier bars bit-identical', () => {
    const r = prng(7);
    for (let c = 0; c < CASES; c++) {
      const { specs, ref } = randLift(r, false, 2 + Math.floor(r() * 10));
      const k = 1 + Math.floor(r() * (specs.length - 1));
      const base = list(run(specs, ref), specs.length);
      const appended = list(run([...specs, randSpec(r, false)], ref), specs.length);
      const edited = list(
        run(
          specs.map((s, i) => (i === k ? randSpec(r, false) : s)),
          ref,
        ),
        specs.length,
      );
      for (let i = 0; i < specs.length; i++) expect(appended[i]).toEqual(base[i]);
      for (let i = 0; i < k; i++) expect(edited[i]).toEqual(base[i]);
    }
  });

  it('supersets with secondary credit: bounded, and the ratchet holds along each muscle', () => {
    const r = prng(8);
    for (let c = 0; c < 500; c++) {
      const mk = (id: string, primary: string, secondary: string[]): TankExercise =>
        lift(id, primary, [], { secondary, e1rmRef: r() < 0.5 ? 0 : 150 });
      const exs = [
        mk('A', 'chest', ['triceps']),
        mk('B', 'triceps', []),
        mk('C', 'chest', ['shoulders']),
      ];
      let at = T0;
      const sets = exs.map(() => [] as TankExercise['sets'][number][]);
      const n = 3 + Math.floor(r() * 12);
      for (let i = 0; i < n; i++) {
        const xi = Math.floor(r() * 3);
        at += (20 + Math.floor(r() * 300)) * 1000;
        sets[xi].push({
          ...randSpec(r, false), // its `rest` is ignored: the stamps below carry the timing
          id: `${exs[xi].id}${sets[xi].length + 1}`,
          position: sets[xi].length,
          loggedAt: at,
        });
      }
      const input = exs.map((e, i) => ({ ...e, sets: sets[i] }));
      const out = setTanks({
        exercises: input,
        readiness: new Map([
          ['chest', r()],
          ['triceps', r()],
        ]),
      });
      const byMuscle = new Map<string, SetTank[]>();
      input.forEach((e) =>
        e.sets.forEach((s) => {
          const o = out.get(s.id)!;
          expect(o.tank).toBeGreaterThanOrEqual(0);
          expect(o.tank).toBeLessThanOrEqual(o.before + 1e-12);
          const arr = byMuscle.get(e.primary!) ?? [];
          arr.push({ ...o, fat: s.loggedAt as number });
          byMuscle.set(e.primary!, arr);
        }),
      );
      for (const arr of byMuscle.values()) {
        arr.sort((a, b) => a.fat - b.fat);
        for (let i = 1; i < arr.length; i++)
          expect(arr[i].before).toBeLessThanOrEqual(arr[i - 1].before + 1e-12);
      }
    }
  });
});

describe('rest recovery: no rise up to 60 s, a capped partial rise after longer rests', () => {
  const randSeries = (r: () => number, maxRest: number) => {
    const n = 2 + Math.floor(r() * 12);
    const specs: Spec[] = Array.from({ length: n }, (_, i) => ({
      ...randSpec(r, false, i === 0),
      reps: 1 + Math.floor(r() * 15),
      rest: i === 0 ? 0 : Math.floor(r() * (maxRest + 1)),
    }));
    return { specs, out: list(run(specs, r() < 0.5 ? 0 : 60 + r() * 200), n) };
  };

  it('random sets, rests 0-60 s, reps 1-15: the bar NEVER rises between adjacent sets', () => {
    const r = prng(11);
    for (let c = 0; c < CASES; c++) {
      const { out } = randSeries(r, 60);
      for (let i = 1; i < out.length; i++) {
        expect(out[i].tank).toBeLessThanOrEqual(out[i - 1].tank + 1e-12);
        expect(out[i].before).toBeLessThanOrEqual(out[i - 1].tank + 1e-12);
      }
    }
  });

  it('random sets, rests 0-180 s: a rise is at most the earned recovery and never above the previous start', () => {
    const r = prng(12);
    for (let c = 0; c < CASES; c++) {
      const { out } = randSeries(r, 180);
      for (let i = 1; i < out.length; i++) {
        expect(out[i].before).toBeLessThanOrEqual(out[i - 1].before + 1e-12); // cap 1
        expect(out[i].tank).toBeLessThanOrEqual(out[i - 1].before + 1e-12);
        // earned recovery = start - previous end; the new set's cost only reduces the rise
        expect(out[i].tank - out[i - 1].tank).toBeLessThanOrEqual(
          out[i].before - out[i - 1].tank + 1e-12,
        );
      }
    }
  });

  it('cap 1 for any rest below a real break: the start never exceeds the previous start', () => {
    const r = prng(13);
    for (let c = 0; c < CASES; c++) {
      const { out } = randSeries(r, 7000);
      for (let i = 1; i < out.length; i++)
        expect(out[i].before).toBeLessThanOrEqual(out[i - 1].before + 1e-12);
    }
  });

  it('more rest never gives a lower tank - and it is meaningful: 180 s is strictly higher than 30 s', () => {
    const r = prng(14);
    for (let c = 0; c < CASES; c++) {
      const { specs } = randSeries(r, 100);
      const k = 1 + Math.floor(r() * (specs.length - 1));
      const at = (rest: number) =>
        list(
          run(
            specs.map((s, i) => (i === k ? { ...s, rest } : s)),
            0,
          ),
          specs.length,
        )[k];
      let last = at(0);
      for (const rest of [30, 60, 90, 120, 180, 300, 1200]) {
        const cur = at(rest);
        expect(cur.before).toBeGreaterThanOrEqual(last.before - 1e-12);
        expect(cur.tank).toBeGreaterThanOrEqual(last.tank - 1e-12);
        last = cur;
      }
    }
    const fail = (rest: number) =>
      list(
        run([W(10, 100, 0, { failure: 'manual' }), W(10, 100, rest, { failure: 'manual' })], 0),
        2,
      )[1];
    expect(fail(180).tank).toBeGreaterThan(fail(30).tank + 0.05);
    expect(fail(30).tank).toBeCloseTo(fail(60).tank, 12); // no earned recovery up to 60 s
  });

  it('reviewer case 1: reps falling at a constant weight (10,8,7,6,5 @100 kg): rest 30/60 s never rise', () => {
    for (const rest of [30, 60]) {
      for (const stated of [false, true]) {
        const specs = [10, 8, 7, 6, 5].map((reps, i) =>
          W(reps, 100, i ? rest : 0, stated ? { rpe: 8 } : {}),
        );
        const out = list(run(specs, 0), 5);
        for (let i = 1; i < 5; i++)
          expect(out[i].tank).toBeLessThanOrEqual(out[i - 1].tank + 1e-12);
      }
    }
    // 90 s: a small rise is allowed, bounded by the earned recovery and the previous start
    const out = list(
      run(
        [10, 8, 7, 6, 5].map((n, i) => W(n, 100, i ? 90 : 0)),
        0,
      ),
      5,
    );
    expect(out[4].tank).toBeGreaterThan(out[3].tank);
    for (let i = 1; i < 5; i++) expect(out[i].tank).toBeLessThanOrEqual(out[i - 1].before + 1e-12);
  });

  it('reviewer case 2: a 12-rep failure set then a light 3 x 60 kg: 30/60 s do not lift the bar, 120 s may (capped)', () => {
    for (const rest of [30, 60]) {
      const out = list(run([W(12, 100, 0, { failure: 'manual' }), W(3, 60, rest)], 0), 2);
      expect(out[1].tank).toBeLessThanOrEqual(out[0].tank + 1e-12);
    }
    const out = list(run([W(12, 100, 0, { failure: 'manual' }), W(3, 60, 120)], 0), 2);
    expect(out[1].tank).toBeLessThanOrEqual(out[0].before + 1e-12);
  });

  it('a real break (3 h gap or cool-down) does lift the start again', () => {
    const base = lift('x', 'chest', [
      { id: 'x1', position: 0, reps: 10, weight: 100, failure: 'manual', loggedAt: T0 },
      {
        id: 'x2',
        position: 1,
        reps: 10,
        weight: 100,
        failure: 'manual',
        loggedAt: T0 + 4 * 3600000,
      },
    ]);
    const o = setTanks({ exercises: [base], readiness: new Map() });
    expect(o.get('x2')!.before).toBeGreaterThan(o.get('x1')!.tank);
  });

  it('NaN / Infinity reps do not poison later sets', () => {
    for (const bad of [Number.NaN, Infinity, -Infinity]) {
      const mk = (reps: number) =>
        list(
          run(
            [W(8, 100, 0, { rpe: 8 }), W(reps, 100, 60, { rpe: 8 }), W(8, 100, 60, { rpe: 8 })],
            0,
          ),
          3,
        );
      const o = mk(bad);
      for (const v of o) {
        for (const x of [v.tank, v.before, v.barHeight, v.fat])
          expect(Number.isFinite(x)).toBe(true);
      }
      expect(o[1].tank).toBeCloseTo(o[0].tank, 12); // a set of "no reps" costs nothing
      const zero = mk(0);
      expect(o[2].tank).toBeCloseTo(zero[2].tank, 12);
    }
  });
});

describe('determinism and frozen parameters', () => {
  afterEach(() => vi.useRealTimers());

  it('same input gives bit-identical output, whatever the clock says', () => {
    const { specs, ref } = randLift(prng(9), false, 12);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2020-01-01T00:00:00Z'));
    const a = run(specs, ref, 0.4);
    vi.setSystemTime(new Date('2031-06-15T12:34:56Z'));
    const b = run(specs, ref, 0.4);
    expect([...b]).toEqual([...a]);
  });

  it('does not mutate its input', () => {
    const ex = lift('x', 'chest', chain('x', [WU(8, 60), W(5, 150, 90, { rpe: 6 })]), {
      e1rmRef: 195,
    });
    const copy = JSON.stringify(ex);
    setTanks({ exercises: [ex], readiness: new Map([['chest', 0.5]]) });
    expect(JSON.stringify(ex)).toBe(copy);
  });

  it('TANK_PARAMS equal the spec table (change rule: docs/specs/set-bars-tank.md §6)', () => {
    expect(Object.isFrozen(TANK_PARAMS)).toBe(true);
    expect({ ...TANK_PARAMS }).toEqual({
      halfLifeSec: 60,
      fastShare: 0.75,
      failCost: 0.44,
      costPower: 1.5,
      readinessWeight: 0.25,
      rirDefault: 2,
      rirSegment: 1,
      warmUnknownU: 0.15,
      restFallbackSec: 90,
      secondaryWeight: 0.5,
      epleyDiv: 30,
      secPerRep: 3,
      minWorkSec: 30,
      e1rmMaxReps: 10,
      rirMax: 5,
      fullRestSec: 10800,
      colourTankRed: 0.8,
      restRampStartSec: 60,
      restRampFullSec: 120,
      displayGamma: 0.5,
      displayFloor: 0.1,
    });
  });
});

describe('non-finite durations do not poison the tank', () => {
  it('a timed set with Infinity minutes costs nothing and later sets stay finite', () => {
    const mk = (id: string, position: number, extra: object) => ({
      id,
      position,
      reps: 8,
      weight: 60,
      loggedAt: 1_000_000 + position * 120_000,
      ...extra,
    });
    const out = setTanks({
      readiness: new Map(),
      exercises: [
        {
          id: 'x',
          primary: 'chest',
          secondary: [],
          weighted: true,
          e1rmRef: 0,
          sets: [mk('a', 0, { type: 'static-dynamic', durationMin: Infinity }), mk('b', 1, {})],
        },
      ],
    } as never);
    for (const v of out.values()) {
      expect(Number.isFinite(v.tank)).toBe(true);
      expect(Number.isFinite(v.barHeight)).toBe(true);
    }
  });
});
