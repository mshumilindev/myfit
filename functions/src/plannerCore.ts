/**
 * Planner reminders, the pure part (SPO-552 I6). The server cannot read a plan (it is sealed): it only sees the open
 * `fireAts`, the next reminder moments the device wrote, and sends them one after another. One document per plan, one
 * Cloud Task pending per plan at a time: after a moment is sent the next one is queued.
 */

/** A persistent (`ring`) reminder repeats this often, this many times, until it is dismissed or snoozed. */
export const RING_REPEAT_MS = 2 * 60_000;
export const RING_MAX_REPEATS = 5;
/** A reminder's state document is dropped this long after its moment. */
export const ALERT_KEEP_MS = 6 * 3600_000;
/** A moment this far in the past is too old to ring (the task was late or the device wrote an old list). */
export const STALE_MS = 6 * 3600_000;
/** Cloud Tasks can hold a task about 30 days ahead; the device writes at most 28 days. */
export const MAX_AHEAD_MS = 29 * 24 * 3600_000;
const MAX_FIRES = 32;

export type PlannerStep = 'fire' | 'repeat' | 'snooze' | 'cleanup';

/** The payload of a task: ids and a time, never any text. */
export interface PlannerTask {
  uid: string;
  id: string;
  dueAt: number;
  step: PlannerStep;
  n?: number;
  /** The ring round (the alert's `rev`): a repeat after a snooze is a new task, not the old name again. */
  r?: number;
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

/** Should a moment still ring at `now`? Not once it is stale, and not when it is further ahead than a task can wait. */
export const ringable = (at: number, now: number): boolean =>
  now - at <= STALE_MS && at - now <= MAX_AHEAD_MS;

/** Idempotent task name: the same moment queued twice is one task. */
export function taskId(t: PlannerTask): string {
  const base = `pl-${t.step}-${t.uid}-${t.id}-${t.dueAt}${t.r != null ? `-r${t.r}` : ''}${t.n != null ? `-${t.n}` : ''}`;
  return base.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 480);
}

/** The state document of one moment. */
export const alertId = (id: string, dueAt: number): string => `${id}_${dueAt}`;

export type AlertState = 'ringing' | 'snoozed' | 'dismissed';

/** What a repeat should do, from the alert as it stands now. */
export function repeatAction(
  alert: { state?: unknown; snoozeUntil?: unknown } | undefined,
  n: number,
  now: number,
): 'ring' | 'wait' | 'stop' {
  if (!alert) return 'stop';
  if (alert.state === 'dismissed') return 'stop';
  if (alert.state === 'snoozed') {
    return typeof alert.snoozeUntil === 'number' && alert.snoozeUntil > now ? 'wait' : 'stop';
  }
  return alert.state === 'ringing' && n <= RING_MAX_REPEATS ? 'ring' : 'stop';
}
