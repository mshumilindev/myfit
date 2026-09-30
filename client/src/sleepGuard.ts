/**
 * One live mode at a time: a night of sleep can't be STARTED while a workout,
 * a live activity or a home set is running. Pure — the store, the views and
 * anything else that offers "Start sleep" ask this one function.
 */
export type SleepBlock = 'workout' | 'activity' | 'homeSet';

export interface SleepGuardState {
  workouts?: ReadonlyArray<{ finishedAt: number | null; kind?: 'home' | null }> | null;
  activities?: ReadonlyArray<{ finishedAt: number | null }> | null;
}

/** What blocks starting a sleep right now, or null when it is free to start. */
export function sleepBlockedBy(state: SleepGuardState): SleepBlock | null {
  const open = (state.workouts ?? []).filter((w) => w.finishedAt === null);
  if (open.some((w) => w.kind === 'home')) return 'homeSet';
  if (open.length > 0) return 'workout';
  if ((state.activities ?? []).some((a) => a.finishedAt === null)) return 'activity';
  return null;
}

/** i18n key of the short "why can't I sleep now" hint for each reason. */
export const SLEEP_BLOCK_KEY = {
  workout: 'slpBlockWorkout',
  activity: 'slpBlockActivity',
  homeSet: 'slpBlockHomeSet',
} as const satisfies Record<SleepBlock, string>;
