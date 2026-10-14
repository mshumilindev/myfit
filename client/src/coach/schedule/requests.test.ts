import { describe, expect, it } from 'vitest';
import { HOUR, MIN, DAY } from '../domain/time';
import { opaqueSlotKey } from './ids';
import {
  answer,
  canAnswer,
  canCancel,
  createRequest,
  expiryFor,
  groupProgress,
  RequestError,
} from './requests';
import type { RescheduleRequest } from './types';

const NOW = Date.UTC(2026, 9, 7, 9, 5);
const slot = { key: 'r1:20000', start: NOW + 2 * DAY };
const draft = (o: Partial<Parameters<typeof createRequest>[0]> = {}) => ({
  id: 'q1',
  clientId: 'c1',
  from: 'trainer' as const,
  slot,
  toStart: NOW + 3 * DAY,
  now: NOW,
  ...o,
});

describe('request creation (R-BE-CAL-4, plan 11.2)', () => {
  it('builds a pending request with an opaque slot key and a bounded expiry', () => {
    const r = createRequest(draft({ note: ' Gym is booked. ' }), []);
    expect(r).toMatchObject({
      status: 'pending',
      slotKey: opaqueSlotKey('r1:20000'),
      note: 'Gym is booked.',
      scope: 'all',
    });
    expect(r.slotKey).not.toContain('20000');
    expect(r.expiresAt).toBeGreaterThan(r.createdAt);
    expect(r.expiresAt).toBeLessThanOrEqual(r.createdAt + 14 * DAY);
  });
  it('expiry = min(proposed start - 2 h, now + 72 h), never in the past', () => {
    expect(expiryFor(NOW + 10 * DAY, NOW)).toBe(NOW + 72 * HOUR);
    expect(expiryFor(NOW + 30 * HOUR, NOW)).toBe(NOW + 28 * HOUR);
    expect(expiryFor(NOW + HOUR, NOW)).toBe(NOW + 15 * MIN);
  });
  it('refuses a request without a slot reference, in the past, at the same time, or with a long note', () => {
    expect(() => createRequest(draft({ slot: { key: '', start: 0 } }), [])).toThrow(RequestError);
    expect(() => createRequest(draft({ toStart: NOW - 1 }), [])).toThrow(/past/);
    expect(() => createRequest(draft({ toStart: slot.start }), [])).toThrow(/same-time/);
    expect(() => createRequest(draft({ note: 'x'.repeat(301) }), [])).toThrow(/note-too-long/);
  });
  it('one open request per session and person', () => {
    const first = createRequest(draft(), []);
    expect(() => createRequest(draft({ id: 'q2' }), [first])).toThrow(/open-request/);
    // another person of the same session is fine, and so is a counter that supersedes the open one
    expect(createRequest(draft({ id: 'q3', clientId: 'c2' }), [first]).id).toBe('q3');
    expect(
      createRequest(draft({ id: 'q4', from: 'client', supersedes: 'q1' }), [first]).supersedes,
    ).toBe('q1');
  });
});

describe('answering (the OTHER side only)', () => {
  const r = createRequest(draft(), []);
  it('only the other side answers, only the creator cancels', () => {
    expect(canAnswer(r, 'client', NOW)).toBe(true);
    expect(canAnswer(r, 'trainer', NOW)).toBe(false);
    expect(canCancel(r, 'trainer', NOW)).toBe(true);
    expect(canCancel(r, 'client', NOW)).toBe(false);
    expect(() => answer(r, 'accepted', 'trainer', NOW)).toThrow(/not-allowed/);
    expect(() => answer(r, 'cancelled', 'client', NOW)).toThrow(/not-allowed/);
  });
  it('accepts, declines; a double accept is idempotent; terminal states do not change', () => {
    const a = answer(r, 'accepted', 'client', NOW + 1000);
    expect(a).toMatchObject({ status: 'accepted', decidedAt: NOW + 1000 });
    expect(answer(a, 'accepted', 'client', NOW + 5000)).toBe(a);
    expect(() => answer(a, 'declined', 'client', NOW)).toThrow(/not-open/);
  });
  it('accept after expiry fails', () => {
    expect(() => answer(r, 'accepted', 'client', r.expiresAt + 1)).toThrow(/expired/);
    expect(canAnswer(r, 'client', r.expiresAt + 1)).toBe(false);
  });
  it('counts a whole-session move', () => {
    const mk = (id: string, status: RescheduleRequest['status']): RescheduleRequest => ({
      ...r,
      id,
      status,
    });
    expect(
      groupProgress([
        mk('a', 'accepted'),
        mk('b', 'declined'),
        mk('c', 'pending'),
        mk('d', 'accepted'),
      ]),
    ).toEqual({
      total: 4,
      accepted: 2,
      declined: 1,
      waiting: 1,
    });
  });
});
