import type { CatalogEntry } from './catalog/types';
import type { TlStrings } from './strings';

/** The catalog names a day after the weekday when the source gives it no focus: that is not a focus. */
export const isWeekdayName = (n: string): boolean => /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/.test(n);

/**
 * What a program is, written from its own data and never from a guess about the person: the split and the goals as plain
 * sentences, and in "Read more" the days' focus, the lifts that come up most with their sets and reps, and the load of a session.
 */
export interface ProgramDescription {
  /** Always shown: what the program is and what it aims at. */
  lead: string;
  /** Behind "Read more". */
  more: string[];
}

/** The exercises that recur most across the program, each with its most common sets × reps (up to `limit`). */
export function mainWork(e: CatalogEntry, limit = 3): string[] {
  const seen = new Map<string, { count: number; schemes: Map<string, number> }>();
  for (const r of e.items) {
    if (r.bare) continue;
    const cur = seen.get(r.name) ?? { count: 0, schemes: new Map<string, number>() };
    cur.count += 1;
    const scheme = `${r.sets}×${r.reps}`;
    cur.schemes.set(scheme, (cur.schemes.get(scheme) ?? 0) + 1);
    seen.set(r.name, cur);
  }
  return [...seen.entries()]
    .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name, v]) => {
      const scheme = [...v.schemes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      return scheme ? `${name} ${scheme}` : name;
    });
}

/** Source labels that only number the day ("Week 1", "Day 3"): they say nothing about its focus. */
const GENERIC_DAY = /^(week|day|phase|workout|session)\s*\d+$/i;

export function describeProgram(e: CatalogEntry, s: TlStrings): ProgramDescription {
  const aims = e.goals.map((g) => s.goal[g].toLowerCase()).join(', ');
  const lead = [s.splitInfo[e.split], aims ? s.aimedAt(aims) : ''].filter(Boolean).join(' ');
  const more: string[] = [s.disciplineInfo[e.discipline]];

  const focus: string[] = [];
  for (let d = 1; d <= 7; d++) {
    const n = e.dayNames[String(d)];
    if (
      n &&
      !isWeekdayName(n) &&
      !GENERIC_DAY.test(n) &&
      n !== s.weekdays[d - 1] &&
      !focus.includes(n)
    )
      focus.push(n);
  }
  if (focus.length > 0) more.push(s.daysFocus(focus.join(', ')));

  const work = mainWork(e);
  if (work.length > 0) more.push(s.mainWork(work.join(', ')));

  const sets = e.items.filter((r) => !r.bare).reduce((n, r) => n + r.sets, 0);
  const days = new Set(e.items.map((r) => r.day)).size;
  if (sets > 0 && days > 0) more.push(s.perSession(Math.round(sets / days)));
  if (e.weeks > 1) more.push(s.runsFor(e.weeks));
  return { lead, more };
}
