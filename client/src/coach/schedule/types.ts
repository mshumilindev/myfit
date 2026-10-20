/**
 * Schedule domain types (M6). Plain data, no copy. Storage shape follows plan 11.1: ONE sealed doc per client
 * (`schedules/{clientId}`) with patterns, one-offs, exceptions and cancellations; instances (`Slot`) are GENERATED on
 * the device (`model.generateSlots`). Requests are separate docs sealed by the requester (`requests`, plan 11.2).
 */
import type { Slot } from '../domain/types';
import type { GymWeek } from './hours';
import { coachTestDefault } from '../data/testHooks';

export interface Gym {
  id: string;
  name: string;
  short: string;
  /** Opening hours when known (Monday first, minutes; see `hours.ts`). Absent = the calendar looks them up from `place`. */
  hours?: GymWeek;
  /** Where the gym is, for the opening-hours lookup (the real backend only). */
  place?: { lat: number; lng: number };
}
let gymSource: (() => readonly Gym[]) | null = null;
/**
 * The real backend installs the trainer's OWN gyms here (`data/firestore/bootstrap.ts`), so the schedule builder and
 * the gym filter offer exactly those. Pass null to uninstall them.
 */
export function configureScheduleGyms(f: (() => readonly Gym[]) | null): void {
  gymSource = f;
}
/** True when a real backend installed the trainer's own gyms (the app's gym list); false in tests and stories. */
export const hasGymSource = (): boolean => gymSource !== null;
/** The gyms a session can be held in: the trainer's own with a real backend (possibly none); only test doubles (`coachTestDefault('gyms')`) offer others. */
export const scheduleGyms = (): readonly Gym[] =>
  gymSource ? gymSource() : (coachTestDefault<readonly Gym[]>('gyms')?.() ?? []);
/**
 * Names of gyms this device does not own, as the trainer wrote them into the schedule (`ScheduleDoc.gymNames`). A
 * member's own gym list does not hold the trainer's gym ids; without this a session would show an opaque id as its place.
 */
const sharedGymNames = new Map<string, string>();
export function rememberGymNames(docs: readonly Pick<ScheduleDoc, 'gymNames'>[]): void {
  for (const d of docs)
    for (const [id, name] of Object.entries(d.gymNames ?? {})) sharedGymNames.set(id, name);
}
export const forgetGymNames = (): void => sharedGymNames.clear();
/** A gym's name; an id nobody gave a name for is shown as it is. */
export const gymName = (id: string): string =>
  scheduleGyms().find((g) => g.id === id)?.name ??
  (coachTestDefault<readonly Gym[]>('gyms')?.() ?? []).find((g) => g.id === id)?.name ??
  sharedGymNames.get(id) ??
  id;
/** The gym ids a document uses. */
export const gymIdsOf = (d: Pick<ScheduleDoc, 'patterns' | 'oneOffs'>): string[] => [
  ...new Set([
    ...d.patterns.flatMap((p) => p.rows.map((r) => r.gymId)),
    ...d.oneOffs.map((o) => o.gymId),
  ]),
];

/** Present when the session is split / group: every attendee's doc carries the same `groupId` and row ids. */
export interface ShareInfo {
  groupId: string;
  kind: 'split' | 'group';
  title?: string;
  capacity?: number;
}

/** One weekday of a weekly pattern. `id` is the row id (shared by all attendees of a shared session). */
export interface Row {
  id: string;
  /** 0 = Monday .. 6 = Sunday */
  dow: number;
  start: string;
  dur: number;
  gymId: string;
  dayLabel?: string | null;
  programDayId?: string | null;
}
export interface PatternDoc {
  id: string;
  /** first day key the pattern may produce a session on */
  fromDay: number;
  weeks: number;
  rows: Row[];
  share?: ShareInfo;
}
export interface OneOffDoc {
  id: string;
  day: number;
  start: string;
  dur: number;
  gymId: string;
  note?: string;
  share?: ShareInfo;
}
/**
 * The trainer's mark on one instance. `missed` / `done`: past sessions without shared totals. `kept`: in a whole-session
 * move this person stays on the OLD time while the others move ("Keep Sofiia on the old time, move the others").
 */
export interface ExceptionDoc {
  slotKey: string;
  status: 'missed' | 'done' | 'kept';
}
export interface ScheduleDoc {
  clientId: string;
  rev: number;
  patterns: PatternDoc[];
  oneOffs: OneOffDoc[];
  exceptions: ExceptionDoc[];
  /** instance keys the trainer cancelled (R-BE-CAL-7) */
  cancelled: string[];
  /**
   * IANA zone the wall-clock times of this document were written in (the trainer's zone when they saved it). A member's
   * device reads the times in THIS zone, wherever it is. Absent = a document from before zones were stored: read in the
   * zone the app already uses (UTC on a member's device until the trainer saves again).
   */
  tz?: string;
  /** Display names of the gyms the document uses, by gym id (the trainer's own gyms; a member's device does not hold them). */
  gymNames?: Record<string, string>;
}
export const emptyDoc = (clientId: string): ScheduleDoc => ({
  clientId,
  rev: 0,
  patterns: [],
  oneOffs: [],
  exceptions: [],
  cancelled: [],
});

/* ---- requests --------------------------------------------------------------------------------------------------- */
export type ReqStatus = 'pending' | 'accepted' | 'declined' | 'countered' | 'expired' | 'cancelled';
export const OPEN_STATUSES: readonly ReqStatus[] = ['pending'];

export interface RescheduleRequest {
  id: string;
  /** the attendee this request is for (one per attendee for a whole-session move) */
  clientId: string;
  /** who asked */
  from: 'trainer' | 'client';
  /** `manager`: a team manager proposed it on the trainer's side (the client still answers) */
  via?: 'manager';
  /** the manager's display name (sealed with the request), shown as "Proposed by …" */
  byName?: string;
  slotKey: string;
  fromStart: number;
  toStart: number;
  note?: string;
  status: ReqStatus;
  createdAt: number;
  decidedAt?: number;
  expiresAt: number;
  /** a counter-proposal replaces this request */
  supersedes?: string;
  /** all / one person of a shared session */
  scope: 'all' | 'one';
  /** the requests of ONE whole-session move share this */
  groupKey?: string;
}

/* ---- generated slots ---------------------------------------------------------------------------------------------- */
/** A `Slot` plus what the calendar needs. `start` is epoch ms (domain). */
export interface ScheduleSlot extends Slot {
  dayLabel?: string | null;
  programDayId?: string | null;
  oneOff?: boolean;
  note?: string;
  /** moved here by an accepted request */
  justMoved?: boolean;
  /** the old place of a moved session (status 'moved'): where it went */
  movedTo?: number;
  /** split: each person's own program day */
  attendeeDays?: Record<string, string | null>;
  /** the instance key (source row id + day) the requests refer to */
  key: string;
}
export const MAX_ROWS = 8;
export const MAX_NOTE = 300;
