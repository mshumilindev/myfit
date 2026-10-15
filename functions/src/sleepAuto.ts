/**
 * Pure rules for the server side of automatic sleep (no Firebase imports, so they are unit-tested).
 *
 * The client lays out the upcoming bedtimes as absolute instants (`sleepSchedules/{uid}.upcoming`);
 * the hourly job opens a night for a slot that has come due and closes a night whose wake time has
 * passed. Anything the job leaves open blocks every later night from starting (one live night at a
 * time), so an open night must never be able to stay open forever.
 */

export const HOUR_MS = 60 * 60 * 1000;
/** A slot older than this is not resurrected (the morning auto-fill logs that night instead). */
export const AUTO_START_STALE_MS = 6 * HOUR_MS;
/** A night with no scheduled wake (started by hand) that is still open after this is closed. */
export const MAX_OPEN_NIGHT_MS = 16 * HOUR_MS;
/** Length given to such a night — same fallback the app uses when it has no plan. */
export const FALLBACK_NIGHT_MS = 8 * HOUR_MS;

export interface UpcomingNight {
  startAt: number;
  wakeAt: number;
  date: string;
}

/**
 * When an open night must end, or null if it may keep running.
 * - its scheduled wake (`autoWakeAt`) has passed, or
 * - it has no scheduled wake and has been open longer than MAX_OPEN_NIGHT_MS (left open by hand).
 */
export function wakeToCloseAt(
  n: { bedtime?: unknown; autoWakeAt?: unknown },
  now: number,
): number | null {
  const bed = typeof n.bedtime === 'number' ? n.bedtime : null;
  if (typeof n.autoWakeAt === 'number') {
    if (n.autoWakeAt > now) return null;
    return Math.max(n.autoWakeAt, (bed ?? 0) + 60_000);
  }
  if (bed !== null && now - bed > MAX_OPEN_NIGHT_MS) return bed + FALLBACK_NIGHT_MS;
  return null;
}

/**
 * Consumes the queue: every slot whose start has passed is dropped, the most recent of them is the
 * one to act on (`slot`, only if still fresh), and `rest` is what stays queued.
 */
export function takeDueSlot(
  upcoming: UpcomingNight[],
  now: number,
): { slot: UpcomingNight | null; rest: UpcomingNight[] } {
  const rest = [...upcoming].sort((a, b) => a.startAt - b.startAt);
  let slot: UpcomingNight | undefined;
  while (rest.length && rest[0].startAt <= now) slot = rest.shift();
  return { slot: slot && now - slot.startAt <= AUTO_START_STALE_MS ? slot : null, rest };
}
