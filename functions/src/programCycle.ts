/**
 * Training days of a program week when the program has a weekly cycle (SPO-609). The server holds no add-on state: a cycle
 * is plain data on the program, and the plan it describes is what "expected so far" is measured against. Programs without a
 * cycle keep the old rule (weeks x days per week).
 */
interface Week {
  items?: Array<{ day: number; name?: string }>;
  targetMuscles?: Record<string, string[]>;
}
export interface CycledProgram extends Week {
  daysPerWeek: number;
  cycle?: { length?: number; weeks?: Week[] };
}

/** Weekdays a week really prescribes: named lifts or target muscles. */
function daysOf(w: Week): number {
  const days = new Set<number>();
  for (const it of w.items ?? []) if ((it.name ?? '').trim()) days.add(Number(it.day));
  for (const [k, v] of Object.entries(w.targetMuscles ?? {}))
    if (Array.isArray(v) && v.length > 0) days.add(Number(k));
  return days.size;
}

/** Sessions planned for program week `week` (1-based). */
export function plannedInWeek(p: CycledProgram, week: number): number {
  const len = p.cycle?.length;
  if (!p.cycle || typeof len !== 'number' || len < 2) return p.daysPerWeek;
  const cw = ((Math.max(1, week) - 1) % len) + 1;
  const w = cw === 1 ? p : p.cycle.weeks?.[cw - 2];
  return w ? daysOf(w) : p.daysPerWeek;
}

/** Sessions planned over weeks 1..`through`. */
export function plannedThrough(p: CycledProgram, through: number): number {
  let n = 0;
  for (let w = 1; w <= through; w++) n += plannedInWeek(p, w);
  return n;
}
