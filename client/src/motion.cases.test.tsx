import { act, cleanup, renderHook } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SMOOTH_MS, downgradeMotion, frameStats, hardNo, isSmooth, useMotionTier } from './motion';

type Motion = typeof import('./motion');

const KEY = 'spotter.motion.v2';
const T0 = new Date(2026, 5, 15, 12).getTime();

// A manual frame clock: rAF callbacks run only when `run` advances time.
let rafQueue: Array<(t: number) => void> = [];
let frameTs = 0;
const flush = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};
async function run(ms: number, gap = 16) {
  for (let t = 0; t < ms; t += gap) {
    await vi.advanceTimersByTimeAsync(gap);
    frameTs += gap;
    const cbs = rafQueue;
    rafQueue = [];
    for (const cb of cbs) cb(frameTs);
    await flush();
  }
}

function defineNav(k: string, v: unknown) {
  Object.defineProperty(navigator, k, { value: v, configurable: true });
}
function media(reduced: boolean) {
  window.matchMedia = ((q: string) => ({
    matches: reduced && q.includes('reduce'),
    media: q,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
}

async function fresh(): Promise<Motion> {
  vi.resetModules();
  return import('./motion');
}
const stored = () => JSON.parse(localStorage.getItem(KEY) ?? 'null');
const motionAttr = () => document.documentElement.dataset.motion;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.setSystemTime(T0);
  rafQueue = [];
  frameTs = 1000;
  vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => rafQueue.push(cb));
  defineNav('hardwareConcurrency', 8);
  defineNav('deviceMemory', 8);
  defineNav('connection', { saveData: false });
  media(false);
  localStorage.clear();
  delete document.documentElement.dataset.motion;
  window.history.replaceState(null, '', '/');
  Object.defineProperty(document, 'hidden', { value: false, configurable: true });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

describe('pure frame-rate rules', () => {
  it('frameStats: median of the sorted gaps and the share of frames over 50 ms', () => {
    expect(frameStats([30, 10, 20])).toEqual({ median: 20, jank: 0 });
    expect(frameStats([10, 20, 30, 40])).toEqual({ median: 30, jank: 0 });
    expect(frameStats([16, 16, 51, 50])).toEqual({ median: 50, jank: 0.25 });
    expect(frameStats([])).toEqual({ median: Infinity, jank: 1 });
  });

  it('smooth up to a 25 ms median, not beyond', () => {
    expect(SMOOTH_MS).toBe(25);
    expect(isSmooth(Array(20).fill(25))).toBe(true);
    expect(isSmooth(Array(20).fill(26))).toBe(false);
  });

  it('needs at least 12 frames of evidence', () => {
    expect(isSmooth(Array(11).fill(16))).toBe(false);
    expect(isSmooth(Array(12).fill(16))).toBe(true);
  });

  it('tolerates up to 10% janky frames (> 50 ms), not more', () => {
    const mix = (jank: number) => [...Array(20 - jank).fill(16), ...Array(jank).fill(51)];
    expect(isSmooth(mix(2))).toBe(true); // 10%
    expect(isSmooth(mix(3))).toBe(false); // 15%
    expect(isSmooth([...Array(19).fill(16), 50])).toBe(true); // exactly 50 ms is not jank
  });

  it('hardNo treats unknown hardware as capable and 3+ cores / > 2 GB as fine', () => {
    const base = { reducedMotion: false, saveData: false };
    expect(hardNo({ ...base, deviceMemory: undefined, cores: undefined })).toBe(false);
    expect(hardNo({ ...base, deviceMemory: 4, cores: 4 })).toBe(false);
    expect(hardNo({ ...base, deviceMemory: 2.5 })).toBe(false);
    expect(hardNo({ ...base, deviceMemory: 1 })).toBe(true);
    expect(hardNo({ ...base, cores: 3 })).toBe(false);
    expect(hardNo({ ...base, cores: 1 })).toBe(true);
  });
});

describe('initMotion: hard vetoes and overrides', () => {
  it.each([
    ['prefers-reduced-motion', () => media(true)],
    ['Save-Data', () => defineNav('connection', { saveData: true })],
    ['2 GB memory', () => defineNav('deviceMemory', 2)],
    ['2 CPU cores', () => defineNav('hardwareConcurrency', 2)],
  ])('%s -> static immediately, nothing remembered, no probe', async (_n, arrange) => {
    arrange();
    const m = await fresh();
    m.initMotion();
    expect(m.getMotionTier()).toBe('static');
    expect(motionAttr()).toBeUndefined();
    await run(5000);
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(rafQueue).toHaveLength(0);
  });

  it('a veto beats the ?motion=on override', async () => {
    media(true);
    window.history.replaceState(null, '', '/?motion=on');
    const m = await fresh();
    m.initMotion();
    expect(m.getMotionTier()).toBe('static');
  });

  it('?motion=on forces full, ?motion=off forces static, without writing a verdict', async () => {
    window.history.replaceState(null, '', '/?motion=on');
    const on = await fresh();
    on.initMotion();
    expect(on.getMotionTier()).toBe('full');
    expect(motionAttr()).toBe('full');
    window.history.replaceState(null, '', '/?motion=off');
    const off = await fresh();
    off.initMotion();
    expect(off.getMotionTier()).toBe('static');
    expect(motionAttr()).toBeUndefined();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('is idempotent: a second call does not re-decide', async () => {
    window.history.replaceState(null, '', '/?motion=on');
    const m = await fresh();
    m.initMotion();
    window.history.replaceState(null, '', '/?motion=off');
    m.initMotion();
    expect(m.getMotionTier()).toBe('full');
  });

  it('stays pending until the device is judged', async () => {
    const m = await fresh();
    expect(m.getMotionTier()).toBe('pending');
  });
});

describe('initMotion: remembered verdict', () => {
  const put = (v: unknown) => localStorage.setItem(KEY, JSON.stringify(v));

  it('a fresh static verdict is honoured without probing', async () => {
    put({ t: 'static', at: T0 - 60_000, ttl: 20 * 60_000 });
    const m = await fresh();
    m.initMotion();
    expect(m.getMotionTier()).toBe('static');
    await run(3000);
    expect(rafQueue).toHaveLength(0);
  });

  it('a static verdict expires after its own ttl (20 min), then the device is probed again', async () => {
    put({ t: 'static', at: T0 - 20 * 60_000 - 1, ttl: 20 * 60_000 });
    const m = await fresh();
    m.initMotion();
    expect(m.getMotionTier()).toBe('pending');
    await run(2000);
    expect(motionAttr()).toBe('probe');
  });

  it('a full verdict without ttl lasts 3 days, not longer', async () => {
    put({ t: 'full', at: T0 - 3 * 86_400_000 + 1000 });
    const a = await fresh();
    a.initMotion();
    expect(a.getMotionTier()).toBe('full');
    expect(motionAttr()).toBe('full');
    put({ t: 'full', at: T0 - 3 * 86_400_000 - 1 });
    delete document.documentElement.dataset.motion;
    const b = await fresh();
    b.initMotion();
    expect(b.getMotionTier()).toBe('pending');
  });

  it.each([
    ['garbage', '{nope'],
    ['unknown tier', JSON.stringify({ t: 'maybe', at: T0 })],
  ])('ignores a %s verdict and probes', async (_n, raw) => {
    localStorage.setItem(KEY, raw);
    const m = await fresh();
    m.initMotion();
    expect(m.getMotionTier()).toBe('pending');
    await run(2000);
    expect(motionAttr()).toBe('probe');
  });
});

describe('initMotion: probe', () => {
  it('a steady 60 fps device passes: full, remembered for 3 days with the reading', async () => {
    const m = await fresh();
    m.initMotion();
    await run(1400 + 600 + 800 - 50, 16); // not yet: probe has not finished sampling
    expect(m.getMotionTier()).toBe('pending');
    expect(motionAttr()).toBe('probe');
    await run(1500, 16);
    expect(m.getMotionTier()).toBe('full');
    expect(motionAttr()).toBe('full');
    const v = stored();
    expect(v).toMatchObject({ t: 'full', ttl: 3 * 86_400_000 });
    expect(v.probe.median).toBe(16);
    expect(v.probe.jank).toBe(0);
  });

  it('a 20 fps device fails all three tries: static, remembered only for 20 minutes', async () => {
    const m = await fresh();
    m.initMotion();
    await run(20_000, 50);
    expect(m.getMotionTier()).toBe('static');
    expect(motionAttr()).toBeUndefined();
    expect(stored()).toMatchObject({ t: 'static', ttl: 20 * 60_000 });
    expect(stored().probe.median).toBe(50);
  });

  it('a busy first try is forgiven when a later try is smooth (best of three)', async () => {
    const m = await fresh();
    m.initMotion();
    await run(3000, 50); // first try: slow
    expect(m.getMotionTier()).toBe('pending');
    await run(6000, 16); // later try: smooth
    expect(m.getMotionTier()).toBe('full');
    expect(stored().t).toBe('full');
  });

  it('waits while the tab is hidden and ignores frames from the hidden period', async () => {
    const m = await fresh();
    m.initMotion();
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    await run(6000, 100); // slow frames while hidden must not count against the device
    expect(m.getMotionTier()).toBe('pending');
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    await run(4000, 16);
    expect(m.getMotionTier()).toBe('full');
  });

  it('starts from requestIdleCallback when the browser has it', async () => {
    const ric = vi.fn((cb: () => void) => cb());
    vi.stubGlobal('requestIdleCallback', ric);
    Object.defineProperty(window, 'requestIdleCallback', { value: ric, configurable: true });
    const m = await fresh();
    m.initMotion();
    await run(700, 100);
    expect(ric).toHaveBeenCalledTimes(1);
    expect(motionAttr()).toBe('probe');
    delete (window as { requestIdleCallback?: unknown }).requestIdleCallback;
  });

  it('before the page finished loading, waits for the load event', async () => {
    Object.defineProperty(document, 'readyState', { value: 'loading', configurable: true });
    const m = await fresh();
    m.initMotion();
    await run(3000, 100);
    expect(motionAttr()).toBeUndefined(); // no probe yet
    window.dispatchEvent(new Event('load'));
    await run(2000, 100);
    expect(motionAttr()).toBe('probe');
    Object.defineProperty(document, 'readyState', { value: 'complete', configurable: true });
  });

  it('works when localStorage refuses writes (private mode)', async () => {
    const m = await fresh();
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    m.initMotion();
    await run(4000, 16);
    expect(m.getMotionTier()).toBe('full');
    set.mockRestore();
  });
});

describe('watchdog', () => {
  const full = async () => {
    window.history.replaceState(null, '', '/');
    localStorage.setItem(KEY, JSON.stringify({ t: 'full', at: T0, ttl: 3 * 86_400_000 }));
    const m = await fresh();
    m.initMotion();
    return m;
  };

  it('two slow rounds in a row switch the animation off for 20 minutes', async () => {
    const m = await full();
    await run(3900, 60);
    expect(m.getMotionTier()).toBe('full');
    await run(20_000, 60);
    expect(m.getMotionTier()).toBe('static');
    expect(motionAttr()).toBeUndefined();
    expect(stored()).toMatchObject({ t: 'static', ttl: 20 * 60_000 });
  });

  it('one slow round followed by a fast one resets the strike count', async () => {
    const m = await full();
    await run(4000 + 3200, 60); // round 1 slow (strike 1)
    await run(4000 + 3200 + 3200, 16); // round 2 fast
    await run(4000 + 3200, 60); // round 3 slow again (strike 1, not 2)
    expect(m.getMotionTier()).toBe('full');
  });

  it('stops watching after a minute and stays on', async () => {
    const m = await full();
    await run(75_000, 16);
    expect(m.getMotionTier()).toBe('full');
    const before = rafQueue.length;
    await run(20_000, 16);
    expect(rafQueue.length).toBe(before);
  });

  it('a downgrade from elsewhere ends the watch quietly', async () => {
    const m = await full();
    await run(4500, 16); // inside a sampling round
    m.downgradeMotion();
    await run(10_000, 16);
    expect(m.getMotionTier()).toBe('static');
  });
});

describe('downgradeMotion', () => {
  it('from full: static, attribute removed, remembered 20 minutes', async () => {
    window.history.replaceState(null, '', '/?motion=on');
    const m = await fresh();
    m.initMotion();
    expect(motionAttr()).toBe('full');
    m.downgradeMotion();
    expect(m.getMotionTier()).toBe('static');
    expect(motionAttr()).toBeUndefined();
    expect(stored()).toMatchObject({ t: 'static', ttl: 20 * 60_000, at: T0 });
  });

  it('from pending also gives up; a second call changes nothing', async () => {
    const m = await fresh();
    m.downgradeMotion();
    expect(m.getMotionTier()).toBe('static');
    localStorage.clear();
    m.downgradeMotion();
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});

describe('useMotionTier', () => {
  it('is pending, then re-renders as static when a component gives up on animation', () => {
    const { result } = renderHook(() => useMotionTier());
    expect(result.current).toBe('pending');
    act(() => downgradeMotion());
    expect(result.current).toBe('static');
    expect(stored()).toMatchObject({ t: 'static' });
  });

  it('renders static on the server', async () => {
    const m = await fresh();
    const server = renderToString(createElement(() => createElement('i', null, m.useMotionTier())));
    expect(server).toContain('static');
  });
});
