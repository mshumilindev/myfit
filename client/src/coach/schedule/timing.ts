/**
 * `timing`: the one OPEN part of a schedule document (SPO-265). The schedule itself is sealed; the server still has to
 * send "tomorrow 18:00 with Oleh" and "yesterday's session is not marked" without ever reading it. So the saving
 * device writes only MOMENTS: when the next sessions start and when finished ones are waiting for a mark. No gym, no
 * name, no program day, no note. The server learns that a client has a session at a time, nothing about what it is.
 *
 * `dueAt` is the earliest moment the server has something to do (0 = nothing). The server advances it after it has
 * acted. The formula lives in `functions/src/coach/reminders.ts` too; `timing.test.ts` pins the shared constants.
 */
import { DAY, MIN } from '../domain/time';
import { generateSlots } from './model';
import { dayOfTs } from './time';
import type { ScheduleDoc } from './types';

/** the client hears about a session this long before it starts */
export const REMIND_BEFORE = 18 * 60 * MIN;
/** the trainer hears about an unmarked session this long after it ended */
export const UNMARKED_AFTER = 2 * 60 * MIN;
const AHEAD_DAYS = 14;
const BACK_DAYS = 3;
export const MAX_MOMENTS = 12;

export interface Timing {
  /** starts (epoch ms) of upcoming sessions, soonest first */
  starts: number[];
  /** ends (epoch ms) of finished sessions nobody marked yet, soonest first */
  unmarked: number[];
  dueAt: number;
}

export function timingOf(doc: ScheduleDoc, now: number): Timing {
  const slots = generateSlots([doc], [], {
    fromDay: dayOfTs(now - BACK_DAYS * DAY),
    toDay: dayOfTs(now + AHEAD_DAYS * DAY),
    now,
  });
  const marked = new Set(doc.exceptions.map((e) => e.slotKey));
  const starts: number[] = [];
  const unmarked: number[] = [];
  for (const s of slots) {
    const end = s.start + s.durationMin * MIN;
    if (end > now) {
      if (s.status === 'planned') starts.push(s.start);
    } else if (!marked.has(s.key) && s.status !== 'moved') unmarked.push(end);
  }
  starts.sort((a, b) => a - b);
  unmarked.sort((a, b) => a - b);
  const t = {
    starts: starts.slice(0, MAX_MOMENTS),
    unmarked: unmarked.slice(-MAX_MOMENTS),
    dueAt: 0,
  };
  return { ...t, dueAt: dueAtOf(t, now) };
}

/** The earliest remaining moment strictly after `after` (0 = none). */
export function dueAtOf(t: Pick<Timing, 'starts' | 'unmarked'>, after: number): number {
  const all = [
    ...t.starts.map((s) => s - REMIND_BEFORE),
    ...t.unmarked.map((e) => e + UNMARKED_AFTER),
  ].filter((x) => x > after);
  return all.length ? Math.min(...all) : 0;
}
