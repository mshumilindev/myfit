/**
 * Inputs of the signal engine and the consent gate that produces them (plan 8.1, R-BE-DEC-1).
 * The gate is the ONLY place raw client data is cut down to what the consent level allows; the engine
 * calls it again on its own input, so a caller that forgets cannot leak a locked category.
 */
import { effectiveConsent } from './consent';
import { DAY, weekStartOf } from './time';
import { HISTORY_DAYS } from './signalConfig';
import type { Consent, LogMode } from './types';

/** One logged session of one lift (needs `sets: full`). */
export interface LiftSession {
  at: number;
  /** Equipment id if known, else gym id (memory: weight by context). 'unknown' lowers confidence. */
  variant: string;
  e1rm: number;
  workingSets: number;
  rpe: number | null;
  allRepsDone: boolean;
  /** Display text such as "100x5, 100x5, 100x4". */
  setsText?: string;
}
/** Weekly aggregate of one lift (enough at `sets: effects`). */
export interface LiftWeek {
  weekStart: number;
  bestE1rm: number;
  workingSets: number;
  avgRpe: number | null;
  variant: string;
}
export interface LiftSeries {
  liftId: string;
  name: string;
  /** Present at effects and full. */
  weeks?: LiftWeek[];
  /** Present at full only. */
  sessions?: LiftSession[];
}
/** Weekly working sets of one muscle, oldest first, LAST = current (partial) week. */
export interface MuscleLoad {
  muscle: string;
  weeklySets: number[];
}
/** Sessions done in the last completed weeks (oldest first) and the current state. */
export interface TotalsInput {
  completedWeeks: { done: number; planned: number }[];
  plannedThisWeek: number;
  /** null = no session known. */
  daysSinceLast: number | null;
  sessionsLast4Weeks: number;
}
/** Injury restrictions and the program items that conflict with them (computed by the caller). */
export interface InjuryInput {
  restrictions: string[];
  conflicts: { exercise: string; restriction: string }[];
}

export interface ClientSignalInput {
  clientId: string;
  mode: LogMode;
  consent: Consent;
  totals?: TotalsInput;
  lifts?: LiftSeries[];
  muscles?: MuscleLoad[];
  injury?: InjuryInput;
}

/** Weekly aggregates from sessions (the same function the device uses to publish `shares/sets`). */
export function weeksFromSessions(sessions: readonly LiftSession[]): LiftWeek[] {
  const byWeek = new Map<number, LiftSession[]>();
  for (const s of sessions) {
    const w = weekStartOf(s.at);
    byWeek.set(w, [...(byWeek.get(w) ?? []), s]);
  }
  return [...byWeek.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([weekStart, ss]) => {
      const rpes = ss.map((s) => s.rpe).filter((r): r is number => r != null);
      const best = ss.reduce((a, b) => (b.e1rm > a.e1rm ? b : a));
      return {
        weekStart,
        bestE1rm: best.e1rm,
        workingSets: ss.reduce((a, s) => a + s.workingSets, 0),
        avgRpe: rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null,
        variant: best.variant,
      };
    });
}

/**
 * Cuts raw data down to what consent allows. Output never carries a category above its level:
 * - program mode: nothing;
 * - totals off: no totals; sets off: no lifts, no muscles; sets effects: weekly rows only (sessions removed);
 * - history older than HISTORY_DAYS is dropped.
 */
export function gateInput(raw: ClientSignalInput, now: number): ClientSignalInput {
  const consent = effectiveConsent(raw.mode, raw.consent);
  const out: ClientSignalInput = { clientId: raw.clientId, mode: raw.mode, consent };
  if (raw.mode === 'program') return out;
  const cutoff = now - HISTORY_DAYS * DAY;

  if (consent.totals !== 'off' && raw.totals) out.totals = raw.totals;

  if (consent.sets !== 'off') {
    if (raw.lifts) {
      out.lifts = raw.lifts.map((l) => {
        const sessions = (l.sessions ?? []).filter((s) => s.at >= cutoff);
        const weeksSrc = l.weeks ?? (sessions.length ? weeksFromSessions(sessions) : []);
        const weeks = weeksSrc.filter((w) => w.weekStart + 7 * DAY >= cutoff);
        const lift: LiftSeries = { liftId: l.liftId, name: l.name, weeks };
        if (consent.sets === 'full') lift.sessions = sessions;
        return lift;
      });
    }
    if (raw.muscles) out.muscles = raw.muscles;
  }
  if (consent.injury !== 'off' && raw.injury) out.injury = raw.injury;
  return out;
}
