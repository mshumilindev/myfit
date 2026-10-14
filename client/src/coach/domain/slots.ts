import type { Attendee, Slot, SessionKind } from './types';

export const kindOf = (s: Slot): SessionKind => s.kind;
export const attendeesOf = (s: Slot): Attendee[] =>
  s.attendees.length ? s.attendees : [{ clientId: s.clientId, status: s.status }];
export const hasClient = (s: Slot, id: string) => attendeesOf(s).some((a) => a.clientId === id);
export const headcount = (s: Slot) => attendeesOf(s).filter((a) => a.status !== 'declined').length;
/** What ONE client may learn about a shared session: kind, title and how many people, never the other names. */
export const sharedView = (s: Slot) => ({
  kind: s.kind,
  title: s.title,
  people: headcount(s),
  capacity: s.capacity,
});
/** Pending reschedule requests, oldest session first. */
export const pendingMoves = (slots: readonly Slot[]): Slot[] =>
  slots.filter((s) => s.status === 'pending-move' && s.move).sort((a, b) => a.start - b.start);
