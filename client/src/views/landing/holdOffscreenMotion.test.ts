import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { holdOffscreenMotion } from './holdOffscreenMotion';

type Cb = (entries: Partial<IntersectionObserverEntry>[]) => void;
let cb: Cb;
let disconnect = vi.fn();

beforeEach(() => {
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
afterEach(() => vi.unstubAllGlobals());

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
  return { scroller, secs };
}
const show = (el: Element, on: boolean) =>
  cb([{ target: el, isIntersecting: on, intersectionRatio: on ? 0.5 : 0 }]);
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

describe('holdOffscreenMotion', () => {
  it('starts with every screen idle, runs only the visible one', () => {
    const { scroller, secs } = build();
    holdOffscreenMotion(scroller, secs);
    expect(secs.every((s) => s.classList.contains('l-idle'))).toBe(true);
    show(secs[0], true);
    expect(secs[0].classList.contains('l-idle')).toBe(false);
    expect(secs[1].classList.contains('l-idle')).toBe(true);
  });

  it('never pauses a visible screen because of scrolling', () => {
    const { scroller, secs } = build();
    holdOffscreenMotion(scroller, secs);
    show(secs[0], true);
    scroller.dispatchEvent(new Event('scroll'));
    expect(secs[0].classList.contains('l-idle')).toBe(false);
    expect(svgCalls(secs[0])).toEqual({ pause: 1, unpause: 1 });
  });

  it('a screen that scrolls out goes idle again, and back in resumes', () => {
    const { scroller, secs } = build();
    holdOffscreenMotion(scroller, secs);
    show(secs[0], true);
    show(secs[0], false);
    expect(secs[0].classList.contains('l-idle')).toBe(true);
    show(secs[0], true);
    expect(secs[0].classList.contains('l-idle')).toBe(false);
  });

  it('touches the SVG animations only when a screen really changes state', () => {
    const { scroller, secs } = build();
    holdOffscreenMotion(scroller, secs);
    show(secs[0], true);
    show(secs[0], true);
    expect(svgCalls(secs[0])).toEqual({ pause: 1, unpause: 1 });
  });

  it('cleanup disconnects the observer', () => {
    const { scroller, secs } = build();
    holdOffscreenMotion(scroller, secs)();
    expect(disconnect).toHaveBeenCalled();
  });

  it('is a no-op where IntersectionObserver does not exist', () => {
    vi.unstubAllGlobals();
    vi.stubGlobal('IntersectionObserver', undefined);
    const { scroller, secs } = build();
    expect(() => holdOffscreenMotion(scroller, secs)()).not.toThrow();
    expect(secs[0].classList.contains('l-idle')).toBe(false);
  });
});
