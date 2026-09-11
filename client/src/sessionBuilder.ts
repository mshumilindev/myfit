/**
 * Session Builder — the "AI-like, without AI" generation engine.
 *
 * Pure orchestration over the app's existing training models: it turns a build
 * context (goal, intent, target muscles, gym, history) into a fully-shaped
 * training DAY — warm-up, main lifts (sets × reps, target weights, warm-up
 * ramps), an optional cardio finisher and a cool-down — that reads like a
 * coach's plan, not a random pick.
 *
 * It stands on: recovery.ts (readiness), volume.ts + personalize.ts + goals.ts
 * (how many sets), the rich exercise catalog (what to pick), progression.ts +
 * standards (what weight), playbook.ts (what you actually like), loads/plates
 * (loadable reality). No store mutation, no React — it returns a plan the UI
 * renders, edits and materialises.
 */
import type { Activity, BodyMetrics, Gym, Workout } from './types';
import {
  BUILT_IN_CATALOG,
  richExerciseById,
  type MuscleGroup,
  type RichExercise,
} from './data/exercises';
import { exerciseDay, type TrainingDay } from './data/daySuggest';
import { nextTarget, topHistory } from './progression';
import { muscleReadiness, type ReadyState } from './recovery';
import { LANDMARKS, VOLUME_MUSCLES, weeklyMuscleSets, type Landmark } from './volume';
import { personalLandmarks } from './personalize';
import { focusAdjustLandmarks, groupEmphasis, type Emphasis, type FitGoals } from './goals';
import { computePlaybook, type Play } from './playbook';
import { deriveLoadType, type LoadType } from './loads';

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
const roundToStep = (n: number, step: number): number => Math.round(n / step) * step;

// ---------------------------------------------------------------------------
// Intent → per-set prescription
// ---------------------------------------------------------------------------
export type SessionIntent = 'strength' | 'muscle' | 'endurance' | 'power' | 'conditioning';

export interface IntentSpec {
  intent: SessionIntent;
  repLow: number;
  repHigh: number;
  setsMin: number;
  setsMax: number;
  restSec: number;
}

export const INTENT_SPEC: Record<SessionIntent, IntentSpec> = {
  strength: { intent: 'strength', repLow: 3, repHigh: 5, setsMin: 3, setsMax: 5, restSec: 210 },
  muscle: { intent: 'muscle', repLow: 6, repHigh: 12, setsMin: 3, setsMax: 4, restSec: 105 },
  endurance: { intent: 'endurance', repLow: 12, repHigh: 20, setsMin: 2, setsMax: 4, restSec: 60 },
  power: { intent: 'power', repLow: 3, repHigh: 6, setsMin: 3, setsMax: 5, restSec: 150 },
  conditioning: {
    intent: 'conditioning',
    repLow: 10,
    repHigh: 15,
    setsMin: 3,
    setsMax: 4,
    restSec: 40,
  },
};

export function intentSpec(i: SessionIntent): IntentSpec {
  return INTENT_SPEC[i] ?? INTENT_SPEC.muscle;
}

// ---------------------------------------------------------------------------
// Volume sizing — how many working sets for a muscle today
// ---------------------------------------------------------------------------

/**
 * Today's working-set dose for one muscle: aim to reach the (goal-adjusted,
 * personalised) weekly MAV, credit what's already been done this week, and
 * split the remainder over the sessions left — bounded to a sane per-session
 * dose that never pushes the muscle over half its weekly MRV in one day.
 */
export function sessionSetsForMuscle(lm: Landmark, weekToDate: number, sessionsLeft = 2): number {
  const target = Math.max(lm.mev, lm.mav);
  const remaining = Math.max(lm.mev, target - Math.max(0, weekToDate));
  const per = sessionsLeft > 0 ? remaining / sessionsLeft : remaining;
  const hi = Math.max(3, Math.round(lm.mrv / 2));
  return clamp(Math.round(per), 3, hi);
}

// ---------------------------------------------------------------------------
// Warm-up ramp
// ---------------------------------------------------------------------------
export interface PlannedSet {
  reps: number;
  weight: number | null;
  type: 'warmup' | 'working';
}

/**
 * A ramp of warm-up sets up to the first working weight. Only for loaded
 * compound work heavy enough to warrant it; light isolation and non-weight
 * load types get none. Each rung is rounded to a loadable step.
 */
export function warmupRamp(
  workingKg: number | null,
  opts: { loadType?: LoadType; compound?: boolean; barKg?: number; step?: number } = {},
): PlannedSet[] {
  const { loadType = 'weight', compound = true, barKg = 20, step = 2.5 } = opts;
  if (loadType !== 'weight' || !compound || !workingKg || workingKg <= 0) return [];
  if (workingKg < barKg * 1.5) return [];
  const out: PlannedSet[] = [{ reps: 10, weight: barKg, type: 'warmup' }];
  for (const [f, reps] of [
    [0.55, 5],
    [0.75, 3],
    [0.9, 1],
  ] as [number, number][]) {
    const w = roundToStep(workingKg * f, step);
    if (w > out[out.length - 1].weight! && w < workingKg)
      out.push({ reps, weight: w, type: 'warmup' });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Cold-start weight (no history) — conservative body-weight fractions
// ---------------------------------------------------------------------------
export type Pattern =
  | 'squat'
  | 'hinge'
  | 'horiz-press'
  | 'vert-press'
  | 'horiz-pull'
  | 'vert-pull'
  | 'curl'
  | 'isolation'
  | 'other';

const BW_FRACTION: Partial<Record<Pattern, { M: number; F: number }>> = {
  squat: { M: 0.6, F: 0.45 },
  hinge: { M: 0.7, F: 0.55 },
  'horiz-press': { M: 0.5, F: 0.3 },
  'vert-press': { M: 0.33, F: 0.2 },
  'horiz-pull': { M: 0.45, F: 0.32 },
  'vert-pull': { M: 0.5, F: 0.35 },
  curl: { M: 0.18, F: 0.12 },
};

export function coldStartWeight(
  pattern: Pattern,
  bodyKg: number | null | undefined,
  sex: 'male' | 'female' | undefined,
  step = 2.5,
): number | null {
  const f = BW_FRACTION[pattern];
  if (!f || !bodyKg || bodyKg <= 0) return null;
  const frac = sex === 'female' ? f.F : f.M;
  return Math.max(step, roundToStep(bodyKg * frac, step));
}

const SKIP_RE =
  /stretch|mobility|warm|drill|around the world|wrist|figure ?8|windmill|get[- ]?up|pass between|foam/i;

const EQUIP_RANK: Record<string, number> = {
  dumbbell: 0,
  barbell: 0,
  cable: 0,
  machine: 1,
  'e-z-curl-bar': 1,
  kettlebell: 2,
  bands: 2,
  body: 3,
};

export function patternOf(name: string, mechanic: RichExercise['mechanic']): Pattern {
  const n = name.toLowerCase();
  if (/squat|leg press|lunge|split squat|hack/.test(n)) return 'squat';
  if (/deadlift|romanian|rdl|good ?morning|hip thrust|hinge|back extension/.test(n)) return 'hinge';
  if (/overhead|shoulder press|ohp|military|arnold/.test(n)) return 'vert-press';
  if (/bench|chest press|dip|push[- ]?up|incline press|decline press/.test(n)) return 'horiz-press';
  if (/pulldown|pull[- ]?up|chin[- ]?up|lat ?pull/.test(n)) return 'vert-pull';
  if (/row|face pull|inverted/.test(n)) return 'horiz-pull';
  if (/curl/.test(n)) return 'curl';
  return mechanic === 'compound' ? 'other' : 'isolation';
}

// ---------------------------------------------------------------------------
// Exercise ranking from the catalog
// ---------------------------------------------------------------------------
export interface Candidate {
  name: string;
  primary: MuscleGroup | null;
  secondary: MuscleGroup[];
  equipment: string | null;
  compound: boolean;
  level: RichExercise['level'];
}

function equipAvailable(equip: string | null, gym: Gym | null): boolean {
  if (!equip) return true;
  const inv = gym?.inventory;
  if (!inv || inv.length === 0) return true;
  return inv.includes(equip);
}

/** Candidates whose PRIMARY group is `muscle`, gym-available and not gimmicky,
 *  compounds ranked before isolation, loadable equipment first. */
export function rankExercisesForMuscle(muscle: MuscleGroup, gym: Gym | null): Candidate[] {
  const out: Candidate[] = [];
  const seen = new Set<string>();
  for (const ex of BUILT_IN_CATALOG) {
    if (ex.muscle !== muscle) continue;
    const rich = richExerciseById(ex.id);
    if (!rich || rich.category !== 'strength') continue;
    const name = ex.names[0];
    if (SKIP_RE.test(name) || seen.has(name)) continue;
    if (!equipAvailable(ex.equipment ?? null, gym)) continue;
    seen.add(name);
    out.push({
      name,
      primary: rich.primaryMuscles[0] ?? muscle,
      secondary: rich.secondaryMuscles,
      equipment: ex.equipment ?? null,
      compound: rich.mechanic === 'compound',
      level: rich.level,
    });
  }
  out.sort((a, b) => {
    if (a.compound !== b.compound) return a.compound ? -1 : 1;
    const ra = EQUIP_RANK[a.equipment ?? ''] ?? 4;
    const rb = EQUIP_RANK[b.equipment ?? ''] ?? 4;
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name);
  });
  return out;
}

// ---------------------------------------------------------------------------
// Muscle selection
// ---------------------------------------------------------------------------
export interface BuildContext {
  finished: Workout[];
  activities: Activity[];
  body: BodyMetrics | null;
  goals: FitGoals | undefined;
  gym: Gym | null;
  now: number;
  intent: SessionIntent;
  targetMuscles?: MuscleGroup[];
  lengthMin?: number;
  warmup?: boolean;
  cardio?: boolean;
  cooldown?: boolean;
  bodyKg?: number | null;
  sex?: 'male' | 'female';
}

/** Auto-pick a coherent day of recovered, volume-hungry, on-goal muscles. */
export function pickMuscles(ctx: BuildContext): MuscleGroup[] {
  const ready = muscleReadiness(ctx.finished, ctx.now);
  const lms = focusAdjustLandmarks(personalLandmarks(ctx.finished, ctx.now), ctx.goals);
  const week = weeklyMuscleSets(ctx.finished, ctx.now);
  const emph = groupEmphasis(ctx.goals);

  const scored: { m: MuscleGroup; score: number; state: ReadyState }[] = [];
  for (const m of VOLUME_MUSCLES) {
    const r = ready.get(m);
    if (r && r.state === 'recovering') continue; // never hammer unrecovered tissue
    const lm = lms.get(m) ?? LANDMARKS[m];
    if (!lm) continue;
    const debt = clamp((lm.mav - (week.get(m) ?? 0)) / Math.max(1, lm.mav), 0, 1);
    const e = emph.get(m);
    const ebonus = e === 'grow' ? 0.4 : e === 'ease' ? -0.7 : 0;
    const stateBonus = r?.state === 'stale' ? 0.25 : r?.state === 'ready' ? 0.1 : 0;
    scored.push({ m, score: debt + ebonus + stateBonus, state: r?.state ?? 'ready' });
  }
  scored.sort((a, b) => b.score - a.score);
  if (scored.length === 0) return [];

  // Coherent day: the dominant push/pull/legs split of the top picks, plus core.
  const topDay = exerciseDay(scored[0].m);
  const inDay = (m: MuscleGroup): boolean =>
    m === 'core' || (topDay != null && exerciseDay(m) === topDay);
  const chosen = scored.filter((s) => inDay(s.m)).slice(0, 5);
  return (chosen.length >= 2 ? chosen : scored.slice(0, 4)).map((s) => s.m);
}

// ---------------------------------------------------------------------------
// Plan assembly
// ---------------------------------------------------------------------------
export interface PlannedExercise {
  name: string;
  kind: 'strength' | 'cardio' | 'warmup' | 'cooldown';
  primary: MuscleGroup | null;
  secondary: MuscleGroup[];
  equipment: string[];
  loadType: LoadType;
  sets: number;
  repLow: number;
  repHigh: number;
  targetWeight: number | null;
  deltaKg: number;
  progState: string;
  warmup: PlannedSet[];
  why: string;
  durationMin?: number | null;
}

export interface GeneratedDay {
  dayName: string;
  intent: SessionIntent;
  targetMuscles: MuscleGroup[];
  warmup: PlannedExercise[];
  main: PlannedExercise[];
  cardio: PlannedExercise[];
  cooldown: PlannedExercise[];
  coverage: { muscle: MuscleGroup; sets: number }[];
  estMinutes: number;
}

const DAY_LABEL: Record<TrainingDay, string> = {
  push: 'Push',
  pull: 'Pull',
  legs: 'Legs',
  core: 'Core',
  full: 'Full body',
};

function dayNameFor(muscles: MuscleGroup[]): string {
  const days = new Set(muscles.map((m) => exerciseDay(m)).filter(Boolean) as TrainingDay[]);
  const main = [...days].filter((d) => d === 'push' || d === 'pull' || d === 'legs');
  if (main.length === 1) return DAY_LABEL[main[0]] + (days.has('core') ? ' + core' : '');
  if (main.length >= 3) return 'Full body';
  if (main.length === 2) return 'Upper body';
  return days.has('core') ? 'Core' : 'Session';
}

function playForMuscles(finished: Workout[], now: number, muscles: MuscleGroup[]): Play | null {
  const pb = computePlaybook(finished, now);
  if (!pb.ready) return null;
  let best: { play: Play; overlap: number } | null = null;
  for (const play of pb.plays) {
    const covered = new Set(play.coverage.map((c) => c.muscle));
    const overlap = muscles.filter((m) => covered.has(m)).length;
    if (overlap > 0 && (!best || overlap > best.overlap)) best = { play, overlap };
  }
  return best?.play ?? null;
}

function whyFor(
  primary: MuscleGroup | null,
  emph: Map<MuscleGroup, Emphasis>,
  state: ReadyState | undefined,
  progState: string,
  fromPlay: boolean,
): string {
  if (primary && emph.get(primary) === 'grow')
    return 'A grow-focus muscle — earns extra work today.';
  if (fromPlay) return 'One of your staples on this day.';
  if (state === 'stale') return "Hasn't been trained in a while — bringing it back.";
  if (progState === 'progress') return 'Recovered and due to add load.';
  if (progState === 'first') return 'New lift — start light and find your working weight.';
  return 'Fits the day and your recovery.';
}

/** Build a full training day from the context. */
export function buildDay(ctx: BuildContext): GeneratedDay {
  const spec = intentSpec(ctx.intent);
  const muscles =
    ctx.targetMuscles && ctx.targetMuscles.length > 0 ? ctx.targetMuscles : pickMuscles(ctx);
  const lms = focusAdjustLandmarks(personalLandmarks(ctx.finished, ctx.now), ctx.goals);
  const week = weeklyMuscleSets(ctx.finished, ctx.now);
  const ready = muscleReadiness(ctx.finished, ctx.now);
  const emph = groupEmphasis(ctx.goals);
  const play = playForMuscles(ctx.finished, ctx.now, muscles);
  const bodyKg = ctx.bodyKg ?? null;

  const used = new Set<string>();
  const main: PlannedExercise[] = [];

  const makeExercise = (
    name: string,
    primary: MuscleGroup | null,
    secondary: MuscleGroup[],
    equipment: string | null,
    compound: boolean,
    sets: number,
  ): PlannedExercise => {
    const loadType = deriveLoadType(name, equipment ? [equipment] : []);
    const target = nextTarget(topHistory(ctx.finished, name, ctx.now), {
      plannedReps: spec.repHigh,
      equipment: equipment ? [equipment] : [],
      primary,
      loadType,
    });
    let weight = target.weight;
    if (weight == null && loadType === 'weight') {
      weight = coldStartWeight(
        patternOf(name, compound ? 'compound' : 'isolation'),
        bodyKg,
        ctx.sex,
      );
    }
    return {
      name,
      kind: 'strength',
      primary,
      secondary,
      equipment: equipment ? [equipment] : [],
      loadType,
      sets,
      repLow: spec.repLow,
      repHigh: spec.repHigh,
      targetWeight: weight,
      deltaKg: target.deltaKg,
      progState: target.state,
      warmup: warmupRamp(weight, { loadType, compound }),
      why: whyFor(primary, emph, ready.get(primary as MuscleGroup)?.state, target.state, false),
    };
  };

  for (const m of muscles) {
    const lm = lms.get(m) ?? LANDMARKS[m];
    if (!lm) continue;
    let budget = sessionSetsForMuscle(lm, week.get(m) ?? 0, 2);
    const ranked = rankExercisesForMuscle(m, ctx.gym);
    if (ranked.length === 0) continue;

    // Anchor: a playbook staple for this muscle if there is one, else the top
    // ranked compound.
    const playName = play?.exercises.find(
      (e) => e.primary === m && ranked.some((c) => c.name === e.name),
    )?.name;
    const anchor = playName
      ? ranked.find((c) => c.name === playName)!
      : (ranked.find((c) => c.compound) ?? ranked[0]);
    const anchorSets = clamp(Math.ceil(budget * 0.55), spec.setsMin, spec.setsMax);
    if (!used.has(anchor.name)) {
      used.add(anchor.name);
      const ex = makeExercise(
        anchor.name,
        anchor.primary,
        anchor.secondary,
        anchor.equipment,
        anchor.compound,
        anchorSets,
      );
      if (playName) ex.why = 'One of your staples on this day.';
      main.push(ex);
      budget -= anchorSets;
    }

    // Fill the rest with isolation / accessory work.
    for (const c of ranked) {
      if (budget < spec.setsMin) break;
      if (used.has(c.name)) continue;
      used.add(c.name);
      const sets = clamp(budget, spec.setsMin, spec.setsMax);
      main.push(makeExercise(c.name, c.primary, c.secondary, c.equipment, c.compound, sets));
      budget -= sets;
    }
  }

  // Order: compounds before isolation, keeping muscle grouping roughly intact.
  main.sort((a, b) => Number(b.warmup.length > 0) - Number(a.warmup.length > 0));

  const warmup: PlannedExercise[] = ctx.warmup
    ? [
        {
          name: 'Warm-up · mobility + light cardio',
          kind: 'warmup',
          primary: null,
          secondary: [],
          equipment: [],
          loadType: 'weight',
          sets: 1,
          repLow: 0,
          repHigh: 0,
          targetWeight: null,
          deltaKg: 0,
          progState: 'first',
          warmup: [],
          why: 'Raise the heart rate and prime the day’s patterns.',
          durationMin: 5,
        },
      ]
    : [];

  const cardio: PlannedExercise[] = ctx.cardio
    ? [
        {
          name: 'Incline walk',
          kind: 'cardio',
          primary: 'cardio',
          secondary: [],
          equipment: [],
          loadType: 'weight',
          sets: 1,
          repLow: 0,
          repHigh: 0,
          targetWeight: null,
          deltaKg: 0,
          progState: 'first',
          warmup: [],
          why: 'Zone-2 finisher to round out the day.',
          durationMin: 12,
        },
      ]
    : [];

  const cooldown: PlannedExercise[] = ctx.cooldown
    ? [
        {
          name: 'Cool-down stretch',
          kind: 'cooldown',
          primary: null,
          secondary: [],
          equipment: [],
          loadType: 'weight',
          sets: 1,
          repLow: 0,
          repHigh: 0,
          targetWeight: null,
          deltaKg: 0,
          progState: 'first',
          warmup: [],
          why: 'Ease down and stretch the muscles you trained.',
          durationMin: 4,
        },
      ]
    : [];

  // Coverage (fractional: primary 1, secondary 0.5) and duration estimate.
  const cover = new Map<MuscleGroup, number>();
  for (const ex of main) {
    if (ex.primary && ex.primary !== 'cardio')
      cover.set(ex.primary, (cover.get(ex.primary) ?? 0) + ex.sets);
    for (const s of ex.secondary)
      if (s !== ex.primary && s !== 'cardio') cover.set(s, (cover.get(s) ?? 0) + ex.sets * 0.5);
  }
  const coverage = [...cover.entries()]
    .map(([muscle, sets]) => ({ muscle, sets: Math.round(sets * 10) / 10 }))
    .sort((a, b) => b.sets - a.sets);

  const workSecPerSet = 40;
  const mainMin = main.reduce(
    (t, ex) => t + (ex.warmup.length * 45 + ex.sets * (workSecPerSet + spec.restSec)) / 60,
    0,
  );
  const extraMin =
    (warmup[0]?.durationMin ?? 0) + (cardio[0]?.durationMin ?? 0) + (cooldown[0]?.durationMin ?? 0);
  const estMinutes = Math.round(mainMin + extraMin);

  return {
    dayName: dayNameFor(muscles),
    intent: ctx.intent,
    targetMuscles: muscles,
    warmup,
    main,
    cardio,
    cooldown,
    coverage,
    estMinutes,
  };
}
