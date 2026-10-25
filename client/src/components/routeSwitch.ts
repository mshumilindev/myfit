/**
 * Screen-to-screen transition inside an app (route change). The moment the route changes (`hashchange`) the old
 * screen is covered, so the new one never flashes: `html[data-route]` = `load` (covered; stays so while the next
 * screen's chunk loads, so the wait can be as long as it needs) → `in` (the cover leaves and the new screen shows).
 * The duration of `in` is the theme token `--route-tail` (ms, 0 = instant); the theme draws the phases on
 * `html[data-theme=<id>][data-route]` (tests/theme-switch.guard). The cover sits over the app's `<main>` only.
 * An app switch (appGlitch) in progress, or reduced motion, leaves the route change instant.
 */
import { currentHash } from '../route';
import { isHolding, onHoldRelease } from './appGlitch';

const SAFETY_MS = 6000;
let timer: number | undefined;
let safety: number | undefined;
let off: (() => void) | undefined;
let last = '';

const root = () => document.documentElement;
const tailMs = () =>
  Number.parseFloat(getComputedStyle(root()).getPropertyValue('--route-tail')) || 0;
const live = () =>
  !root().dataset.glitch &&
  tailMs() > 0 &&
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
/** The screen a route belongs to: the first two path segments (query and deeper params stay in the same screen). */
const screenOf = (h: string) => h.replace(/^#/, '').split('?')[0]!.split('/').slice(1, 3).join('/');

function end() {
  window.clearTimeout(timer);
  window.clearTimeout(safety);
  off?.();
  off = undefined;
  delete root().dataset.route;
}

function tail() {
  off?.();
  off = undefined;
  root().dataset.route = 'in';
  window.clearTimeout(timer);
  timer = window.setTimeout(end, tailMs());
}

function onRoute() {
  const now = screenOf(currentHash());
  if (now === last) return;
  last = now;
  if (!live() || root().dataset.route === 'load') return;
  const r = document.querySelector('main')?.getBoundingClientRect();
  const st = root().style;
  st.setProperty('--route-t', `${r?.top ?? 0}px`);
  st.setProperty('--route-l', `${r?.left ?? 0}px`);
  st.setProperty('--route-w', `${r?.width ?? window.innerWidth}px`);
  st.setProperty('--route-h', `${r?.height ?? window.innerHeight}px`);
  window.clearTimeout(timer);
  off?.();
  root().dataset.route = 'load';
  window.clearTimeout(safety);
  safety = window.setTimeout(end, SAFETY_MS);
  // Let React mount the Suspense fallback (if the chunk is not loaded yet) before deciding to hold.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      if (root().dataset.route !== 'load') return;
      if (isHolding()) {
        off = onHoldRelease(() => {
          if (root().dataset.route === 'load') tail();
        });
      } else tail();
    }),
  );
}

/** Start listening (once, from main.tsx). */
export function installRouteSwitch() {
  last = screenOf(currentHash());
  window.addEventListener('hashchange', onRoute);
}
