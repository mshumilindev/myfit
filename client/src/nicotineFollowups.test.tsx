/**
 * Nicotine: the remaining engines (Today load index, Today rest widget, program warm-up
 * minutes), the coach view per sharing mode, and the coach's card.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { __getStateForTests, __replaceStateForTests } from './store';
import {
  SURFACE_COEFFS,
  defaultNicotineSettings,
  emptyNicotineState,
  newNicotineProduct,
  NICOTINE_SURFACES,
} from './nicotine';
import { nicotineCoachView } from './nicotineShare';
import { levelOfIdx } from './today/widgets/training';
import { nicotineRest } from './today/widgets/plan';
import { startProgramDaySession } from './data/programMine';
import { CoachNicotine, coachEffectText } from './views/CoachNicotine';
import { setLocale } from './i18n';
import type { NicotineSettings, NicotineState } from './types';
import type { Program, ProgramItem } from './views/programs/model';

function nicState(
  cig: number,
  settings: Partial<NicotineSettings> = {},
  off: (keyof NicotineSettings['surfaces'])[] = [],
): NicotineState {
  const s = { ...defaultNicotineSettings(), ...settings };
  // Experimental surfaces start off; these engine tests switch every surface on.
  s.surfaces = Object.fromEntries(
    NICOTINE_SURFACES.map((k) => [k, true]),
  ) as NicotineSettings['surfaces'];
  for (const k of off) s.surfaces[k] = false;
  return {
    products: cig ? [{ ...newNicotineProduct('cigarettes', 'c'), amount: cig }] : [],
    settings: s,
    updatedAt: 1,
  };
}
const setNic = (n: NicotineState) =>
  __replaceStateForTests({ ...__getStateForTests(), nicotine: n });

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* none */
  }
  setLocale('en');
  setNic(nicState(0));
});
afterEach(() => {
  cleanup();
  setNic(emptyNicotineState());
});

describe('Today load index bands', () => {
  it('off: 15 / 40 / 70 as before', () => {
    expect(levelOfIdx(69)).toBe('high');
    expect(levelOfIdx(70)).toBe('fried');
    expect(levelOfIdx(39)).toBe('moderate');
  });
  it('on: the high and fried lines move down by at most the cap; switch off = neutral', () => {
    setNic(nicState(40));
    // At 40 cig-eq the mid of the range is about -6.6 %: fried line 70 x 0.934 = 65.4.
    expect(levelOfIdx(66)).toBe('fried');
    expect(levelOfIdx(64)).toBe('high'); // below 65.4, above the high line
    expect(levelOfIdx(38)).toBe('high'); // 40 x 0.934 = 37.4
    expect(levelOfIdx(37)).toBe('moderate');
    expect(levelOfIdx(14)).toBe('fresh'); // moderate line is untouched
    setNic(nicState(40, {}, ['fatigue']));
    expect(levelOfIdx(66)).toBe('high');
  });
});

describe('Today rest widget', () => {
  it('off: unchanged', () => {
    expect(nicotineRest(90, 'working')).toBe(90);
  });
  it('on: working rests grow within the cap, warm-up rests and zero stay; switch off = neutral', () => {
    setNic(nicState(40));
    const r = nicotineRest(150, 'working');
    expect(r).toBeGreaterThan(150);
    expect(r).toBeLessThanOrEqual(Math.round(150 * (1 + SURFACE_COEFFS.restPct.cap)));
    expect(nicotineRest(60, 'warmup')).toBe(60);
    expect(nicotineRest(0, 'working')).toBe(0);
    setNic(nicState(40, {}, ['rest']));
    expect(nicotineRest(150, 'working')).toBe(150);
  });
});

describe('program warm-up minutes', () => {
  const marker: ProgramItem = {
    id: 'wu',
    day: 1,
    position: 0,
    name: 'Warm-up',
    kind: 'warmup',
    sets: 1,
    reps: 0,
    durationMin: 10,
    equipment: [],
  };
  const program: Program = {
    id: 'p',
    name: 'P',
    weeks: 4,
    daysPerWeek: 1,
    status: 'active',
    authorId: 'u',
    dayNames: { '1': 'Upper' },
    targetMuscles: {},
    items: [marker],
  };
  const minutes = (): number | null | undefined => {
    __replaceStateForTests({ ...__getStateForTests(), workouts: [] });
    const id = startProgramDaySession(
      {
        program,
        assignedBy: null,
        week: 1,
        done: 0,
        total: 1,
        expectedSoFar: 0,
        adherence: null,
      } as never,
      1,
      'Upper',
    )!;
    return __getStateForTests().workouts.find((w) => w.id === id)!.exercises[0].plannedDurationMin;
  };
  it('off: the prescribed 10; on: a little longer within the cap; switch off = 10', () => {
    expect(minutes()).toBe(10);
    setNic(nicState(40));
    const m = minutes() as number;
    expect(m).toBeGreaterThan(10);
    expect(m - 10).toBeLessThanOrEqual(SURFACE_COEFFS.warmupMin.cap);
    setNic(nicState(40, {}, ['warmup']));
    expect(minutes()).toBe(10);
  });
});

describe('coach view per sharing mode', () => {
  const full = (sharing: NicotineSettings['sharing']) => nicState(20, { sharing });
  it('off publishes nothing', () => {
    expect(nicotineCoachView(full('off'))).toBeNull();
  });
  it('effects: only effect ranges, no products, no mg', () => {
    const v = nicotineCoachView(full('effects'))!;
    expect(v.mode).toBe('effects');
    expect(v.effects.length).toBeGreaterThan(0);
    expect(v.full).toBeUndefined();
    const text = JSON.stringify(v);
    for (const secret of ['cigarettes', 'strengthMg', 'amount', 'mgPerDay', 'products'])
      expect(text).not.toContain(secret);
  });
  it('full: also the usual amounts and the combined mg', () => {
    const v = nicotineCoachView(full('full'))!;
    expect(v.full!.mgPerDay).toBe(20);
    expect(v.full!.absorbedMgPerDay).toBe(20); // cigarettes: 1 mg absorbed each
    expect(v.full!.cigEq).toBe(20);
    expect(v.full!.products).toEqual([
      { kind: 'cigarettes', unit: 'pieces', amount: 20, strengthMg: 1 },
    ]);
  });
  it('full: a from-time-to-time product is shared as a flag, with no amount or unit', () => {
    const n = nicState(0, { sharing: 'full' });
    n.products = [{ ...newNicotineProduct('heated', 'h'), amount: 8, occasional: true }];
    const v = nicotineCoachView(n)!;
    expect(v.full!.products).toEqual([{ kind: 'heated', strengthMg: 1, occasional: true }]);
    expect(v.full!.mgPerDay).toBeCloseTo(0.1, 1);
    expect(v.full!.absorbedMgPerDay).toBeCloseTo(0.086, 3); // 1/7 mg x 0.6 (labelled is shown rounded)
    render(<CoachNicotine view={v} />);
    expect(screen.getByText('From time to time × 1 mg')).toBeTruthy();
  });
  it('effects of a switched-off surface are left out; no products or master off = null for effects', () => {
    const v = nicotineCoachView(nicState(20, { sharing: 'effects' }, ['rest', 'rpe']))!;
    expect(v.effects.map((e) => e.key)).not.toContain('restPct');
    expect(v.effects.map((e) => e.key)).not.toContain('rpe');
    expect(nicotineCoachView(nicState(0, { sharing: 'effects' }))).toBeNull();
    expect(
      nicotineCoachView(nicState(20, { sharing: 'effects', useInCalculations: false })),
    ).toBeNull();
    // Full still shares what the user entered even when nothing is applied.
    expect(
      nicotineCoachView(nicState(20, { sharing: 'full', useInCalculations: false }))!.effects,
    ).toEqual([]);
  });
});

describe('coach view: research-backed vs experimental effects', () => {
  const defaults = (
    sharing: NicotineSettings['sharing'],
    on: (keyof NicotineSettings['surfaces'])[] = [],
  ) => {
    const n = nicState(20, { sharing });
    n.settings = { ...defaultNicotineSettings(), sharing };
    for (const k of on) n.settings.surfaces[k] = true;
    return n;
  };
  it('with default switches only readiness and sleep are shared', () => {
    const v = nicotineCoachView(defaults('effects'))!;
    expect(v.effects.map((e) => e.key).sort()).toEqual(['readiness', 'sleepMin']);
    const f = nicotineCoachView(defaults('full'))!;
    expect(f.effects.map((e) => e.key).sort()).toEqual(['readiness', 'sleepMin']);
  });
  it('an experimental surface the user turned on is shared too', () => {
    const v = nicotineCoachView(defaults('effects', ['rpe', 'warmup']))!;
    expect(v.effects.map((e) => e.key).sort()).toEqual([
      'readiness',
      'rpe',
      'sleepMin',
      'warmupMin',
    ]);
  });
  it('only experimental surfaces on and none of the research ones: those alone are shared', () => {
    const n = defaults('effects', ['rest']);
    n.settings.surfaces.readiness = false;
    n.settings.surfaces.sleep = false;
    expect(nicotineCoachView(n)!.effects.map((e) => e.key)).toEqual(['restPct']);
  });
});

describe('CoachNicotine combined load', () => {
  it('shows the absorbed total as the value, with labelled mg and cig-eq in the sub line (same wording as 4E)', () => {
    const n = nicState(0, { sharing: 'full' });
    n.products = [
      { ...newNicotineProduct('vape', 'v'), unit: 'ml', amount: 1.5, strengthMg: 20 },
      { ...newNicotineProduct('heated', 'h'), unit: 'sticks', amount: 8, strengthMg: 1 },
    ];
    const v = nicotineCoachView(n)!;
    expect(v.full).toMatchObject({ mgPerDay: 38, absorbedMgPerDay: 13.8, cigEq: 13.8 });
    render(<CoachNicotine view={v} />);
    expect(screen.getByText('≈ 14 mg')).toBeTruthy();
    expect(screen.getByText('label ≈ 38 mg')).toBeTruthy();
    expect(screen.getByText('13.8 cigarette-equivalents')).toBeTruthy();
    expect(screen.getByText('Absorbed, not labelled. Used for every estimate')).toBeTruthy();
  });
});

describe('CoachNicotine', () => {
  it('tags every effect row: weak evidence for readiness and sleep, experimental for the rest', () => {
    render(<CoachNicotine view={nicotineCoachView(nicState(20, { sharing: 'effects' }))!} />);
    expect(screen.getAllByText('Weak evidence')).toHaveLength(2);
    expect(screen.getAllByText('Experimental')).toHaveLength(5);
  });
  it('writes the ranges readably', () => {
    expect(coachEffectText('readiness', 0.95, 0.9, 'min')).toBe('−5 → −10 %');
    expect(coachEffectText('sleepMin', 15, 30, 'min')).toBe('+15 → +30 min');
    expect(coachEffectText('rpe', -0.25, -0.5, 'min')).toBe('−0.25 → −0.5');
  });
  it('shows effects only, or effects plus amounts', () => {
    render(<CoachNicotine view={nicotineCoachView(nicState(20, { sharing: 'effects' }))!} />);
    expect(screen.getByText('Recovery and readiness')).toBeTruthy();
    expect(screen.queryByText('Usual amounts')).toBeNull();
    cleanup();
    render(<CoachNicotine view={nicotineCoachView(nicState(20, { sharing: 'full' }))!} />);
    expect(screen.getByText('Usual amounts')).toBeTruthy();
    expect(screen.getByText('Cigarettes')).toBeTruthy();
    expect(screen.getByText('≈ 20 mg')).toBeTruthy();
  });
});
