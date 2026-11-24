/**
 * Cleaning of stored cycles, percents and rep ranges (Periodization chunk). The core never runs this itself: its seam
 * (`periodizationApi.ts`) calls it only while the module is installed, and passes stored data through untouched otherwise.
 */
import {
  normalizeItems,
  savedWeekParts,
  type CycleLabel,
  type ProgramCycle,
  type ProgramItem,
  type WeekPlan,
} from '../views/programs/model';
import type { MuscleGroup } from '../data/exercises';
import { CYCLE_LABELS, MAX_CYCLE, MIN_CYCLE } from './cycle';

type Base = Pick<WeekPlan, 'items' | 'dayNames' | 'targetMuscles'>;

/** A percent of max kept on a row: whole numbers 1–110, anything else is dropped. */
export function sanitizePct(n: unknown): number | undefined {
  return typeof n === 'number' && Number.isFinite(n) && n > 0
    ? Math.max(1, Math.min(110, Math.round(n)))
    : undefined;
}

/** The percent and rep range a row keeps when saved (the range only when its lower end is below `reps`). */
export function rowExtras(i: ProgramItem): Pick<ProgramItem, 'targetPct' | 'repsMin'> {
  const pct = sanitizePct(i.targetPct);
  const min = Number.isFinite(i.repsMin) ? Math.round(i.repsMin as number) : 0;
  return {
    ...(pct ? { targetPct: pct } : {}),
    ...(min >= 1 && min < i.reps ? { repsMin: min } : {}),
  };
}

const labelOf = (v: unknown): CycleLabel | undefined =>
  CYCLE_LABELS.includes(v as CycleLabel) ? (v as CycleLabel) : undefined;

/** A copy of rows with fresh ids (and fresh group ids), used when a cycle week starts as a copy of another. */
export function cloneItems(src: ProgramItem[]): ProgramItem[] {
  const groups = new Map<string, string>();
  return src.map((it) => {
    let groupId = it.groupId ?? null;
    if (groupId) {
      if (!groups.has(groupId)) groups.set(groupId, crypto.randomUUID());
      groupId = groups.get(groupId)!;
    }
    return { ...it, id: crypto.randomUUID(), groupId };
  });
}

/** A copy of a cycle with fresh row ids in every week. */
export function cloneCycle(c: ProgramCycle): ProgramCycle {
  return { ...c, weeks: c.weeks.map((w) => ({ ...w, items: cloneItems(w.items) })) };
}

/**
 * Coerce a stored (or absent / malformed) cycle to a clean one that matches `base` (cycle week 1): length 2–12, one week for
 * each of the other cycle weeks (a missing one starts as a copy of the base), labels only from the known set. A cycle of
 * fewer than 2 weeks is no cycle (undefined).
 */
export function sanitizeCycle(raw: unknown, base: Base): ProgramCycle | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const len = Math.round(Number(r.length));
  if (!Number.isFinite(len) || len < MIN_CYCLE) return undefined;
  const length = Math.min(MAX_CYCLE, len);
  const stored = Array.isArray(r.weeks) ? (r.weeks as unknown[]) : [];
  const weeks: WeekPlan[] = [];
  for (let i = 0; i < length - 1; i++) {
    const w = stored[i];
    const o = w && typeof w === 'object' ? (w as Record<string, unknown>) : null;
    const parts = savedWeekParts(
      o
        ? {
            items: Array.isArray(o.items) ? (o.items as ProgramItem[]) : [],
            dayNames: (o.dayNames ?? {}) as Record<string, string>,
            targetMuscles: (o.targetMuscles ?? {}) as Record<string, MuscleGroup[]>,
          }
        : { ...base, items: cloneItems(base.items) },
    );
    const label = o ? labelOf(o.label) : undefined;
    weeks.push({ ...(label ? { label } : {}), ...parts });
  }
  const baseLabel = labelOf(r.baseLabel);
  return {
    length,
    ...(baseLabel ? { baseLabel } : {}),
    weeks: weeks.map((w) => ({ ...w, items: normalizeItems(w.items) })),
  };
}
