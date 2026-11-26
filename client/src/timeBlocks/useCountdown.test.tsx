import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const played: string[] = [];
vi.mock('./blockAudio', () => ({ playCue: (k: string) => played.push(k) }));
import { useCountdown } from './useCountdown';

const prefs = { sound: true, vibrate: true };
beforeEach(() => {
  vi.useFakeTimers();
  played.length = 0;
});
afterEach(() => vi.useRealTimers());

describe('useCountdown', () => {
  it('counts 5 to GO, one cue per second, starts the block once and closes after the GO beat', () => {
    const onStart = vi.fn();
    const onClose = vi.fn();
    const { result } = renderHook(() =>
      useCountdown({ prefs, onStart, onClose, now: () => Date.now() }),
    );
    expect(result.current.n).toBe(5);
    for (let s = 0; s < 5; s++) act(() => void vi.advanceTimersByTime(1000));
    expect(played).toEqual(['tick', 'tick', 'warn', 'warn', 'warn', 'go']);
    expect(result.current.go).toBe(true);
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(900));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('skip jumps to GO and starts the block exactly once', () => {
    const onStart = vi.fn();
    const { result } = renderHook(() => useCountdown({ prefs, onStart, onClose: vi.fn() }));
    act(() => result.current.skip());
    act(() => result.current.skip());
    act(() => void vi.advanceTimersByTime(300));
    expect(result.current.go).toBe(true);
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('unmounting during the countdown never starts the block', () => {
    const onStart = vi.fn();
    const { unmount } = renderHook(() => useCountdown({ prefs, onStart, onClose: vi.fn() }));
    act(() => void vi.advanceTimersByTime(2000));
    unmount();
    act(() => void vi.advanceTimersByTime(10000));
    expect(onStart).not.toHaveBeenCalled();
  });
});
