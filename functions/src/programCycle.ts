/**
 * Training days of a program week when the program has a weekly cycle (SPO-609). The server holds no add-on state: a cycle
 * is plain data on the program, and the plan it describes is what "expected so far" is measured against. Programs without a
 * cycle keep the old rule (weeks x days per week).
 */
interface Week {
  items?: Array<{ day: number; name?: string }>;
  targetMuscles?: Record<string, string[]>;
  dayNames?: Record<string, string>;
}
/** Longest cycle the client honours (`MAX_CYCLE` in client/src/periodization/cycle.ts); keep the two equal. */
const MAX_CYCLE = 12;
export interface CycledProgram extends Week {
  daysPerWeek: number;
  cycle?: { length?: number; weeks?: Week[] };
}

/** Weekdays a week really prescribes: rows, target muscles or a day name (same rule as `trainingDaysOfPlan` on the client). */
function daysOf(w: Week): number {
  const days = new Set<number>();
  for (const it of w.items ?? []) days.add(Number(it.day));
  for (const [k, v] of Object.entries(w.targetMuscles ?? {}))
    if (Array.isArray(v) && v.length > 0) days.add(Number(k));
  for (const [k, v] of Object.entries(w.dayNames ?? {}))
    if (typeof v === 'string' && v.trim()) days.add(Number(k));
  return days.size;
}

/** Sessions planned for program week `week` (1-based). */
export function plannedInWeek(p: CycledProgram, week: number): number {
  const len = Math.floor(Number(p.cycle?.length));
  if (!p.cycle || !Number.isFinite(len) || len < 2) return p.daysPerWeek;
  const cw = ((Math.max(1, week) - 1) % Math.min(MAX_CYCLE, len)) + 1;
  // A missing week falls back to the base week, as the client does (`weekPlanOf`).
  return daysOf(cw === 1 ? p : (p.cycle.weeks?.[cw - 2] ?? p));
}

/** Sessions planned over weeks 1..`through`. */
export function plannedThrough(p: CycledProgram, through: number): number {
  let n = 0;
  for (let w = 1; w <= through; w++) n += plannedInWeek(p, w);
  return n;
}
