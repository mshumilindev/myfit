import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  status: 'synced' as string,
  listeners: new Set<() => void>(),
  retrySync: vi.fn(),
}));

vi.mock('./store', () => ({
  getStoreState: () => ({ syncStatus: h.status }),
  subscribeStore: (cb: () => void) => {
    h.listeners.add(cb);
    return () => h.listeners.delete(cb);
  },
  retrySync: h.retrySync,
}));
vi.mock('./api', () => ({
  currentUid: () => 'u1',
  getMutationPending: () => 0,
  subscribeMutation: () => () => undefined,
}));

import {
  BACKOFF_MAX_MS,
  SLOW_AFTER_MS,
  SYNCING_SHOW_AFTER_MS,
  backoffDelay,
  deriveSyncUi,
  useSyncUi,
} from './syncHealth';

function setStatus(s: string) {
  h.status = s;
  for (const l of [...h.listeners]) l();
}

const base = {
  signedIn: true,
  status: 'synced' as const,
  online: true,
  unsettledForMs: 0,
  savingForMs: 0,
};

describe('deriveSyncUi', () => {
  it('is silent when settled or signed out', () => {
    expect(deriveSyncUi(base)).toBe('synced');
    expect(deriveSyncUi({ ...base, signedIn: false, status: 'failed' })).toBe('synced');
  });
  it('does not flash a chip for quick syncs, then says syncing, then slow', () => {
    const p = { ...base, status: 'pending' as const };
    expect(deriveSyncUi({ ...p, unsettledForMs: 100 })).toBe('synced');
    expect(deriveSyncUi({ ...p, unsettledForMs: SYNCING_SHOW_AFTER_MS })).toBe('syncing');
    expect(deriveSyncUi({ ...p, unsettledForMs: SLOW_AFTER_MS })).toBe('slow');
  });
  it('offline is its own calm state and wins over slow', () => {
    expect(deriveSyncUi({ ...base, status: 'offline' })).toBe('offline');
    expect(
      deriveSyncUi({ ...base, status: 'pending', online: false, unsettledForMs: 99_999 }),
    ).toBe('offline');
  });
  it('failed is reported; saving shows only after a short delay', () => {
    expect(deriveSyncUi({ ...base, status: 'failed' })).toBe('failed');
    expect(deriveSyncUi({ ...base, savingForMs: 100 })).toBe('synced');
    expect(deriveSyncUi({ ...base, savingForMs: 500 })).toBe('saving');
  });
});

describe('backoffDelay', () => {
  it('doubles from 5 s and caps at 60 s', () => {
    expect([0, 1, 2, 3].map(backoffDelay)).toEqual([5000, 10000, 20000, 40000]);
    expect(backoffDelay(4)).toBe(BACKOFF_MAX_MS);
    expect(backoffDelay(99)).toBe(BACKOFF_MAX_MS);
    expect(backoffDelay(-3)).toBe(5000);
  });
});

describe('useSyncUi', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    h.status = 'synced';
    h.retrySync.mockClear();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    setStatus('synced');
  });

  it('goes syncing -> slow, retries with backoff, and clears once synced', async () => {
    const { result } = renderHook(() => useSyncUi());
    expect(result.current.state).toBe('synced');

    act(() => setStatus('pending'));
    expect(result.current.state).toBe('synced'); // grace period: no flash
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SYNCING_SHOW_AFTER_MS + 500);
    });
    expect(result.current.state).toBe('syncing');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SLOW_AFTER_MS);
    });
    expect(result.current.state).toBe('slow');
    expect(h.retrySync).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000); // first backoff
    });
    expect(h.retrySync).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(9000); // second backoff is 10 s: not yet
    });
    expect(h.retrySync).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(h.retrySync).toHaveBeenCalledTimes(2);

    act(() => setStatus('synced'));
    expect(result.current.state).toBe('synced');
    const calls = h.retrySync.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });
    expect(h.retrySync.mock.calls.length).toBe(calls); // retries stop when settled
  });

  it('retries at once when the browser comes back online, and on manual retry', () => {
    const { result } = renderHook(() => useSyncUi());
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(h.retrySync).toHaveBeenCalledTimes(1);
    act(() => result.current.retry());
    expect(h.retrySync).toHaveBeenCalledTimes(2);
  });

  it('reports offline calmly without scheduling retries', async () => {
    const { result } = renderHook(() => useSyncUi());
    act(() => setStatus('offline'));
    expect(result.current.state).toBe('offline');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });
    expect(h.retrySync).not.toHaveBeenCalled();
  });
});
