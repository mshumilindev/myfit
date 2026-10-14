/**
 * Every tunable of the decision engine in ONE file (plan 8.2, R-BE-DEC-5). Nothing else may
 * hard-code a threshold. Decisions after rounds 7-15: 2.5 kg step, 14 d, 90 d, 7 d, 8 s undo.
 */
import type { SignalKind } from './types';

/** Change in estimated 1RM (kg) that counts as a real change; below it the result is "No clear change". */
export const NOISE_KG = 2.5;
/** Default follow-up / look-back window in days. */
export const WINDOW_DAYS = 14;
/** The engine never reads data older than this many days. */
export const HISTORY_DAYS = 90;
/** Snooze ("Wait a week") and spike window. */
export const SNOOZE_DAYS = 7;
/** A dismissed signal key stays hidden this long unless its evidence strengthens. */
export const DISMISS_DAYS = 30;
/** The undo window is owned by the chat store; kept here so the number exists once. */
export const UNDO_MS = 8000;

/** Stall: completed weeks without e1RM gain >= NOISE_KG, with weekly working sets within +-15% of their mean. */
export const STALL_WEEKS = 4;
export const STALL_VOLUME_TOLERANCE = 0.15;
/** Rhythm: sessions < 50% of planned in each of the last two completed weeks, or idle > 7 d while planned. */
export const RHYTHM_MIN_SHARE = 0.5;
export const RHYTHM_WEEKS = 2;
export const RHYTHM_IDLE_DAYS = 7;
/** Spike: weekly working sets > 130% of the 4-week chronic load (needs a real baseline). */
export const SPIKE_RATIO = 1.3;
export const SPIKE_CHRONIC_WEEKS = 4;
export const SPIKE_MIN_CHRONIC_SETS = 6;
/** Ready: RPE <= 7 with all reps in this many sessions in a row. */
export const READY_SESSIONS = 3;
export const READY_MAX_RPE = 7;
/** PR needs at least this many earlier weeks to compare with. */
export const PR_MIN_HISTORY_WEEKS = 3;
/** Hybrid clients only raise rhythm/stall when they logged at least this many sessions in 4 weeks. */
export const HYBRID_MIN_SESSIONS_4W = 1;

/** A dismissed/snoozed signal returns early only if its strength grows by this many points (0-100 scale). */
export const STRENGTHEN_MARGIN = 15;

/** Follow-up window per signal type (plan 8.2 table); null = informational, no measurement. */
export const WINDOW_BY_KIND: Readonly<Record<SignalKind, number | null>> = {
  stall: 14,
  rhythm: 14,
  injury: 14,
  machine: 14,
  spike: 7,
  ready: 14,
  pr: null,
  nodata: null,
};

/** Card limits (R-BE-DEC-8). */
export const QUEUE_MIN_ROSTER = 8;
export const QUEUE_SMALL_MAX_ROSTER = 20;
export const QUEUE_SMALL_MAX_CARDS = 5;
export const QUEUE_LARGE_SHARE = 0.25;
export const QUEUE_LARGE_MAX_CARDS = 10;

/** Outcome extension when the window holds too few sessions (R-BE-DEC-4). */
export const OUTCOME_MIN_SESSIONS = 2;
export const OUTCOME_EXTENSION_DAYS = 7;
export const OUTCOME_BEFORE_SESSIONS = 3;

/** Evidence snapshot limits (R-BE-DEC-2). */
export const EVIDENCE_MAX_ROWS = 12;
