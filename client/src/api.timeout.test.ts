import { afterEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ httpsCallable: vi.fn() }));
vi.mock('./firebase', () => ({ auth: { currentUser: null }, functions: {} }));
vi.mock('firebase/auth', () => ({
  signInWithCustomToken: vi.fn(),
  onAuthStateChanged: vi.fn(),
  onIdTokenChanged: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock('firebase/functions', () => ({ httpsCallable: h.httpsCallable }));

import { READ_TIMEOUT_MS, WRITE_TIMEOUT_MS, callFn, getMutationPending } from './api';

afterEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
});

describe('callFn on a bad network', () => {
  it('passes a bounded timeout: reads 15 s, mutations 30 s', async () => {
    h.httpsCallable.mockReturnValue(async () => ({ data: {} }));
    await callFn('profileMe');
    expect(h.httpsCallable.mock.calls[0][2]).toEqual({ timeout: READ_TIMEOUT_MS });
    await callFn('updateProfile', {});
    expect(h.httpsCallable.mock.calls[1][2]).toEqual({ timeout: WRITE_TIMEOUT_MS });
  });

  it('maps a deadline to 504 and leaves no pending mutation behind', async () => {
    h.httpsCallable.mockReturnValue(async () => {
      throw { code: 'functions/deadline-exceeded', message: 'deadline' };
    });
    await expect(callFn('updateProfile', {})).rejects.toMatchObject({ status: 504 });
    expect(getMutationPending()).toBe(0);
  });

  it('fails at once when offline, without touching the network or the chip', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    await expect(callFn('updateProfile', {})).rejects.toMatchObject({ status: 503 });
    expect(h.httpsCallable).not.toHaveBeenCalled();
    expect(getMutationPending()).toBe(0);
  });
});
