import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BACKEND_START_TIMEOUT_MS, useCoachBackendStatus } from './backend';
import { setCoachBackendMode } from '../__fixtures__/register';
import { HttpError } from '../../api';

const gate = vi.hoisted(() => ({ mode: 'hang' as 'hang' | 'deny' | 'missing' }));
vi.mock('./firestore/bootstrap', () => ({
  acquireBackend: vi.fn(
    () =>
      new Promise<() => void>((_res, rej) => {
        if (gate.mode === 'deny')
          rej(new HttpError(403, 'denied', { code: 'functions/permission-denied' }));
        if (gate.mode === 'missing') rej(new HttpError(404, 'nf', { code: 'functions/not-found' }));
      }),
  ),
}));

beforeEach(() => {
  vi.useFakeTimers();
  setCoachBackendMode('firestore');
});
afterEach(() => {
  vi.useRealTimers();
  setCoachBackendMode(null);
  gate.mode = 'hang';
});

describe('the first load of the real backend is bounded', () => {
  it('a setup that never finishes becomes `failed` / timeout after the bound, never an endless loading', async () => {
    const { result } = renderHook(() =>
      useCoachBackendStatus('trainer', true, { id: 'u1', name: 'T' }),
    );
    expect(result.current.status).toBe('loading');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(BACKEND_START_TIMEOUT_MS + 50);
    });
    expect(result.current.status).toBe('failed');
    expect(result.current.problem).toBe('timeout');
  });
  it('permission-denied and a missing service say which', async () => {
    gate.mode = 'deny';
    const a = renderHook(() => useCoachBackendStatus('client', true, { id: 'u1', name: '' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(a.result.current.problem).toBe('denied');
    gate.mode = 'missing';
    const b = renderHook(() => useCoachBackendStatus('client', true, { id: 'u2', name: '' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(b.result.current.problem).toBe('not-deployed');
  });
});
