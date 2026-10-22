/**
 * Progression engine (design PROG-1..W): the recommended next target for a
 * lift, from the athlete's own history. Double progression on load -- add weight
 * once the top of the rep range is reached, otherwise chase one more rep -- with
 * a light deload when the top set has stalled, and a from-scratch aim when there
 * is no history. Pure: feed it the exercise's top-set history and options.
 *
 * We already prefill last weight and log RPE; this turns that into an actual
 * target instead of "repeat last time".
 *
 * Breaks (SPO-149): when the caller passes `now`, a lift that was not trained for
 * 15+ calendar days gets a 'return' target (no jump, then a lighter start, then a
 * fast climb back to the pre-break load) instead of "last weight / +5 kg". See
 * docs/specs/detraining-return-after-break.md and docs/research/detraining.md.
 */
import { topSet, isStrengthExercise, liftVariant, loadTypeFor } from './store';
import type { Workout } from './types';
import type { EquipmentId } from './data/equipment';
import type { MuscleGroup } from './data/exercises';
import type { LoadType } from './loads';
import type { ConditionEffects } from './data/conditionCatalog';
import { progressionMult } from './calcMods';
import {
  REF_BODY_KG,
  REGAIN_MAX_SESSIONS,
  CUT_FROM_DAYS,
  STALL_BREAK_DAYS,
  breakRow,
  calendarDaysBetween,
  gapDays,
  type BreakRow,
} from './detraining';

export interface TopPoint {
  ts: number;
  weight: number | null;
  reps: number;
}

/** Top working set per past session for `name`, newest first (optionally only
 *  sessions before `beforeTs`, so the live session excludes itself). */
export function topHistory(
  finished: Workout[],
  name: string,
  beforeTs?: number,
  variant?: string,
): TopPoint[] {
  const needle = name.trim().toLowerCase();
  const pts: TopPoint[] = [];
  for (const w of finished) {
    if (beforeTs !== undefined && w.startedAt >= beforeTs) continue;
    const ex = w.exercises.find(
      (e) =>
        e.name.trim().toLowerCase() === needle &&
        isStrengthExercise(e) &&
        (variant === undefined || liftVariant(w, e) === variant),
    );
    if (!ex) continue;
    const top = topSet(ex.sets);
    if (!top) continue;
    pts.push({ ts: w.startedAt, weight: top.weight, reps: top.reps });
  }
  return pts.sort((a, b) => b.ts - a.ts);
}

/** 'return' = first sessions back after a break (see `Target.returnKind`). */
export type ProgState = 'first' | 'progress' | 'hold' | 'stall' | 'return';

/** ease: break of 2-4 weeks, no jump · cut: lighter start after a longer break · regain: climbing back to the pre-break load. */
export type ReturnKind = 'ease' | 'cut' | 'regain';

export interface Target {
  state: ProgState;
  weight: number | null;
  reps: number;
  deltaKg: number;
  repLow: number;
  repHigh: number;
  prevWeight: number | null;
  prevReps: number | null;
  /** state 'return' only: which kind of return this is. */
  returnKind?: ReturnKind;
  /** state 'return' only: calendar days since the lift was last trained (ease/cut). */
  gapDays?: number;
}

export interface ProgOpts {
  plannedReps?: number | null;
  equipment?: string[];
  primary?: MuscleGroup | null;
  bodyweight?: boolean;
  /** Load type (Load-entry C): steers the direction of progress. Defaults to
   *  plain weight. */
  loadType?: LoadType;
  /** "Now" (ms) for break detection. Absent = no break logic (the old behaviour);
   *  callers that know the time pass it, tests pin it. */
  now?: number;
  /** Body mass (kg), only used to size the extra help of an assisted machine after a break. */
  bodyKg?: number | null;
}

/** Stack step for an assisted machine's counter-weight (a typical plate). */
const ASSIST_STEP = 5;

// Loaded compound barbell work on these gets a 5 kg jump; everything else 2.5.
const BIG: MuscleGroup[] = ['quads', 'hamstrings', 'glutes', 'back', 'lats', 'chest'];

function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step;
}

function repRange(plannedReps?: number | null): { low: number; high: number } {
  const high = plannedReps && plannedReps > 0 ? plannedReps : 10;
  return { low: Math.max(5, high - 3), high };
}

function stepFor(opts: ProgOpts): number {
  const barbell = (opts.equipment ?? []).includes('barbell');
  const big = opts.primary ? BIG.includes(opts.primary) : false;
  return barbell && big ? 5 : 2.5;
}

/** Top weight flat (no new high) across the last 3+ loaded sessions. */
function isStalled(history: TopPoint[]): boolean {
  const loaded = history.filter((p) => (p.weight ?? 0) > 0);
  if (loaded.length < 3) return false;
  const recent = loaded.slice(0, 3);
  // A break inside the window is not a plateau (SPO-149).
  for (let i = 0; i < 2; i++)
    if (calendarDaysBetween(recent[i + 1].ts, recent[i].ts) >= STALL_BREAK_DAYS) return false;
  const w = recent[0].weight ?? 0;
  return recent.every((p) => (p.weight ?? 0) <= w) && (recent[2].weight ?? 0) === w;
}

// ---------------------------------------------------------------------------
// Breaks (SPO-149): first session back, and the climb to the pre-break load
// ---------------------------------------------------------------------------

/** Cut a load by `mult` and keep it loadable (2.5 steps), never above the last weight. */
function cutWeight(prev: number, mult: number): number {
  return Math.min(prev, Math.max(2.5, roundTo(prev * mult, 2.5)));
}

/** The first target after `gap` calendar days without this lift (rows R1..R5 of the research table). */
function returnTarget(
  last: TopPoint,
  row: BreakRow,
  gap: number,
  opts: ProgOpts,
  range: { repLow: number; repHigh: number },
): Target {
  const { repLow: low, repHigh: high } = range;
  const { weight: prevWeight, reps: prevReps } = last;
  const mk = (weight: number | null, reps: number, kind: ReturnKind): Target => ({
    state: 'return',
    weight,
    reps,
    deltaKg: weight !== null && prevWeight !== null ? weight - prevWeight : 0,
    repLow: low,
    repHigh: high,
    prevWeight,
    prevReps,
    returnKind: kind,
    gapDays: gap,
  });
  const unloaded = opts.bodyweight || prevWeight === null || prevWeight === 0;
  const assisted = opts.loadType === 'assist' && prevWeight !== null;

  // R1: a short break (2-4 weeks) -- same load, no jump, no "+1 rep" either.
  if (row.tier === 1) {
    if (opts.loadType === 'band' || (unloaded && !assisted))
      return mk(prevWeight, prevReps, 'ease');
    return mk(prevWeight, Math.min(prevReps, high), 'ease');
  }

  const reduced = Math.max(1, Math.round(prevReps * row.weightMult));
  // Band: the colour ladder is discrete, so fewer reps instead of a lighter band.
  if (opts.loadType === 'band') return mk(prevWeight, reduced, 'cut');
  // Assisted: weaker = MORE help (stored as a more negative kg). At least one stack step.
  if (assisted) {
    const body = opts.bodyKg && opts.bodyKg > 0 ? opts.bodyKg : REF_BODY_KG;
    // 2-decimal pre-round: 75 x (1 - 0.9) is 7.499999... in floating point, not 7.5.
    const lost = Math.round(body * (1 - row.weightMult) * 100) / 100;
    const extra = Math.max(ASSIST_STEP, roundTo(lost, ASSIST_STEP));
    return mk(Math.min(prevWeight, 0) - extra, Math.min(prevReps, low), 'cut');
  }
  // Bodyweight / unloaded: fewer reps, no weight.
  if (unloaded) return mk(null, reduced, 'cut');
  // Never more reps than last time: a heavy single cut to 90% x 7 would out-lift the old best.
  // On a light weight the 2.5 grid swallows the cut: same weight is "no jump", never "lighter".
  const cut = cutWeight(prevWeight, row.weightMult);
  return mk(cut, Math.min(prevReps, low), cut < prevWeight ? 'cut' : 'ease');
}

/**
 * Sessions right after a real break (>= CUT_FROM_DAYS between two sessions, within
 * REGAIN_MAX_SESSIONS): climb back to the pre-break load by the normal step per
 * session instead of waiting out a whole double-progression cycle at the lighter
 * weight (return is faster than the first gain -- research R2..R5). Weighted and
 * assisted lifts only; reps-only lifts already add a rep a session. null = nothing to do.
 */
function regainTarget(
  history: TopPoint[],
  opts: ProgOpts,
  range: { repLow: number; repHigh: number },
): Target | null {
  if (opts.loadType === 'band' || opts.bodyweight) return null;
  const last = history[0];
  let pre: TopPoint | null = null;
  const reach = Math.min(history.length - 1, REGAIN_MAX_SESSIONS);
  for (let i = 0; i < reach; i++) {
    if (calendarDaysBetween(history[i + 1].ts, history[i].ts) >= CUT_FROM_DAYS) {
      pre = history[i + 1];
      break;
    }
  }
  if (!pre || last.weight === null || pre.weight === null) return null;
  if (last.weight >= pre.weight) return null;
  const assisted = opts.loadType === 'assist';
  // An assisted lift's pre-break load can be 0 (no help at all); a plain one cannot.
  if (!assisted && (pre.weight === 0 || last.weight <= 0)) return null;
  const { repLow: low, repHigh: high } = range;
  const base = {
    state: 'return' as const,
    repLow: low,
    repHigh: high,
    prevWeight: last.weight,
    prevReps: last.reps,
    returnKind: 'regain' as const,
  };
  // Not yet at the bottom of the range last time: hold the weight, chase a rep.
  if (last.reps < low) {
    return { ...base, weight: last.weight, reps: Math.min(last.reps + 1, high), deltaKg: 0 };
  }
  const step = assisted ? ASSIST_STEP : stepFor(opts);
  const weight = Math.min(pre.weight, last.weight + step);
  return { ...base, weight, reps: low, deltaKg: weight - last.weight };
}

function baseTarget(history: TopPoint[], opts: ProgOpts = {}): Target {
  const { low, high } = repRange(opts.plannedReps);
  const base = { repLow: low, repHigh: high };

  if (history.length === 0) {
    return {
      state: 'first',
      weight: null,
      reps: high,
      deltaKg: 0,
      ...base,
      prevWeight: null,
      prevReps: null,
    };
  }

  const last = history[0];
  const prevWeight = last.weight;
  const prevReps = last.reps;

  // A break: this lift was not trained for 15+ calendar days (only when the caller gave `now`).
  if (opts.now !== undefined) {
    const gap = gapDays(history, opts.now) ?? 0;
    const row = breakRow(gap);
    if (row) return returnTarget(last, row, gap, opts, { repLow: low, repHigh: high });
    const regain = regainTarget(history, opts, { repLow: low, repHigh: high });
    if (regain) return regain;
  }

  // Resistance band: the kg is an estimate off a discrete colour ladder, so we
  // never nudge it — chase reps, and the UI suggests the next band at the top.
  if (opts.loadType === 'band') {
    return {
      state: 'progress',
      weight: prevWeight,
      reps: prevReps < high ? prevReps + 1 : high,
      deltaKg: 0,
      ...base,
      prevWeight,
      prevReps,
    };
  }

  // Assisted machine: help is stored as negative kg. "Stronger" means LESS help,
  // so double-progression walks the counter-weight toward zero (never past it).
  if (opts.loadType === 'assist' && prevWeight !== null) {
    if (prevReps >= high) {
      const next = Math.min(prevWeight + ASSIST_STEP, 0);
      return {
        state: next >= 0 ? 'hold' : 'progress',
        weight: next,
        reps: next >= 0 ? Math.min(prevReps + 1, high) : low,
        deltaKg: next - prevWeight,
        ...base,
        prevWeight,
        prevReps,
      };
    }
    return {
      state: 'hold',
      weight: prevWeight,
      reps: Math.min(prevReps + 1, high),
      deltaKg: 0,
      ...base,
      prevWeight,
      prevReps,
    };
  }

  // Bodyweight / unloaded: progress by reps.
  if (opts.bodyweight || prevWeight === null || prevWeight === 0) {
    return {
      state: 'progress',
      weight: null,
      reps: prevReps + 1,
      deltaKg: 0,
      ...base,
      prevWeight,
      prevReps,
    };
  }

  if (isStalled(history)) {
    const deloaded = Math.max(roundTo(prevWeight * 0.9, 2.5), 2.5);
    return {
      state: 'stall',
      weight: deloaded,
      reps: low,
      deltaKg: deloaded - prevWeight,
      ...base,
      prevWeight,
      prevReps,
    };
  }

  // Double progression: hit the top of the range -> add load, reset reps.
  if (prevReps >= high) {
    const step = stepFor(opts);
    return {
      state: 'progress',
      weight: prevWeight + step,
      reps: low,
      deltaKg: step,
      ...base,
      prevWeight,
      prevReps,
    };
  }

  // Otherwise hold the weight and chase one more rep.
  return {
    state: 'hold',
    weight: prevWeight,
    reps: Math.min(prevReps + 1, high),
    deltaKg: 0,
    ...base,
    prevWeight,
    prevReps,
  };
}

// ---------------------------------------------------------------------------
// Long-term conditions: slower / no automatic load increases
// ---------------------------------------------------------------------------

let activeEffects: ConditionEffects = {};

/** Set once from the app shell with the stacked effects of the active conditions. */
export function setProgressionEffects(e: ConditionEffects): void {
  activeEffects = e;
}

/** `nextTarget` with the person's conditions applied (every caller gets them for free). */
export function nextTarget(history: TopPoint[], opts: ProgOpts = {}): Target {
  const base = baseTarget(history, opts);
  if (isRaise(base) && base.state === 'return') {
    // A climb back after a break is limited by conditions and nicotine alike; the
    // most conservative step wins -- never their product (SPO-149 spec).
    const byCondition = applyConditionEffects(base, activeEffects);
    const byNicotine = applyNicotineStep(base);
    return byNicotine.deltaKg < byCondition.deltaKg ? byNicotine : byCondition;
  }
  return applyNicotineStep(applyConditionEffects(base, activeEffects));
}

/** A target that raises the load: normal progress, or a climb back after a break. */
function isRaise(t: Target): boolean {
  if (t.state !== 'progress' && !(t.state === 'return' && t.returnKind === 'regain')) return false;
  return t.weight != null && t.prevWeight != null && t.deltaKg > 0;
}

/**
 * Nicotine makes the next load jump a little smaller (midpoint of its range; x1 = no
 * change when off). Halves of a kilo, rounded up (so the cap always holds), at least 0.5.
 * A 2.5 kg step stays 2.5 at the current caps (it rounds back up); a 5 kg step can become 4.5.
 */
export function applyNicotineStep(t: Target): Target {
  if (!isRaise(t) || t.weight == null || t.prevWeight == null) return t;
  const k = progressionMult();
  if (k >= 1) return t;
  // Rounded UP to the half kilo, so rounding can never push the step past the cap.
  const delta = Math.max(0.5, Math.ceil((t.deltaKg * k) / 0.5) * 0.5);
  if (delta >= t.deltaKg) return t;
  return { ...t, weight: t.prevWeight + delta, deltaKg: delta };
}

export function applyConditionEffects(t: Target, e: ConditionEffects): Target {
  if (!isRaise(t) || t.weight == null || t.prevWeight == null) return t;
  if (e.noAutoIncrease) {
    return {
      ...t,
      state: 'hold',
      weight: t.prevWeight,
      reps: Math.min((t.prevReps ?? t.repLow) + 1, t.repHigh),
      deltaKg: 0,
    };
  }
  if (e.stepScale != null && e.stepScale < 1) {
    // Never above the unscaled target: a regain's weight is capped at the pre-break load.
    const delta = Math.min(t.deltaKg, Math.max(0.5, roundTo(t.deltaKg * e.stepScale, 0.5)));
    return { ...t, weight: t.prevWeight + delta, deltaKg: delta };
  }
  return t;
}

/** The progression target shown under a picker suggestion ("Try 80 × 8"); `beforeTs` is the moment the suggestion is for, so a lift not trained for weeks shows the lighter return target (SPO-149). */
export function pickTarget(
  item: {
    name: string;
    timesDone: number;
    equipment: EquipmentId | null;
    primary: MuscleGroup | null;
    last: { weight: number | null } | null;
  },
  finished: Workout[],
  beforeTs: number,
): Target | null {
  if (item.timesDone === 0) return null;
  const hist = topHistory(finished, item.name, beforeTs);
  if (hist.length === 0) return null;
  return nextTarget(hist, {
    equipment: item.equipment ? [item.equipment] : [],
    primary: item.primary,
    bodyweight: item.last?.weight === null,
    loadType: loadTypeFor({ name: item.name, equipment: item.equipment ? [item.equipment] : [] }),
    now: beforeTs,
  });
}
