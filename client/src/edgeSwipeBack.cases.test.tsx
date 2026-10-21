import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBackButtonEdgeSwipe, useEdgeSwipeBack } from './edgeSwipeBack';

type P = { x: number; y?: number };
interface Opts {
  touches?: P[];
  changed?: P[];
  target?: Element;
  cancelable?: boolean;
}
const mkTouch = (p: P) =>
  ({ clientX: p.x, clientY: p.y ?? 300, identifier: 1 }) as unknown as Touch;

function fire(type: string, o: Opts = {}) {
  const e = new Event(type, { bubbles: true, cancelable: o.cancelable ?? true }) as TouchEvent;
  const one = o.touches ?? o.changed ?? [];
  Object.defineProperty(e, 'touches', { value: (type === 'touchend' ? [] : one).map(mkTouch) });
  Object.defineProperty(e, 'changedTouches', { value: (o.changed ?? one).map(mkTouch) });
  (o.target ?? document.body).dispatchEvent(e);
  return e;
}
const start = (x: number, y = 300, o: Opts = {}) =>
  fire('touchstart', { touches: [{ x, y }], ...o });
const move = (x: number, y = 300, o: Opts = {}) => fire('touchmove', { touches: [{ x, y }], ...o });
const end = (x: number, y = 300) => fire('touchend', { changed: [{ x, y }] });

function setup(over: { interactive?: boolean; enabled?: boolean; layers?: boolean } = {}) {
  const els = {
    over: document.createElement('div'),
    under: document.createElement('div'),
    scrim: document.createElement('div'),
    stage: document.createElement('div'),
  };
  const withLayers = over.layers !== false;
  const o = {
    enabled: over.enabled ?? true,
    interactive: over.interactive ?? true,
    onBack: vi.fn(),
    onSwipeStart: vi.fn(),
    onSwipeEnd: vi.fn(),
    stageRef: { current: withLayers ? els.stage : null },
    overRef: { current: withLayers ? els.over : null },
    underRef: { current: withLayers ? els.under : null },
    scrimRef: { current: withLayers ? els.scrim : null },
  };
  const hook = renderHook(() => useEdgeSwipeBack(o));
  return { o, ...els, hook };
}

beforeEach(() => {
  vi.useFakeTimers({
    toFake: [
      'setTimeout',
      'clearTimeout',
      'Date',
      'performance',
      'requestAnimationFrame',
      'cancelAnimationFrame',
    ],
  });
  vi.setSystemTime(new Date(2026, 5, 15, 12));
  Object.defineProperty(window, 'innerWidth', { value: 400, configurable: true });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('useEdgeSwipeBack: where a gesture may start', () => {
  it('starts within 28 px of the edge only; cancels the native swipe up to 20 px', () => {
    const { o } = setup({ interactive: false });
    expect(start(20).defaultPrevented).toBe(true);
    expect(start(21).defaultPrevented).toBe(false);
    start(28);
    expect(end(28)).toBeDefined();
    start(29);
    start(200);
    // 29+ never began a gesture: a long swipe from there does not go back
    start(29);
    move(80);
    end(150);
    expect(o.onBack).not.toHaveBeenCalled();
  });

  it('a non-cancelable touchstart is not prevented', () => {
    setup({ interactive: false });
    expect(start(6, 300, { cancelable: false }).defaultPrevented).toBe(false);
  });

  it('ignores two-finger touches and controls that own the edge', () => {
    const { o } = setup();
    fire('touchstart', { touches: [{ x: 6 }, { x: 100 }] });
    expect(o.onSwipeStart).not.toHaveBeenCalled();
    for (const sel of ['button', 'a', 'input', '.tabbar', '.sheet', '[data-no-edge-swipe]']) {
      const host = document.createElement(sel.startsWith('.') || sel.startsWith('[') ? 'div' : sel);
      if (sel === '.tabbar') host.className = 'tabbar';
      if (sel === '.sheet') host.className = 'sheet';
      if (sel.startsWith('[')) host.setAttribute('data-no-edge-swipe', '');
      const child = document.createElement('span');
      host.appendChild(child);
      document.body.appendChild(host);
      start(6, 300, { target: child });
      host.remove();
    }
    expect(o.onSwipeStart).not.toHaveBeenCalled();
  });

  it('a disabled shell ignores the edge', () => {
    const off = setup({ enabled: false });
    start(6);
    move(40);
    end(200);
    expect(off.o.onSwipeStart).not.toHaveBeenCalled();
    expect(off.o.onBack).not.toHaveBeenCalled();
  });

  it('mounts the destination once per gesture', () => {
    const { o } = setup();
    start(6);
    start(6);
    expect(o.onSwipeStart).toHaveBeenCalledTimes(1);
  });

  it('non-interactive mode never mounts anything', () => {
    const { o } = setup({ interactive: false });
    start(6);
    move(60);
    end(120);
    expect(o.onSwipeStart).not.toHaveBeenCalled();
    expect(o.onSwipeEnd).not.toHaveBeenCalled();
  });
});

describe('useEdgeSwipeBack: plain threshold back (no overlay)', () => {
  const swipe = (dxEnd: number, o: { dyEnd?: number; wait?: number; locked?: boolean } = {}) => {
    const h = setup({ interactive: false });
    start(6, 300);
    if (o.locked !== false) move(6 + 40, 300 + (o.dyEnd ? 5 : 0));
    if (o.wait) vi.setSystemTime(Date.now() + o.wait);
    end(6 + dxEnd, 300 + (o.dyEnd ?? 0));
    return h.o.onBack;
  };

  it('a locked horizontal swipe goes back from exactly 72 px, not before', () => {
    expect(swipe(72)).toHaveBeenCalledTimes(1);
    expect(swipe(71, { wait: 400 })).not.toHaveBeenCalled();
  });

  it('too much vertical drift (> 52 px) is not a back swipe', () => {
    expect(swipe(120, { dyEnd: 52, wait: 400 })).toHaveBeenCalledTimes(1);
    expect(swipe(120, { dyEnd: 53, wait: 400 })).not.toHaveBeenCalled();
  });

  it('the swipe must be clearly more horizontal than vertical (x1.8)', () => {
    // dx 90, dy 50 -> 90 > 90 is false
    expect(swipe(90, { dyEnd: 50, wait: 400 })).not.toHaveBeenCalled();
    expect(swipe(92, { dyEnd: 50, wait: 400 })).toHaveBeenCalledTimes(1);
  });

  it('a quick flick (>= 52 px in < 280 ms) goes back without ever locking', () => {
    expect(swipe(52, { locked: false })).toHaveBeenCalledTimes(1);
    expect(swipe(51, { locked: false })).not.toHaveBeenCalled();
    expect(swipe(60, { locked: false, wait: 280 })).not.toHaveBeenCalled();
    expect(swipe(60, { locked: false, wait: 279 })).toHaveBeenCalledTimes(1);
  });

  it('a flick needs dx > 2x the vertical travel', () => {
    const h = setup({ interactive: false });
    start(6, 300);
    end(6 + 60, 330); // 60 > 60 is false
    expect(h.o.onBack).not.toHaveBeenCalled();
    start(6, 300);
    end(6 + 62, 330);
    expect(h.o.onBack).toHaveBeenCalledTimes(1);
  });

  it('the horizontal move is claimed (preventDefault) only after the lock, and only if cancelable', () => {
    setup({ interactive: false });
    start(6);
    expect(move(15).defaultPrevented).toBe(false); // 9 px: not locked yet
    expect(move(40).defaultPrevented).toBe(true); // 34 px: locked
    expect(move(50, 300, { cancelable: false }).defaultPrevented).toBe(false);
  });

  it('a mostly vertical start is a scroll: cancelled for the rest of the gesture', () => {
    const h = setup({ interactive: false });
    start(6, 300);
    move(10, 330);
    move(90, 330); // later horizontal movement is ignored
    end(120, 330);
    expect(h.o.onBack).not.toHaveBeenCalled();
  });

  it('moving back to the left (< -8 px) abandons the gesture', () => {
    const h = setup({ interactive: false });
    start(15);
    move(5);
    move(60);
    end(140);
    expect(h.o.onBack).not.toHaveBeenCalled();
  });

  it('a lone touchend, an empty touchend or a two-finger move do nothing', () => {
    const h = setup({ interactive: false });
    end(150);
    start(6);
    fire('touchmove', { touches: [{ x: 60 }, { x: 70 }] });
    fire('touchend', { changed: [] });
    expect(h.o.onBack).not.toHaveBeenCalled();
    end(200); // the gesture was released by the empty end
    expect(h.o.onBack).not.toHaveBeenCalled();
  });

  it('touchcancel abandons the gesture', () => {
    const h = setup({ interactive: false });
    start(6);
    move(40);
    fire('touchcancel');
    end(200);
    expect(h.o.onBack).not.toHaveBeenCalled();
  });

  it('removes its listeners on unmount', () => {
    const h = setup({ interactive: false });
    h.hook.unmount();
    start(6);
    move(40);
    end(200);
    expect(h.o.onBack).not.toHaveBeenCalled();
  });
});

describe('useEdgeSwipeBack: interactive reveal', () => {
  it('follows the finger with transforms on the layers and the scrim', async () => {
    const h = setup();
    start(6);
    move(30);
    move(206); // dx = 200 of width 400
    await vi.advanceTimersByTimeAsync(50);
    expect(h.over.style.willChange).toBe('transform');
    expect(h.over.style.transform).toBe('translate3d(200px,0,0)');
    expect(h.under.style.transform).toBe('translate3d(-50px,0,0)'); // (1 - 0.5) * 400 * 0.25
    expect(Number(h.scrim.style.opacity)).toBeCloseTo(0.06, 5);
  });

  it('a drag past half the width commits: slides out, then goes back once and cleans up', async () => {
    const h = setup();
    start(6);
    move(30);
    move(250);
    await vi.advanceTimersByTimeAsync(20);
    vi.setSystemTime(Date.now() + 2000);
    end(250);
    expect(h.over.style.transition).toMatch(/^transform \d+ms cubic-bezier/);
    expect(h.over.style.transform).toBe('translate3d(400px,0,0)');
    expect(h.o.onBack).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(400);
    expect(h.o.onBack).toHaveBeenCalledTimes(1);
    expect(h.o.onSwipeEnd).toHaveBeenCalledTimes(1);
    expect([h.over, h.under].map((e) => e.style.transform)).toEqual(['', '']);
    expect(h.over.style.willChange).toBe('');
    expect(h.scrim.style.opacity).toBe('');
  });

  it('transitionend finishes immediately and the safety timer does not repeat it', async () => {
    const h = setup();
    start(6);
    move(30);
    move(300);
    end(300);
    h.over.dispatchEvent(new Event('transitionend'));
    expect(h.o.onBack).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(h.o.onBack).toHaveBeenCalledTimes(1);
    expect(h.o.onSwipeEnd).toHaveBeenCalledTimes(1);
  });

  it('a quick flick commits even when short', async () => {
    const h = setup();
    start(6);
    await vi.advanceTimersByTimeAsync(10);
    move(60);
    await vi.advanceTimersByTimeAsync(10);
    move(110);
    end(110);
    await vi.advanceTimersByTimeAsync(400);
    expect(h.o.onBack).toHaveBeenCalledTimes(1);
  });

  it('a short, slow drag springs back: no back, destination unmounted, styles reset', async () => {
    const h = setup();
    start(6);
    move(30);
    await vi.advanceTimersByTimeAsync(600);
    move(60);
    await vi.advanceTimersByTimeAsync(600);
    end(60);
    expect(h.over.style.transform).toBe('translate3d(0px,0,0)');
    await vi.advanceTimersByTimeAsync(400);
    expect(h.o.onBack).not.toHaveBeenCalled();
    expect(h.o.onSwipeEnd).toHaveBeenCalledTimes(1);
    expect(h.over.style.transform).toBe('');
  });

  it('release duration follows distance and speed, between 140 and 320 ms', async () => {
    const dur = async (width: number, to: number, slowMs: number) => {
      Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
      const h = setup();
      start(6);
      move(30);
      await vi.advanceTimersByTimeAsync(slowMs);
      move(to + 6);
      await vi.advanceTimersByTimeAsync(slowMs);
      end(to + 6);
      const ms = Number(/(\d+)ms/.exec(h.over.style.transition)![1]);
      h.over.dispatchEvent(new Event('transitionend'));
      h.hook.unmount();
      return ms;
    };
    expect(await dur(400, 380, 600)).toBe(140); // 20 px left at 0.9 px/ms: clamped up
    expect(await dur(1000, 520, 600)).toBe(320); // 480 px left: clamped down
    expect(await dur(400, 210, 600)).toBe(211); // 190 px / 0.9 px/ms
  });

  it('touchcancel mid-gesture springs back without going back', async () => {
    const h = setup();
    start(6);
    move(30);
    move(250);
    fire('touchcancel');
    await vi.advanceTimersByTimeAsync(400);
    expect(h.o.onBack).not.toHaveBeenCalled();
    expect(h.o.onSwipeEnd).toHaveBeenCalledTimes(1);
    expect(h.over.style.transform).toBe('');
  });

  it('touchcancel before the lock just drops the pre-mounted destination', () => {
    const h = setup();
    start(6);
    fire('touchcancel');
    expect(h.o.onSwipeEnd).toHaveBeenCalledTimes(1);
  });

  it('a new gesture is ignored while the previous one is still animating out', async () => {
    const h = setup();
    start(6);
    move(30);
    move(300);
    end(300);
    start(6);
    expect(h.o.onSwipeStart).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(400);
    start(6);
    expect(h.o.onSwipeStart).toHaveBeenCalledTimes(2);
  });

  it('works without the layer elements mounted', async () => {
    const h = setup({ layers: false });
    start(6);
    move(30);
    move(300);
    await vi.advanceTimersByTimeAsync(20);
    end(300);
    await vi.advanceTimersByTimeAsync(400);
    expect(h.o.onBack).toHaveBeenCalledTimes(1);
  });

  it('unmounting mid-drag cancels the pending paint and detaches the move listener', async () => {
    const h = setup();
    const remove = vi.spyOn(window, 'removeEventListener');
    start(6);
    move(30);
    move(120);
    h.hook.unmount();
    expect(remove.mock.calls.some((c) => String(c[0]) === 'touchmove')).toBe(true);
    await vi.advanceTimersByTimeAsync(50);
    expect(h.over.style.transform).toBe(''); // the queued frame never ran
    remove.mockRestore();
  });
});

describe('useBackButtonEdgeSwipe', () => {
  function mount(enabled = true, scope?: string, host = 'co-main') {
    const main = document.createElement('main');
    main.className = host;
    const back = document.createElement('button');
    back.className = 'uiback';
    const click = vi.fn();
    back.addEventListener('click', click);
    main.appendChild(back);
    document.body.appendChild(main);
    const h = renderHook(() => useBackButtonEdgeSwipe(enabled, scope));
    return { click, ...h };
  }

  it('presses Back from exactly 72 px, not 71', () => {
    const { click } = mount();
    start(6);
    end(6 + 71);
    expect(click).not.toHaveBeenCalled();
    start(6);
    end(6 + 72);
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('respects the vertical limit (52 px) and the 1.8 dominance rule', () => {
    const { click } = mount();
    start(6, 300);
    end(6 + 200, 300 + 53);
    expect(click).not.toHaveBeenCalled();
    start(6, 300);
    end(6 + 90, 300 + 50); // 90 <= 90
    expect(click).not.toHaveBeenCalled();
    start(6, 300);
    end(6 + 91, 300 + 50);
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('only a touch that began at the edge counts, and a cancel forgets it', () => {
    const { click } = mount();
    start(100);
    end(300);
    start(29);
    end(300);
    start(6);
    fire('touchcancel');
    end(300);
    fire('touchend', { changed: [] });
    expect(click).not.toHaveBeenCalled();
  });

  it('ignores two-finger starts and excluded controls; a non-cancelable start is not prevented', () => {
    const { click } = mount();
    fire('touchstart', { touches: [{ x: 6 }, { x: 50 }] });
    end(300);
    const btn = document.createElement('button');
    document.body.appendChild(btn);
    start(6, 300, { target: btn });
    end(300);
    expect(click).not.toHaveBeenCalled();
    expect(start(6, 300, { cancelable: false }).defaultPrevented).toBe(false);
    expect(start(21).defaultPrevented).toBe(false);
    expect(start(20).defaultPrevented).toBe(true);
  });

  it('does nothing while disabled and detaches on unmount', () => {
    const off = mount(false);
    start(6);
    end(300);
    expect(off.click).not.toHaveBeenCalled();
    off.unmount();
    const on = mount(true);
    on.unmount();
    start(6);
    end(300);
    expect(on.click).not.toHaveBeenCalled();
  });

  it('looks for the Back button inside the given scope only', () => {
    const inCo = mount(true, '.co-main');
    start(6);
    end(300);
    expect(inCo.click).toHaveBeenCalledTimes(1);
    inCo.unmount();
    const other = mount(true, '.elsewhere');
    start(6);
    end(300);
    expect(other.click).not.toHaveBeenCalled();
  });
});
