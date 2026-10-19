import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { __getStateForTests, __replaceStateForTests } from '../store';
import type { SleepNight, Workout } from '../types';

let tier: 'pending' | 'full' | 'static' = 'full';
const downgradeMotion = vi.fn();
vi.mock('../motion', () => ({
  useMotionTier: () => tier,
  downgradeMotion: () => downgradeMotion(),
}));

import { AppRoot, NightSky, SpotterSky } from './SpotterSky';

type Ctx = Record<string, ReturnType<typeof vi.fn>>;
const ctxs = new Map<HTMLCanvasElement, Ctx>();
let nullContext = false;

function makeCtx(): Ctx {
  const calls: Ctx = {};
  return new Proxy(calls, {
    get(t, k: string) {
      if (k === 'createLinearGradient' || k === 'createRadialGradient') {
        t[k] ??= vi.fn(() => ({ addColorStop: vi.fn() }));
      } else t[k] ??= vi.fn();
      return t[k];
    },
    set() {
      return true;
    },
  });
}
const mainCtx = (c: HTMLCanvasElement) => ctxs.get(c)!;

let rafQueue: Array<(t: number) => void> = [];
const raf = vi.fn((cb: (t: number) => void) => {
  rafQueue.push(cb);
  return rafQueue.length;
});
const caf = vi.fn();
/** Runs the next scheduled animation frame at the given timestamp. */
function tick(now: number) {
  const cb = rafQueue.shift();
  if (!cb) throw new Error('no frame scheduled');
  act(() => cb(now));
}

function setSize(w: number, h: number, dpr = 1) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: w });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: h });
  Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: dpr });
}
function setReducedMotion(on: boolean) {
  window.matchMedia = ((q: string) => ({ matches: on && q.includes('reduce'), media: q })) as never;
}
const sleeps = (n: number, live = false): SleepNight[] =>
  Array.from(
    { length: n },
    (_, i) =>
      ({
        id: `s${i}`,
        date: `2026-01-${i + 1}`,
        bedtime: 1,
        wake: live && i === 0 ? null : 2,
        source: 'backfill',
      }) as SleepNight,
  );
const state = (over: { workouts?: Workout[]; sleeps?: SleepNight[] }) =>
  __replaceStateForTests({
    ...__getStateForTests(),
    workouts: [],
    activities: [],
    sleeps: [],
    ...over,
  } as never);
const canvas = () => document.querySelector('canvas.spotter-sky') as HTMLCanvasElement;

let nowMs = 0;
beforeEach(() => {
  tier = 'full';
  nullContext = false;
  ctxs.clear();
  rafQueue = [];
  raf.mockClear();
  caf.mockClear();
  downgradeMotion.mockClear();
  nowMs = 0;
  setSize(320, 640, 1);
  setReducedMotion(false);
  state({});
  vi.stubGlobal('requestAnimationFrame', raf);
  vi.stubGlobal('cancelAnimationFrame', caf);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
    this: HTMLCanvasElement,
  ) {
    if (nullContext) return null;
    if (!ctxs.has(this)) ctxs.set(this, makeCtx());
    return ctxs.get(this) as never;
  } as never);
  vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
  vi.spyOn(Math, 'random').mockReturnValue(0.9);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('SpotterSky · setup', () => {
  it('renders an aria-hidden canvas sized to the window and clamps DPR to 2', () => {
    setSize(300, 500, 3);
    render(<SpotterSky />);
    const c = canvas();
    expect(c.getAttribute('aria-hidden')).toBe('true');
    expect(c.width).toBe(600);
    expect(c.height).toBe(1000);
    expect(c.style.width).toBe('300px');
    expect(c.style.height).toBe('500px');
    expect(mainCtx(c).setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
  });

  it('paints the galaxy once to an offscreen bitmap and blits it right away', () => {
    render(<SpotterSky />);
    const main = mainCtx(canvas());
    expect(main.drawImage).toHaveBeenCalledTimes(1);
    const [off] = main.drawImage.mock.calls[0];
    expect(off).toBeInstanceOf(HTMLCanvasElement);
    expect(off).not.toBe(canvas());
    expect(ctxs.get(off)!.createLinearGradient).toHaveBeenCalled(); // sky wash lives offscreen
    expect(ctxs.get(off)!.arc.mock.calls.length).toBeGreaterThan(100);
  });

  it('does nothing (and does not throw) when the 2d context is unavailable', () => {
    nullContext = true;
    expect(() => render(<SpotterSky />)).not.toThrow();
    expect(raf).not.toHaveBeenCalled();
  });

  it('a static tier draws the galaxy once, no twinkle layer and no animation loop', () => {
    tier = 'static';
    render(<SpotterSky />);
    expect(raf).not.toHaveBeenCalled();
    const main = mainCtx(canvas());
    expect(main.drawImage).toHaveBeenCalledTimes(1);
    expect(main.arc).not.toHaveBeenCalled();
  });

  it('the pending tier is also static', () => {
    tier = 'pending';
    render(<SpotterSky />);
    expect(raf).not.toHaveBeenCalled();
  });

  it('prefers-reduced-motion keeps even a full tier static', () => {
    setReducedMotion(true);
    render(<SpotterSky />);
    expect(raf).not.toHaveBeenCalled();
    expect(mainCtx(canvas()).arc).not.toHaveBeenCalled();
  });

  it('works without matchMedia at all', () => {
    // @ts-expect-error simulating an old browser
    window.matchMedia = undefined;
    render(<SpotterSky />);
    expect(raf).toHaveBeenCalledTimes(1);
  });

  it('richness grows with logged history: a busy sky is denser than a new one', () => {
    const count = () => {
      const [off] = mainCtx(canvas()).drawImage.mock.calls[0];
      return ctxs.get(off)!.arc.mock.calls.length;
    };
    state({});
    const a = render(<SpotterSky />);
    const sparse = count();
    a.unmount();
    ctxs.clear();
    state({ workouts: Array.from({ length: 200 }, (_, i) => ({ id: `w${i}` }) as Workout) });
    render(<SpotterSky />);
    expect(count()).toBeGreaterThan(sparse);
  });

  it('unfinished (live) nights do not add richness', () => {
    state({});
    const base = render(<SpotterSky />);
    const [o1] = mainCtx(canvas()).drawImage.mock.calls[0];
    const n1 = ctxs.get(o1)!.arc.mock.calls.length;
    base.unmount();
    ctxs.clear();
    state({ sleeps: sleeps(1, true) });
    render(<SpotterSky />);
    const [o2] = mainCtx(canvas()).drawImage.mock.calls[0];
    expect(ctxs.get(o2)!.arc.mock.calls.length).toBe(n1);
  });
});

describe('SpotterSky · animation loop', () => {
  it('twinkles the bright stars each frame, capped at ~30fps', () => {
    render(<SpotterSky />);
    const main = mainCtx(canvas());
    main.arc.mockClear();
    main.drawImage.mockClear();
    tick(100);
    expect(main.drawImage).toHaveBeenCalledTimes(1);
    const drawn = main.arc.mock.calls.length;
    expect(drawn).toBeGreaterThan(20);
    tick(110); // 10ms later: skipped
    expect(main.drawImage).toHaveBeenCalledTimes(1);
    tick(140); // 40ms after the last drawn frame
    expect(main.drawImage).toHaveBeenCalledTimes(2);
  });

  it('keeps scheduling frames but draws nothing while the tab is hidden', () => {
    render(<SpotterSky />);
    const main = mainCtx(canvas());
    main.drawImage.mockClear();
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    try {
      tick(100);
      expect(main.drawImage).not.toHaveBeenCalled();
      expect(rafQueue).toHaveLength(1);
    } finally {
      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    }
  });

  it('repaints immediately when the tab becomes visible again', () => {
    render(<SpotterSky />);
    const main = mainCtx(canvas());
    main.drawImage.mockClear();
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(main.drawImage).not.toHaveBeenCalled();
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(main.drawImage).toHaveBeenCalledTimes(1);
  });

  it('launches a shooting star after its delay and retires it once it leaves the screen', () => {
    render(<SpotterSky />);
    const main = mainCtx(canvas());
    tick(100);
    tick(1500); // random=0.9 => first shooting star is due at 1400 + 0.9 * 4200 = 5180ms
    expect(main.stroke).not.toHaveBeenCalled();
    let t = 5300;
    tick(t); // spawns and draws the first segment
    expect(main.stroke).toHaveBeenCalledTimes(1);
    let frames = 1;
    while (frames < 150) {
      const before = main.stroke.mock.calls.length;
      t += 40;
      tick(t);
      if (main.stroke.mock.calls.length === before) break;
      frames++;
    }
    // it crosses the 320px screen from the left edge and is then retired, well before its life ends
    expect(frames).toBeGreaterThan(20);
    expect(frames).toBeLessThan(60);
    // the next one only comes after the pause (>= 2600ms)
    const strokes = main.stroke.mock.calls.length;
    t += 1000;
    tick(t);
    expect(main.stroke.mock.calls.length).toBe(strokes);
  });

  it('a heavy renderer gives up animating: downgrade after 90 slow frames', () => {
    render(<SpotterSky />);
    // each performance.now() read advances 20ms => measured draw cost 20ms > 12ms budget
    (performance.now as ReturnType<typeof vi.fn>).mockImplementation(() => (nowMs += 20));
    let t = 100;
    for (let i = 0; i < 89; i++) {
      tick(t);
      t += 40;
    }
    expect(downgradeMotion).not.toHaveBeenCalled();
    tick(t);
    expect(downgradeMotion).toHaveBeenCalledTimes(1);
  });

  it('a collapsed frame rate (gaps > 70ms) also downgrades', () => {
    render(<SpotterSky />);
    let t = 100;
    for (let i = 0; i < 90; i++) {
      tick(t);
      t += 100;
    }
    expect(downgradeMotion).toHaveBeenCalledTimes(1);
  });

  it('a healthy 30fps never downgrades, even over several windows', () => {
    render(<SpotterSky />);
    let t = 100;
    for (let i = 0; i < 270; i++) {
      tick(t);
      t += 34;
    }
    expect(downgradeMotion).not.toHaveBeenCalled();
  });
});

describe('SpotterSky · resize & lifecycle', () => {
  it('debounces window resize (150ms) and then repaints at the new size', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    render(<SpotterSky />);
    expect(canvas().width).toBe(320);
    setSize(400, 800, 1);
    window.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('resize'));
    act(() => void vi.advanceTimersByTime(100));
    expect(canvas().width).toBe(320);
    act(() => void vi.advanceTimersByTime(60));
    expect(canvas().width).toBe(400);
    expect(canvas().height).toBe(800);
  });

  it('unmount cancels the frame loop and removes its listeners', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { unmount } = render(<SpotterSky />);
    const main = mainCtx(canvas());
    const c = canvas();
    unmount();
    expect(caf).toHaveBeenCalled();
    main.drawImage.mockClear();
    setSize(500, 900, 1);
    window.dispatchEvent(new Event('resize'));
    document.dispatchEvent(new Event('visibilitychange'));
    act(() => void vi.advanceTimersByTime(500));
    expect(main.drawImage).not.toHaveBeenCalled();
    expect(c.width).toBe(320);
  });

  it('switching tier full -> static stops the loop and drops the twinkle layer', () => {
    const { rerender } = render(<SpotterSky />);
    expect(rafQueue).toHaveLength(1);
    tier = 'static';
    rerender(<SpotterSky />);
    expect(caf).toHaveBeenCalled();
    const main = mainCtx(canvas());
    main.arc.mockClear();
    document.dispatchEvent(new Event('visibilitychange'));
    expect(main.arc).not.toHaveBeenCalled();
  });
});

describe('NightSky / AppRoot', () => {
  it('NightSky renders nothing without a live night and the sky while one runs', () => {
    state({ sleeps: sleeps(2) });
    const a = render(<NightSky />);
    expect(a.container.querySelector('canvas')).toBeNull();
    a.unmount();
    state({ sleeps: sleeps(2, true) });
    const b = render(<NightSky />);
    expect(b.container.querySelector('canvas.spotter-sky')).toBeTruthy();
  });

  it('AppRoot wraps its children in the app shell and adds the sky only at night', () => {
    state({});
    const a = render(
      <AppRoot>
        <main>content</main>
      </AppRoot>,
    );
    expect(a.container.querySelector('.app.app-apex-root main')?.textContent).toBe('content');
    expect(a.container.querySelector('canvas')).toBeNull();
    a.unmount();
    state({ sleeps: sleeps(1, true) });
    const b = render(
      <AppRoot>
        <main>content</main>
      </AppRoot>,
    );
    expect(b.container.querySelector('.app-apex-root canvas.spotter-sky')).toBeTruthy();
    expect(b.container.querySelector('main')?.textContent).toBe('content');
  });
});
