/**
 * Pure numbers of the week digest strip. Consent-gated: a session only counts as done / planned when at least one
 * of its people shares their totals (`totals` is not `off`). Nothing here reads a clock; `now` is passed in.
 */
import type { CoachClient } from '../../domain/types';
import { dayOfTs } from '../time';
import { peopleOf, statusAt } from '../model';
import type { RescheduleRequest, ScheduleSlot } from '../types';

export interface WeekDigest {
  /** counted sessions of the week (planned + done + missed, never moved-away ghosts) */
  planned: number;
  done: number;
  /** sessions left out because nobody on them shares totals */
  hidden: number;
  /** requests still waiting for an answer, for sessions of this week */
  moves: number;
  /** open decisions, only for the current week (a signal has no week) */
  decisions: number | null;
}

export function weekDigest(p: {
  days: readonly number[];
  slots: readonly ScheduleSlot[];
  requests: readonly RescheduleRequest[];
  byId: ReadonlyMap<string, CoachClient>;
  now: number;
  /** null = not the current week */
  openDecisions: number | null;
}): WeekDigest {
  const inWeek = p.slots.filter((s) => s.status !== 'moved' && p.days.includes(dayOfTs(s.start)));
  const shares = (s: ScheduleSlot) =>
    peopleOf(s).some((id) => (p.byId.get(id)?.consent.totals ?? 'off') !== 'off');
  const counted = inWeek.filter(shares);
  const moves = p.requests.filter(
    (r) => statusAt(r, p.now) === 'pending' && p.days.includes(dayOfTs(r.fromStart)),
  ).length;
  return {
    planned: counted.length,
    done: counted.filter((s) => s.status === 'done').length,
    hidden: inWeek.length - counted.length,
    moves,
    decisions: p.openDecisions,
  };
}

/** Nothing to say: no sessions, no waiting requests, no open decisions. The strip then renders nothing. */
export const digestIsEmpty = (d: WeekDigest): boolean =>
  d.planned === 0 && d.hidden === 0 && d.moves === 0 && !d.decisions;
