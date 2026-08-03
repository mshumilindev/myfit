/**
 * Per-day program status + outlook (AC-PROG-10, AC-PLAN-11). Pure functions so
 * the member program detail and a node test share them.
 *
 * A program day (week w, day d) maps to the calendar day
 * `startedAt + ((w-1)*7 + (d-1))` days. A day with no prescribed items is a
 * rest day (AC-PROG-07). A training day is `logged` when a finished workout
 * falls on its calendar day, `missed` when its day is past and nothing was
 * logged, otherwise `upcoming`.
 */
export const DAY_MS = 24 * 60 * 60 * 1000;

export type DayStatus = 'logged' | 'missed' | 'upcoming' | 'rest';

export interface DayCell {
  day: number;
  date: number;
  status: DayStatus;
}

function dayKey(ts: number): number {
  return Math.floor(ts / DAY_MS);
}

export interface OutlookInput {
  startedAt: number;
  weeks: number;
  daysPerWeek: number;
  itemCountByDay: Record<number, number>;
  workoutDates: number[];
  now: number;
}

/** Status of days 1..7 for one program week. */
export function weekDayStatuses(input: OutlookInput, week: number): DayCell[] {
  const logged = new Set(input.workoutDates.map(dayKey));
  const todayKey = dayKey(input.now);
  return Array.from({ length: 7 }, (_, i) => {
    const day = i + 1;
    const date = input.startedAt + ((week - 1) * 7 + (day - 1)) * DAY_MS;
    const hasItems = (input.itemCountByDay[day] ?? 0) > 0;
    let status: DayStatus;
    if (!hasItems) {
      status = 'rest';
    } else if (logged.has(dayKey(date))) {
      status = 'logged';
    } else if (dayKey(date) < todayKey) {
      status = 'missed';
    } else {
      status = 'upcoming';
    }
    return { day, date, status };
  });
}

export interface Outlook {
  currentWeek: number;
  finished: boolean;
  weekComplete: boolean;
  missedCount: number;
}

/** Overall program outlook driving the derived notices (AC-PLAN-11). */
export function programOutlook(input: OutlookInput): Outlook {
  const openEnded = input.weeks === 0;
  const elapsedDays = Math.max(0, Math.floor((input.now - input.startedAt) / DAY_MS));
  const currentWeek = openEnded
    ? Math.floor(elapsedDays / 7) + 1
    : Math.min(input.weeks, Math.floor(elapsedDays / 7) + 1);
  const finished = !openEnded && input.now >= input.startedAt + input.weeks * 7 * DAY_MS;

  let missedCount = 0;
  for (let w = 1; w <= currentWeek; w++) {
    for (const cell of weekDayStatuses(input, w)) {
      if (cell.status === 'missed') missedCount++;
    }
  }
  const weekCells = weekDayStatuses(input, currentWeek).filter((c) => c.status !== 'rest');
  const weekComplete = weekCells.length > 0 && weekCells.every((c) => c.status === 'logged');

  return { currentWeek, finished, weekComplete, missedCount };
}
