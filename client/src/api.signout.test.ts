import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ flush: vi.fn(), flushRevokes: vi.fn(), order: [] as string[] }));
vi.mock('./firebase', () => ({ auth: { currentUser: { uid: 'u1' } }, functions: {} }));
vi.mock('firebase/auth', () => ({
  signInWithCustomToken: vi.fn(),
  onAuthStateChanged: vi.fn(),
  onIdTokenChanged: vi.fn(),
  signOut: vi.fn(async () => {
    h.order.push('firebaseSignOut');
  }),
}));
vi.mock('firebase/functions', () => ({ httpsCallable: vi.fn() }));
vi.mock('./legal/signupConsents', () => ({ flushPendingConsents: h.flush }));
vi.mock('./coach/client/revokeQueue', () => ({ flushPendingRevokes: h.flushRevokes }));
vi.mock('./accounts/sessions', () => ({ endSession: vi.fn(async () => undefined) }));
vi.mock('./deviceWipe', () => ({ wipeAfterSignOut: vi.fn(async () => undefined) }));

import { SIGN_OUT_FLUSH_MS, signOut } from './api';

beforeEach(() => {
  vi.useFakeTimers();
  h.order.length = 0;
  h.flush.mockReset();
  h.flushRevokes.mockReset();
  localStorage.clear();
  localStorage.setItem('spotter.consentQueue', '[{"uid":"u1","items":[]}]');
  localStorage.setItem('spotter.consentRevokeQueue', '[{"uid":"u1","at":1,"kinds":["totals"]}]');
  localStorage.setItem('spotter.consentLocalOff', '{"u1":["geo-search"]}');
  localStorage.setItem('spotter.state', '{}');
});
afterEach(() => vi.useRealTimers());

describe('signOut and queued consents', () => {
  it('tries to send them BEFORE the session ends, and the queue and local-off flags survive the wipe', async () => {
    h.flush.mockImplementation(async () => {
      h.order.push('flush');
    });
    await signOut();
    expect(h.order).toEqual(['flush', 'firebaseSignOut']);
    expect(localStorage.getItem('spotter.consentQueue')).not.toBeNull();
    expect(localStorage.getItem('spotter.consentLocalOff')).not.toBeNull();
    expect(localStorage.getItem('spotter.state')).toBeNull();
  });

  it('the queued Stop sharing revoke is sent before the session ends, and its queue survives', async () => {
    h.flush.mockResolvedValue(undefined);
    h.flushRevokes.mockImplementation(async () => {
      h.order.push('flushRevokes');
    });
    await signOut();
    expect(h.order).toEqual(['flushRevokes', 'firebaseSignOut']);
    expect(localStorage.getItem('spotter.consentRevokeQueue')).not.toBeNull();
  });

  it('never blocks: a flush that hangs delays the sign-out by at most the short limit', async () => {
    expect(SIGN_OUT_FLUSH_MS).toBeLessThanOrEqual(3000);
    h.flush.mockReturnValue(new Promise(() => undefined));
    let done = false;
    const p = signOut().then(() => (done = true));
    await vi.advanceTimersByTimeAsync(SIGN_OUT_FLUSH_MS - 1);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1600);
    await p;
    expect(done).toBe(true);
    expect(h.order).toEqual(['firebaseSignOut']);
  });

  it('a flush that throws does not stop the sign-out', async () => {
    h.flush.mockRejectedValue(new Error('boom'));
    await signOut();
    expect(h.order).toEqual(['firebaseSignOut']);
  });
});
