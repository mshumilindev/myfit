/**
 * Consistency streak — the ONE rule behind every "N day streak" in the app.
 *
 * Days are local-calendar day keys (consecutive integers, see `dayKey` in store.ts).
 *
 * A day is COVERED when the user trained (a finished workout or activity) or the
 * day is protected: inside a rest / active-rest / illness period, inside an
 * active injury or surgery rehab, or a weekday the assigned program leaves free.
 * Every other day is UNCOVERED.
 *
 * - The streak is the number of covered days in the unbroken chain ending today.
 * - Up to `STREAK_MAX_GAP` consecutive uncovered days are forgiven (they bridge the
 *   chain but are not counted). The next one breaks it: the streak is cut at that
 *   gap and everything older no longer counts.
 * - Today never breaks the streak while it is still empty (the day is not over).
 * - The chain never reaches before `floorDay` (first workout, or a challenge start).
 */

/** Consecutive uncovered days that do not break the streak. */
export const STREAK_MAX_GAP = 2;

export interface StreakInput {
  /** Day keys with a finished workout or activity. */
  trained: ReadonlySet<number>;
  /** Day keys that are covered without training (rest, illness, injury, program rest). */
  isProtected: (day: number) => boolean;
  /** Local day key of "now". */
  today: number;
  /** Earliest day the chain may reach. */
  floorDay: number;
}

export function computeStreak({ trained, isProtected, today, floorDay }: StreakInput): number {
  let streak = 0;
  let gap = 0;
  for (let d = today; d >= floorDay; d--) {
    if (trained.has(d) || isProtected(d)) {
      streak += 1;
      gap = 0;
    } else if (d === today) {
      continue; // today is not over yet
    } else {
      gap += 1;
      if (gap > STREAK_MAX_GAP) break;
    }
  }
  return streak;
}
