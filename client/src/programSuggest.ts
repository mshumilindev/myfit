/**
 * "Add it to your program" suggestions (design: Suggestion A). When someone has
 * done the same activity on the same weekday most weeks lately and their
 * program doesn't plan it, Spotter offers to add it. Pure over the activity
 * history, the program's planned activities and the muted list — no store, no
 * React — so it unit-tests as plain data.
 */
import type { Activity } from './types';
import { median, roundDuration } from './activitySuggest';
import { isoWeekday, weekStartOf, type IsoDay } from './weekStart';
import type { ProgramActivity } from './views/programs/model';

/** How many completed weeks are looked at… */
export const SUGGEST_WEEKS = 6;
/** …and in how many of them the same weekday must have it. */
export const SUGGEST_MIN_WEEKS = 4;
/** "Not now" hides one activity's suggestion for this long. */
export const SNOOZE_DAYS = 14;

const DAY = 24 * 3600 * 1000;
/** Mute-list entries: an activity key, '*' for every suggestion, or a snooze. */
export const MUTE_ALL = '*';
export const snoozeKey = (type: string, until: number) => `later:${type}:${until}`;

export interface ProgramSuggestion {
  type: string;
  weekday: IsoDay;
  /** Median length across those weeks, rounded to a typical value. */
  minutes: number;
  /** Weeks (of `of`) it was done on that weekday. */
  weeks: number;
  of: number;
}

/** Is this activity's suggestion hidden — muted for good, or snoozed still? */
export function isMuted(off: string[], type: string, now: number): boolean {
  if (off.includes(MUTE_ALL) || off.includes(type)) return true;
  const prefix = `later:${type}:`;
  return off.some((k) => k.startsWith(prefix) && Number(k.slice(prefix.length)) > now);
}

/** Muted types (for the Settings list): the permanent ones only. */
export function mutedTypes(off: string[]): string[] {
  return off.filter((k) => k !== MUTE_ALL && !k.startsWith('later:'));
}

/** Drop snoozes that already ended so the synced list doesn't grow forever. */
export function pruneSnoozes(off: string[], now: number): string[] {
  return off.filter((k) => {
    if (!k.startsWith('later:')) return true;
    return Number(k.slice(k.lastIndexOf(':') + 1)) > now;
  });
}

export function suggestForProgram(opts: {
  activities: Activity[];
  planned: ProgramActivity[];
  off: string[];
  now: number;
  weekStart: IsoDay;
}): ProgramSuggestion | null {
  const { activities, planned, off, now, weekStart } = opts;
  if (off.includes(MUTE_ALL)) return null;
  const thisWeek = weekStartOf(now, weekStart);
  const from = thisWeek - SUGGEST_WEEKS * 7 * DAY;
  // type|weekday → week index → minutes that day
  const seen = new Map<string, Map<number, number>>();
  for (const a of activities) {
    if (a.finishedAt === null || !(a.durationMin > 0)) continue;
    if (a.startedAt < from || a.startedAt >= thisWeek) continue;
    const key = `${a.type}|${isoWeekday(a.startedAt)}`;
    const wk = Math.round((weekStartOf(a.startedAt, weekStart) - from) / (7 * DAY));
    const weeks = seen.get(key) ?? new Map<number, number>();
    weeks.set(wk, (weeks.get(wk) ?? 0) + a.durationMin);
    seen.set(key, weeks);
  }
  let best: ProgramSuggestion | null = null;
  let bestTotal = 0;
  for (const [key, weeks] of seen) {
    if (weeks.size < SUGGEST_MIN_WEEKS) continue;
    const [type, wd] = key.split('|');
    const weekday = Number(wd) as IsoDay;
    if (isMuted(off, type, now)) continue;
    if (planned.some((p) => p.type === type && p.day === weekday)) continue;
    const mins = [...weeks.values()];
    const total = mins.reduce((s, m) => s + m, 0);
    if (!best || weeks.size > best.weeks || (weeks.size === best.weeks && total > bestTotal)) {
      best = {
        type,
        weekday,
        minutes: roundDuration(median(mins)),
        weeks: weeks.size,
        of: SUGGEST_WEEKS,
      };
      bestTotal = total;
    }
  }
  return best;
}
