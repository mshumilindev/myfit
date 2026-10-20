import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { holdOffscreenMotion, SCROLL_IDLE_MS } from './holdOffscreenMotion';

type Cb = (entries: Partial<IntersectionObserverEntry>[]) => void;
let cb: Cb;
let disconnect = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  disconnect = vi.fn();
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(c: Cb) {
        cb = c;
      }
      observe() {}
      disconnect = disconnect;
    },
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function build() {
  const scroller = document.createElement('div');
  const secs = ['a', 'b'].map((id) => {
    const s = document.createElement('section');
    s.id = `s-${id}`;
    s.innerHTML = '<svg></svg>';
    const svg = s.querySelector('svg') as unknown as {
      pauseAnimations: () => void;
      unpauseAnimations: () => void;
    };
    svg.pauseAnimations = vi.fn();
    svg.unpauseAnimations = vi.fn();
    scroller.append(s);
    return s;
  });
  return {
    scroller,
    secs,
    svg: (i: number) => secs[i].querySelector('svg') as unknown as SVGSVGElement,
  };
}
const show = (el: Element, on: boolean) =>
  cb([{ target: el, isIntersecting: on, intersectionRatio: on ? 0.5 : 0 }]);

describe('holdOffscreenMotion', () => {
  it('starts with every screen idle, runs only the visible one', () => {
    const { scroller, secs } = build();
    holdOffscreenMotion(scroller, secs);
    expect(secs.every((s) => s.classList.contains('l-idle'))).toBe(true);
    show(secs[0], true);
    expect(secs[0].classList.contains('l-idle')).toBe(false);
    expect(secs[1].classList.contains('l-idle')).toBe(true);
    expect(svgCalls(secs[0]).unpause).toBe(1);
  });

  it('holds the visible screen still while scrolling and resumes after the quiet period', () => {
    const { scroller, secs } = build();
    holdOffscreenMotion(scroller, secs);
    show(secs[0], true);
    scroller.dispatchEvent(new Event('scroll'));
    expect(secs[0].classList.contains('l-idle')).toBe(true);
    // more scroll events keep it held and push the resume back
    vi.advanceTimersByTime(SCROLL_IDLE_MS - 10);
    scroller.dispatchEvent(new Event('scroll'));
    vi.advanceTimersByTime(SCROLL_IDLE_MS - 10);
    expect(secs[0].classList.contains('l-idle')).toBe(true);
    vi.advanceTimersByTime(20);
    expect(secs[0].classList.contains('l-idle')).toBe(false);
    expect(secs[1].classList.contains('l-idle')).toBe(true);
  });

  it('a screen that becomes visible mid-scroll stays held until the scroll ends', () => {
    const { scroller, secs } = build();
    holdOffscreenMotion(scroller, secs);
    scroller.dispatchEvent(new Event('scroll'));
    show(secs[1], true);
    expect(secs[1].classList.contains('l-idle')).toBe(true);
    vi.advanceTimersByTime(SCROLL_IDLE_MS + 1);
    expect(secs[1].classList.contains('l-idle')).toBe(false);
  });

  it('touches the SVG animations only when a screen really changes state', () => {
    const { scroller, secs } = build();
    holdOffscreenMotion(scroller, secs);
    show(secs[0], true);
    show(secs[0], true);
    scroller.dispatchEvent(new Event('scroll'));
    scroller.dispatchEvent(new Event('scroll'));
    const c = svgCalls(secs[0]);
    expect(c.unpause).toBe(1);
    expect(c.pause).toBe(2); // initial idle + the scroll hold
  });

  it('cleanup disconnects the observer and stops reacting to scroll', () => {
    const { scroller, secs } = build();
    const stop = holdOffscreenMotion(scroller, secs);
    show(secs[0], true);
    stop();
    expect(disconnect).toHaveBeenCalled();
    scroller.dispatchEvent(new Event('scroll'));
    expect(secs[0].classList.contains('l-idle')).toBe(false);
  });

  it('is a no-op where IntersectionObserver does not exist', () => {
    vi.unstubAllGlobals();
    vi.stubGlobal('IntersectionObserver', undefined);
    const { scroller, secs } = build();
    expect(() => holdOffscreenMotion(scroller, secs)()).not.toThrow();
    expect(secs[0].classList.contains('l-idle')).toBe(false);
  });
});

function svgCalls(sec: Element) {
  const svg = sec.querySelector('svg') as unknown as {
    pauseAnimations: ReturnType<typeof vi.fn>;
    unpauseAnimations: ReturnType<typeof vi.fn>;
  };
  return {
    pause: svg.pauseAnimations.mock.calls.length,
    unpause: svg.unpauseAnimations.mock.calls.length,
  };
}
