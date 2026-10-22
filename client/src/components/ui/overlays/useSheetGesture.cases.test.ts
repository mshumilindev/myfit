import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSheetGesture } from './useSheetGesture';

// Default sheet height 400px, viewport 900px, no safe-area: full height = 900 - 0 - 8 = 892.
const DEFAULT_H = 400;
const FULL_H = 892;

function sheet(h = DEFAULT_H) {
  const el = document.createElement('div');
  el.getBoundingClientRect = () => ({ height: h }) as DOMRect;
  return { current: el };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 });
});
afterEach(() => {
  vi.useRealTimers();
});

/** Drag from y0 to y1 over `ms` milliseconds in two moves, then release. */
function drag(
  r: ReturnType<typeof renderHook<ReturnType<typeof useSheetGesture>, unknown>>,
  y0: number,
  y1: number,
  ms: number,
) {
  act(() => r.result.current.onGrabStart(y0));
  act(() => {
    vi.advanceTimersByTime(ms);
    r.result.current.onGrabMove(y1);
  });
  act(() => r.result.current.onGrabEnd());
}

describe('useSheetGesture', () => {
  it('starts idle in default mode', () => {
    const { result } = renderHook(() => useSheetGesture(sheet(), () => undefined));
    expect(result.current).toMatchObject({
      mode: 'default',
      heightPx: null,
      liveH: null,
      drag: 0,
      dragging: false,
      closing: false,
    });
  });

  it('ignores grab start when the sheet is not mounted and moves/ends without a grab', () => {
    const { result } = renderHook(() => useSheetGesture({ current: null }, () => undefined));
    act(() => result.current.onGrabStart(100));
    expect(result.current.dragging).toBe(false);
    act(() => result.current.onGrabMove(50));
    act(() => result.current.onGrabEnd());
    expect(result.current.liveH).toBeNull();
    expect(result.current.mode).toBe('default');
  });

  it('dragging up grows the height live', () => {
    const r = renderHook(() => useSheetGesture(sheet(), () => undefined));
    act(() => r.result.current.onGrabStart(500));
    expect(r.result.current.dragging).toBe(true);
    act(() => {
      vi.advanceTimersByTime(100);
      r.result.current.onGrabMove(400); // up 100px
    });
    expect(r.result.current.liveH).toBe(500);
    expect(r.result.current.drag).toBe(0);
  });

  it('rubber-bands past the full height', () => {
    const r = renderHook(() => useSheetGesture(sheet(), () => undefined));
    act(() => r.result.current.onGrabStart(800));
    act(() => {
      vi.advanceTimersByTime(100);
      r.result.current.onGrabMove(0); // rawH = 400 + 800 = 1200
    });
    expect(r.result.current.liveH).toBeCloseTo(FULL_H + (1200 - FULL_H) * 0.3, 5);
  });

  it('dragging down below the default pins the height and slides the sheet', () => {
    const r = renderHook(() => useSheetGesture(sheet(), () => undefined));
    act(() => r.result.current.onGrabStart(500));
    act(() => {
      vi.advanceTimersByTime(100);
      r.result.current.onGrabMove(560); // down 60px
    });
    expect(r.result.current.liveH).toBe(DEFAULT_H);
    expect(r.result.current.drag).toBe(60);
  });

  it('snaps to full when released past the midpoint', () => {
    const r = renderHook(() => useSheetGesture(sheet(), () => undefined));
    drag(r, 800, 200, 1000); // rawH = 1000 > (400+892)/2=646, slow -> no flick
    expect(r.result.current).toMatchObject({
      mode: 'full',
      heightPx: FULL_H,
      dragging: false,
      liveH: null,
      drag: 0,
    });
  });

  it('snaps back to default when released before the midpoint', () => {
    const r = renderHook(() => useSheetGesture(sheet(), () => undefined));
    drag(r, 500, 400, 1000); // rawH 500 < 646
    expect(r.result.current).toMatchObject({ mode: 'default', heightPx: DEFAULT_H });
  });

  it('a quick upward flick goes full even from a short drag', () => {
    const r = renderHook(() => useSheetGesture(sheet(), () => undefined));
    drag(r, 500, 470, 10); // 30px in 10ms = -3 px/ms
    expect(r.result.current.mode).toBe('full');
  });

  it('a short downward pull springs back to default', () => {
    const onClose = vi.fn();
    const r = renderHook(() => useSheetGesture(sheet(), onClose));
    drag(r, 500, 550, 1000); // 50px, slow
    expect(r.result.current).toMatchObject({
      mode: 'default',
      heightPx: DEFAULT_H,
      drag: 0,
      closing: false,
    });
    act(() => void vi.advanceTimersByTime(500));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes after the slide when pulled down more than 100px', () => {
    const onClose = vi.fn();
    const r = renderHook(() => useSheetGesture(sheet(), onClose));
    drag(r, 500, 650, 1000);
    expect(r.result.current.closing).toBe(true);
    act(() => void vi.advanceTimersByTime(239));
    expect(onClose).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(1));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on a downward flick even for a small pull', () => {
    const onClose = vi.fn();
    const r = renderHook(() => useSheetGesture(sheet(), onClose));
    drag(r, 500, 540, 20); // 2 px/ms down
    expect(r.result.current.closing).toBe(true);
    act(() => void vi.advanceTimersByTime(240));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('requestClose is idempotent: one onClose however many times it is called', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useSheetGesture(sheet(), onClose));
    act(() => result.current.requestClose());
    act(() => result.current.requestClose());
    act(() => void vi.advanceTimersByTime(1000));
    expect(result.current.closing).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shrinks from full before it starts to slide away', () => {
    const el = sheet(DEFAULT_H);
    const r = renderHook(() => useSheetGesture(el, () => undefined));
    drag(r, 800, 200, 1000); // go full; defaultH remembered = 400
    expect(r.result.current.mode).toBe('full');
    (el.current as HTMLElement).getBoundingClientRect = () => ({ height: FULL_H }) as DOMRect;
    act(() => r.result.current.onGrabStart(100));
    act(() => {
      vi.advanceTimersByTime(1000);
      r.result.current.onGrabMove(300); // rawH = 892 - 200 = 692 >= 400 -> still the height zone
    });
    expect(r.result.current.liveH).toBe(692);
    expect(r.result.current.drag).toBe(0);
    act(() => {
      vi.advanceTimersByTime(1000);
      r.result.current.onGrabMove(700); // rawH = 292 < 400 -> dismiss zone
    });
    expect(r.result.current.liveH).toBe(DEFAULT_H);
    expect(r.result.current.drag).toBe(108);
  });

  it('leaves the DOM clean: the safe-area probe is removed', () => {
    const r = renderHook(() => useSheetGesture(sheet(), () => undefined));
    act(() => r.result.current.onGrabStart(100));
    expect(document.body.querySelectorAll('div[style*="visibility:hidden"]')).toHaveLength(0);
  });
});
