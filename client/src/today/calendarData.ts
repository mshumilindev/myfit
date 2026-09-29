/**
 * Calendar data shared by the Calendar widgets (widgets/calendar.tsx) and the
 * History calendar on Today (HistoryCalendar.tsx): personal records and one
 * cached per-day map of everything logged — finished workouts, activities,
 * nights, weigh-ins, rest / illness / off periods and injuries. Day keys use
 * the calendarDays encoding (same as store.dayKey).
 */
import { dayOfTimestamp } from '../components/ui/calendarDays';
import { isStrengthExercise, setBestE1rm, workoutVolumeKg, type StoreState } from '../store';
import { nightDurationMin, sleepKindOf } from '../sleep';
import type { Activity, Workout } from '../types';

export interface PrRecord {
  name: string;
  e1rm: number;
  prev: number;
  at: number;
  workoutId: string;
}

let prCache: { src: Workout[] | null; out: PrRecord[] } = { src: null, out: [] };

/**
 * Estimated-1RM records across the whole history, oldest first: a lift beats
 * every earlier session of the same exercise (the first session sets the bar,
 * it isn't a record itself). Cached on the workouts array identity.
 */
export function prRecords(workouts: Workout[]): PrRecord[] {
  if (prCache.src === workouts) return prCache.out;
  const finished = workouts
    .filter((w) => w.finishedAt !== null)
    .sort((a, b) => a.startedAt - b.startedAt);
  const best = new Map<string, number>();
  const out: PrRecord[] = [];
  for (const w of finished) {
    for (const ex of w.exercises) {
      if (!isStrengthExercise(ex)) continue;
      const top = ex.sets.reduce((m, s) => Math.max(m, setBestE1rm(s)), 0);
      if (top <= 0) continue;
      const key = ex.name.trim().toLowerCase();
      const prev = best.get(key);
      if (prev !== undefined && top > prev + 0.01) {
        out.push({ name: ex.name, e1rm: top, prev, at: w.startedAt, workoutId: w.id });
      }
      if (prev === undefined || top > prev) best.set(key, top);
    }
  }
  prCache = { src: workouts, out };
  return out;
}

export type HealthKind = 'rest' | 'sick' | 'off' | 'injury';

export interface DayInfo {
  workouts: Workout[];
  /** Finished activities that started this day. */
  activities: Activity[];
  activity: boolean;
  sleep: boolean;
  /** Minutes slept in the night that ended this morning (0 = none). */
  sleepMin: number;
  /** Last weigh-in of the day, kg. */
  weight: number | null;
  pr: boolean;
  /** Personal records set this day. */
  prs: number;
  health: HealthKind | null;
}

export type DayMap = Map<number, DayInfo>;
let dayCache: { key: unknown[]; out: DayMap } | null = null;

function entry(map: DayMap, d: number): DayInfo {
  let e = map.get(d);
  if (!e) {
    e = {
      workouts: [],
      activities: [],
      activity: false,
      sleep: false,
      sleepMin: 0,
      weight: null,
      pr: false,
      prs: 0,
      health: null,
    };
    map.set(d, e);
  }
  return e;
}

/** Everything logged, by calendar day key (calendarDays encoding). */
export function dayMap(store: StoreState, now: number): DayMap {
  const today = dayOfTimestamp(now);
  const weights = store.bodyMetrics?.weights;
  const key = [
    store.workouts,
    store.activities,
    store.sleeps,
    store.restPeriods,
    store.injuries,
    weights,
    today,
  ];
  if (dayCache && dayCache.key.every((k, i) => k === key[i])) return dayCache.out;
  const map: DayMap = new Map();
  for (const w of store.workouts) {
    if (w.finishedAt === null) continue;
    entry(map, dayOfTimestamp(w.startedAt)).workouts.push(w);
  }
  for (const a of store.activities) {
    if (a.finishedAt === null) continue;
    const e = entry(map, dayOfTimestamp(a.startedAt));
    e.activity = true;
    e.activities.push(a);
  }
  for (const n of store.sleeps) {
    if (n.wake == null || sleepKindOf(n) !== 'sleep') continue;
    const e = entry(map, dayOfTimestamp(n.wake));
    e.sleep = true;
    e.sleepMin += nightDurationMin(n);
  }
  const lastAt = new Map<number, number>();
  for (const wt of weights ?? []) {
    const d = dayOfTimestamp(wt.at);
    if ((lastAt.get(d) ?? -Infinity) > wt.at) continue;
    lastAt.set(d, wt.at);
    entry(map, d).weight = wt.weight;
  }
  for (const r of store.restPeriods) {
    const kind: HealthKind = r.mode === 'illness' ? 'sick' : r.mode === 'off' ? 'off' : 'rest';
    const end = r.open ? today : Math.min(r.endDay, r.startDay + 400);
    for (let d = r.startDay; d <= end; d++) entry(map, d).health = kind;
  }
  for (const inj of store.injuries) {
    // The date-bound full-rest window (or the day it happened) reads as injury.
    const stop = Math.min(
      inj.fullRestUntil != null ? inj.fullRestUntil - 1 : inj.startDay,
      inj.healedDay ?? today,
      inj.startDay + 400,
    );
    for (let d = inj.startDay; d <= Math.max(inj.startDay, stop); d++) {
      const e = entry(map, d);
      if (!e.health) e.health = 'injury';
    }
  }
  for (const p of prRecords(store.workouts)) {
    const e = entry(map, dayOfTimestamp(p.at));
    e.pr = true;
    e.prs++;
  }
  for (const e of map.values()) e.workouts.sort((a, b) => a.startedAt - b.startedAt);
  dayCache = { key, out: map };
  return map;
}

export interface RangeCounts {
  trained: number;
  logged: number;
  /** Days with at least one PR. */
  prDays: number;
  /** Personal records set in the range. */
  prs: number;
  volumeKg: number;
  health: Record<HealthKind, number>;
}

/** Totals over the day keys from…to (inclusive). */
export function countRange(map: DayMap, from: number, to: number): RangeCounts {
  let trained = 0;
  let logged = 0;
  let prDays = 0;
  let prs = 0;
  let volumeKg = 0;
  const health: Record<HealthKind, number> = { rest: 0, sick: 0, off: 0, injury: 0 };
  for (let d = from; d <= to; d++) {
    const e = map.get(d);
    if (!e) continue;
    const any =
      e.workouts.length > 0 || e.activity || e.sleep || e.weight !== null || e.health !== null;
    if (any) logged++;
    if (e.workouts.length > 0) trained++;
    for (const w of e.workouts) volumeKg += workoutVolumeKg(w);
    if (e.pr) prDays++;
    prs += e.prs;
    if (e.health) health[e.health]++;
  }
  return { trained, logged, prDays, prs, volumeKg, health };
}
