/**
 * Weekly cycles and % of max (SPO-609, Advanced training › Periodization): the pure rules, no UI.
 *
 * One gate at the source (addons.md, "one wrapper on the source"): with Periodization not installed, `activeWeekPlan` always
 * answers the program's own week, `loadKg` never reads a percent and `repsLabel` never shows a range, so every reader gets the
 * same neutral value and no screen needs its own `if`. The stored cycle, percents and ranges are never touched.
 */
import { periodizationAvailable } from '../../addons/featureGates';
import {
  type CycleLabel,
  type ProgramCycle,
  type ProgramItem,
  type WeekPlan,
  MAX_CYCLE,
  MIN_CYCLE,
} from './model';
import type { MuscleGroup } from '../../data/exercises';

/** The least a program must have for a cycle to apply to it. */
export interface WeekSource {
  items: ProgramItem[];
  dayNames?: Record<string, string>;
  targetMuscles?: Record<string, MuscleGroup[]>;
  cycle?: ProgramCycle;
}

/** Cycle week (1-based) of program week `week` in a cycle of `length` weeks. */
export function cycleWeekOf(week: number, length: number): number {
  const w = Number.isFinite(week) ? Math.max(1, Math.floor(week)) : 1;
  const n = Math.floor(length);
  if (!Number.isFinite(n) || n < MIN_CYCLE) return 1;
  return ((w - 1) % Math.min(MAX_CYCLE, n)) + 1;
}

/** How many times the cycle repeats in a program of `weeks` weeks (0 = ongoing: no count). Whole repeats only. */
export function cycleRepeats(weeks: number, length: number): number {
  if (!(weeks > 0) || !(length >= MIN_CYCLE)) return 0;
  return Math.floor(weeks / length);
}

/** The days of cycle week `cw` (1-based) of a program, whatever the add-on state: the structure, not the gate. */
export function weekPlanOf(p: WeekSource, cw: number): WeekPlan {
  const base: WeekPlan = {
    ...(p.cycle?.baseLabel ? { label: p.cycle.baseLabel } : {}),
    dayNames: p.dayNames ?? {},
    targetMuscles: p.targetMuscles ?? {},
    items: p.items,
  };
  if (!p.cycle || cw <= 1) return base;
  return p.cycle.weeks[cw - 2] ?? base;
}

/** The cycle week program week `week` falls on; always 1 while Periodization is off or the program has no cycle. */
export function activeCycleWeek(p: Pick<WeekSource, 'cycle'>, week: number): number {
  if (!p.cycle || !periodizationAvailable()) return 1;
  return cycleWeekOf(week, p.cycle.length);
}

/** The days to train in program week `week`: the cycle week when Periodization is on, else the program's own week. */
export function activeWeekPlan(p: WeekSource, week: number): WeekPlan {
  return weekPlanOf(p, activeCycleWeek(p, week));
}

/** The hint of program week `week` (Deload, Test, Peak); undefined for a base week or while the add-on is off. */
export function activeWeekLabel(p: WeekSource, week: number): CycleLabel | undefined {
  return p.cycle && periodizationAvailable() ? activeWeekPlan(p, week).label : undefined;
}

/** True when program week `week` is a deload week (nothing counts as behind in it). */
export const isDeloadWeek = (p: WeekSource, week: number): boolean =>
  activeWeekLabel(p, week) === 'deload';

/** Days of a week that prescribe anything (rows, muscles or a name). */
export function trainingDaysOfPlan(
  w: Pick<WeekPlan, 'items' | 'dayNames' | 'targetMuscles'>,
): number[] {
  const out: number[] = [];
  for (let d = 1; d <= 7; d++) {
    const k = String(d);
    if (
      w.items.some((i) => i.day === d) ||
      (w.targetMuscles?.[k]?.length ?? 0) > 0 ||
      !!w.dayNames?.[k]?.trim()
    )
      out.push(d);
  }
  return out;
}

/** Training days planned in program week `week` (the cycle week when on). */
export function plannedDays(p: WeekSource, week: number): number {
  return trainingDaysOfPlan(activeWeekPlan(p, week)).length;
}

/** Training days planned from week 1 through `week`, each week counted by its own cycle week. */
export function plannedThrough(p: WeekSource, week: number): number {
  let n = 0;
  for (let w = 1; w <= Math.max(0, Math.floor(week)); w++) n += plannedDays(p, w);
  return n;
}

/** Equipment step the weights are rounded to (kg). */
export const KG_STEP = 2.5;

/** A percent of a max as kilograms, rounded to the nearest `step`; null when either number is unusable. */
export function pctToKg(pct: number, max: number, step: number = KG_STEP): number | null {
  if (!Number.isFinite(pct) || !Number.isFinite(max) || pct <= 0 || max <= 0) return null;
  const s = step > 0 ? step : KG_STEP;
  return Math.round(((pct / 100) * max) / s) * s;
}

export interface Load {
  /** Kilograms to put on the bar, null when none is prescribed or a percent has no max yet. */
  kg: number | null;
  /** The prescribed percent, when the row asks for one and Periodization is on. */
  pct: number | null;
  /** A percent is prescribed but there is no max to turn it into kilograms ("no max yet"). */
  needsMax: boolean;
}

/**
 * The load a row asks for. A percent wins when Periodization is on; with a max it becomes kilograms, without one it asks for
 * a max instead of inventing a weight. With the add-on off only `targetWeight` counts.
 */
export function loadKg(
  item: Pick<ProgramItem, 'targetWeight' | 'targetPct'>,
  max: number | null | undefined,
): Load {
  const pct = periodizationAvailable() && item.targetPct ? item.targetPct : null;
  if (pct) {
    const kg = max ? pctToKg(pct, max) : null;
    return { kg, pct, needsMax: kg === null };
  }
  return { kg: item.targetWeight ?? null, pct: null, needsMax: false };
}

/** "6–8" for a range (Periodization on), else the plain rep count. */
export function repsLabel(item: Pick<ProgramItem, 'reps' | 'repsMin'>): string {
  const min = periodizationAvailable() ? item.repsMin : undefined;
  return min && min < item.reps ? `${min}–${item.reps}` : String(item.reps);
}
