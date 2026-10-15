import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PR_CARD_MS, prCardDue, usePrMomentExpiry } from './prMoment';

// SPO-12: the record card goes away by itself after a fixed time, and a record that is gone never comes back.
describe('record card lifetime', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('is due for the fixed time, then not', () => {
    const m = { at: 1000 };
    expect(prCardDue(m, 1000 + PR_CARD_MS - 1)).toBe(true);
    expect(prCardDue(m, 1000 + PR_CARD_MS)).toBe(false);
    expect(prCardDue(null, 1000)).toBe(false);
  });

  it('clears itself when the time is up, even with no re-render ticking', () => {
    vi.setSystemTime(10_000);
    const clear = vi.fn();
    renderHook(() => usePrMomentExpiry({ at: 10_000 }, clear));
    vi.advanceTimersByTime(PR_CARD_MS - 1);
    expect(clear).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it('clears at once when the moment is already stale (reopened screen / throttled tab)', () => {
    vi.setSystemTime(100_000);
    const clear = vi.fn();
    renderHook(() => usePrMomentExpiry({ at: 100_000 - PR_CARD_MS - 5 }, clear));
    vi.advanceTimersByTime(0);
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it('a new record restarts the timer and the old one never fires', () => {
    vi.setSystemTime(0);
    const clear = vi.fn();
    const { rerender } = renderHook(({ m }) => usePrMomentExpiry(m, clear), {
      initialProps: { m: { at: 0 } as { at: number } | null },
    });
    vi.advanceTimersByTime(10_000);
    vi.setSystemTime(10_000);
    rerender({ m: { at: 10_000 } });
    vi.advanceTimersByTime(PR_CARD_MS - 1); // 24_999 total: the first record's time is long gone
    expect(clear).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(1));
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it('nothing to clear when there is no record', () => {
    const clear = vi.fn();
    renderHook(() => usePrMomentExpiry(null, clear));
    vi.advanceTimersByTime(PR_CARD_MS * 2);
    expect(clear).not.toHaveBeenCalled();
  });
});
