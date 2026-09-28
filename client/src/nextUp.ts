/**
 * "Next up" — the post-workout activity suggestion on the Session summary
 * (design: docs/design/log-activity/BRIEF3.md, artboards p01–p05).
 *
 * If history shows the athlete usually does something right after lifting
 * ("You hit the sauna after 6 of your last 8 sessions"), the summary offers to
 * start it at once. This module only decides WHAT to offer; it is pure over the
 * workout + activity lists (no store, no React, no Date / time-zone math — all
 * arithmetic is on ms epochs, so the result is identical in every zone).
 *
 * Rules
 *  1. Reference point: this workout's `finishedAt` (or `now` while it is still
 *     open). "This workout" is `finishedWorkoutId`.
 *  2. Lookback: the last up to 8 OTHER finished workouts that finished before
 *     this one started, within the last 10 weeks. Auto-finished sessions are
 *     skipped — their finishedAt is synthetic (8 h auto-close), so nothing can
 *     honestly "follow" them. Fewer than 4 such workouts → no suggestion at all
 *     (first weeks: the summary shows the quiet "Anything after this?" row).
 *  3. Follows: an activity follows a workout when it STARTED 0–120 min after
 *     that workout's finishedAt. Each workout counts a type at most once (the
 *     first such activity of that type sets its duration). Live activities
 *     (not finished yet) don't count as history.
 *  4. Qualifies (`after_workouts`): the type followed ≥ 3 of the lookback
 *     workouts AND ≥ 40 % of them.
 *  5. Qualifies (`after_day_type`): when this workout has a day type (push /
 *     pull / legs / core / full — dominant working-set volume by primary muscle,
 *     `dayFromCounts`), look at the last up to 8 lookback-eligible workouts of
 *     the same day type (same 10-week window); the type qualifies when it
 *     followed ≥ 3 of them AND ≥ 40 %. If a type qualifies both ways, the
 *     higher ratio wins (tie → `after_workouts`, the broader habit).
 *  6. Excluded: types in `off` ("Don't suggest this") and any type already
 *     logged after THIS workout (started at/after its finish, live included).
 *  7. Ranking: ratio (count/of) desc, then count desc, then recency (the most
 *     recent workout it followed) desc, then type key asc — fully deterministic.
 *  8. `minutes`: median of the per-workout durations, rounded to the nearest
 *     5 min (minimum 5).
 *  9. `top` = the best qualifying type (null if none). `alternatives` = up to 2
 *     more: remaining qualifying types first, then recovery-category types that
 *     followed ≥ 2 lookback workouts (as `after_workouts`), in the same order.
 *     No top → no alternatives (the card is not shown at all).
 *
 * Cost: one pass to filter/sort workouts, one sort of activities, then a binary
 * search per lookback workout — well under 2 ms for 500 workouts.
 */
import type { Activity, Workout } from './types';
import type { MuscleGroup } from './data/exercises';
import { activityType, durationMin } from './activities';
import { dayFromCounts } from './data/daySuggest';

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;

/** How many recent workouts the pattern is read from ("your last 8 sessions"). */
export const NEXT_UP_LOOKBACK = 8;
/** Workouts older than this don't count as the current habit. */
export const NEXT_UP_MAX_AGE_MS = 70 * DAY;
/** An activity "follows" a workout if it started within this long after it. */
export const NEXT_UP_FOLLOW_MS = 120 * MIN;
/** Below this many lookback workouts there is no pattern to read yet. */
export const NEXT_UP_MIN_HISTORY = 4;
/** A type must follow at least this many workouts… */
export const NEXT_UP_MIN_COUNT = 3;
/** …and at least this share of them. */
export const NEXT_UP_MIN_RATIO = 0.4;
/** Recovery types followed this often can fill the alternative chips. */
export const NEXT_UP_RECOVERY_MIN_COUNT = 2;
const MAX_ALTERNATIVES = 2;

export type NextUpReason = 'after_workouts' | 'after_day_type';

export interface NextUp {
  /** Activity catalog key (see ACTIVITY_TYPES). */
  type: string;
  /** Median duration of the matched activities, rounded to 5 min. */
  minutes: number;
  /** How many of the considered workouts it followed ("6"). */
  count: number;
  /** How many workouts were considered ("of 8"). */
  of: number;
  reason: NextUpReason;
  /** The day type (e.g. 'legs') when reason is 'after_day_type'. */
  dayType?: string;
}

export interface NextUpInput {
  workouts: Workout[];
  activities: Activity[];
  finishedWorkoutId: string;
  now: number;
  /** Types the athlete turned off ("Don't suggest Sauna after workouts"). */
  off?: string[];
  /** Day-type classifier; defaults to `workoutDayType` (stored muscles). */
  dayTypeOf?: (w: Workout) => string | null;
}

export interface NextUpResult {
  top: NextUp | null;
  alternatives: NextUp[];
}

interface Candidate extends NextUp {
  lastAt: number;
}

/**
 * The workout's dominant training day by working-set count per primary muscle
 * (strength exercises only; warm-up sets ignored). Null for an empty session.
 */
export function workoutDayType(w: Workout): string | null {
  const counts = new Map<MuscleGroup, number>();
  for (const e of w.exercises) {
    if ((e.kind ?? 'strength') !== 'strength' || !e.primaryMuscle) continue;
    const working = e.sets.filter(
      (s) => (s.type ?? (s.isWarmup ? 'warmup' : 'working')) !== 'warmup',
    );
    const m = e.primaryMuscle as MuscleGroup;
    counts.set(m, (counts.get(m) ?? 0) + Math.max(1, working.length));
  }
  return dayFromCounts(counts);
}

/** Round minutes to the nearest 5, never below 5. */
function round5(min: number): number {
  return Math.max(5, Math.round(min / 5) * 5);
}

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** First index in `sorted` (by startedAt) whose startedAt >= t. */
function lowerBound(sorted: Activity[], t: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid].startedAt < t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Finished activities sorted by start (ties by id, for determinism). */
function sortedFinished(activities: Activity[]): Activity[] {
  return activities
    .filter((a) => a.finishedAt !== null)
    .sort((a, b) => a.startedAt - b.startedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Per type: the workouts it followed (duration + when), for a set of workouts. */
function tally(
  lookback: Workout[],
  acts: Activity[],
): Map<string, { minutes: number[]; lastAt: number }> {
  const out = new Map<string, { minutes: number[]; lastAt: number }>();
  for (const w of lookback) {
    const end = w.finishedAt as number;
    const seen = new Set<string>();
    for (let i = lowerBound(acts, end); i < acts.length; i++) {
      const a = acts[i];
      if (a.startedAt - end > NEXT_UP_FOLLOW_MS) break;
      if (seen.has(a.type)) continue;
      seen.add(a.type);
      const t = out.get(a.type) ?? { minutes: [], lastAt: -Infinity };
      t.minutes.push(durationMin(a));
      t.lastAt = Math.max(t.lastAt, end);
      out.set(a.type, t);
    }
  }
  return out;
}

function toCandidates(
  counts: Map<string, { minutes: number[]; lastAt: number }>,
  of: number,
  reason: NextUpReason,
  dayType?: string,
): Candidate[] {
  const list: Candidate[] = [];
  for (const [type, t] of counts) {
    const c: Candidate = {
      type,
      minutes: round5(median(t.minutes)),
      count: t.minutes.length,
      of,
      reason,
      lastAt: t.lastAt,
    };
    if (dayType !== undefined) c.dayType = dayType;
    list.push(c);
  }
  return list;
}

function qualifies(c: Candidate): boolean {
  return c.count >= NEXT_UP_MIN_COUNT && c.count / c.of >= NEXT_UP_MIN_RATIO;
}

function rank(a: Candidate, b: Candidate): number {
  // Compare ratios exactly via cross-multiplication (no float drift).
  const r = b.count * a.of - a.count * b.of;
  if (r !== 0) return r;
  if (b.count !== a.count) return b.count - a.count;
  if (b.lastAt !== a.lastAt) return b.lastAt - a.lastAt;
  return a.type < b.type ? -1 : a.type > b.type ? 1 : 0;
}

function strip(c: Candidate): NextUp {
  const { lastAt: _lastAt, ...rest } = c;
  void _lastAt;
  return rest;
}

/** The reference time of a workout: its finish, or `now` while still open. */
function refTime(w: Workout | undefined, now: number): number {
  return w?.finishedAt ?? now;
}

/**
 * Whether anything was already logged after this workout: an activity (live or
 * finished) that started 0–120 min after its finish. Unknown id → false.
 */
export function hasActivityAfter(
  workouts: Workout[],
  activities: Activity[],
  workoutId: string,
  now?: number,
): boolean {
  const w = workouts.find((x) => x.id === workoutId);
  if (!w) return false;
  const end = refTime(w, now ?? Infinity);
  if (!Number.isFinite(end)) return false;
  return activities.some((a) => a.startedAt >= end && a.startedAt - end <= NEXT_UP_FOLLOW_MS);
}

/** Eligible history for `current` (rule 2, before the 8-cap), newest first. */
function eligibleHistory(workouts: Workout[], current: Workout, now: number): Workout[] {
  const cutoff = refTime(current, now) - NEXT_UP_MAX_AGE_MS;
  return workouts
    .filter(
      (w) =>
        w.id !== current.id &&
        w.finishedAt !== null &&
        !w.autoFinished &&
        w.finishedAt <= current.startedAt &&
        w.finishedAt >= cutoff,
    )
    .sort(
      (a, b) =>
        (b.finishedAt as number) - (a.finishedAt as number) ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
}

/** How many sessions the pattern is read from ("your last 8 sessions"), 0–8. */
export function nextUpLookbackCount(
  input: Pick<NextUpInput, 'workouts' | 'finishedWorkoutId' | 'now'>,
): number {
  const current = input.workouts.find((w) => w.id === input.finishedWorkoutId);
  if (!current) return 0;
  return Math.min(NEXT_UP_LOOKBACK, eligibleHistory(input.workouts, current, input.now).length);
}

export interface NextUpStrip {
  /** Per considered workout, OLDEST first: did `type` follow it? */
  hits: boolean[];
  /** Shortest / longest matched duration, minutes rounded (0 when none). */
  minMin: number;
  maxMin: number;
}

/**
 * The evidence strip under the card (p01 "8 sessions ago … usually 18–22 min"):
 * the same workouts `suggestion` was read from — the general lookback, or the
 * same-day-type sessions for an `after_day_type` reason — oldest first, each
 * marked when the type started 0–120 min after it finished.
 */
export function nextUpStrip(input: NextUpInput, suggestion: NextUp): NextUpStrip {
  const empty: NextUpStrip = { hits: [], minMin: 0, maxMin: 0 };
  const current = input.workouts.find((w) => w.id === input.finishedWorkoutId);
  if (!current) return empty;
  const eligible = eligibleHistory(input.workouts, current, input.now);
  let list: Workout[];
  if (suggestion.reason === 'after_day_type' && suggestion.dayType) {
    const dayTypeOf = input.dayTypeOf ?? workoutDayType;
    list = [];
    for (const w of eligible) {
      if (dayTypeOf(w) === suggestion.dayType) list.push(w);
      if (list.length === NEXT_UP_LOOKBACK) break;
    }
  } else list = eligible.slice(0, NEXT_UP_LOOKBACK);
  const acts = sortedFinished(input.activities.filter((a) => a.type === suggestion.type));
  const mins: number[] = [];
  const hits = list.map((w) => {
    const end = w.finishedAt as number;
    const i = lowerBound(acts, end);
    const a = acts[i];
    if (!a || a.startedAt - end > NEXT_UP_FOLLOW_MS) return false;
    mins.push(durationMin(a));
    return true;
  });
  hits.reverse();
  if (mins.length === 0) return { hits, minMin: 0, maxMin: 0 };
  return {
    hits,
    minMin: Math.round(Math.min(...mins)),
    maxMin: Math.round(Math.max(...mins)),
  };
}

/** The post-workout "Next up" suggestion — see the rules in the file header. */
export function nextUpSuggestions(input: NextUpInput): NextUpResult {
  const none: NextUpResult = { top: null, alternatives: [] };
  const { workouts, activities, finishedWorkoutId, now } = input;
  const current = workouts.find((w) => w.id === finishedWorkoutId);
  if (!current) return none;
  const ref = refTime(current, now);
  const eligible = eligibleHistory(workouts, current, now);
  const lookback = eligible.slice(0, NEXT_UP_LOOKBACK);
  if (lookback.length < NEXT_UP_MIN_HISTORY) return none;

  const acts = sortedFinished(activities);
  const off = new Set(input.off ?? []);
  for (const a of activities) if (a.startedAt >= ref) off.add(a.type);

  const general = toCandidates(tally(lookback, acts), lookback.length, 'after_workouts').filter(
    (c) => !off.has(c.type),
  );

  // Day-type branch: the same habit read only from sessions like this one.
  const byDay = new Map<string, Candidate>();
  const dayTypeOf = input.dayTypeOf ?? workoutDayType;
  const dayType = dayTypeOf(current);
  if (dayType) {
    const same: Workout[] = [];
    for (const w of eligible) {
      if (dayTypeOf(w) === dayType) same.push(w);
      if (same.length === NEXT_UP_LOOKBACK) break;
    }
    if (same.length >= NEXT_UP_MIN_COUNT) {
      for (const c of toCandidates(tally(same, acts), same.length, 'after_day_type', dayType)) {
        if (!off.has(c.type) && qualifies(c)) byDay.set(c.type, c);
      }
    }
  }

  // One entry per type: the qualifying evidence with the higher ratio.
  const qualified: Candidate[] = [];
  const generalByType = new Map(general.map((c) => [c.type, c]));
  for (const c of general) {
    const d = byDay.get(c.type);
    const g = qualifies(c) ? c : null;
    if (g && d) qualified.push(d.count * g.of > g.count * d.of ? d : g);
    else if (g ?? d) qualified.push((g ?? d) as Candidate);
  }
  for (const [type, d] of byDay) if (!generalByType.has(type)) qualified.push(d);
  qualified.sort(rank);

  if (qualified.length === 0) return none;
  const [top, ...rest] = qualified;
  const alternatives = rest.slice(0, MAX_ALTERNATIVES);
  if (alternatives.length < MAX_ALTERNATIVES) {
    const taken = new Set(qualified.map((c) => c.type));
    const recovery = general
      .filter(
        (c) =>
          !taken.has(c.type) &&
          c.count >= NEXT_UP_RECOVERY_MIN_COUNT &&
          activityType(c.type)?.category === 'recovery',
      )
      .sort(rank);
    alternatives.push(...recovery.slice(0, MAX_ALTERNATIVES - alternatives.length));
  }
  return { top: strip(top), alternatives: alternatives.map(strip) };
}
