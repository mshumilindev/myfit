/** Seeded random coach programs for the no-data-loss tests: every optional key of the model is set by some seed. */
import {
  freshProgram,
  type Program,
  type ProgramItem,
  type ProgramWarmupItem,
} from '../../../../views/programs/model';
import type { MuscleGroup } from '../../../../data/exercises';
import { planProgramId } from '../../../program/planCodec';
import { C, T } from './harness';

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const NAMES = [
  'Barbell Squat',
  'Romanian Deadlift',
  'Leg Curl',
  'Paused Bench Press',
  'Pull-Up',
  'Plank',
];

export function genProgram(seed: number, id = planProgramId(C)): Program {
  const r = rng(seed);
  const pick = <X>(xs: readonly X[]): X => xs[Math.floor(r() * xs.length)];
  const maybe = <X>(p: number, v: () => X): X | undefined => (r() < p ? v() : undefined);
  // Cycle fields draw from their own stream, so the programs of every seed stay what they were before cycles existed.
  const x = rng(seed ^ 0x5bd1e995);
  const pickX = <Y>(ys: readonly Y[]): Y => ys[Math.floor(x() * ys.length)];
  const maybeX = <Y>(p: number, v: () => Y): Y | undefined => (x() < p ? v() : undefined);
  const items: ProgramItem[] = [];
  const nItems = 4 + Math.floor(r() * 8);
  for (let n = 0; n < nItems; n++) {
    const kind = pick(['strength', 'strength', 'strength', 'cardio', 'warmup'] as const);
    const bare = kind === 'strength' && r() < 0.2;
    const it: ProgramItem = {
      id: `it${seed}-${n}`,
      day: 1 + Math.floor(r() * 6),
      position: n,
      name: kind === 'warmup' ? 'Warm-up' : kind === 'cardio' ? 'Rowing' : pick(NAMES),
      kind,
      sets: bare ? 0 : kind === 'strength' ? 1 + Math.floor(r() * 6) : 1,
      reps: bare ? 0 : kind === 'strength' ? 1 + Math.floor(r() * 15) : 1,
      durationMin: kind === 'strength' ? null : 5 + Math.floor(r() * 30),
      equipment: r() < 0.5 ? ['barbell'] : [],
    };
    const o: Partial<ProgramItem> = {
      groupId: maybe(0.4, () => pick(['g1', 'g2', null])),
      groupOrder: maybe(0.4, () => Math.floor(r() * 3)),
      dropLast: maybe(0.3, () => r() < 0.5),
      bare: bare ? true : maybe(0.2, () => false),
    };
    if (kind === 'strength' && !bare) {
      o.targetWeight = maybe(0.7, () => Math.round(r() * 2000) / 10);
      o.targetRpe = maybe(0.6, () => 5 + Math.floor(r() * 5));
      o.targetPct = maybeX(0.5, () => 40 + Math.floor(x() * 61));
      o.repsMin = maybeX(0.4, () => 1 + Math.floor(x() * Math.max(1, (it.reps as number) - 1)));
      o.restSec = maybe(0.6, () => 30 + Math.floor(r() * 24) * 15);
      o.note = maybe(0.5, () => `cue ${seed}-${n} "quotes" \\ unicode: Привіт ąčę 💪`);
    }
    if (kind === 'warmup') {
      o.warmupItems = Array.from({ length: 1 + Math.floor(r() * 3) }, (_, k): ProgramWarmupItem => {
        const w: ProgramWarmupItem = { id: `wi${seed}-${n}-${k}`, name: pick(NAMES) };
        if (r() < 0.5) w.reps = 5 + Math.floor(r() * 10);
        else w.durationSec = 20 + Math.floor(r() * 40);
        const ex = maybe(0.5, () => `ex-${k}`);
        if (ex) w.exerciseId = ex;
        const kg = maybe(0.5, () => Math.round(r() * 300) / 10);
        if (kg && w.reps) w.weight = kg;
        return w;
      });
    }
    for (const [k, v] of Object.entries(o))
      if (v !== undefined) (it as unknown as Record<string, unknown>)[k] = v;
    items.push(it);
  }
  const p: Program = {
    ...freshProgram('Block ' + seed),
    id,
    authorId: T,
    weeks: Math.floor(r() * 13),
    daysPerWeek: 1 + Math.floor(r() * 6),
    dayNames: { '1': 'Day ä', '3': `Push "${seed}"`, '5': 'Лінія' },
    targetMuscles: r() < 0.6 ? { '6': ['chest', 'back'] } : {},
    items,
  };
  if (x() < 0.6) {
    const len = 2 + Math.floor(x() * 3);
    p.cycle = {
      length: len,
      baseLabel: maybeX(0.5, () => 'peak' as const) ?? undefined,
      weeks: Array.from({ length: len - 1 }, (_, k) => ({
        label: maybeX(0.5, () => pickX(['deload', 'test', 'peak'] as const)) ?? undefined,
        dayNames: { '1': `W${k + 2} ä` },
        targetMuscles: (x() < 0.5 ? { '2': ['back'] } : {}) as Record<string, MuscleGroup[]>,
        items: items
          .slice(0, 2)
          .map((x, n) => ({ ...x, id: `cw${seed}-${k}-${n}`, groupId: null, groupOrder: null })),
      })),
    };
  }
  if (r() < 0.8)
    p.activities = [
      {
        id: `a${seed}-1`,
        day: 3,
        type: 'running',
        minutes: 20 + Math.floor(r() * 40),
        effort: pick(['light', 'moderate', 'hard'] as const),
        when: pick(['any', 'before', 'after'] as const),
      },
      { id: `a${seed}-2`, day: 5, type: 'yoga', minutes: 45, effort: 'light', when: 'any' },
    ];
  return p;
}

export const seeds = Array.from({ length: 60 }, (_, i) => 1000 + i * 7);
