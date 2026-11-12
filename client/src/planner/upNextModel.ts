import { occurrencesBetween } from './recurrence';
import type { PlanDoc } from './types';
import { addDays, localParts, zonedToUtc, type DayKey } from './zoned';

const MIN = 60_000;
const DEFAULT_DURATION = 60;

export interface UpNextItem {
  plan: PlanDoc;
  day: DayKey;
  /** UTC ms */
  startAt: number;
  endAt: number;
  /** Started already and not over (a plan that lasts an hour is "now" for that hour). */
  ongoing: boolean;
}

/**
 * The next moments of the person's plans: running now or starting within `horizonDays`, soonest first. Each plan's repeat is
 * walked in its own zone; paused plans are left out. Reminders that already rang or were dismissed do not matter here: this is
 * the plan itself, not the alarm. `onlyToday` keeps just today's moments (and what is running now).
 */
export function upNextItems(
  plans: readonly PlanDoc[],
  now: number,
  limit = 5,
  horizonDays = 7,
  onlyToday = false,
): UpNextItem[] {
  const out: UpNextItem[] = [];
  for (const plan of plans) {
    if (!plan.enabled) continue;
    const tz = plan.timing.tz;
    const today = localParts(now, tz).day;
    // One day back, so a plan that began before midnight and is still running shows.
    for (const day of occurrencesBetween(
      plan.timing,
      addDays(today, -1),
      addDays(today, onlyToday ? 0 : horizonDays),
    )) {
      const startAt = zonedToUtc(day, plan.timing.time, tz);
      const endAt = startAt + (plan.durationMin ?? DEFAULT_DURATION) * MIN;
      if (endAt <= now) continue;
      // "Today" means today's own moments, plus a plan that began before midnight and is still running.
      if (onlyToday && day !== today && startAt > now) continue;
      out.push({ plan, day, startAt, endAt, ongoing: startAt <= now });
    }
  }
  return out
    .sort((a, b) => a.startAt - b.startAt || a.plan.title.localeCompare(b.plan.title))
    .slice(0, limit);
}
