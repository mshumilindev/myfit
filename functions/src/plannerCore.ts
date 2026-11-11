/**
 * Planner reminders, the pure part (SPO-552 I6). The server cannot read a plan (it is sealed): it only sees the open
 * `fireAts`, the next reminder moments the device wrote, and sends one push per moment. One document per plan, one
 * Cloud Task pending per plan at a time: after a moment is sent the next one is queued. Everything else (a persistent
 * reminder's repeats, snooze, the ringing screen) is done by the client while the app is open.
 */

/** A moment this far in the past is too old to send (the task was late or the device wrote an old list). */
export const STALE_MS = 6 * 3600_000;
/** Cloud Tasks can hold a task about 30 days ahead; the device writes at most 28 days. */
export const MAX_AHEAD_MS = 29 * 24 * 3600_000;
const MAX_FIRES = 32;

/** The payload of a task: ids and a time, never any text. */
export interface PlannerTask {
  uid: string;
  id: string;
  dueAt: number;
}

/** The moments from a document: finite numbers, ascending, unique, at most 32. Anything else is dropped. */
export function validFires(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const out = [
    ...new Set(raw.filter((x): x is number => typeof x === 'number' && Number.isFinite(x))),
  ];
  return out.sort((a, b) => a - b).slice(0, MAX_FIRES);
}

/** The first moment strictly after `t`, or null. */
export const nextAfter = (fires: number[], t: number): number | null =>
  fires.find((f) => f > t) ?? null;

/** Can a moment be queued at `now`? Not once it is stale, and not when it is further ahead than a task can wait. */
export const ringable = (at: number, now: number): boolean =>
  now - at <= STALE_MS && at - now <= MAX_AHEAD_MS;

/** Idempotent task name: the same moment queued twice is one task. */
export function taskId(t: PlannerTask): string {
  return `pl-${t.uid}-${t.id}-${t.dueAt}`.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 480);
}
