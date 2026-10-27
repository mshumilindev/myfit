/**
 * App switch transition: the app you leave goes out, the screen holds while the next one loads (the lazy chunk's
 * Suspense fallback holds it), then the new app settles in. `html[data-glitch]` carries the phase (`out` → `load` →
 * `in`); each theme draws it its own way: Cyberpunk glitches (_cyberpunk.structure.css), Brass Glass pulls focus
 * (_switch.css). The timings are theme tokens (`--switch-out`, `--switch-tail`, ms, 0 = instant) required by the theme
 * contract. Reduced motion switches at once.
 */
const SAFETY_MS = 6000;

let timer: number | undefined;
let safety: number | undefined;
let holds = 0;
const releaseFns = new Set<() => void>();
/** True while a lazy screen's loading placeholder is mounted. */
export const isHolding = () => holds > 0;
/** Called whenever the last loading placeholder goes away. */
export function onHoldRelease(fn: () => void) {
  releaseFns.add(fn);
  return () => void releaseFns.delete(fn);
}

const root = () => document.documentElement;
const ms = (name: string) =>
  Number.parseFloat(getComputedStyle(root()).getPropertyValue(name)) || 0;
const live = () =>
  ms('--switch-out') > 0 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function end() {
  window.clearTimeout(timer);
  window.clearTimeout(safety);
  delete root().dataset.glitch;
}

function tail() {
  root().dataset.glitch = 'in';
  window.clearTimeout(timer);
  timer = window.setTimeout(end, ms('--switch-tail'));
}

/** Run `go` (the state change that opens the next app) between the glitch-out and the settling tail. */
export function glitchSwitch(go: () => void) {
  if (!live()) return go();
  window.clearTimeout(timer);
  root().dataset.glitch = 'out';
  window.clearTimeout(safety);
  safety = window.setTimeout(end, SAFETY_MS);
  timer = window.setTimeout(() => {
    go();
    // Let React mount the Suspense fallback (if the chunk is not loaded yet) before deciding to hold.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (!root().dataset.glitch) return;
        if (holds > 0) root().dataset.glitch = 'load';
        else tail();
      }),
    );
  }, ms('--switch-out'));
}

/** The loading screen of an app calls this while it is mounted: the glitch keeps running until it goes away. */
export function glitchHold() {
  holds += 1;
  if (root().dataset.glitch === 'in') root().dataset.glitch = 'load';
  return () => {
    holds = Math.max(0, holds - 1);
    if (holds === 0) for (const fn of [...releaseFns]) fn();
    if (holds === 0 && root().dataset.glitch === 'load') tail();
  };
}

/**
 * A theme change (SPO-355): the same transition as an app switch, drawn by the theme being switched TO. `go` puts
 * the new theme on `<html>` first, so every phase (`out` → `in`) is that theme's own; nothing has to load, so the
 * cover leaves as soon as `--switch-out` has run.
 */
export function glitchTheme(go: () => void) {
  go();
  if (!live()) return;
  window.clearTimeout(timer);
  root().dataset.glitch = 'out';
  window.clearTimeout(safety);
  safety = window.setTimeout(end, SAFETY_MS);
  timer = window.setTimeout(tail, ms('--switch-out'));
}
