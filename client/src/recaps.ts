/**
 * Recaps (design "My Fit — Recaps"): period summaries — month, quarter, year —
 * that live in Notifications as a Replay-style event. This module is pure data:
 * given the logged workouts/activities/goals it decides which periods have a
 * recap (ready / building / too-thin) and computes the full recap for one.
 * Views localise labels; nothing here touches i18n.
 */
import type { Workout, Activity } from './types';
import type { MuscleGroup } from './data/exercises';
import type { FocusMuscle } from './data/subregions';
import type { FitGoals } from './goals';
import { groupToFocus, focusToGroup } from './data/subregions';
import { focusLists } from './goals';
import {
  workoutVolumeKg,
  workoutSets,
  setRepsTotal,
  setBestE1rm,
  setTopWeight,
  isStrengthExercise,
  muscleWorkSorted,
} from './store';
import { workoutCalories, activityCategory, durationMin as activityMin } from './activities';

export type RecapPeriodKind = 'month' | 'quarter' | 'year';
export type RecapStatus = 'ready' | 'building' | 'thin';

/** How many sessions a MONTH needs before its recap unlocks. */
export const MONTH_UNLOCK = 6;
/** Sessions counted toward a "perfect" training week. */
const WEEK_TARGET = 3;
const HOUR = 3600_000;
const DAY = 86_400_000;

export interface RecapRef {
  id: string; // "2026-M7" | "2026-Q3" | "2026-Y"
  kind: RecapPeriodKind;
  year: number;
  index: number; // month 0-11 · quarter 1-4 · year 0
  start: number; // inclusive ms
  end: number; // exclusive ms (next period start)
}

export interface RecapEntry {
  ref: RecapRef;
  status: RecapStatus;
  sessions: number;
}

export interface RecapRecord {
  name: string;
  weightKg: number;
  e1rm: number;
}
export interface RecapMuscle {
  group: MuscleGroup;
  sets: number;
  pct: number;
}
export interface RecapTrendBar {
  label?: string; // month view: "W1"…
  month?: number; // quarter/year view: 0-11 (view localises)
  value: number; // tonnes
  peak: boolean;
}
export type RecapDelta = number | null; // fraction (+0.18 = up 18%); null = no prior period

export interface Recap {
  ref: RecapRef;
  prevExists: boolean;
  headline:
    | 'firstPeriod'
    | 'highestVolume'
    | 'consistency'
    | 'records'
    | 'comeback'
    | 'steady';
  // totals
  sessions: number;
  volumeKg: number;
  timeHours: number;
  sets: number;
  reps: number;
  calories: number;
  d: {
    sessions: RecapDelta;
    volume: RecapDelta;
    time: RecapDelta;
    sets: RecapDelta;
    calories: RecapDelta;
  };
  volumeIsPeak: boolean; // highest-volume period of its kind on record
  // records
  prCount: number;
  records: RecapRecord[];
  heaviestSet: { name: string; weightKg: number; reps: number } | null;
  biggestSession: { volumeKg: number; ts: number } | null;
  // muscles
  muscles: RecapMuscle[];
  growMuscles: FocusMuscle[];
  leastMuscle: MuscleGroup | null;
  // consistency
  trainingDays: number;
  longestStreak: number;
  perfectWeeks: number;
  weeksInPeriod: number;
  weekdayMask: boolean[]; // Mon..Sun
  // trend
  trend: RecapTrendBar[];
  // goals
  goal: { archetype: string; adherencePct: number; hits: { muscle: FocusMuscle; ok: boolean }[] } | null;
  // activities
  recoveryMin: number;
  conditioningMin: number;
}

// ─── period math ───────────────────────────────────────────────────────────

function monthRef(year: number, m: number): RecapRef {
  const start = new Date(year, m, 1).getTime();
  const end = new Date(year, m + 1, 1).getTime();
  return { id: `${year}-M${m}`, kind: 'month', year, index: m, start, end };
}
function quarterRef(year: number, q: number): RecapRef {
  const start = new Date(year, (q - 1) * 3, 1).getTime();
  const end = new Date(year, q * 3, 1).getTime();
  return { id: `${year}-Q${q}`, kind: 'quarter', year, index: q, start, end };
}
function yearRef(year: number): RecapRef {
  const start = new Date(year, 0, 1).getTime();
  const end = new Date(year + 1, 0, 1).getTime();
  return { id: `${year}-Y`, kind: 'year', year, index: 0, start, end };
}

export function recapRefFromId(id: string): RecapRef | null {
  const m = /^(\d{4})-([MQY])(\d*)$/.exec(id);
  if (!m) return null;
  const year = Number(m[1]);
  if (m[2] === 'M') return monthRef(year, Number(m[3]));
  if (m[2] === 'Q') return quarterRef(year, Number(m[3]));
  return yearRef(year);
}

function finishedIn(workouts: Workout[], start: number, end: number): Workout[] {
  return workouts.filter(
    (w) => w.finishedAt != null && w.startedAt >= start && w.startedAt < end,
  );
}

function statusFor(kind: RecapPeriodKind, closed: boolean, sessions: number): RecapStatus {
  if (!closed) return 'building';
  if (kind === 'month') return sessions >= MONTH_UNLOCK ? 'ready' : 'thin';
  return sessions > 0 ? 'ready' : 'thin';
}

/** Every period that has (or is accruing) a recap, newest first. */
export function availableRecaps(workouts: Workout[], now = Date.now()): RecapEntry[] {
  const nd = new Date(now);
  const y = nd.getFullYear();
  const refs: RecapRef[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(y, nd.getMonth() - i, 1);
    refs.push(monthRef(d.getFullYear(), d.getMonth()));
  }
  const curQ = Math.floor(nd.getMonth() / 3) + 1;
  for (let i = 0; i < 6; i++) {
    let q = curQ - i;
    let yy = y;
    while (q <= 0) {
      q += 4;
      yy -= 1;
    }
    refs.push(quarterRef(yy, q));
  }
  for (let i = 0; i < 3; i++) refs.push(yearRef(y - i));

  const out: RecapEntry[] = [];
  for (const ref of refs) {
    if (ref.start > now) continue;
    const sessions = finishedIn(workouts, ref.start, ref.end).length;
    const closed = ref.end <= now;
    if (sessions === 0 && closed) continue; // nothing to recap in a closed empty period
    out.push({ ref, status: statusFor(ref.kind, closed, sessions), sessions });
  }
  return out.sort((a, b) => b.ref.end - a.ref.end || b.ref.start - a.ref.start);
}

// ─── one recap ───────────────────────────────────────────────────────────────

interface Totals {
  sessions: number;
  volumeKg: number;
  timeHours: number;
  sets: number;
  reps: number;
  calories: number;
}
function totals(ws: Workout[], bodyKg: number | null): Totals {
  let volumeKg = 0,
    timeHours = 0,
    sets = 0,
    reps = 0,
    calories = 0;
  for (const w of ws) {
    volumeKg += workoutVolumeKg(w);
    timeHours += Math.min(6 * HOUR, Math.max(0, (w.finishedAt ?? w.startedAt) - w.startedAt)) / HOUR;
    sets += workoutSets(w);
    for (const e of w.exercises) for (const s of e.sets) reps += setRepsTotal(s);
    calories += workoutCalories(w, bodyKg) ?? 0;
  }
  return { sessions: ws.length, volumeKg, timeHours, sets, reps, calories };
}

function delta(cur: number, prev: number): RecapDelta {
  if (prev <= 0) return null;
  return (cur - prev) / prev;
}

function prevRef(ref: RecapRef): RecapRef {
  if (ref.kind === 'month') {
    const d = new Date(ref.year, ref.index - 1, 1);
    return monthRef(d.getFullYear(), d.getMonth());
  }
  if (ref.kind === 'quarter') {
    let q = ref.index - 1,
      y = ref.year;
    if (q <= 0) {
      q = 4;
      y -= 1;
    }
    return quarterRef(y, q);
  }
  return yearRef(ref.year - 1);
}

export function buildRecap(
  ref: RecapRef,
  workouts: Workout[],
  activities: Activity[],
  goals: FitGoals,
  bodyKg: number | null,
): Recap {
  const ws = finishedIn(workouts, ref.start, ref.end).sort((a, b) => a.startedAt - b.startedAt);
  const t = totals(ws, bodyKg);

  const pRef = prevRef(ref);
  const prevWs = finishedIn(workouts, pRef.start, pRef.end);
  const prevExists = prevWs.length > 0;
  const p = totals(prevWs, bodyKg);

  // volume peak across all same-kind periods before this one
  let volumeIsPeak = t.volumeKg > 0;
  for (const e of availableRecaps(workouts, ref.start)) {
    if (e.ref.kind !== ref.kind || e.ref.id === ref.id) continue;
    if (totals(finishedIn(workouts, e.ref.start, e.ref.end), bodyKg).volumeKg >= t.volumeKg)
      volumeIsPeak = false;
  }

  // ─ records: e1RM beating the all-time best set before this period ─
  const bestBefore = new Map<string, number>();
  for (const w of workouts) {
    if (w.finishedAt == null || w.startedAt >= ref.start) continue;
    for (const ex of w.exercises) {
      if (!isStrengthExercise(ex)) continue;
      for (const s of ex.sets) {
        const e = setBestE1rm(s);
        if (e > (bestBefore.get(ex.name) ?? 0)) bestBefore.set(ex.name, e);
      }
    }
  }
  // A PR = an e1RM that beats this exercise's all-time best from BEFORE the
  // period (a first-ever exercise has nothing to beat, so it doesn't count).
  // Keep the single best PR set per exercise.
  const prBest = new Map<string, RecapRecord>();
  let heaviestSet: Recap['heaviestSet'] = null;
  let biggestSession: Recap['biggestSession'] = null;
  for (const w of ws) {
    const vol = workoutVolumeKg(w);
    if (!biggestSession || vol > biggestSession.volumeKg)
      biggestSession = { volumeKg: vol, ts: w.startedAt };
    for (const ex of w.exercises) {
      if (!isStrengthExercise(ex)) continue;
      const prior = bestBefore.get(ex.name) ?? 0;
      for (const s of ex.sets) {
        const tw = setTopWeight(s);
        if (tw > 0 && (!heaviestSet || tw > heaviestSet.weightKg))
          heaviestSet = { name: ex.name, weightKg: tw, reps: s.reps };
        const e = setBestE1rm(s);
        if (e <= 0 || prior <= 0 || e <= prior) continue;
        const cur = prBest.get(ex.name);
        if (!cur || e > cur.e1rm)
          prBest.set(ex.name, { name: ex.name, weightKg: tw, e1rm: e });
      }
    }
  }
  const records = [...prBest.values()].sort((a, b) => b.e1rm - a.e1rm);
  const prCount = records.length;

  // ─ muscle distribution ─
  const setsByGroup = new Map<MuscleGroup, number>();
  for (const w of ws)
    for (const { muscle, sets } of muscleWorkSorted(w))
      setsByGroup.set(muscle, (setsByGroup.get(muscle) ?? 0) + sets);
  const totalMuscleSets = [...setsByGroup.values()].reduce((a, b) => a + b, 0) || 1;
  const muscles: RecapMuscle[] = [...setsByGroup.entries()]
    .map(([group, sets]) => ({ group, sets, pct: Math.round((sets / totalMuscleSets) * 100) }))
    .sort((a, b) => b.sets - a.sets);
  // Highlight the WHOLE of each top group on the body map — for a split group
  // like chest that means both sub-regions (upper + lower), not just the first.
  const growMuscles: FocusMuscle[] = [];
  for (const m of muscles.slice(0, 5)) {
    for (const f of groupToFocus(m.group)) if (!growMuscles.includes(f)) growMuscles.push(f);
  }
  const leastMuscle = muscles.length >= 4 ? muscles[muscles.length - 1].group : null;

  // ─ consistency ─
  const dayKeys = new Set<string>();
  const weekdayMask = [false, false, false, false, false, false, false];
  const weekBuckets = new Map<number, number>();
  for (const w of ws) {
    const d = new Date(w.startedAt);
    dayKeys.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    weekdayMask[(d.getDay() + 6) % 7] = true;
    const wk = Math.floor((w.startedAt - ref.start) / (7 * DAY));
    weekBuckets.set(wk, (weekBuckets.get(wk) ?? 0) + 1);
  }
  const trainingDays = dayKeys.size;
  const sortedDays = [...dayKeys]
    .map((k) => {
      const [y, m, d] = k.split('-').map(Number);
      return new Date(y, m, d).getTime();
    })
    .sort((a, b) => a - b);
  let longestStreak = sortedDays.length ? 1 : 0;
  let run = longestStreak;
  for (let i = 1; i < sortedDays.length; i++) {
    if (Math.round((sortedDays[i] - sortedDays[i - 1]) / DAY) === 1) run += 1;
    else run = 1;
    longestStreak = Math.max(longestStreak, run);
  }
  const weeksInPeriod = Math.max(1, Math.ceil((ref.end - ref.start) / (7 * DAY)));
  let perfectWeeks = 0;
  for (const c of weekBuckets.values()) if (c >= WEEK_TARGET) perfectWeeks += 1;

  // ─ trend ─
  const trend: RecapTrendBar[] = [];
  if (ref.kind === 'month') {
    const nWeeks = Math.ceil((ref.end - ref.start) / (7 * DAY));
    const vols: number[] = new Array(nWeeks).fill(0);
    for (const w of ws) {
      const wk = Math.min(nWeeks - 1, Math.floor((w.startedAt - ref.start) / (7 * DAY)));
      vols[wk] += workoutVolumeKg(w);
    }
    const peak = Math.max(...vols, 0);
    vols.forEach((v, i) =>
      trend.push({ label: `W${i + 1}`, value: v / 1000, peak: v === peak && peak > 0 }),
    );
  } else {
    const months = ref.kind === 'quarter' ? 3 : 12;
    const base = ref.kind === 'quarter' ? (ref.index - 1) * 3 : 0;
    const vols: number[] = new Array(months).fill(0);
    for (const w of ws) vols[new Date(w.startedAt).getMonth() - base] += workoutVolumeKg(w);
    const peak = Math.max(...vols, 0);
    vols.forEach((v, i) =>
      trend.push({ month: base + i, value: v / 1000, peak: v === peak && peak > 0 }),
    );
  }

  // ─ goals ─
  let goal: Recap['goal'] = null;
  if (goals.physique || goals.focus) {
    const { grow } = focusLists(goals);
    const growSet = new Set<MuscleGroup>();
    for (const w of ws) for (const { muscle } of muscleWorkSorted(w)) growSet.add(muscle);
    const hits = grow.map((f) => ({ muscle: f, ok: growSet.has(focusToGroup(f)) }));
    const adherencePct = hits.length
      ? Math.round((hits.filter((h) => h.ok).length / hits.length) * 100)
      : 0;
    goal = {
      archetype: goals.physique?.archetype ?? '',
      adherencePct,
      hits,
    };
  }

  // ─ activities ─
  let recoveryMin = 0,
    conditioningMin = 0;
  for (const a of activities) {
    if (a.finishedAt == null || a.startedAt < ref.start || a.startedAt >= ref.end) continue;
    if (activityCategory(a) === 'recovery') recoveryMin += activityMin(a);
    else conditioningMin += activityMin(a);
  }

  // ─ headline ─
  let headline: Recap['headline'] = 'steady';
  if (!prevExists) headline = 'firstPeriod';
  else if (volumeIsPeak && (t.volumeKg > p.volumeKg)) headline = 'highestVolume';
  else if (prCount >= 2) headline = 'records';
  else if (perfectWeeks >= Math.max(2, weeksInPeriod - 1)) headline = 'consistency';
  else if (t.volumeKg > p.volumeKg * 1.05) headline = 'comeback';

  return {
    ref,
    prevExists,
    headline,
    ...t,
    d: {
      sessions: delta(t.sessions, p.sessions),
      volume: delta(t.volumeKg, p.volumeKg),
      time: delta(t.timeHours, p.timeHours),
      sets: delta(t.sets, p.sets),
      calories: delta(t.calories, p.calories),
    },
    volumeIsPeak,
    prCount,
    records,
    heaviestSet,
    biggestSession,
    muscles,
    growMuscles,
    leastMuscle,
    trainingDays,
    longestStreak,
    perfectWeeks,
    weeksInPeriod,
    weekdayMask,
    trend,
    goal,
    recoveryMin: Math.round(recoveryMin),
    conditioningMin: Math.round(conditioningMin),
  };
}
