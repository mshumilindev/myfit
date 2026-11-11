/**
 * Late-bound runtime of the Sleep add-on (SPO-500 I8, same pattern as `conditionsRt`). Every caller asks these wrappers; they
 * answer "no sleep data" (no nights, no stats, no plan, bias 0) until `sleep.ts` is imported (a lazy chunk fetched only while
 * Sleep is installed) and `provide`s the real functions. Not installed = the code is not even loaded (owner 11.11).
 */
import type { SleepDayPlan, SleepNight, SleepSchedule } from './types';
import type { SleepStats, WeekdayPattern } from './sleep';
import type { SleepBlock, SleepGuardState } from './sleepGuard';
import { provide } from './trackerRt';

export { SLEEP_IDLE_MS, AUTO_START_WINDOW_MS } from './sleepConsts';

type Nights = SleepNight[] | null | undefined;
interface Impl {
  minutesOfDay(ms: number): number;
  awakeMsAt(n: SleepNight, now?: number): number;
  nightDurationMin(n: SleepNight, now?: number): number;
  classifySleepKind(bedtime: number, wake: number, awakeMs?: number): 'sleep' | 'nap';
  sleepKindOf(n: SleepNight): 'sleep' | 'nap';
  finishedNights(s: Nights, now?: number): SleepNight[];
  lastNight(s: Nights, now?: number): SleepNight | null;
  sleepStats(s: Nights, now?: number, goalMin?: number, days?: number): SleepStats;
  weekdayPattern(s: Nights, now?: number): WeekdayPattern;
  sleepReadinessBias(s: Nights, now?: number, goalMin?: number, extraNeedMin?: number): number;
  planForWeekday(schedule: SleepSchedule | null | undefined, weekday: number): SleepDayPlan | null;
  planDurationMin(p: SleepDayPlan): number;
  resolvePlan(
    schedule: SleepSchedule,
    sleeps: SleepNight[],
    weekday: number,
    now?: number,
  ): SleepDayPlan | null;
  usualPlan(s: Nights, now?: number): SleepDayPlan | null;
  nightEndingOn(
    schedule: SleepSchedule,
    sleeps: SleepNight[],
    wakeDayStart: number,
    now?: number,
  ): { bedtime: number; wake: number } | null;
  dueBedtime(
    now: number,
    planOf: (weekday: number) => SleepDayPlan | null,
    windowMs?: number,
  ): { bedTs: number; plan: SleepDayPlan } | null;
  computeUpcomingNights(
    schedule: SleepSchedule,
    sleeps: SleepNight[],
    now?: number,
    count?: number,
  ): Array<{ startAt: number; wakeAt: number; date: string }>;
  sameSleep(a: SleepNight, b: SleepNight, now?: number): boolean;
  duplicateSleepIds(list: SleepNight[], now?: number): string[];
  sleepBlockedBy(state: SleepGuardState, now?: number): SleepBlock | null;
}

const NO_STATS: SleepStats = {
  nights: 0,
  avgMin: 0,
  goalMet: 0,
  consistencyPct: 0,
  deltaVsPrevMin: 0,
  streak: 0,
};
const NO_PATTERN: WeekdayPattern = {
  byDay: {},
  confidence: 'low',
  weeksCovered: 0,
  autoLogEligible: false,
};

/** What `sleep.ts` fills in. Neutral until then. */
export const slpRt: Impl = {
  minutesOfDay: () => 0,
  awakeMsAt: () => 0,
  nightDurationMin: () => 0,
  classifySleepKind: () => 'sleep',
  sleepKindOf: () => 'sleep',
  finishedNights: () => [],
  lastNight: () => null,
  sleepStats: () => NO_STATS,
  weekdayPattern: () => NO_PATTERN,
  sleepReadinessBias: () => 0,
  planForWeekday: () => null,
  planDurationMin: () => 0,
  resolvePlan: () => null,
  usualPlan: () => null,
  nightEndingOn: () => null,
  dueBedtime: () => null,
  computeUpcomingNights: () => [],
  sameSleep: () => false,
  duplicateSleepIds: () => [],
  sleepBlockedBy: () => null,
};
export const provideSleep = (impl: Partial<Impl>): void => provide(slpRt, impl);

export const minutesOfDay: Impl['minutesOfDay'] = (ms) => slpRt.minutesOfDay(ms);
export const awakeMsAt: Impl['awakeMsAt'] = (n, now) => slpRt.awakeMsAt(n, now);
export const nightDurationMin: Impl['nightDurationMin'] = (n, now) =>
  slpRt.nightDurationMin(n, now);
export const classifySleepKind: Impl['classifySleepKind'] = (b, w, a) =>
  slpRt.classifySleepKind(b, w, a);
export const sleepKindOf: Impl['sleepKindOf'] = (n) => slpRt.sleepKindOf(n);
export const finishedNights: Impl['finishedNights'] = (s, now) => slpRt.finishedNights(s, now);
export const lastNight: Impl['lastNight'] = (s, now) => slpRt.lastNight(s, now);
export const sleepStats: Impl['sleepStats'] = (s, now, g, d) => slpRt.sleepStats(s, now, g, d);
export const weekdayPattern: Impl['weekdayPattern'] = (s, now) => slpRt.weekdayPattern(s, now);
export const sleepReadinessBias: Impl['sleepReadinessBias'] = (s, now, g, x) =>
  slpRt.sleepReadinessBias(s, now, g, x);
export const planForWeekday: Impl['planForWeekday'] = (s, d) => slpRt.planForWeekday(s, d);
export const planDurationMin: Impl['planDurationMin'] = (p) => slpRt.planDurationMin(p);
export const resolvePlan: Impl['resolvePlan'] = (c, s, d, now) => slpRt.resolvePlan(c, s, d, now);
export const usualPlan: Impl['usualPlan'] = (s, now) => slpRt.usualPlan(s, now);
export const nightEndingOn: Impl['nightEndingOn'] = (c, s, w, now) =>
  slpRt.nightEndingOn(c, s, w, now);
export const dueBedtime: Impl['dueBedtime'] = (n, p, w) => slpRt.dueBedtime(n, p, w);
export const computeUpcomingNights: Impl['computeUpcomingNights'] = (c, s, n, k) =>
  slpRt.computeUpcomingNights(c, s, n, k);
export const sameSleep: Impl['sameSleep'] = (a, b, now) => slpRt.sameSleep(a, b, now);
export const duplicateSleepIds: Impl['duplicateSleepIds'] = (l, now) =>
  slpRt.duplicateSleepIds(l, now);
export const sleepBlockedBy: Impl['sleepBlockedBy'] = (s, now) => slpRt.sleepBlockedBy(s, now);
