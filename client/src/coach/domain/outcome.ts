/**
 * Outcome measurement (R-BE-DEC-3/4). Runs in the trainer's browser when the app opens after `windowEndsAt`.
 *  - lift signals: before = median e1RM of the last 3 sessions before the decision (same variant);
 *    after = median of the window's sessions (same variant, needs >= 2). Improved iff delta >= 2.5,
 *    Declined iff delta <= -2.5, else No clear change. Never colour a +-1 kg move.
 *  - too few sessions: extend ONCE by 7 days, then "no clear change" / not-enough-sessions.
 *  - rhythm: sessions per week before vs inside the window, +-1 session is noise.
 */
import {
  NOISE_KG,
  OUTCOME_BEFORE_SESSIONS,
  OUTCOME_EXTENSION_DAYS,
  OUTCOME_MIN_SESSIONS,
} from './signalConfig';
import { DAY, WEEK, median } from './time';
import type { DecisionRecord, Outcome } from './decisions';
import type { LiftSession } from './signalInputs';

export interface MeasureResult {
  outcome: Outcome;
  /** new end of the follow-up window if it was extended */
  windowEndsAt: number | null;
}

/** sessions of the decision's lift (any variant); the function filters by the variant itself */
export interface OutcomeData {
  sessions: readonly LiftSession[];
  /** rhythm: timestamps of all the client's sessions */
  sessionDates?: readonly number[];
}

export function measureLift(d: DecisionRecord, data: OutcomeData, now: number): MeasureResult {
  const ends = d.windowEndsAt;
  if (ends == null) return { outcome: d.outcome ?? { result: 'measuring' }, windowEndsAt: null };
  if (now < ends)
    return {
      outcome: { result: 'measuring', noiseKg: NOISE_KG, extended: d.outcome?.extended },
      windowEndsAt: ends,
    };

  // the variant the decision was taken on = the latest session before it
  const prior = [...data.sessions].filter((s) => s.at < d.decidedAt).sort((a, b) => a.at - b.at);
  const variant = prior.length ? prior[prior.length - 1].variant : null;
  const same = (s: LiftSession) => variant == null || s.variant === variant;
  const beforeS = prior.filter(same).slice(-OUTCOME_BEFORE_SESSIONS);
  const inWin = data.sessions.filter((s) => s.at >= d.decidedAt && s.at <= ends && same(s));

  if (!beforeS.length || inWin.length < OUTCOME_MIN_SESSIONS) {
    if (!d.outcome?.extended) {
      const next = ends + OUTCOME_EXTENSION_DAYS * DAY;
      return {
        outcome: { result: 'measuring', noiseKg: NOISE_KG, extended: true },
        windowEndsAt: next,
      };
    }
    return {
      outcome: {
        result: 'no-clear-change',
        reason: 'not-enough-sessions',
        noiseKg: NOISE_KG,
        extended: true,
        measuredAt: now,
      },
      windowEndsAt: ends,
    };
  }
  const before = median(beforeS.map((s) => s.e1rm));
  const after = median(inWin.map((s) => s.e1rm));
  const delta = after - before;
  // compare at 0.01 kg resolution: removes float noise (2.4900000000000091) without rounding 2.49 up to 2.5
  const r = Math.round(delta * 100) / 100;
  const result = r >= NOISE_KG ? 'improved' : r <= -NOISE_KG ? 'declined' : 'no-clear-change';
  return {
    outcome: {
      result,
      before,
      after,
      noiseKg: NOISE_KG,
      measuredAt: now,
      extended: d.outcome?.extended,
    },
    windowEndsAt: ends,
  };
}

export function measureRhythm(d: DecisionRecord, data: OutcomeData, now: number): MeasureResult {
  const ends = d.windowEndsAt;
  const dates = data.sessionDates ?? [];
  if (ends == null || now < ends) return { outcome: { result: 'measuring' }, windowEndsAt: ends };
  const weeksWin = Math.max(1, (ends - d.decidedAt) / WEEK);
  const perWeek = (from: number, to: number) =>
    dates.filter((t) => t >= from && t < to).length / ((to - from) / WEEK);
  const before = perWeek(d.decidedAt - 2 * WEEK, d.decidedAt);
  const after = dates.filter((t) => t >= d.decidedAt && t <= ends).length / weeksWin;
  const delta = after - before;
  const result = delta >= 1 ? 'improved' : delta <= -1 ? 'declined' : 'no-clear-change';
  return { outcome: { result, before, after, measuredAt: now }, windowEndsAt: ends };
}

/** Dispatch by signal kind: rhythm uses sessions per week, everything else the e1RM rule. */
export function measureDecision(d: DecisionRecord, data: OutcomeData, now: number): MeasureResult {
  return d.signal.kind === 'rhythm' ? measureRhythm(d, data, now) : measureLift(d, data, now);
}
