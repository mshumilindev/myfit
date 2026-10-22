import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';

const h = vi.hoisted(() => ({
  record: vi.fn(),
  flush: vi.fn(),
  pending: [] as string[],
}));
vi.mock('../api', () => ({ currentUid: () => 'u1' }));
vi.mock('../i18n', () => ({ getLocale: () => 'en' }));
vi.mock('./signupConsents', () => ({
  recordGateConsents: h.record,
  flushPendingConsents: h.flush,
  pendingConsentKinds: () => h.pending,
}));

import { useGateRecorder } from './gateRecorder';

const BASE = { base: true, trainer: false };

beforeEach(() => {
  vi.useFakeTimers();
  h.record.mockReset().mockResolvedValue(true);
  h.flush.mockReset().mockResolvedValue(undefined);
  h.pending = [];
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useGateRecorder', () => {
  it('is done as soon as the server has the grants (nothing left in the queue)', async () => {
    const onDone = vi.fn();
    const { result } = renderHook(() => useGateRecorder(BASE, false, onDone));
    expect(result.current.state).toBe('idle');
    await act(async () => result.current.start());
    expect(result.current.state).toBe('done');
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(h.record).toHaveBeenCalledTimes(1);
  });

  it('waits while the grants are still queued (offline), retries, and finishes once sent', async () => {
    h.pending = ['terms', 'policy-ack', 'age-18'];
    const onDone = vi.fn();
    const { result } = renderHook(() => useGateRecorder(BASE, false, onDone));
    await act(async () => result.current.start());
    expect(result.current.state).toBe('waiting');
    expect(onDone).not.toHaveBeenCalled();
    h.pending = [];
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4100);
    });
    expect(h.flush).toHaveBeenCalled();
    expect(result.current.state).toBe('done');
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('retries a refusal twice by itself, then fails with a button and never calls onDone', async () => {
    h.record.mockResolvedValue(false);
    const onDone = vi.fn();
    const { result } = renderHook(() => useGateRecorder(BASE, false, onDone));
    await act(async () => {
      result.current.start();
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(h.record).toHaveBeenCalledTimes(3);
    expect(result.current.state).toBe('failed');
    expect(onDone).not.toHaveBeenCalled();
    // the button starts it again
    h.record.mockResolvedValue(true);
    await act(async () => result.current.start());
    expect(result.current.state).toBe('done');
  });

  it('waits for the trainer part too', async () => {
    h.pending = ['trainer-terms'];
    const { result } = renderHook(() =>
      useGateRecorder({ base: false, trainer: true }, false, vi.fn()),
    );
    await act(async () => result.current.start());
    expect(result.current.state).toBe('waiting');
  });

  it('preview records nothing', async () => {
    const onDone = vi.fn();
    const { result } = renderHook(() => useGateRecorder(BASE, true, onDone));
    await act(async () => {
      result.current.start();
      await vi.advanceTimersByTimeAsync(900);
    });
    expect(h.record).not.toHaveBeenCalled();
    expect(result.current.state).toBe('done');
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
