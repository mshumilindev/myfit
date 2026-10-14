/**
 * What the Client 360 Overview shows beyond the live signals: lifts with their trend, the last sessions and the
 * weekly rhythm. The raw record is plain data; `gateHistory` is the ONLY place it is cut down to the client's
 * consent, so a locked category never reaches a component (R-FE-061).
 */
import { effectiveConsent } from './consent';
import type { Consent, LogMode } from './types';
import type { ClientWorkouts } from './workouts';

export interface LiftSummary {
  id: string;
  /** Lift name as a data label (user data, not copy). */
  name: string;
  /** Prescribed target, e.g. { kg: 100, reps: 5 }; formatted by the UI. */
  target: { kg: number; reps: number };
  /** Best estimated 1RM now, kg. */
  e1rm: number;
  /** Weekly or per-session estimated 1RM, oldest first (the last 8 sessions). */
  series: readonly number[];
}

export interface SessionSummary {
  id: string;
  at: number;
  /** Session title as a data label ("Upper A"). */
  title: string;
  sets: number;
  tonnageKg: number;
}

export interface WeekCount {
  done: number;
  planned: number;
}

export interface ClientHistory {
  lifts: readonly LiftSummary[];
  /** Newest first. */
  sessions: readonly SessionSummary[];
  /** Last completed weeks, oldest first. */
  weeks: readonly WeekCount[];
  /** Workouts + Strength tabs (S-04 / S-05); gated by `gateWorkouts` / `gateStrength`, not here. */
  workouts?: ClientWorkouts;
}

export interface GatedHistory {
  /** Needs `sets` (effects is enough: weekly e1RM). */
  lifts: readonly LiftSummary[] | null;
  /** Needs `sets` (the list carries sets and tonnage per session, lab rule). */
  sessions: readonly SessionSummary[] | null;
  weeks: readonly WeekCount[] | null;
}

export type LiftTrend = 'rising' | 'flat';

/** A lift whose best estimate has not moved over the last 4 sessions is `flat` (drawn as a warning). */
export function liftTrend(series: readonly number[]): LiftTrend {
  if (series.length < 5) return 'rising';
  return series[series.length - 1] > series[series.length - 5] ? 'rising' : 'flat';
}

export function gateHistory(
  h: ClientHistory | undefined,
  mode: LogMode,
  consent: Consent,
): GatedHistory {
  const c = effectiveConsent(mode, consent);
  return {
    lifts: h && c.sets !== 'off' ? h.lifts : null,
    sessions: h && c.sets !== 'off' ? h.sessions : null,
    weeks: h && c.totals !== 'off' ? h.weeks : null,
  };
}
