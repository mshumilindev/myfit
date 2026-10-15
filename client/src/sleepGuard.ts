/**
 * One live mode at a time: a night of sleep can't be STARTED while a workout,
 * a live activity or a home set is running. Pure — the store, the views and
 * anything else that offers "Start sleep" ask this one function.
 */
export type SleepBlock = 'workout' | 'activity' | 'homeSet';

/** An open workout / activity older than this is forgotten, not running: workouts close themselves
 *  at 8 h, but a live activity timer never does, and a forgotten one must not stop every night
 *  from starting by itself. */
export const STALE_OPEN_MS = 8 * 60 * 60 * 1000;

export interface SleepGuardState {
  workouts?: ReadonlyArray<{
    finishedAt: number | null;
    startedAt?: number;
    kind?: 'home' | null;
  }> | null;
  activities?: ReadonlyArray<{ finishedAt: number | null; startedAt?: number }> | null;
}

/** What blocks starting a sleep right now, or null when it is free to start. */
export function sleepBlockedBy(
  state: SleepGuardState,
  now: number = Date.now(),
): SleepBlock | null {
  const live = (x: { finishedAt: number | null; startedAt?: number }) =>
    x.finishedAt === null && (x.startedAt === undefined || now - x.startedAt <= STALE_OPEN_MS);
  const open = (state.workouts ?? []).filter(live);
  if (open.some((w) => w.kind === 'home')) return 'homeSet';
  if (open.length > 0) return 'workout';
  if ((state.activities ?? []).some(live)) return 'activity';
  return null;
}

/** i18n key of the short "why can't I sleep now" hint for each reason. */
export const SLEEP_BLOCK_KEY = {
  workout: 'slpBlockWorkout',
  activity: 'slpBlockActivity',
  homeSet: 'slpBlockHomeSet',
} as const satisfies Record<SleepBlock, string>;
