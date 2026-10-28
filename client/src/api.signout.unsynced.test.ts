import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// SPO-384: sign-out refuses to wipe the device while changes are unsent, asks first, and wipes only after a yes.
const h = vi.hoisted(() => ({ order: [] as string[], wipe: vi.fn(async () => undefined) }));
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
vi.mock('./accounts/sessions', () => ({ endSession: vi.fn(async () => undefined) }));
vi.mock('./deviceWipe', () => ({ wipeAfterSignOut: (...a: unknown[]) => h.wipe(...(a as [])) }));

import { signOut } from './api';
import { DRAIN_MS, registerFirestoreDrain, registerUnsynced, setUnsyncedPrompt } from './unsynced';

let outbox = 0;
beforeEach(() => {
  vi.useFakeTimers();
  h.order.length = 0;
  h.wipe.mockClear();
  localStorage.clear();
  localStorage.setItem('spotter.state', '{"x":1}');
  outbox = 2;
  registerUnsynced('chat', { count: () => outbox });
  registerFirestoreDrain(null);
  setUnsyncedPrompt(null);
});
afterEach(() => vi.useRealTimers());

describe('signOut with changes still unsent', () => {
  it('does not wipe anything, asks with the count, and a yes then signs out for real', async () => {
    const asked: Array<{ remaining: number; proceed: () => void }> = [];
    setUnsyncedPrompt((remaining, proceed) => asked.push({ remaining, proceed }));
    const p = signOut();
    await vi.advanceTimersByTimeAsync(DRAIN_MS + 100);
    await expect(p).resolves.toEqual({ ok: false, remaining: 2 });
    expect(h.order).toEqual([]);
    expect(h.wipe).not.toHaveBeenCalled();
    expect(localStorage.getItem('spotter.state')).not.toBeNull();
    expect(asked.map((a) => a.remaining)).toEqual([2]);

    asked[0].proceed();
    await vi.advanceTimersByTimeAsync(5000);
    expect(h.order).toEqual(['firebaseSignOut']);
    expect(h.wipe).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('spotter.state')).toBeNull();
  });

  it('with the queue emptied in time it signs out without asking', async () => {
    const ask = vi.fn();
    setUnsyncedPrompt(ask);
    const p = signOut();
    await vi.advanceTimersByTimeAsync(600);
    outbox = 0;
    await vi.advanceTimersByTimeAsync(5000);
    await expect(p).resolves.toEqual({ ok: true });
    expect(ask).not.toHaveBeenCalled();
    expect(h.wipe).toHaveBeenCalledTimes(1);
  });

  it('discardUnsynced (the person said yes, or the account is being deleted) skips the wait and the question', async () => {
    const ask = vi.fn();
    setUnsyncedPrompt(ask);
    const p = signOut({ discardUnsynced: true });
    await vi.advanceTimersByTimeAsync(5000);
    await expect(p).resolves.toEqual({ ok: true });
    expect(ask).not.toHaveBeenCalled();
    expect(h.wipe).toHaveBeenCalledTimes(1);
  });

  it('already checked by the caller (gated) is not checked twice', async () => {
    const p = signOut({ gated: true });
    await vi.advanceTimersByTimeAsync(5000);
    await expect(p).resolves.toEqual({ ok: true });
    expect(h.wipe).toHaveBeenCalledTimes(1);
  });
});
