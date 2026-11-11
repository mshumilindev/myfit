/**
 * Loads the Sleep engine (it `provide`s itself into the `sleepRt` facade at import time) and tells the store to rebuild what
 * depends on it. Imported lazily by the add-on runtime while Sleep is installed (SPO-500 I8).
 */
import {
  minutesOfDay,
  awakeMsAt,
  nightDurationMin,
  classifySleepKind,
  sleepKindOf,
  finishedNights,
  lastNight,
  sleepStats,
  weekdayPattern,
  sleepReadinessBias,
  planForWeekday,
  planDurationMin,
  resolvePlan,
  usualPlan,
  nightEndingOn,
  dueBedtime,
  computeUpcomingNights,
  sameSleep,
  duplicateSleepIds,
} from './sleep';
import { sleepBlockedBy } from './sleepGuard';
import { provideSleep } from './sleepRt';
import { trackerReady } from './trackerRt';

provideSleep({
  minutesOfDay,
  awakeMsAt,
  nightDurationMin,
  classifySleepKind,
  sleepKindOf,
  finishedNights,
  lastNight,
  sleepStats,
  weekdayPattern,
  sleepReadinessBias,
  planForWeekday,
  planDurationMin,
  resolvePlan,
  usualPlan,
  nightEndingOn,
  dueBedtime,
  computeUpcomingNights,
  sameSleep,
  duplicateSleepIds,
  sleepBlockedBy,
});

trackerReady('sleep');
