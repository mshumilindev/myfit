/**
 * Cyberpunk app switch: the whole sub-app glitches out, stays glitching while the next one loads (the lazy chunk's
 * Suspense fallback holds it), then the new app plays a short settling tail. `html[data-glitch]` carries the phase
 * (`out` → `load` → `in`) and the Cyberpunk structure sheet draws it. Other themes and reduced motion switch at once.
 */
const OUT_MS = 220;
const TAIL_MS = 460;
const SAFETY_MS = 6000;

let timer: number | undefined;
let safety: number | undefined;
let holds = 0;

const root = () => document.documentElement;
const live = () =>
  root().dataset.theme === 'cyberpunk' &&
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function end() {
  window.clearTimeout(timer);
  window.clearTimeout(safety);
  delete root().dataset.glitch;
}

function tail() {
  root().dataset.glitch = 'in';
  window.clearTimeout(timer);
  timer = window.setTimeout(end, TAIL_MS);
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
  }, OUT_MS);
}

/** The loading screen of an app calls this while it is mounted: the glitch keeps running until it goes away. */
export function glitchHold() {
  holds += 1;
  if (root().dataset.glitch === 'in') root().dataset.glitch = 'load';
  return () => {
    holds = Math.max(0, holds - 1);
    if (holds === 0 && root().dataset.glitch === 'load') tail();
  };
}
