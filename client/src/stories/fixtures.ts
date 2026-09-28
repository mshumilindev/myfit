/**
 * Story fixtures: a no-op Shell and store seeds for the composed page-section
 * stories. Dates are relative to the real "today" so the pages' own clocks
 * (Date.now()) line up with the seeded periods and activities.
 */
import type { Shell } from '../App';
import { __getStateForTests, __replaceStateForTests } from '../store';
import { ymdToDay } from '../health';
import type { Activity, Injury, RestPeriod, Workout } from '../types';

const noop = () => undefined;

export const storyShell: Shell = {
  openOverlay: noop,
  replaceOverlay: noop,
  goTab: noop,
  goPlaybook: noop,
  openStart: noop,
  toast: noop,
  snack: noop,
  signOut: noop,
  queueLength: 0,
};

const MIN = 60_000;

/** Day key `n` days from today (negative = past). */
export function dayFromToday(n: number): number {
  const d = new Date();
  return ymdToDay(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** Local timestamp `n` days from today at hh:mm. */
export function atDay(n: number, hh: number, mm = 0): number {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, hh, mm).getTime();
}

export function period(over: Partial<RestPeriod> & { id: string }): RestPeriod {
  return {
    startDay: dayFromToday(-14),
    endDay: dayFromToday(-8),
    mode: 'off',
    createdAt: 1,
    ...over,
  };
}

export const kneeInjury = (): Injury => ({
  id: 'knee',
  reason: 'injury',
  bodyPart: 'knee',
  side: 'left',
  muscles: ['quads'],
  stage: 'reintroduce',
  startDay: dayFromToday(-6),
  createdAt: 1,
  checkins: [],
  healedDay: null,
});

export function workoutOn(id: string, daysAgo: number): Workout {
  return {
    id,
    startedAt: atDay(-daysAgo, 18),
    finishedAt: atDay(-daysAgo, 18, 52),
    autoFinished: false,
    dayName: 'Upper body',
    exercises: [],
  };
}

export function activityOn(
  type: string,
  daysAgo: number,
  hh: number,
  min: number,
  category: Activity['category'] = 'conditioning',
): Activity {
  const start = atDay(-daysAgo, hh);
  return {
    id: `${type}-${daysAgo}-${hh}`,
    type,
    category,
    startedAt: start,
    finishedAt: start + min * MIN,
    durationMin: min,
    effort: 'moderate',
  };
}

/** A few weeks of mixed conditioning / sports / recovery history. */
export function activityHistory(): Activity[] {
  const out: Activity[] = [];
  for (const w of [0, 7, 14, 21]) {
    out.push(activityOn('dance', w + 2, 18, 110));
    out.push(activityOn('sauna', w + 2, 20, 20, 'recovery'));
  }
  out.push(activityOn('tennis', 5, 18, 60));
  out.push(activityOn('run', 3, 7, 30));
  out.push(activityOn('yoga', 9, 8, 40, 'recovery'));
  return out.sort((a, b) => b.startedAt - a.startedAt);
}

export function seedStore(over: {
  restPeriods?: RestPeriod[];
  injuries?: Injury[];
  workouts?: Workout[];
  activities?: Activity[];
}): void {
  __replaceStateForTests({
    ...__getStateForTests(),
    restPeriods: over.restPeriods ?? [],
    injuries: over.injuries ?? [],
    workouts: over.workouts ?? [],
    activities: over.activities ?? [],
    sleeps: [],
  });
}
