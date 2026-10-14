/**
 * Joins the schedule into the world (pure). The server does not know the plan, so `coachRead` leaves `planned` per week
 * at 0 and the world has no slots. The schedule (the trainer's own sealed docs, opened on this device) supplies them:
 *   - `slots`            the generated sessions of the window (this week and the weeks around it),
 *   - `completedWeeks[].planned` and `plannedThisWeek` per client (so the rhythm signals can compare done with planned),
 *   - `CoachClient.planned` this week.
 * A session that moved away (`moved`, the ghost at the old place) is not a planned session.
 */
import { DAY, WEEK, weekStartOf } from '../../domain/time';
import type { ClientHistory } from '../../domain/history';
import type { ClientSignalInput } from '../../domain/signalInputs';
import type { CoachClient, Slot } from '../../domain/types';
import { generateSlots } from '../../schedule/model';
import type { ScheduleData } from '../../schedule/port';
import { dayOfTs } from '../../schedule/time';

const counts = (s: Slot) => s.status !== 'moved';

export interface JoinInput {
  clients: CoachClient[];
  inputs: ClientSignalInput[];
  now: number;
}
export interface Joined {
  clients: CoachClient[];
  inputs: ClientSignalInput[];
  slots: Slot[];
}

export function joinSchedule(w: JoinInput, sched: ScheduleData | null): Joined {
  if (!sched || !sched.docs.length) return { clients: w.clients, inputs: w.inputs, slots: [] };
  const thisWeek = weekStartOf(w.now);
  const slots: Slot[] = generateSlots(sched.docs, sched.requests, {
    fromDay: dayOfTs(thisWeek - 4 * WEEK),
    toDay: dayOfTs(thisWeek + 3 * WEEK),
    now: w.now,
  });
  const plannedIn = (clientId: string, from: number, to: number) =>
    slots.filter(
      (s) =>
        counts(s) &&
        s.start >= from &&
        s.start < to &&
        s.attendees.some((a) => a.clientId === clientId && a.status !== 'declined'),
    ).length;

  const inputs = w.inputs.map((i) => {
    if (!i.totals) return i;
    const planned = [4, 3, 2, 1].map((back) =>
      plannedIn(i.clientId, thisWeek - back * WEEK, thisWeek - (back - 1) * WEEK),
    );
    return {
      ...i,
      totals: {
        ...i.totals,
        completedWeeks: i.totals.completedWeeks.map((cw, k) => ({
          ...cw,
          planned: planned[k] ?? 0,
        })),
        plannedThisWeek: plannedIn(i.clientId, thisWeek, thisWeek + WEEK),
      },
    };
  });
  const clients = w.clients.map((c) => ({
    ...c,
    planned: plannedIn(c.id, thisWeek, thisWeek + WEEK),
  }));
  // the world keeps the near window only (Today, the queue and the header read it); the Schedule screen has its own
  const keepFrom = thisWeek - DAY;
  return { clients, inputs, slots: slots.filter((s) => s.start >= keepFrom) };
}

/** A logged session within this long of a scheduled 1:1 start is that session (the member opens the workout around the start). */
const WITH_TRAINER_WINDOW = 90 * 60_000;

/**
 * Fills the history facts only the schedule knows (pure): which logged sessions were held with the trainer (a scheduled,
 * not cancelled/moved session of that client starting within 90 min of the workout) and the weekly planned count of
 * the rhythm bars (the sessions the schedule had for that client that week). Without a schedule the history is
 * returned untouched: `withTrainer` stays false and `planned` stays the done count rather than inventing a plan.
 */
export function joinHistory(
  history: Record<string, ClientHistory>,
  sched: ScheduleData | null,
  now: number,
): Record<string, ClientHistory> {
  if (!sched || !sched.docs.length) return history;
  const thisWeek = weekStartOf(now);
  const slots = generateSlots(sched.docs, sched.requests, {
    fromDay: dayOfTs(thisWeek - 6 * WEEK),
    toDay: dayOfTs(thisWeek),
    now,
  }).filter(counts);
  const mine = (clientId: string) =>
    slots.filter((s) =>
      s.attendees.some((a) => a.clientId === clientId && a.status !== 'declined'),
    );
  const out: Record<string, ClientHistory> = {};
  for (const [id, h] of Object.entries(history)) {
    const own = mine(id);
    out[id] = {
      ...h,
      weeks: h.weeks.map((w, k) => {
        const from = thisWeek - (6 - k) * WEEK;
        const planned = own.filter((s) => s.start >= from && s.start < from + WEEK).length;
        return { ...w, planned: Math.max(planned, w.done) };
      }),
      workouts: h.workouts && {
        ...h.workouts,
        entries: h.workouts.entries.map((e) => ({
          ...e,
          withTrainer: own.some(
            (s) => s.status !== 'missed' && Math.abs(s.start - e.at) <= WITH_TRAINER_WINDOW,
          ),
        })),
      },
    };
  }
  return out;
}
