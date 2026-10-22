import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ uid: 'u1' as string | null, revoke: vi.fn() }));
vi.mock('../../api', () => ({ currentUid: () => h.uid }));
vi.mock('./data/config', () => ({ getClientPort: () => ({ revoke: h.revoke }) }));

import {
  REVOKE_QUEUE_KEY,
  cancelRevoke,
  clearRevoke,
  enqueueRevoke,
  flushPendingRevokes,
  hasPendingRevoke,
  pruneRevokesOf,
} from './revokeQueue';
import { pruneConsentsOf } from '../../legal/signupConsents';
import { SHARE_CATEGORIES } from './domain';

const stored = () => JSON.parse(localStorage.getItem(REVOKE_QUEUE_KEY) ?? '[]');

beforeEach(() => {
  localStorage.clear();
  h.uid = 'u1';
  h.revoke.mockReset();
});
afterEach(() => localStorage.clear());

describe('durable Stop sharing revoke (B4)', () => {
  it('is a device-level, uid-bound record of the six grant kinds and nothing else', () => {
    enqueueRevoke();
    enqueueRevoke(); // one entry per account
    const q = stored();
    expect(q).toHaveLength(1);
    expect(Object.keys(q[0]).sort()).toEqual(['at', 'kinds', 'uid']);
    expect(q[0].uid).toBe('u1');
    expect(q[0].kinds).toEqual([...SHARE_CATEGORIES]);
    expect(REVOKE_QUEUE_KEY).toBe('spotter.consentRevokeQueue');
  });

  it('a failed send stays queued; the next flush (start, online, sign-in) sends it and clears it', async () => {
    enqueueRevoke();
    h.revoke.mockRejectedValueOnce(new Error('offline'));
    await flushPendingRevokes();
    expect(hasPendingRevoke('u1')).toBe(true);
    h.revoke.mockResolvedValueOnce({ previous: {} });
    await flushPendingRevokes();
    expect(h.revoke).toHaveBeenCalledTimes(2);
    expect(hasPendingRevoke('u1')).toBe(false);
    expect(localStorage.getItem(REVOKE_QUEUE_KEY)).toBeNull();
  });

  it("another account's record is neither sent nor cleared, and nothing is sent signed out", async () => {
    enqueueRevoke();
    h.uid = 'u2';
    await flushPendingRevokes();
    expect(h.revoke).not.toHaveBeenCalled();
    clearRevoke();
    expect(hasPendingRevoke('u1')).toBe(true);
    h.uid = null;
    await flushPendingRevokes();
    expect(h.revoke).not.toHaveBeenCalled();
  });

  it('a newer sharing choice cancels a waiting revoke', async () => {
    enqueueRevoke();
    cancelRevoke();
    await flushPendingRevokes();
    expect(h.revoke).not.toHaveBeenCalled();
  });

  it('the deleted account is pruned, also through the consent prune the delete flow calls', () => {
    enqueueRevoke();
    h.uid = 'u2';
    enqueueRevoke();
    pruneRevokesOf('u1');
    expect(stored().map((e: { uid: string }) => e.uid)).toEqual(['u2']);
    pruneConsentsOf('u2');
    expect(localStorage.getItem(REVOKE_QUEUE_KEY)).toBeNull();
  });
});
