import { useEffect, useRef, type RefObject } from 'react';
import { flushSync } from 'react-dom';

/** Interactive edge back-swipe (iOS style) for the Gym shell; extracted from App.tsx (SPO-146 touched it). */

const EDGE_BACK_START_PX = 28;
/** iOS starts its own history swipe in roughly the first 20 px; cancelling touchstart there keeps WebKit out (SPO-146). */
const EDGE_BACK_NATIVE_PX = 20;
const EDGE_BACK_LOCK_PX = 18;
const EDGE_BACK_TRIGGER_PX = 72;
const EDGE_BACK_MAX_VERTICAL_PX = 52;
const EDGE_BACK_DOMINANCE = 1.8;
const EDGE_BACK_EXCLUDE_SELECTOR = [
  'a',
  'button',
  'input',
  'select',
  'textarea',
  '[contenteditable="true"]',
  '[role="button"]',
  '[data-no-edge-swipe]',
  '.tabbar',
  '.tabbar-fab',
  '.rail',
  '.sheet',
  '.scrim',
  '.dialog-scrim',
  '.exd-lightbox',
  '.toast-holder',
].join(',');

function isEdgeSwipeExcluded(target: EventTarget | null): boolean {
  if (typeof Element === 'undefined' || !(target instanceof Element)) return false;
  return target.closest(EDGE_BACK_EXCLUDE_SELECTOR) !== null;
}

interface EdgeBackOpts {
  enabled: boolean;
  /** Do the interactive reveal (an overlay is open). Off = plain threshold back. */
  interactive: boolean;
  onBack: () => void;
  stageRef: RefObject<HTMLElement | null>;
  overRef: RefObject<HTMLDivElement | null>;
  underRef: RefObject<HTMLDivElement | null>;
  scrimRef: RefObject<HTMLDivElement | null>;
  onSwipeStart: () => void;
  onSwipeEnd: () => void;
}

const BACK_PARALLAX = 0.25; // how far the revealed screen sits behind, as a fraction of width
const BACK_SCRIM = 0.12; // dim over the revealed screen at rest
const BACK_EASE = 'cubic-bezier(0.22, 0.61, 0.36, 1)';

/**
 * Interactive iOS-style edge-back. From the left edge, the current overlay
 * follows the finger to the right while the destination (rendered underneath)
 * eases in from a slight left parallax with a fading scrim; release past the
 * halfway point (or a flick) completes the pop, otherwise it springs back.
 * When no overlay is open (e.g. a Programs sub-tab) it falls back to a plain
 * threshold trigger with no visual.
 *
 * Smoothness: the destination is mounted on touch-start (before the finger has
 * moved), only transforms/opacity are written per frame (no CSS-variable
 * invalidation), the release duration follows the finger's velocity, the pop is
 * committed with flushSync so the old screen never flashes back for a frame, and
 * the non-passive touchmove listener exists only while an edge gesture runs.
 */
export function useEdgeSwipeBack(opts: EdgeBackOpts): void {
  const ref = useRef(opts);
  useEffect(() => {
    ref.current = opts;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let tracking = false;
    let locked = false;
    let cancelled = false;
    let armed = false; // destination mounted (touch-start on the edge)
    let active = false; // interactive reveal engaged
    let dx = 0;
    let width = 1;
    let raf = 0;
    let moving = false; // touchmove listener attached
    let samples: Array<{ x: number; t: number }> = [];

    const layers = () => ({
      over: ref.current.overRef.current,
      under: ref.current.underRef.current,
      stage: ref.current.stageRef.current,
      scrim: ref.current.scrimRef.current,
    });
    const frame = (x: number) => {
      const { over, under, scrim } = layers();
      const p = Math.max(0, Math.min(1, x / width));
      if (over) over.style.transform = `translate3d(${Math.max(0, x)}px,0,0)`;
      if (under) under.style.transform = `translate3d(${-(1 - p) * width * BACK_PARALLAX}px,0,0)`;
      if (scrim) scrim.style.opacity = String((1 - p) * BACK_SCRIM);
    };
    const paint = () => {
      raf = 0;
      frame(dx);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(paint);
    };
    const clearStyles = () => {
      const { over, under, scrim } = layers();
      for (const el of [over, under]) {
        if (!el) continue;
        el.style.transition = '';
        el.style.transform = '';
        el.style.willChange = '';
      }
      if (scrim) {
        scrim.style.transition = '';
        scrim.style.opacity = '';
      }
    };
    const track = (x: number) => {
      const t = performance.now();
      samples.push({ x, t });
      while (samples.length > 2 && t - samples[0].t > 100) samples.shift();
    };
    /** px per ms over the last ~100 ms (0 when unknown). */
    const velocity = () => {
      if (samples.length < 2) return 0;
      const a = samples[0];
      const b = samples[samples.length - 1];
      return b.t > a.t ? (b.x - a.x) / (b.t - a.t) : 0;
    };
    const onMove = (event: TouchEvent) => {
      if (!tracking || cancelled || event.touches.length !== 1) return;
      const touch = event.touches[0];
      if (!touch) return;
      dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      if (dx < -8) {
        release();
        return;
      }
      if (!locked) {
        if (absY > 10 && absY > absX) {
          cancelled = true;
          tracking = false;
          release();
          return;
        }
        if (dx > EDGE_BACK_LOCK_PX && absX > absY * EDGE_BACK_DOMINANCE) {
          locked = true;
          if (armed) {
            active = true;
            width = window.innerWidth || 1;
            const { over, under } = layers();
            for (const el of [over, under]) if (el) el.style.willChange = 'transform';
          }
        }
      }
      if (locked && event.cancelable) event.preventDefault();
      if (active) {
        track(touch.clientX);
        schedule();
      }
    };
    const attachMove = () => {
      if (moving) return;
      moving = true;
      window.addEventListener('touchmove', onMove, { passive: false });
    };
    const detachMove = () => {
      if (!moving) return;
      moving = false;
      window.removeEventListener('touchmove', onMove);
    };
    /** Gesture over without an interactive reveal: drop the pre-mounted destination. */
    const release = () => {
      detachMove();
      tracking = false;
      locked = false;
      cancelled = false;
      if (armed && !active) {
        armed = false;
        ref.current.onSwipeEnd();
      }
    };
    const endInteractive = (commit: boolean, v: number) => {
      const { over, under, scrim } = layers();
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      // Duration follows the remaining distance and the flick speed.
      const remaining = commit ? Math.max(0, width - dx) : Math.max(0, dx);
      const speed = Math.max(Math.abs(v), 0.9); // px/ms
      const ms = Math.round(Math.max(140, Math.min(320, remaining / speed)));
      const tr = `transform ${ms}ms ${BACK_EASE}`;
      if (over) {
        over.style.transition = tr;
        void over.offsetWidth; // flush so the release animates from the current spot
      }
      if (under) under.style.transition = tr;
      if (scrim) scrim.style.transition = `opacity ${ms}ms ${BACK_EASE}`;
      frame(commit ? width : 0);
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        // Commit the pop (and unmount the layers) in one synchronous render, so
        // the screen that just slid away never reappears for a frame.
        flushSync(() => {
          if (commit) ref.current.onBack();
          ref.current.onSwipeEnd();
        });
        clearStyles();
        active = false;
        armed = false;
      };
      if (over) over.addEventListener('transitionend', finish, { once: true });
      window.setTimeout(finish, ms + 80);
    };

    const onTouchStart = (event: TouchEvent) => {
      if (!ref.current.enabled || active) return;
      if (event.touches.length !== 1 || isEdgeSwipeExcluded(event.target)) return;
      const touch = event.touches[0];
      if (!touch || touch.clientX > EDGE_BACK_START_PX) return;
      // Without this WebKit runs ITS back animation (a snapshot of the previous page: Today a second time) on top of ours
      // and can leave the page shifted sideways when it is cancelled. We own back navigation here.
      if (touch.clientX <= EDGE_BACK_NATIVE_PX && event.cancelable) event.preventDefault();
      startX = touch.clientX;
      startY = touch.clientY;
      startTime = Date.now();
      tracking = true;
      locked = false;
      cancelled = false;
      dx = 0;
      samples = [{ x: touch.clientX, t: performance.now() }];
      attachMove();
      if (ref.current.interactive && !armed) {
        armed = true;
        ref.current.onSwipeStart(); // mount the destination before the finger moves
      }
    };
    const onTouchEnd = (event: TouchEvent) => {
      if (!tracking || cancelled) {
        release();
        return;
      }
      const touch = event.changedTouches[0];
      if (!touch) {
        release();
        return;
      }
      dx = touch.clientX - startX;
      const absY = Math.abs(touch.clientY - startY);
      const elapsed = Date.now() - startTime;
      const intentional =
        locked &&
        dx >= EDGE_BACK_TRIGGER_PX &&
        absY <= EDGE_BACK_MAX_VERTICAL_PX &&
        dx > absY * EDGE_BACK_DOMINANCE;
      const fast = dx >= 52 && elapsed < 280 && dx > absY * 2;
      if (active) {
        track(touch.clientX);
        const v = velocity();
        detachMove();
        tracking = false;
        locked = false;
        endInteractive(dx >= width * 0.5 || fast || intentional || v > 0.5, v);
        return;
      }
      const go = intentional || fast;
      release();
      if (go) ref.current.onBack();
    };
    const onCancel = () => {
      if (active) {
        detachMove();
        tracking = false;
        locked = false;
        endInteractive(false, 0);
      } else release();
    };

    window.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onCancel, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      detachMove();
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onCancel);
    };
  }, []);
}

/**
 * Edge back for shells whose back navigation is browser history (the Coach app: every screen change is a hash entry and
 * its Back button decides what "back" means). On iOS the system swipe would play its own snapshot animation (the previous
 * page again) over a page that has already re-rendered, and can leave the page shifted sideways (SPO-146). We cancel it
 * and press the visible Back button of the screen instead, so a swipe is exactly a tap on Back. Nothing happens on a
 * screen without a Back button (a top-level tab), so the swipe can never leave the app.
 */
export function useBackButtonEdgeSwipe(enabled: boolean, scope = '.co-main'): void {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    let startX = 0;
    let startY = 0;
    let tracking = false;
    const onStart = (event: TouchEvent) => {
      tracking = false;
      if (event.touches.length !== 1 || isEdgeSwipeExcluded(event.target)) return;
      const touch = event.touches[0];
      if (!touch || touch.clientX > EDGE_BACK_START_PX) return;
      if (touch.clientX <= EDGE_BACK_NATIVE_PX && event.cancelable) event.preventDefault();
      startX = touch.clientX;
      startY = touch.clientY;
      tracking = true;
    };
    const onEnd = (event: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const touch = event.changedTouches[0];
      if (!touch) return;
      const dx = touch.clientX - startX;
      const absY = Math.abs(touch.clientY - startY);
      if (
        dx < EDGE_BACK_TRIGGER_PX ||
        absY > EDGE_BACK_MAX_VERTICAL_PX ||
        dx <= absY * EDGE_BACK_DOMINANCE
      ) {
        return;
      }
      document.querySelector<HTMLButtonElement>(`${scope} .uiback`)?.click();
    };
    const onCancel = () => {
      tracking = false;
    };
    window.addEventListener('touchstart', onStart, { passive: false });
    window.addEventListener('touchend', onEnd, { passive: true });
    window.addEventListener('touchcancel', onCancel, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onCancel);
    };
  }, [enabled, scope]);
}
