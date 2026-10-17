/**
 * SPO-149: return after a break. Every threshold here is a row of
 * docs/research/detraining.md (section 4) / docs/specs/detraining-return-after-break.md.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { __getStateForTests, __replaceStateForTests } from './store';
import {
  NICOTINE_SURFACES,
  defaultNicotineSettings,
  emptyNicotineState,
  newNicotineProduct,
} from './nicotine';
import { nextTarget, setProgressionEffects, type ProgOpts, type TopPoint } from './progression';

/** Local time `d` calendar days after 2026-01-01 at 09:00 (local arithmetic: DST-proof). */
const day = (d: number, hour = 9): number => new Date(2026, 0, 1 + d, hour).getTime();
const NOW = day(400);
/** A point `daysAgo` calendar days before NOW. */
const ago = (daysAgo: number, weight: number | null, reps: number): TopPoint => ({
  ts: day(400 - daysAgo),
  weight,
  reps,
});
const squat: ProgOpts = {
  plannedReps: 10,
  equipment: ['barbell'],
  primary: 'quads',
  now: NOW,
};

beforeEach(() => {
  setProgressionEffects({});
});
afterEach(() => {
  setProgressionEffects({});
  __replaceStateForTests({ ...__getStateForTests(), nicotine: emptyNicotineState() });
});

describe('no break logic without `now` or without history (unchanged behaviour)', () => {
  it('no `now`: an ancient last session still gets the old target', () => {
    const t = nextTarget([{ ts: 1, weight: 100, reps: 10 }], { ...squat, now: undefined });
    expect(t.state).toBe('progress');
    expect(t.weight).toBe(105);
    expect(t.returnKind).toBeUndefined();
  });
  it('no history: still the first-time target', () => {
    const t = nextTarget([], squat);
    expect(t.state).toBe('first');
    expect(t.weight).toBeNull();
    expect(t.reps).toBe(10);
  });
  it('R0 (0..14 days): the normal double progression', () => {
    for (const gap of [0, 1, 14]) {
      const t = nextTarget([ago(gap, 100, 10)], squat);
      expect(t.state).toBe('progress');
      expect(t.weight).toBe(105);
    }
    expect(nextTarget([ago(14, 100, 7)], squat).state).toBe('hold');
  });
});

describe('boundaries of the research rows (weight lift, 100 kg x 10)', () => {
  it('14 days is normal, 15 days is the first break row', () => {
    expect(nextTarget([ago(14, 100, 10)], squat).state).toBe('progress');
    const t = nextTarget([ago(15, 100, 10)], squat);
    expect(t.state).toBe('return');
    expect(t.returnKind).toBe('ease');
  });

  it.each([
    // gap, expected kind, expected weight
    [15, 'ease', 100],
    [28, 'ease', 100],
    [29, 'cut', 90],
    [84, 'cut', 90],
    [85, 'cut', 85],
    [168, 'cut', 85],
    [169, 'cut', 80],
    [364, 'cut', 80],
    [365, 'cut', 70],
    [1500, 'cut', 70],
  ])('gap %i days -> %s at %f kg', (gap, kind, weight) => {
    const t = nextTarget([ago(gap, 100, 10)], squat);
    expect(t.state).toBe('return');
    expect(t.returnKind).toBe(kind);
    expect(t.weight).toBe(weight);
    expect(t.gapDays).toBe(gap);
    expect(t.deltaKg).toBe(weight - 100);
    expect(t.prevWeight).toBe(100);
    expect(t.prevReps).toBe(10);
  });

  it('the day before a boundary stays in the lower row', () => {
    expect(nextTarget([ago(28, 100, 10)], squat).weight).toBe(100);
    expect(nextTarget([ago(84, 100, 10)], squat).weight).toBe(90);
    expect(nextTarget([ago(168, 100, 10)], squat).weight).toBe(85);
    expect(nextTarget([ago(364, 100, 10)], squat).weight).toBe(80);
  });
});

describe('what the first session back looks like', () => {
  it('ease (R1): same weight, no +5 kg and no +1 rep', () => {
    const top = nextTarget([ago(20, 100, 10)], squat);
    expect(top.weight).toBe(100);
    expect(top.reps).toBe(10);
    expect(top.deltaKg).toBe(0);
    const mid = nextTarget([ago(20, 100, 7)], squat);
    expect(mid.weight).toBe(100);
    expect(mid.reps).toBe(7);
  });

  it('cut (R2+): lighter weight, reps at the bottom of the range', () => {
    const t = nextTarget([ago(60, 100, 10)], squat);
    expect(t.weight).toBe(90);
    expect(t.reps).toBe(t.repLow);
    expect(t.repLow).toBe(7);
  });

  it('cut rounds to a loadable 2.5 step and never above the last weight', () => {
    expect(nextTarget([ago(60, 52.5, 8)], squat).weight).toBe(47.5);
    expect(nextTarget([ago(400, 52.5, 8)], squat).weight).toBe(37.5);
    // tiny loads: floor of 2.5 but never above what was lifted
    expect(nextTarget([ago(400, 2.5, 8)], squat).weight).toBe(2.5);
    expect(nextTarget([ago(60, 1, 8)], squat).weight).toBe(1);
  });

  it('a deload-worthy history after a break is not a stall either', () => {
    const t = nextTarget([ago(60, 100, 8), ago(67, 100, 8), ago(74, 100, 8)], squat);
    expect(t.state).toBe('return');
    expect(t.weight).toBe(90);
  });
});

describe('load types', () => {
  it('band: weight never moves; reps ease, then drop with the row multiplier', () => {
    const band: ProgOpts = { plannedReps: 15, loadType: 'band', now: NOW };
    const ease = nextTarget([ago(20, 12, 15)], band);
    expect(ease.state).toBe('return');
    expect(ease.weight).toBe(12);
    expect(ease.reps).toBe(15);
    const cut = nextTarget([ago(60, 12, 20)], band);
    expect(cut.weight).toBe(12);
    expect(cut.reps).toBe(18); // 20 x 0.9
    expect(nextTarget([ago(200, 12, 20)], band).reps).toBe(16); // x 0.8
    expect(nextTarget([ago(500, 12, 1)], band).reps).toBe(1); // never below 1
  });

  it('bodyweight: reps drop, weight stays null', () => {
    const bw: ProgOpts = { plannedReps: 12, bodyweight: true, now: NOW };
    const ease = nextTarget([ago(20, null, 15)], bw);
    expect(ease.weight).toBeNull();
    expect(ease.reps).toBe(15); // no +1
    const cut = nextTarget([ago(60, null, 20)], bw);
    expect(cut.state).toBe('return');
    expect(cut.weight).toBeNull();
    expect(cut.reps).toBe(18);
    expect(nextTarget([ago(500, null, 20)], bw).reps).toBe(14); // x 0.7
    // implicit bodyweight: no recorded weight
    expect(nextTarget([ago(60, 0, 10)], { plannedReps: 12, now: NOW }).weight).toBeNull();
  });

  it('assist: climbing back works when the pre-break help was 0 (no help at all)', () => {
    const assist: ProgOpts = { plannedReps: 10, loadType: 'assist', now: NOW };
    // Before the break: no help. First session back used 10 kg of help. Now: take 5 kg off.
    const t = nextTarget([ago(10, -10, 10), ago(60, 0, 10)], assist);
    expect(t).toMatchObject({ state: 'return', returnKind: 'regain', weight: -5, deltaKg: 5 });
    // Already back at no help: nothing left to regain.
    expect(nextTarget([ago(5, 0, 10), ago(40, 0, 10)], assist).returnKind).toBeUndefined();
  });

  it('assist: a break means MORE help (more negative kg), never less', () => {
    const assist: ProgOpts = { plannedReps: 10, loadType: 'assist', now: NOW };
    const ease = nextTarget([ago(20, -20, 10)], assist);
    expect(ease.weight).toBe(-20);
    expect(ease.returnKind).toBe('ease');
    // default 75 kg: R2 extra = round5(75 x 0.10) = 10 (7.5 rounds up)
    const r2 = nextTarget([ago(60, -20, 10)], assist);
    expect(r2.weight).toBe(-30);
    expect(r2.deltaKg).toBe(-10);
    expect(r2.weight!).toBeLessThan(-20);
    expect(r2.reps).toBe(r2.repLow);
    // R3 round5(75 x 0.15 = 11.25) = 10 ; R4 round5(15) = 15 ; R5 round5(22.5) = 25
    expect(nextTarget([ago(100, -20, 10)], assist).weight).toBe(-30);
    expect(nextTarget([ago(200, -20, 10)], assist).weight).toBe(-35);
    expect(nextTarget([ago(400, -20, 10)], assist).weight).toBe(-45);
    // a known body mass sizes the extra help
    expect(nextTarget([ago(60, -20, 10)], { ...assist, bodyKg: 100 }).weight).toBe(-30);
    expect(nextTarget([ago(400, -20, 10)], { ...assist, bodyKg: 100 }).weight).toBe(-50);
    // at least one stack step even for a very light person
    expect(nextTarget([ago(60, -20, 10)], { ...assist, bodyKg: 20 }).weight).toBe(-25);
    // already unassisted (0): the break adds help
    expect(nextTarget([ago(60, 0, 8)], assist).weight).toBe(-10);
  });

  it('dumbbell lifts use the same weight cut', () => {
    const db: ProgOpts = { plannedReps: 10, equipment: ['dumbbell'], primary: 'biceps', now: NOW };
    expect(nextTarget([ago(60, 20, 10)], db).weight).toBe(17.5);
  });
});

describe('progression resumes after a return (two sessions back)', () => {
  // pre-break 100 x 10 on day 0; first session back is 90 x 7 on day 70.
  const pre: TopPoint = { ts: day(0), weight: 100, reps: 10 };
  const back1: TopPoint = { ts: day(70), weight: 90, reps: 7 };
  const opts = (d: number): ProgOpts => ({ ...squat, now: day(d) });

  it('the session after the return climbs toward the pre-break weight (normal step, not +1 rep)', () => {
    const t = nextTarget([back1, pre], opts(72));
    expect(t.state).toBe('return');
    expect(t.returnKind).toBe('regain');
    expect(t.weight).toBe(95); // 90 + the 5 kg barbell step
    expect(t.reps).toBe(7);
    expect(t.deltaKg).toBe(5);
  });

  it('the second session back reaches, and never exceeds, the pre-break weight', () => {
    const back2: TopPoint = { ts: day(72), weight: 95, reps: 7 };
    const t = nextTarget([back2, back1, pre], opts(75));
    expect(t.state).toBe('return');
    expect(t.weight).toBe(100);
    // from a bigger deficit than one step: capped at the pre-break weight
    const t2 = nextTarget([{ ts: day(72), weight: 97.5, reps: 7 }, back1, pre], opts(75));
    expect(t2.weight).toBe(100);
  });

  it('then normal double progression takes over (hold -> progress)', () => {
    const back3: TopPoint = { ts: day(75), weight: 100, reps: 7 };
    const history = [back3, { ts: day(72), weight: 95, reps: 7 }, back1, pre];
    const hold = nextTarget(history, opts(78));
    expect(hold.state).toBe('hold');
    expect(hold.weight).toBe(100);
    expect(hold.reps).toBe(8);
    const top = nextTarget([{ ts: day(78), weight: 100, reps: 10 }, ...history], opts(81));
    expect(top.state).toBe('progress');
    expect(top.weight).toBe(105);
  });

  it('missed the bottom of the range: keep the weight, chase a rep', () => {
    const t = nextTarget([{ ts: day(70), weight: 90, reps: 5 }, pre], opts(72));
    expect(t.state).toBe('return');
    expect(t.returnKind).toBe('regain');
    expect(t.weight).toBe(90);
    expect(t.reps).toBe(6);
    expect(t.deltaKg).toBe(0);
  });

  it('a lighter lift (2.5 kg step) climbs by 2.5 kg', () => {
    const db: ProgOpts = { plannedReps: 10, equipment: ['dumbbell'], primary: 'biceps' };
    const t = nextTarget(
      [
        { ts: day(70), weight: 17.5, reps: 7 },
        { ts: day(0), weight: 20, reps: 10 },
      ],
      { ...db, now: day(72) },
    );
    expect(t.weight).toBe(20);
  });

  it('assist climbs by LESS help, up to the pre-break level', () => {
    const t = nextTarget(
      [
        { ts: day(70), weight: -35, reps: 7 },
        { ts: day(0), weight: -20, reps: 10 },
      ],
      { plannedReps: 10, loadType: 'assist', now: day(72) },
    );
    expect(t.state).toBe('return');
    expect(t.weight).toBe(-30);
    const t2 = nextTarget(
      [
        { ts: day(72), weight: -25, reps: 7 },
        { ts: day(70), weight: -35, reps: 7 },
        { ts: day(0), weight: -20, reps: 10 },
      ],
      { plannedReps: 10, loadType: 'assist', now: day(75) },
    );
    expect(t2.weight).toBe(-20);
  });

  it('is not triggered by a normal rhythm, by an R1 break, or after 8 sessions', () => {
    // 20-day gap (R1) before the last session: no regain, plain progression
    const r1 = nextTarget(
      [
        { ts: day(40), weight: 90, reps: 10 },
        { ts: day(20), weight: 100, reps: 10 },
      ],
      { ...squat, now: day(41) },
    );
    expect(r1.state).toBe('progress');
    // the break is more than 8 sessions behind us
    const sessions: TopPoint[] = [];
    for (let i = 10; i >= 1; i--) sessions.push({ ts: day(100 + i * 3), weight: 90, reps: 8 });
    const history = [...sessions.reverse(), { ts: day(0), weight: 100, reps: 10 }];
    const late = nextTarget(history, { ...squat, now: day(135) });
    expect(late.state).not.toBe('return');
  });

  it('reps-only lifts just keep adding a rep per session (no special state)', () => {
    const bw: ProgOpts = { plannedReps: 12, bodyweight: true };
    const t = nextTarget(
      [
        { ts: day(70), weight: null, reps: 18 },
        { ts: day(0), weight: null, reps: 20 },
      ],
      { ...bw, now: day(72) },
    );
    expect(t.state).toBe('progress');
    expect(t.reps).toBe(19);
    const band = nextTarget(
      [
        { ts: day(70), weight: 12, reps: 13 },
        { ts: day(0), weight: 12, reps: 15 },
      ],
      { plannedReps: 15, loadType: 'band', now: day(72) },
    );
    expect(band.state).toBe('progress');
    expect(band.reps).toBe(14);
  });

  it('a new break after the return takes precedence over the climb', () => {
    const t = nextTarget([back1, pre], opts(70 + 30));
    expect(t.returnKind).toBe('cut');
    expect(t.weight).toBe(80); // 90 x 0.9 = 81 -> 80
  });
});

describe('a break is not a plateau', () => {
  // Three sessions at 100 x 8: a plateau when close together, not when separated by weeks.
  const flat = (spacing: number, lastAgo = 2): TopPoint[] => [
    ago(lastAgo, 100, 8),
    ago(lastAgo + spacing, 100, 8),
    ago(lastAgo + 2 * spacing, 100, 8),
  ];

  it('control: weekly sessions at the same weight are a stall (deload)', () => {
    const t = nextTarget(flat(7), squat);
    expect(t.state).toBe('stall');
    expect(t.weight).toBe(90);
  });
  it('14-day gaps still count as a plateau; 15-day gaps do not', () => {
    expect(nextTarget(flat(14), squat).state).toBe('stall');
    expect(nextTarget(flat(15), squat).state).not.toBe('stall');
    expect(nextTarget(flat(15), squat).state).toBe('hold');
  });
  it('one long gap inside the window of three is enough', () => {
    const h: TopPoint[] = [ago(2, 100, 8), ago(9, 100, 8), ago(60, 100, 8)];
    expect(nextTarget(h, squat).state).toBe('hold');
    const h2: TopPoint[] = [ago(2, 100, 8), ago(50, 100, 8), ago(57, 100, 8)];
    expect(nextTarget(h2, squat).state).toBe('hold');
  });
  it('without `now` the gap rule still protects (it needs only the timestamps)', () => {
    const t = nextTarget(flat(30), { ...squat, now: undefined });
    expect(t.state).toBe('hold');
  });
});

describe('conditions and nicotine: the most conservative wins, never the product', () => {
  function setNic(cig: number): void {
    const settings = defaultNicotineSettings();
    settings.useInCalculations = true;
    for (const s of NICOTINE_SURFACES) settings.surfaces[s] = true;
    const products = cig > 0 ? [{ ...newNicotineProduct('cigarettes', 'c'), amount: cig }] : [];
    __replaceStateForTests({
      ...__getStateForTests(),
      nicotine: { products, settings, updatedAt: 1 },
    });
  }
  // pre-break 100 x 10, first session back 90 x 7; the callers ask on day 72.
  const regainHistory = (): TopPoint[] => [
    { ts: day(70), weight: 90, reps: 7 },
    { ts: day(0), weight: 100, reps: 10 },
  ];

  it('a cut is untouched by conditions and nicotine (they only slow increases)', () => {
    const plain = nextTarget([ago(60, 100, 10)], squat);
    setProgressionEffects({ noAutoIncrease: true, stepScale: 0.5 });
    setNic(80);
    const t = nextTarget([ago(60, 100, 10)], squat);
    expect(t.weight).toBe(plain.weight);
    expect(t.state).toBe('return');
    expect(t.returnKind).toBe('cut');
    expect(t.deltaKg).toBe(plain.deltaKg);
  });

  it('an ease (R1) is untouched as well', () => {
    setProgressionEffects({ noAutoIncrease: true });
    const t = nextTarget([ago(20, 100, 10)], squat);
    expect(t.returnKind).toBe('ease');
    expect(t.weight).toBe(100);
  });

  it('noAutoIncrease: the climb back is held at the last weight', () => {
    setProgressionEffects({ noAutoIncrease: true });
    const t = nextTarget(regainHistory(), { ...squat, now: day(72) });
    expect(t.state).toBe('hold');
    expect(t.weight).toBe(90);
    expect(t.deltaKg).toBe(0);
  });

  it('stepScale shrinks the climb', () => {
    setProgressionEffects({ stepScale: 0.5 });
    const t = nextTarget(regainHistory(), { ...squat, now: day(72) });
    expect(t.state).toBe('return');
    expect(t.weight).toBe(92.5);
  });

  it('nicotine shrinks the climb within its cap', () => {
    setNic(80);
    const t = nextTarget(regainHistory(), { ...squat, now: day(72) });
    expect(t.state).toBe('return');
    expect(t.deltaKg).toBeLessThan(5);
    expect(t.deltaKg).toBeGreaterThanOrEqual(0.5);
    expect(t.weight).toBe(90 + t.deltaKg);
  });

  it('both at once: the smaller step, not the product of the two', () => {
    const h = regainHistory();
    const o = { ...squat, now: day(72) };
    setNic(80);
    const nicOnly = nextTarget(h, o).deltaKg;
    setNic(0);
    setProgressionEffects({ stepScale: 0.5 });
    const condOnly = nextTarget(h, o).deltaKg;
    setNic(80);
    const both = nextTarget(h, o).deltaKg;
    expect(both).toBe(Math.min(nicOnly, condOnly));
    expect(both).toBeGreaterThanOrEqual(0.5);
  });
});

describe('cut never raises reps above last time (heavy low-rep lifter)', () => {
  it('100 kg x 1, 30 days ago -> lighter weight, still 1 rep', () => {
    const t = nextTarget([ago(30, 100, 1)], squat);
    expect(t.state).toBe('return');
    expect(t.weight).toBeLessThan(100);
    expect(t.reps).toBeLessThanOrEqual(1);
  });
});
