/**
 * Sets to failure — what the app infers on its own and what it proposes.
 *
 * "To failure" = the next rep wouldn't go (0 reps in reserve). The athlete can
 * always say so (F in the effort row, the flame on the set card), but most
 * people never tag it by hand, so the app also:
 *
 *   1. INFERS it after the fact, at log time, from what was actually logged
 *      (`inferFailure`). Only signals that are hard to explain any other way
 *      count — an inference is stored as `failure: 'auto'` with a reason and
 *      shows as a dashed tag the athlete can dismiss (then `'no'`, and the
 *      same set is never re-inferred).
 *   2. PROPOSES it before a set (`suggestFailure`): the flame on the next set's
 *      card starts switched on when the pattern says this set will be one —
 *      logging with it on is the athlete's own "yes".
 *
 * Pure: no store, no React. Weights are kg.
 */
import type { FailureMark, SetEntry, SetType } from './types';

export type FailureWhy =
  | 'rpe' // RPE 10 logged: no reps left by definition
  | 'partials' // partial reps after the full ones — only happen past failure
  | 'missed' // fell ≥2 reps short of the target at (at least) the target load
  | 'collapse' // reps collapsed vs the previous set at the same load
  | 'effort' // the effort model says nothing was left, and reps fell or missed
  | 'drop'; // a drop / reverse-drop set: its last part is run to failure

export type FailureSuggestWhy = 'streak' | 'habit' | 'drop' | 'room';

const typeOf = (s: Pick<SetEntry, 'type' | 'isWarmup'>): SetType =>
  s.type ?? (s.isWarmup ? 'warmup' : 'working');

export function isFailure(s: Pick<SetEntry, 'failure'>): boolean {
  return s.failure === 'manual' || s.failure === 'auto';
}

export interface InferContext {
  /** What the set card proposed when this set was logged (the target). */
  target?: { reps: number; weight: number | null } | null;
  /** Earlier sets of the same exercise in this session, in order. */
  before: SetEntry[];
}

/**
 * Why the just-logged set was most likely taken to failure, or null. Warm-ups,
 * timed holds and sets the athlete already marked are never inferred.
 */
export function inferFailure(
  s: Pick<
    SetEntry,
    'reps' | 'weight' | 'type' | 'isWarmup' | 'rpe' | 'rpeAuto' | 'partials' | 'failure' | 'restSec'
  >,
  ctx: InferContext,
): FailureWhy | null {
  if (s.failure) return null; // an explicit yes/no always wins
  const type = typeOf(s);
  if (type === 'warmup' || type === 'static-dynamic') return null;
  if (s.reps <= 0) return null;
  if ((s.rpe ?? 0) >= 10) return 'rpe';
  if ((s.partials ?? 0) > 0) return 'partials';
  if (type === 'drop' || type === 'reverse-drop') return 'drop';
  const w = s.weight ?? 0;
  // Missed target: aimed for N reps at a load and got N-2 or fewer at that
  // load or heavier. Small targets (≤3) are too noisy — a triple that became
  // a double is often a planned stop.
  const tg = ctx.target;
  if (tg && tg.reps >= 4 && s.reps <= tg.reps - 2 && w >= (tg.weight ?? 0) && w > 0)
    return 'missed';
  // Rep collapse: same load as the previous working set and ≥30% (and ≥3)
  // fewer reps. Normal set-to-set fatigue costs 1–2 reps; a cliff that size
  // means the bar stopped.
  const prev = [...ctx.before].reverse().find((p) => typeOf(p) === 'working' && p.reps > 0);
  if (
    prev &&
    (prev.weight ?? 0) === w &&
    w > 0 &&
    prev.reps - s.reps >= 3 &&
    s.reps <= prev.reps * 0.7 &&
    (s.restSec == null || s.restSec >= 45)
  )
    return 'collapse';
  // The effort model (rpe.ts) says ~nothing was left AND the set fell short of
  // the previous one at this load or of the target — a smaller drop than a
  // collapse, but with the estimate agreeing it's the same story.
  const est = s.rpeAuto ?? null;
  // The effort model reads the set as maximal on its own (it declines to
  // estimate sets well past what it expects, so 10 means "right at the max").
  if (est !== null && est >= 10 && w > 0) return 'effort';
  if (est !== null && est >= 9.5 && w > 0) {
    const fellShort =
      (prev && (prev.weight ?? 0) === w && prev.reps - s.reps >= 2) ||
      (tg && s.reps < tg.reps && w >= (tg.weight ?? 0));
    if (fellShort) return 'effort';
  }
  return null;
}

/** A past session's final working set of one exercise (oldest first not needed). */
export interface PastExerciseSets {
  sets: SetEntry[];
}

/**
 * Whether the NEXT set of an exercise should start with the flame on.
 *  - streak: the previous working set this session was taken to failure by
 *    hand — the athlete is running sets to failure today.
 *  - habit: this is the last planned set, and in at least 2 of the last 3
 *    sessions the last working set of this lift was to failure.
 *  - drop: the proposed set is a drop / reverse-drop.
 */
export function suggestFailure(p: {
  type: SetType;
  /** Estimated effort of the proposed set (rpe.ts), null = unknown. */
  estRpe?: number | null;
  /** Isolation / machine / cable lift — failure is low-risk there. */
  safeToFail?: boolean;
  /** This session's sets of the exercise so far. */
  current: SetEntry[];
  /** Planned sets for the exercise (0 = no plan). */
  plannedSets: number;
  /** Recent past sessions of the lift, newest first. */
  past: PastExerciseSets[];
}): FailureSuggestWhy | null {
  if (p.type === 'warmup' || p.type === 'static-dynamic') return null;
  if (p.type === 'drop' || p.type === 'reverse-drop') return 'drop';
  const working = p.current.filter((s) => typeOf(s) === 'working');
  const last = working[working.length - 1];
  if (last && last.failure === 'manual') return 'streak';
  const isLastPlanned = p.plannedSets > 0 && p.current.length + 1 >= p.plannedSets;
  if (isLastPlanned) {
    const recent = p.past.slice(0, 3);
    const hits = recent.filter((x) => {
      const w = x.sets.filter((s) => typeOf(s) === 'working');
      const fin = w[w.length - 1];
      return !!fin && isFailure(fin);
    }).length;
    if (recent.length >= 2 && hits >= 2) return 'habit';
  }
  // Room to push: the last set of a lift where failure is low-risk (isolation,
  // machine, cable), and the proposal still leaves ≥2 reps in the tank —
  // a hint only; the flame stays off.
  const lastSet = isLastPlanned || (p.plannedSets <= 0 && working.length >= 2);
  if (lastSet && p.safeToFail && p.estRpe != null && p.estRpe <= 8) return 'room';
  return null;
}

/** Suggestions that switch the flame on by themselves (the rest only hint). */
export function suggestionPresets(why: FailureSuggestWhy | null): boolean {
  return why === 'streak' || why === 'habit' || why === 'drop';
}

/** Share of working sets taken to failure — for summaries. */
export function failureShare(sets: SetEntry[]): { failure: number; working: number } {
  const w = sets.filter((s) => typeOf(s) !== 'warmup');
  return { failure: w.filter(isFailure).length, working: w.length };
}

export type { FailureMark };
