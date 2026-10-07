/**
 * Cycle core: pure functions, no storage / UI / network. Days are the app's integer day keys.
 *
 * Model (docs «Цикл — концепція»): the person enters typical values once; the log is automatic,
 * so every date after the anchor is a PROJECTION, not an observation. We therefore only claim
 * what the projection can honestly support:
 *   S_k = A + k·L                 start of the k-th cycle after the anchor A
 *   σ   = 2.9 d (regular) or (max−min)/4 (irregular)
 *   80% interval of S_k = S_k ± 1.28·σ·√k        (random-walk growth of the error)
 *   valid only while k ≤ MAX_PROJECTED_CYCLES, then the schedule is "stale".
 * Four coarse phase buckets only; no ovulation or fertility estimate is ever produced.
 */
import { effectiveKey, isActive } from '../conditions';
import type { ChronicCondition } from '../types';

export type CycleMode = 'regular' | 'irregular' | 'log';
export type CyclePhase = 'menses' | 'early' | 'mid' | 'late';

export interface CycleSettings {
  mode: CycleMode;
  /** Typical cycle length, days (start to start). */
  length: number;
  /** Typical bleeding length, days. */
  period: number;
  /** Anchor A: the day a cycle last started. */
  anchor: number;
  /** Irregular mode only: the shortest and longest cycle the person knows. */
  min?: number;
  max?: number;
}

export const LIMITS = { length: [15, 60], period: [1, 10] } as const;
/** FIGO / MSD ranges for a typical adult cycle; outside them we only say "worth discussing". */
export const NORM = { length: [24, 38], periodMax: 8 } as const;
export const SIGMA_REGULAR = 2.9;
export const Z80 = 1.2816;
export const MAX_PROJECTED_CYCLES = 2;

const clamp = (n: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, n));

/** Clamp user input into sane bounds (min ≤ length ≤ max for irregular). */
export function normalizeSettings(s: CycleSettings): CycleSettings {
  const length = Math.round(clamp(s.length, LIMITS.length));
  const period = Math.round(clamp(s.period, LIMITS.period));
  if (s.mode !== 'irregular') return { mode: s.mode, length, period, anchor: s.anchor };
  const min = Math.round(clamp(Math.min(s.min ?? length, length), LIMITS.length));
  const max = Math.round(clamp(Math.max(s.max ?? length, length), LIMITS.length));
  return { mode: 'irregular', length, period, anchor: s.anchor, min, max };
}

/** True when the entered values fall outside the usual range (neutral "talk to a doctor" note). */
export function outOfNorm(s: CycleSettings): boolean {
  const lo = Math.min(s.length, s.min ?? s.length);
  const hi = Math.max(s.length, s.max ?? s.length);
  return lo < NORM.length[0] || hi > NORM.length[1] || s.period > NORM.periodMax;
}

export function sigma(s: CycleSettings): number {
  if (s.mode !== 'irregular') return SIGMA_REGULAR;
  const spread = (s.max ?? s.length) - (s.min ?? s.length);
  return Math.max(SIGMA_REGULAR, spread / 4);
}

/** Index of the cycle `day` falls into, counted from the anchor (negative = before it). */
export const cycleIndex = (s: CycleSettings, day: number): number =>
  Math.floor((day - s.anchor) / s.length);

/** Planned start of cycle k and its 80% interval half-width (days, rounded up). */
export function projectedStart(s: CycleSettings, k: number): { day: number; half: number } {
  return {
    day: s.anchor + k * s.length,
    half: Math.ceil(Z80 * sigma(s) * Math.sqrt(Math.max(0, k))),
  };
}

/** Past the honest horizon: today lies more than MAX_PROJECTED_CYCLES cycles after the anchor. */
export const isStale = (s: CycleSettings, today: number): boolean =>
  cycleIndex(s, today) > MAX_PROJECTED_CYCLES;

export interface CycleEstimate {
  phase: CyclePhase;
  /** 1-based day of the current estimated cycle. */
  dayOfCycle: number;
  /** Which cycle after the anchor (0 = the one the person entered). */
  k: number;
  /** The estimate is shaky: irregular mode, or the start interval is wider than ±2 days. */
  approximate: boolean;
  /** The next start: planned day and 80% half-width. */
  next: { day: number; half: number };
}

/** Phase bucket of the d-th (0-based) day of a cycle of length L with bleeding P. */
export function phaseOfDay(d: number, length: number, period: number): CyclePhase {
  if (d < period) return 'menses';
  if (d < Math.round(length * 0.43)) return 'early';
  if (d < Math.round(length * 0.57)) return 'mid';
  return 'late';
}

/**
 * Where `today` is in the cycle, or null when we must not guess: log-only mode, before the
 * anchor, or a stale schedule.
 */
export function estimate(s: CycleSettings, today: number): CycleEstimate | null {
  if (s.mode === 'log') return null;
  const k = cycleIndex(s, today);
  if (k < 0 || k > MAX_PROJECTED_CYCLES) return null;
  const start = projectedStart(s, k);
  const d = today - start.day;
  return {
    phase: phaseOfDay(d, s.length, s.period),
    dayOfCycle: d + 1,
    k,
    approximate: s.mode === 'irregular' || start.half > 2,
    next: projectedStart(s, k + 1),
  };
}

/** Days of bleeding the automatic log has written so far (past and today only, never ahead). */
export function loggedMenses(s: CycleSettings, day: number, today: number): boolean {
  if (day > today || day < s.anchor) return false;
  return (day - s.anchor) % s.length < s.period;
}

/** The tint of a calendar day, or null: forecast phases in forecast modes, logged bleeding in log mode. */
export function calendarPhase(s: CycleSettings, day: number, today: number): CyclePhase | null {
  if (s.mode === 'log') return loggedMenses(s, day, today) ? 'menses' : null;
  const k = cycleIndex(s, day);
  if (k < 0 || k > MAX_PROJECTED_CYCLES) return null;
  return phaseOfDay(day - (s.anchor + k * s.length), s.length, s.period);
}

// ---------------------------------------------------------------------------
// Chronic conditions switch the Cycle off (one predicate, one source of truth)
// ---------------------------------------------------------------------------

export type CycleSuppression = 'pregnancy' | 'menopause';
const PREGNANCY_KEYS = new Set(['preg_first', 'preg_second', 'preg_third']);
export const MENOPAUSE_KEY = 'preg_menopause';

/** Why the Cycle is off right now, or null. Active pregnancy (any trimester) or menopause. */
export function cycleSuppressedBy(
  conditions: readonly ChronicCondition[],
  now: number,
): CycleSuppression | null {
  let found: CycleSuppression | null = null;
  for (const c of conditions) {
    if (!isActive(c, now)) continue;
    const key = effectiveKey(c, now);
    if (key === MENOPAUSE_KEY) return 'menopause';
    if (PREGNANCY_KEYS.has(key)) found = 'pregnancy';
  }
  return found;
}
