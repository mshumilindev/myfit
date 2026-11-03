import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAudioLevel } from './useAudioLevel';

let samples: number[] = [];
const made: FakeCtx[] = [];
let resumeFails = false;
let closeFails = false;

class FakeCtx {
  closed = false;
  disconnected = false;
  constructor() {
    made.push(this);
  }
  resume() {
    return resumeFails ? Promise.reject(new Error('no')) : Promise.resolve();
  }
  close() {
    this.closed = true;
    return closeFails ? Promise.reject(new Error('no')) : Promise.resolve();
  }
  createMediaStreamSource() {
    return {
      connect: vi.fn(),
      disconnect: () => {
        this.disconnected = true;
      },
    };
  }
  createAnalyser() {
    return {
      fftSize: 0,
      getByteTimeDomainData: (b: Uint8Array) => {
        const amp = samples.shift() ?? 0;
        b.forEach((_, i) => (b[i] = 128 + (i % 2 ? amp : -amp)));
      },
    };
  }
}

const stream = (audio: number) =>
  ({ getAudioTracks: () => Array.from({ length: audio }, () => ({})) }) as unknown as MediaStream;

beforeEach(() => {
  vi.useFakeTimers();
  samples = [];
  made.length = 0;
  resumeFails = false;
  closeFails = false;
  vi.stubGlobal('AudioContext', FakeCtx);
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useAudioLevel', () => {
  it('is 0 without a stream, inactive, or without audio tracks, and builds no context', () => {
    const s = stream(1);
    expect(renderHook(() => useAudioLevel(null)).result.current).toBe(0);
    expect(renderHook(() => useAudioLevel(undefined)).result.current).toBe(0);
    expect(renderHook(() => useAudioLevel(s, false)).result.current).toBe(0);
    expect(renderHook(() => useAudioLevel(stream(0))).result.current).toBe(0);
    expect(made).toHaveLength(0);
  });

  it('does nothing where AudioContext does not exist', () => {
    vi.stubGlobal('AudioContext', undefined);
    const { result } = renderHook(() => useAudioLevel(stream(1)));
    act(() => void vi.advanceTimersByTime(200));
    expect(result.current).toBe(0);
    expect(made).toHaveLength(0);
  });

  it('measures every 50 ms, holds a peak and lets it fall by the decay', () => {
    samples = [100, 0, 0];
    const s = stream(1);
    const { result } = renderHook(() => useAudioLevel(s));
    expect(made).toHaveLength(1);
    act(() => void vi.advanceTimersByTime(50));
    const peak = result.current;
    expect(peak).toBeGreaterThan(0.5);
    act(() => void vi.advanceTimersByTime(50));
    expect(result.current).toBeCloseTo(peak * 0.85, 5);
    act(() => void vi.advanceTimersByTime(50));
    expect(result.current).toBeCloseTo(peak * 0.85 * 0.85, 5);
  });

  it('a muted sink element consumes the stream, and play() failing is tolerated', () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(new Error('x'));
    const s = stream(1);
    renderHook(() => useAudioLevel(s));
    expect(play).toHaveBeenCalled();
  });

  it('a synchronously throwing play() is tolerated too', () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => {
      throw new Error('not implemented');
    });
    expect(() => renderHook(() => useAudioLevel(stream(1)))).not.toThrow();
    expect(made).toHaveLength(1);
  });

  it('a failing resume() or close() never surfaces', async () => {
    resumeFails = true;
    closeFails = true;
    const { unmount } = renderHook(() => useAudioLevel(stream(1)));
    unmount();
    await vi.advanceTimersByTimeAsync(0);
    expect(made[0].closed).toBe(true);
  });

  it('unmount stops the timer, disconnects and closes the context', () => {
    samples = [100, 100, 100];
    const s = stream(1);
    const { result, unmount } = renderHook(() => useAudioLevel(s));
    act(() => void vi.advanceTimersByTime(50));
    expect(result.current).toBeGreaterThan(0);
    unmount();
    expect(made[0].disconnected).toBe(true);
    expect(made[0].closed).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('turning inactive reads 0 again and tears the context down', () => {
    samples = [100, 100];
    const s = stream(1);
    const { result, rerender } = renderHook(({ on }) => useAudioLevel(s, on), {
      initialProps: { on: true },
    });
    act(() => void vi.advanceTimersByTime(50));
    expect(result.current).toBeGreaterThan(0);
    rerender({ on: false });
    expect(result.current).toBe(0);
    expect(made[0].closed).toBe(true);
  });
});
