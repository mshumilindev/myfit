/**
 * "Check before sending": the pre-send check of ONE program. Pure: every number is derived from the document and the
 * host's facts (exercise catalog, activity categories, restrictions); nothing is typed in. The result carries machine
 * facts only; the screens turn them into words (labels), so a number can never drift from its sentence.
 *
 * Severity: `fix` blocks Send, `review` never blocks, `note` is information (bare rows / muscles days: never an
 * error), `ok` is fine. The checks are `CheckRule`s: a host can add, drop or reorder them (`host.checkRules`).
 */
import type { ExerciseCatalog, ActivityKind } from '../host.catalog';
import {
  dayItems,
  dayMode,
  dayName,
  effectiveSets,
  isBare,
  trainingDays,
  type DocEnv,
  type MuscleGroup,
  type ProgramDoc,
} from '../model/doc';

export type RangeGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'biceps'
  | 'triceps'
  | 'calves';

/** Weekly hard-set ranges per muscle (V1 constants for a strength goal; per-person targets are LATER). */
export const MUSCLE_BAND: Record<RangeGroup, readonly [number, number]> = {
  chest: [10, 16],
  back: [12, 20],
  shoulders: [8, 14],
  quads: [10, 16],
  hamstrings: [8, 14],
  glutes: [6, 12],
  biceps: [6, 12],
  triceps: [6, 12],
  calves: [6, 12],
};
export const RANGE_GROUPS = Object.keys(MUSCLE_BAND) as RangeGroup[];
/** Weekly conditioning minutes for a strength goal. */
export const CARDIO_BAND: readonly [number, number] = [60, 150];
/** "To fix" means below this share of the weekly minimum; closer to the range is "to review". */
export const FIX_BELOW = 0.8;

/** Fine muscle groups -> the coarse groups the weekly volume ranges are written for. null = no weekly range. */
export const RANGE_GROUP: Record<MuscleGroup, string | null> = {
  chest: 'chest',
  back: 'back',
  lats: 'back',
  traps: 'back',
  lower_back: 'back',
  shoulders: 'shoulders',
  biceps: 'biceps',
  triceps: 'triceps',
  quads: 'quads',
  hamstrings: 'hamstrings',
  glutes: 'glutes',
  calves: 'calves',
  core: 'core',
  forearms: null,
  adductors: null,
  abductors: null,
  neck: null,
  fullbody: null,
  cardio: null,
};

export type Sev = 'fix' | 'review' | 'note' | 'ok';
export type RangeState = 'ok' | 'low' | 'high' | 'open';

export interface MuscleVolume {
  group: RangeGroup;
  sets: number;
  band: readonly [number, number];
  /** Distinct training days that train it. */
  days: number;
  state: RangeState;
  /** Exercises that train it but ask for no sets (bare rows): listed, never counted. */
  bareEx: string[];
  /** Names of muscles days that list it. */
  byMuscles: string[];
}

export type BuiltInFindingKind =
  | 'range'
  | 'open'
  | 'bare'
  | 'musclesDay'
  | 'pushPull'
  | 'pictures'
  | 'onceAWeek'
  | 'cardio'
  | 'restriction'
  | 'emptyDay';
/** A built-in kind, or the kind of a rule the host added. */
export type FindingKind = BuiltInFindingKind | (string & {});

export interface Finding {
  id: string;
  kind: FindingKind;
  sev: Sev;
  /** Machine facts for the sentence. */
  facts: Record<string, string | number | readonly string[]>;
  /** Where "Fix in editor" lands: a weekday (ISO 1..7) and, when known, the row. */
  fix?: { day?: number; itemId?: string };
}

export interface CheckContext {
  /**
   * Restrictions the person declared AND shares with whoever reads the program. The host decides what is shared: an
   * empty list means "nothing to check" (consent off, or none declared).
   */
  restrictions: readonly string[];
}

export interface Check {
  findings: Finding[];
  volume: MuscleVolume[];
  pushPull: { push: number; pull: number };
  activities: {
    cardioMin: number;
    recoveryMin: number;
    rows: {
      id: string;
      day: number;
      type: string;
      minutes: number;
      effort: string;
      when: string;
    }[];
  };
  counts: { fix: number; review: number; note: number; ok: number };
  /** Muscle groups whose weekly sets sit inside the range. */
  inRange: number;
  blocked: boolean;
}

/** What the engine reads from the host. A `ProgramEditorHost` satisfies it. */
export interface CheckEnv extends DocEnv {
  catalog: ExerciseCatalog;
  activities: readonly ActivityKind[];
  checkContext?: CheckContext;
  checkRules?: (builtIn: readonly CheckRule[]) => readonly CheckRule[];
}

/** Everything a rule may read: the document, the host's facts and the numbers computed once for all rules. */
export interface RuleInput {
  doc: ProgramDoc;
  env: CheckEnv;
  volume: MuscleVolume[];
  pushPull: { push: number; pull: number };
  activities: Check['activities'];
}

export interface CheckRule {
  id: string;
  run: (input: RuleInput) => Finding[];
}

/* ---- volume -------------------------------------------------------------------------------------------- */

export function weeklyVolume(p: ProgramDoc, env: CheckEnv): MuscleVolume[] {
  const sets = new Map<RangeGroup, number>();
  const where = new Map<RangeGroup, Set<number>>();
  const bare = new Map<RangeGroup, Set<string>>();
  const byM = new Map<RangeGroup, Set<string>>();
  const mark = <V>(m: Map<RangeGroup, Set<V>>, g: RangeGroup, v: V) => {
    const s = m.get(g) ?? new Set<V>();
    s.add(v);
    m.set(g, s);
  };
  for (const d of trainingDays(p, env)) {
    if (dayMode(p, d) === 'muscles') {
      const label = dayName(p, d) || String(d);
      for (const m of p.targetMuscles[String(d)] ?? []) {
        const g = RANGE_GROUP[m] as RangeGroup | null;
        if (!g || !(g in MUSCLE_BAND)) continue;
        mark(where, g, d);
        mark(byM, g, label);
      }
      continue;
    }
    for (const it of dayItems(p, d)) {
      if (it.kind !== 'strength') continue;
      const f = env.catalog.facts(it.name);
      const groups = new Map<RangeGroup, number>();
      f.muscles.forEach((m, i) => {
        const g = RANGE_GROUP[m] as RangeGroup | null;
        if (!g || !(g in MUSCLE_BAND)) return;
        // The primary counts a full set, secondaries half; two fine groups of one range group count once.
        groups.set(g, Math.max(groups.get(g) ?? 0, i === 0 ? 1 : 0.5));
      });
      for (const [g, w] of groups) {
        mark(where, g, d);
        if (isBare(it)) mark(bare, g, it.name);
        else sets.set(g, (sets.get(g) ?? 0) + effectiveSets(it) * w);
      }
    }
  }
  return RANGE_GROUPS.map((group) => {
    const v = sets.get(group) ?? 0;
    const band = MUSCLE_BAND[group];
    const bareEx = [...(bare.get(group) ?? [])];
    const byMuscles = [...(byM.get(group) ?? [])];
    const covered = bareEx.length + byMuscles.length > 0;
    const state: RangeState =
      v > band[1] ? 'high' : v >= band[0] ? 'ok' : v === 0 && covered ? 'open' : 'low';
    return { group, sets: v, band, days: where.get(group)?.size ?? 0, state, bareEx, byMuscles };
  });
}

const PUSH_MUSCLES: MuscleGroup[] = ['chest', 'shoulders', 'triceps'];
const PULL_MUSCLES: MuscleGroup[] = ['back', 'lats', 'traps', 'lower_back', 'biceps'];

export function pushPull(p: ProgramDoc, env: CheckEnv): { push: number; pull: number } {
  let push = 0;
  let pull = 0;
  for (const it of p.items) {
    if (it.kind !== 'strength') continue;
    const n = effectiveSets(it);
    if (!n) continue;
    const f = env.catalog.facts(it.name);
    if (f.force === 'push') push += n;
    else if (f.force === 'pull') pull += n;
    else if (f.primary && PUSH_MUSCLES.includes(f.primary)) push += n;
    else if (f.primary && PULL_MUSCLES.includes(f.primary)) pull += n;
  }
  return { push, pull };
}

/** Exercises whose catalog entry has no picture (custom or unknown names). */
export const withoutPicture = (p: ProgramDoc, env: CheckEnv): string[] =>
  [...new Set(p.items.filter((i) => i.kind === 'strength').map((i) => i.name))].filter(
    (n) => !env.catalog.facts(n).image,
  );

/* ---- restrictions -------------------------------------------------------------------------------------------- */

interface RestrictionRule {
  test: RegExp;
  /** Does this exercise load what the restriction protects? */
  hits: (name: string) => boolean;
}
const RESTRICTIONS: RestrictionRule[] = [
  {
    test: /overhead/i,
    hits: (n) => /overhead|military|shoulder press|push press|snatch|jerk/i.test(n),
  },
  { test: /squat/i, hits: (n) => /squat/i.test(n) },
  { test: /knee|lunge/i, hits: (n) => /lunge|jump|squat|step.?up/i.test(n) },
  { test: /deadlift|lower back|back/i, hits: (n) => /deadlift|good morning|bent over/i.test(n) },
];

export function restrictionConflicts(
  p: ProgramDoc,
  restrictions: readonly string[],
): { exercise: string; restriction: string; day: number; itemId: string }[] {
  const out: { exercise: string; restriction: string; day: number; itemId: string }[] = [];
  for (const r of restrictions) {
    const rule = RESTRICTIONS.find((x) => x.test.test(r));
    if (!rule) continue;
    for (const it of p.items) {
      if (it.kind !== 'strength') continue;
      if (rule.hits(it.name))
        out.push({ exercise: it.name, restriction: r, day: it.day, itemId: it.id });
    }
  }
  return out;
}

/* ---- the built-in rules --------------------------------------------------------------------------------------- */

const firstDayOf = (i: RuleInput, g: RangeGroup): number | undefined =>
  trainingDays(i.doc, i.env).find((d) =>
    dayMode(i.doc, d) === 'exercises'
      ? dayItems(i.doc, d).some(
          (it) =>
            it.kind === 'strength' &&
            i.env.catalog.facts(it.name).muscles.some((m) => RANGE_GROUP[m] === g),
        )
      : (i.doc.targetMuscles[String(d)] ?? []).some((m) => RANGE_GROUP[m] === g),
  );

export const BUILT_IN_RULES: readonly CheckRule[] = [
  {
    // A named day with nothing in it cannot be sent as is.
    id: 'emptyDay',
    run: ({ doc, env }) =>
      trainingDays(doc, env)
        .filter(
          (d) => dayMode(doc, d) === 'muscles' && !(doc.targetMuscles[String(d)]?.length ?? 0),
        )
        .map((d) => ({
          id: `empty-${d}`,
          kind: 'emptyDay',
          sev: 'fix' as const,
          facts: { day: d, name: dayName(doc, d) },
          fix: { day: d },
        })),
  },
  {
    id: 'range',
    run: (i) =>
      i.volume
        .filter((v) => v.state === 'low' || v.state === 'high')
        .map((v) => ({
          id: `range-${v.group}`,
          kind: 'range',
          sev: (v.state === 'low' && v.sets < v.band[0] * FIX_BELOW ? 'fix' : 'review') as Sev,
          facts: {
            group: v.group,
            sets: v.sets,
            min: v.band[0],
            max: v.band[1],
            state: v.state,
            bare: v.bareEx,
          },
          fix: { day: firstDayOf(i, v.group) },
        })),
  },
  {
    id: 'open',
    run: ({ volume }) => {
      const open = volume.filter((v) => v.state === 'open');
      return open.length
        ? [{ id: 'open', kind: 'open', sev: 'note', facts: { groups: open.map((v) => v.group) } }]
        : [];
    },
  },
  {
    id: 'bare',
    run: ({ doc }) => {
      const bareRows = doc.items.filter((i) => i.kind === 'strength' && isBare(i));
      return bareRows.length
        ? [
            {
              id: 'bare',
              kind: 'bare',
              sev: 'note',
              facts: { n: bareRows.length },
              fix: { day: bareRows[0].day, itemId: bareRows[0].id },
            },
          ]
        : [];
    },
  },
  {
    id: 'musclesDay',
    run: ({ doc, env }) =>
      trainingDays(doc, env)
        .filter(
          (x) => dayMode(doc, x) === 'muscles' && (doc.targetMuscles[String(x)]?.length ?? 0) > 0,
        )
        .map((d) => ({
          id: `muscles-${d}`,
          kind: 'musclesDay',
          sev: 'note' as const,
          facts: { day: d, name: dayName(doc, d), muscles: doc.targetMuscles[String(d)] ?? [] },
          fix: { day: d },
        })),
  },
  {
    id: 'restriction',
    run: ({ doc, env }) =>
      restrictionConflicts(doc, env.checkContext?.restrictions ?? []).map((c) => ({
        id: `restr-${c.itemId}`,
        kind: 'restriction',
        sev: 'fix' as const,
        facts: { exercise: c.exercise, restriction: c.restriction },
        fix: { day: c.day, itemId: c.itemId },
      })),
  },
  {
    id: 'pushPull',
    run: ({ pushPull: pp }) => {
      if (pp.push + pp.pull <= 0) return [];
      const ratio = pp.push ? pp.pull / pp.push : 1;
      return [
        {
          id: 'pushpull',
          kind: 'pushPull',
          sev: ratio < 1 ? 'review' : 'ok',
          facts: { push: pp.push, pull: pp.pull, ratio: Math.round(ratio * 100) / 100 },
        },
      ];
    },
  },
  {
    id: 'pictures',
    run: ({ doc, env }) => {
      const pics = withoutPicture(doc, env);
      return pics.length
        ? [{ id: 'pictures', kind: 'pictures', sev: 'review', facts: { names: pics } }]
        : [];
    },
  },
  {
    id: 'onceAWeek',
    run: ({ volume }) => {
      const under = volume.filter((v) => v.days === 1 && v.sets > 0);
      return [
        {
          id: 'once',
          kind: 'onceAWeek',
          sev: under.length ? 'review' : 'ok',
          facts: { groups: under.map((v) => v.group) },
        },
      ];
    },
  },
  {
    id: 'cardio',
    run: ({ activities: a }) => [
      {
        id: 'cardio',
        kind: 'cardio',
        sev: a.cardioMin >= CARDIO_BAND[0] && a.cardioMin <= CARDIO_BAND[1] ? 'ok' : 'review',
        facts: {
          min: a.cardioMin,
          from: CARDIO_BAND[0],
          to: CARDIO_BAND[1],
          recovery: a.recoveryMin,
        },
      },
    ],
  },
];

/* ---- the check ----------------------------------------------------------------------------------------------- */

const ORDER: Record<Sev, number> = { fix: 0, review: 1, note: 2, ok: 3 };

export function runCheck(p: ProgramDoc, env: CheckEnv): Check {
  const volume = weeklyVolume(p, env);
  const pp = pushPull(p, env);
  const acts = p.activities ?? [];
  const cat = (type: string) =>
    env.activities.find((a) => a.key === type)?.category ?? 'conditioning';
  const cardioMin = acts
    .filter((a) => cat(a.type) === 'conditioning')
    .reduce((n, a) => n + a.minutes, 0);
  const recoveryMin = acts
    .filter((a) => cat(a.type) === 'recovery')
    .reduce((n, a) => n + a.minutes, 0);
  const activities: Check['activities'] = {
    cardioMin,
    recoveryMin,
    rows: acts.map((a) => ({
      id: a.id,
      day: a.day,
      type: a.type,
      minutes: a.minutes,
      effort: a.effort,
      when: a.when,
    })),
  };
  const rules = env.checkRules ? env.checkRules(BUILT_IN_RULES) : BUILT_IN_RULES;
  const input: RuleInput = { doc: p, env, volume, pushPull: pp, activities };
  const findings = rules.flatMap((r) => r.run(input));
  // Stable sort by severity (the rules' own order is kept inside one severity).
  findings.sort((a, b) => ORDER[a.sev] - ORDER[b.sev]);
  const counts = { fix: 0, review: 0, note: 0, ok: 0 };
  for (const f of findings) counts[f.sev]++;
  return {
    findings,
    volume,
    pushPull: pp,
    activities,
    counts,
    inRange: volume.filter((v) => v.state === 'ok').length,
    blocked: counts.fix > 0,
  };
}
