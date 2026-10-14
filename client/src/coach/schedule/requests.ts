/**
 * Reschedule requests: the state machine of plan 11.2 as pure functions. Statuses: pending -> accepted | declined |
 * expired | countered | cancelled (all but pending are terminal). The requester seals the content; the OTHER side only
 * moves the open `status` / `decidedAt` (a counter is a NEW request with `supersedes`).
 */
import { HOUR, MIN, DAY } from '../domain/time';
import { MAX_NOTE, type RescheduleRequest, type ReqStatus } from './types';
import { opaqueSlotKey } from './ids';
import { statusAt } from './model';
import type { ScheduleSlot } from './types';

export class RequestError extends Error {
  constructor(
    readonly code:
      | 'no-slot'
      | 'past'
      | 'same-time'
      | 'open-request'
      | 'note-too-long'
      | 'not-allowed'
      | 'expired'
      | 'not-open',
  ) {
    super(code);
    this.name = 'RequestError';
  }
}

/** expiresAt = min(proposed start - 2 h, now + 72 h), at least 15 minutes ahead, at most 14 days (server bound). */
export function expiryFor(toStart: number, now: number): number {
  const e = Math.min(toStart - 2 * HOUR, now + 72 * HOUR);
  return Math.min(Math.max(e, now + 15 * MIN), now + 14 * DAY);
}

export interface RequestDraft {
  id: string;
  clientId: string;
  from: 'trainer' | 'client';
  slot: Pick<ScheduleSlot, 'key' | 'start'>;
  toStart: number;
  note?: string;
  scope?: 'all' | 'one';
  groupKey?: string;
  supersedes?: string;
  now: number;
}

/** Validate and build a pending request. A request without a slot reference is refused (R-BE-CAL-4). */
export function createRequest(
  d: RequestDraft,
  existing: readonly RescheduleRequest[],
): RescheduleRequest {
  if (!d.slot?.key) throw new RequestError('no-slot');
  if (d.toStart <= d.now) throw new RequestError('past');
  if (d.toStart === d.slot.start) throw new RequestError('same-time');
  const note = d.note?.trim();
  if (note && note.length > MAX_NOTE) throw new RequestError('note-too-long');
  const open = existing.find(
    (r) =>
      r.slotKey === opaqueSlotKey(d.slot.key) &&
      r.clientId === d.clientId &&
      statusAt(r, d.now) === 'pending' &&
      r.id !== d.supersedes,
  );
  if (open) throw new RequestError('open-request');
  return {
    id: d.id,
    clientId: d.clientId,
    from: d.from,
    slotKey: opaqueSlotKey(d.slot.key),
    fromStart: d.slot.start,
    toStart: d.toStart,
    ...(note ? { note } : {}),
    status: 'pending',
    createdAt: d.now,
    expiresAt: expiryFor(d.toStart, d.now),
    scope: d.scope ?? 'all',
    ...(d.groupKey ? { groupKey: d.groupKey } : {}),
    ...(d.supersedes ? { supersedes: d.supersedes } : {}),
  };
}

/** Who may answer: only the OTHER side; who may cancel: only the creator. */
export function canAnswer(r: RescheduleRequest, side: 'trainer' | 'client', now: number): boolean {
  return statusAt(r, now) === 'pending' && r.from !== side;
}
export const canCancel = (r: RescheduleRequest, side: 'trainer' | 'client', now: number): boolean =>
  statusAt(r, now) === 'pending' && r.from === side;

/** Apply an answer. Accept after expiry fails; a double accept is idempotent; terminal statuses never change. */
export function answer(
  r: RescheduleRequest,
  to: Exclude<ReqStatus, 'pending' | 'expired'>,
  side: 'trainer' | 'client',
  now: number,
): RescheduleRequest {
  if (r.status === to) return r; // idempotent
  if (statusAt(r, now) === 'expired' && to === 'accepted') throw new RequestError('expired');
  if (r.status !== 'pending') throw new RequestError('not-open');
  if (to === 'cancelled') {
    if (r.from !== side) throw new RequestError('not-allowed');
  } else if (r.from === side) throw new RequestError('not-allowed');
  return { ...r, status: to, decidedAt: now };
}

/** Whole-session move summary: how many attendees confirmed (the trainer's private view). */
export function groupProgress(reqs: readonly RescheduleRequest[]): {
  total: number;
  accepted: number;
  declined: number;
  waiting: number;
} {
  return {
    total: reqs.length,
    accepted: reqs.filter((r) => r.status === 'accepted').length,
    declined: reqs.filter((r) => r.status === 'declined').length,
    waiting: reqs.filter((r) => r.status === 'pending').length,
  };
}
