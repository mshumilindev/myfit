/**
 * Detraining (SPO-149): how long a lift or a muscle was NOT trained, and what a
 * break of that length means for the first session back. Pure -- no store
 * mutation, no React, no clock of its own (callers pass `now`).
 *
 * Every number below is a row of docs/research/detraining.md (section 4) and of
 * docs/specs/detraining-return-after-break.md. Change them there first.
 */
import { muscleSetsInWorkout } from './store';
import type { Workout } from './types';
import type { MuscleGroup } from './data/exercises';

/**
 * Whole LOCAL calendar days from `from` to `to` (23:00 -> 01:00 is 1 day).
 * Compares local Y-M-D at UTC midnight, so a 23- or 25-hour DST day is still
 * exactly one day (a plain ms difference would be off by one around DST).
 * Never negative: a `from` in the future (clock skew) counts as 0.
 */
export function calendarDaysBetween(from: number, to: number): number {
  const a = new Date(from);
  const b = new Date(to);
  const da = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const db = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.max(0, Math.round((db - da) / 86_400_000));
}

/** One row of the research table (R1..R5); R0 (no break) is `null`. */
export interface BreakRow {
  /** 1 = eased (no jump), 2..5 = a real cut. */
  tier: 1 | 2 | 3 | 4 | 5;
  /** First calendar day (inclusive) of this row. */
  fromDays: number;
  /** Multiplier of the last working load (1 = same). */
  weightMult: number;
  /** Multiplier of a muscle's working sets in the first session back. */
  setsMult: number;
  /** One extra light warm-up rung before the working weight. */
  extraWarmup: boolean;
}

/** R1..R5 of docs/research/detraining.md, ascending by `fromDays`. */
export const BREAK_ROWS: readonly BreakRow[] = [
  { tier: 1, fromDays: 15, weightMult: 1, setsMult: 1, extraWarmup: false },
  { tier: 2, fromDays: 29, weightMult: 0.9, setsMult: 0.67, extraWarmup: true },
  { tier: 3, fromDays: 85, weightMult: 0.85, setsMult: 0.67, extraWarmup: true },
  { tier: 4, fromDays: 169, weightMult: 0.8, setsMult: 0.5, extraWarmup: true },
  { tier: 5, fromDays: 365, weightMult: 0.7, setsMult: 0.5, extraWarmup: true },
];

/** First day of the first real cut (R2): a boundary between sessions at least this far apart is "a break". */
export const CUT_FROM_DAYS = BREAK_ROWS[1].fromDays;
/** From this gap on a flat top weight is a break, not a plateau (R1). */
export const STALL_BREAK_DAYS = BREAK_ROWS[0].fromDays;
/** After a real break, how many sessions we keep steering back to the pre-break load. */
export const REGAIN_MAX_SESSIONS = 8;
/** Minimum sets of a muscle in a session after a break (ACSM novice: 1-3 sets; R2..R5). */
const MIN_RETURN_SETS = 2;
/** Reference body mass for the assisted-machine cut when the caller does not know the real one. */
export const REF_BODY_KG = 75;

/** The research row for a gap in calendar days; `null` = R0 (0..14 days, or unknown). */
export function breakRow(gap: number | null | undefined): BreakRow | null {
  if (gap == null || !Number.isFinite(gap)) return null;
  let hit: BreakRow | null = null;
  for (const r of BREAK_ROWS) if (gap >= r.fromDays) hit = r;
  return hit;
}

/**
 * Calendar days since the newest point of a lift's history (as `topHistory`
 * returns it -- already one lift variant). `null` when there is no history.
 */
export function gapDays(history: readonly { ts: number }[], now: number): number | null {
  if (history.length === 0) return null;
  let newest = history[0].ts;
  for (const p of history) if (p.ts > newest) newest = p.ts;
  return calendarDaysBetween(newest, now);
}

/**
 * Calendar days since `muscle` last took any work (primary or secondary credit,
 * the same attribution recovery.ts uses), looking at sessions up to `now`.
 * `null` = never trained in the given history.
 */
export function muscleGapDays(
  finished: readonly Workout[],
  muscle: MuscleGroup,
  now: number,
): number | null {
  let newest: number | null = null;
  for (const w of finished) {
    if (w.startedAt > now || (newest !== null && w.startedAt <= newest)) continue;
    if ((muscleSetsInWorkout(w).get(muscle) ?? 0) > 0) newest = w.startedAt;
  }
  return newest === null ? null : calendarDaysBetween(newest, now);
}

/** Working sets of a muscle for a session after a break of `gap` days (unchanged for R0/R1). */
export function returnSets(sets: number, gap: number | null | undefined): number {
  const row = breakRow(gap);
  if (!row || row.setsMult >= 1) return sets;
  return Math.min(sets, Math.max(MIN_RETURN_SETS, Math.round(sets * row.setsMult)));
}

/** Whole weeks (rounded down, at least 2 for a real break) for the explanation line. */
export function gapWeeks(gap: number): number {
  return Math.floor(gap / 7);
}
