/**
 * Planner reminders for the desktop shell (SPO-552 I8). The server cannot push to this shell (Electron has no push service), so
 * the main process keeps its own timers: the page hands over only `{ id, at, mode }` (no title, no text) and gets an event when one is
 * due; the page then shows its ring screen and the notification from its own sealed copy. The main process timers are not
 * throttled like a hidden window's, which is the whole point. Kept free of the `electron` import so it can be unit-tested.
 */
export interface Alarm {
  id: string;
  /** UTC ms. */
  at: number;
  mode: 'quiet' | 'ring';
}

export interface AlarmClock {
  now(): number;
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
}

/** A timer must stay below 2^31 ms; a farther alarm is re-armed when that long has passed. */
export const MAX_TIMER_MS = 2 ** 31 - 1;
/** An alarm that was missed by more than this (the computer slept, the shell was closed) is the page's to show as missed. */
export const GRACE_MS = 10 * 60_000;
/** The most alarms the shell holds (a sane page sends the next few dozen at most). */
export const MAX_ALARMS = 200;

/** Accepts only well-formed alarms from the page: anything else is dropped, never trusted. */
export function parseAlarms(input: unknown): Alarm[] {
  if (!Array.isArray(input)) return [];
  const out: Alarm[] = [];
  for (const a of input.slice(0, MAX_ALARMS)) {
    if (!a || typeof a !== 'object') continue;
    const { id, at, mode } = a as Record<string, unknown>;
    if (typeof id !== 'string' || id.length === 0 || id.length > 200) continue;
    if (typeof at !== 'number' || !Number.isFinite(at)) continue;
    if (mode !== 'quiet' && mode !== 'ring') continue;
    out.push({ id, at: Math.floor(at), mode });
  }
  return out;
}

export function createAlarmScheduler(clock: AlarmClock, onDue: (alarm: Alarm) => void) {
  const alarms = new Map<string, Alarm>();
  const timers = new Map<string, unknown>();

  const drop = (id: string) => {
    const t = timers.get(id);
    if (t !== undefined) clock.clearTimer(t);
    timers.delete(id);
    alarms.delete(id);
  };

  const arm = (a: Alarm) => {
    const wait = a.at - clock.now();
    if (wait <= 0) {
      // Due now (or just missed): inside the grace it still rings, older is left for the page.
      drop(a.id);
      if (-wait <= GRACE_MS) onDue(a);
      return;
    }
    timers.set(
      a.id,
      clock.setTimer(() => arm(a), Math.min(wait, MAX_TIMER_MS)),
    );
  };

  return {
    /** Replaces the whole set: what is not in `list` is cancelled, what stays keeps its timer only if the moment is unchanged. */
    schedule(list: readonly Alarm[]): void {
      const next = new Map(list.map((a) => [a.id, a]));
      for (const id of [...alarms.keys()]) if (!next.has(id)) drop(id);
      for (const a of next.values()) {
        const cur = alarms.get(a.id);
        if (cur && cur.at === a.at && cur.mode === a.mode) continue;
        drop(a.id);
        alarms.set(a.id, a);
        arm(a);
      }
    },
    cancel(ids: readonly string[]): void {
      for (const id of ids) drop(id);
    },
    /** After the computer wakes: timers may have been late, so look at every alarm again. */
    recheck(): void {
      for (const a of [...alarms.values()]) {
        const t = timers.get(a.id);
        if (t !== undefined) clock.clearTimer(t);
        timers.delete(a.id);
        arm(a);
      }
    },
    pending(): Alarm[] {
      return [...alarms.values()].sort((x, y) => x.at - y.at);
    },
  };
}
