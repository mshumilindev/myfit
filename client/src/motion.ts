/**
 * Motion budget — decides ONCE per device whether the ambient animations (the
 * slow "lava lamp" background, the twinkling night sky) may run, and keeps
 * watching afterwards. Nothing animates until the device has proven it can:
 *
 *  1. Hard no: prefers-reduced-motion, Save-Data, ≤2 GB memory, ≤2 CPU cores.
 *  2. Otherwise a short probe runs the REAL animation (`data-motion="probe"`)
 *     for ~1.6 s and reads the frame times; a steady ≥ ~40 fps passes.
 *  3. The verdict is remembered for a few days (localStorage), so later launches
 *     start in the right state without probing again.
 *  4. A light watchdog keeps sampling for the first minute; if the frame rate
 *     collapses (thermal throttling, battery saver, a busy screen) the
 *     animations are switched off for good until the verdict expires.
 *
 * `<html data-motion>` is `probe` | `full` | (absent = static). CSS keys off it;
 * canvases read it through `useMotionTier()`.
 */
import { useSyncExternalStore } from 'react';

export type MotionTier = 'pending' | 'full' | 'static';

const KEY = 'spotter.motion.v1';
const TTL_MS = 3 * 24 * 3600 * 1000;
const PROBE_MS = 1600;
const SKIP_FRAMES = 6;
/** Median frame gap (ms) that still counts as smooth (≈ 40 fps). */
export const SMOOTH_MS = 25;
/** Share of janky frames (> 50 ms) tolerated. */
const MAX_JANK = 0.1;

export interface FrameStats {
  median: number;
  jank: number;
}

/** Pure: summarise frame gaps (ms). */
export function frameStats(gaps: number[]): FrameStats {
  if (gaps.length === 0) return { median: Infinity, jank: 1 };
  const s = [...gaps].sort((a, b) => a - b);
  return {
    median: s[Math.floor(s.length / 2)],
    jank: gaps.filter((g) => g > 50).length / gaps.length,
  };
}

/** Pure: is this frame history smooth enough for ambient animation? */
export function isSmooth(gaps: number[]): boolean {
  if (gaps.length < 12) return false;
  const st = frameStats(gaps);
  return st.median <= SMOOTH_MS && st.jank <= MAX_JANK;
}

/** Pure: cheap hardware / preference vetoes. */
export function hardNo(env: {
  reducedMotion: boolean;
  saveData: boolean;
  deviceMemory?: number;
  cores?: number;
}): boolean {
  return (
    env.reducedMotion ||
    env.saveData ||
    (env.deviceMemory !== undefined && env.deviceMemory <= 2) ||
    (env.cores !== undefined && env.cores <= 2)
  );
}

let tier: MotionTier = 'pending';
const listeners = new Set<() => void>();
let started = false;

function set(next: MotionTier): void {
  tier = next;
  if (typeof document !== 'undefined') {
    if (next === 'full') document.documentElement.dataset.motion = 'full';
    else delete document.documentElement.dataset.motion;
  }
  for (const l of listeners) l();
}

function remember(t: 'full' | 'static'): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ t, at: Date.now() }));
  } catch {
    /* private mode: decide again next launch */
  }
}

function recall(): 'full' | 'static' | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { t: string; at: number } | null;
    if (v && Date.now() - v.at < TTL_MS && (v.t === 'full' || v.t === 'static')) return v.t;
  } catch {
    /* ignore */
  }
  return null;
}

/** Collect rAF gaps for `ms` (waits while the tab is hidden). */
function sampleFrames(ms: number): Promise<number[]> {
  return new Promise((resolve) => {
    const gaps: number[] = [];
    let last = 0;
    let t0 = 0;
    const tick = (now: number) => {
      if (document.hidden) {
        last = 0;
        t0 = 0;
        gaps.length = 0;
      } else {
        if (!t0) t0 = now;
        if (last) gaps.push(now - last);
        last = now;
        if (now - t0 >= ms) return resolve(gaps.slice(SKIP_FRAMES));
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/** Keep an eye on the frame rate for a minute after switching on. */
function watchdog(): void {
  const deadline = Date.now() + 60_000;
  let strikes = 0;
  const round = async () => {
    if (tier !== 'full' || Date.now() > deadline) return;
    const gaps = await sampleFrames(3000);
    if (tier !== 'full') return;
    if (frameStats(gaps).median > 45) strikes++;
    else strikes = 0;
    if (strikes >= 2) {
      remember('static');
      set('static');
      return;
    }
    window.setTimeout(round, 4000);
  };
  window.setTimeout(round, 4000);
}

/** Call once at startup. Safe to call again (no-op). */
export function initMotion(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  const reduced =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (
    hardNo({
      reducedMotion: reduced,
      saveData: !!nav.connection?.saveData,
      deviceMemory: nav.deviceMemory,
      cores: nav.hardwareConcurrency,
    })
  )
    return set('static');
  const known = recall();
  if (known === 'static') return set('static');
  if (known === 'full') {
    set('full');
    watchdog();
    return;
  }
  // Unknown device: probe with the real animation once the app has settled.
  const probe = async () => {
    document.documentElement.dataset.motion = 'probe';
    const gaps = await sampleFrames(PROBE_MS);
    const ok = isSmooth(gaps);
    remember(ok ? 'full' : 'static');
    set(ok ? 'full' : 'static');
    if (ok) watchdog();
  };
  const go = () => {
    const ric = (window as Window & { requestIdleCallback?: (cb: () => void) => void })
      .requestIdleCallback;
    if (ric) ric(() => void probe());
    else window.setTimeout(() => void probe(), 800);
  };
  if (document.readyState === 'complete') window.setTimeout(go, 600);
  else window.addEventListener('load', () => window.setTimeout(go, 600), { once: true });
}

/** Give up on animation from now on (a component measured it can't keep up). */
export function downgradeMotion(): void {
  if (tier === 'static') return;
  remember('static');
  set('static');
}

export function getMotionTier(): MotionTier {
  return tier;
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** React: `'full'` only once the device proved it can animate. */
export function useMotionTier(): MotionTier {
  return useSyncExternalStore(subscribe, getMotionTier, () => 'static' as MotionTier);
}
