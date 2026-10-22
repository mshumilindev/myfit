import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBackButtonEdgeSwipe, useEdgeSwipeBack } from './edgeSwipeBack';

function touch(type: string, x: number, y = 300) {
  const t = { clientX: x, clientY: y, identifier: 1, target: document.body } as unknown as Touch;
  const e = new Event(type, { bubbles: true, cancelable: true }) as TouchEvent;
  Object.defineProperty(e, 'touches', { value: type === 'touchend' ? [] : [t] });
  Object.defineProperty(e, 'changedTouches', { value: [t] });
  document.body.dispatchEvent(e);
  return e;
}

function setup(interactive = true) {
  const over = document.createElement('div');
  const under = document.createElement('div');
  const scrim = document.createElement('div');
  const stage = document.createElement('div');
  const o = {
    enabled: true,
    interactive,
    onBack: vi.fn(),
    onSwipeStart: vi.fn(),
    onSwipeEnd: vi.fn(),
    stageRef: { current: stage },
    overRef: { current: over },
    underRef: { current: under },
    scrimRef: { current: scrim },
  };
  renderHook(() => useEdgeSwipeBack(o));
  return { o, over, under, scrim };
}

describe('useEdgeSwipeBack', () => {
  it('mounts the destination on touch-start, before any movement', () => {
    const { o } = setup();
    touch('touchstart', 6);
    expect(o.onSwipeStart).toHaveBeenCalledTimes(1);
  });

  it('only listens non-passively for touchmove during an edge gesture', () => {
    const add = vi.spyOn(window as Window, 'addEventListener');
    setup();
    expect(add.mock.calls.some((c) => String(c[0]) === 'touchmove')).toBe(false);
    touch('touchstart', 6);
    expect(add.mock.calls.some((c) => String(c[0]) === 'touchmove')).toBe(true);
    add.mockRestore();
  });

  // SPO-146: on iOS the system history swipe starts from the same left edge and slides a SNAPSHOT of the previous page
  // (Today a second time) while ours is already animating. Cancelling touchstart in that strip stops the system gesture.
  it('cancels the touchstart in the system-swipe strip so WebKit does not run its own back animation', () => {
    setup();
    expect(touch('touchstart', 6).defaultPrevented).toBe(true);
  });

  it('leaves touches beyond the system strip (and when disabled) alone', () => {
    setup();
    expect(touch('touchstart', 24).defaultPrevented).toBe(false);
    expect(touch('touchstart', 200).defaultPrevented).toBe(false);
  });

  it('listens to touchstart non-passively (a passive listener cannot cancel)', () => {
    const add = vi.spyOn(window as Window, 'addEventListener');
    setup();
    const call = add.mock.calls.find((c) => String(c[0]) === 'touchstart');
    expect((call?.[2] as AddEventListenerOptions | undefined)?.passive).toBe(false);
    add.mockRestore();
  });

  it('a touch away from the edge does nothing', () => {
    const { o } = setup();
    touch('touchstart', 200);
    expect(o.onSwipeStart).not.toHaveBeenCalled();
  });

  it('drops the pre-mounted destination when the gesture is not a back swipe', () => {
    const { o } = setup();
    touch('touchstart', 6);
    touch('touchmove', 8, 340); // vertical
    expect(o.onSwipeEnd).toHaveBeenCalledTimes(1);
    expect(o.onBack).not.toHaveBeenCalled();
  });

  it('a long drag moves the layers by transform and commits on release', async () => {
    vi.useFakeTimers();
    const { o, over, under, scrim } = setup();
    Object.defineProperty(window, 'innerWidth', { value: 400, configurable: true });
    touch('touchstart', 6);
    touch('touchmove', 40);
    touch('touchmove', 260);
    await vi.advanceTimersByTimeAsync(40);
    expect(over.style.transform).toContain('translate3d(');
    expect(Number(scrim.style.opacity)).toBeLessThan(0.12);
    touch('touchend', 260);
    expect(over.style.transition).toContain('transform');
    expect(o.onBack).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(500);
    expect(o.onBack).toHaveBeenCalledTimes(1);
    expect(o.onSwipeEnd).toHaveBeenCalledTimes(1);
    expect(over.style.transform).toBe('');
    expect(under.style.transform).toBe('');
    vi.useRealTimers();
  });

  it('a short slow drag springs back without going back', async () => {
    vi.useFakeTimers();
    const { o, over } = setup();
    Object.defineProperty(window, 'innerWidth', { value: 400, configurable: true });
    touch('touchstart', 6);
    touch('touchmove', 30);
    await vi.advanceTimersByTimeAsync(600);
    touch('touchmove', 50);
    await vi.advanceTimersByTimeAsync(600);
    touch('touchend', 50);
    await vi.advanceTimersByTimeAsync(500);
    expect(o.onBack).not.toHaveBeenCalled();
    expect(o.onSwipeEnd).toHaveBeenCalled();
    expect(over.style.transform).toBe('');
    vi.useRealTimers();
  });
});

describe('useBackButtonEdgeSwipe (Coach shell, SPO-146)', () => {
  function mount(withBack: boolean) {
    const main = document.createElement('main');
    main.className = 'co-main';
    const back = document.createElement('button');
    back.className = 'uiback';
    const click = vi.fn();
    back.addEventListener('click', click);
    if (withBack) main.appendChild(back);
    document.body.appendChild(main);
    const { unmount } = renderHook(() => useBackButtonEdgeSwipe(true));
    return { click, cleanup: () => (unmount(), main.remove()) };
  }

  it('cancels the system swipe at the edge and presses Back on a clear right swipe', () => {
    const { click, cleanup } = mount(true);
    expect(touch('touchstart', 6).defaultPrevented).toBe(true);
    touch('touchend', 140);
    expect(click).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it('does nothing on a screen without a Back button, a short drag or a vertical drag', () => {
    const none = mount(false);
    touch('touchstart', 6);
    touch('touchend', 140);
    expect(none.click).not.toHaveBeenCalled();
    none.cleanup();
    const { click, cleanup } = mount(true);
    touch('touchstart', 6);
    touch('touchend', 30);
    touch('touchstart', 6, 300);
    touch('touchend', 120, 400);
    expect(click).not.toHaveBeenCalled();
    cleanup();
  });
});
