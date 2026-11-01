/**
 * Focus-mode step transition (SPO-323, variant "Neighbouring page"): when the user taps Back/Next, the old exercise
 * card slides out while the new one slides in from the side, both shrunk to 94 % and dimmed while they travel.
 *
 * The new card is the LIVE DOM (so it is interactive from the first frame and logging is never blocked); only the
 * outgoing card is a throw-away, inert snapshot. Pure Web Animations (transform + opacity): no dependency, no
 * layout work, cancelable by the next tap. Reduced motion or a device the motion budget put on "static" gets a
 * 150 ms cross-fade; no `Element.animate` (old engines, jsdom) means the card just swaps, as before.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { useMotionTier, type MotionTier } from '../motion';

export type StepDirection = 1 | -1;
export type StepMode = 'slide' | 'fade';

/** 340 ms is inside the 250-450 ms budget of SPO-323; the curve is the Material "emphasized" one. */
export const SLIDE_MS = 340;
export const FADE_MS = 150;
export const SLIDE_EASING = 'cubic-bezier(0.4, 0.14, 0.3, 1)';
/** Gap between the two cards while they travel (px). */
export const SLIDE_GAP = 16;
export const SLIDE_SCALE = 0.94;
export const SLIDE_DIM = 0.35;
/** A prepared snapshot older than this belongs to a navigation that never happened. */
const PREPARED_TTL_MS = 1000;

export interface StepKeyframes {
  out: Keyframe[];
  in: Keyframe[];
  options: KeyframeAnimationOptions;
}

/** Pure: the keyframes of one transition. `dir` 1 = Next (old leaves to the left), -1 = Back. */
export function stepKeyframes(mode: StepMode, dir: StepDirection, width: number): StepKeyframes {
  if (mode === 'fade') {
    return {
      out: [{ opacity: 1 }, { opacity: 0 }],
      in: [{ opacity: 0 }, { opacity: 1 }],
      options: { duration: FADE_MS, easing: 'linear', fill: 'both' },
    };
  }
  const dx = (width + SLIDE_GAP) * dir;
  return {
    out: [
      { transform: 'none', opacity: 1 },
      { transform: `translateX(${-dx}px) scale(${SLIDE_SCALE})`, opacity: SLIDE_DIM },
    ],
    in: [
      { transform: `translateX(${dx}px) scale(${SLIDE_SCALE})`, opacity: SLIDE_DIM },
      { transform: 'none', opacity: 1 },
    ],
    options: { duration: SLIDE_MS, easing: SLIDE_EASING, fill: 'both' },
  };
}

/** Pure: which transition a device gets. */
export function stepMode(reducedMotion: boolean, tier: MotionTier): StepMode {
  return reducedMotion || tier === 'static' ? 'fade' : 'slide';
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

/** An inert, id-free copy of the outgoing card, safe to leave in the DOM for 340 ms. */
function makeGhost(live: HTMLElement): HTMLElement {
  const ghost = document.createElement('div');
  ghost.className = 'focus-ghost';
  ghost.setAttribute('aria-hidden', 'true');
  ghost.setAttribute('inert', '');
  live.childNodes.forEach((n) => ghost.appendChild(n.cloneNode(true)));
  ghost.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
  ghost.querySelectorAll('[name]').forEach((el) => el.removeAttribute('name'));
  return ghost;
}

interface Prepared {
  ghost: HTMLElement;
  dir: StepDirection;
  at: number;
}

interface Running {
  anims: Animation[];
  ghost: HTMLElement;
  scroller: HTMLElement | null;
}

/**
 * `stageRef` is the `.focus-stage` element that wraps `.focus-live` (the card). Call `prepare(dir)` right before
 * changing `step`; once `step` has changed and React has committed, the transition runs.
 */
export function useFocusStepTransition(
  stageRef: RefObject<HTMLElement | null>,
  liveRef: RefObject<HTMLElement | null>,
  step: number,
): { prepare: (dir: StepDirection) => void } {
  const tier = useMotionTier();
  const prepared = useRef<Prepared | null>(null);
  const running = useRef<Running | null>(null);
  const lastStep = useRef(step);

  const stop = useCallback(() => {
    const r = running.current;
    if (!r) return;
    running.current = null;
    r.anims.forEach((a) => a.cancel());
    r.ghost.remove();
    r.scroller?.classList.remove('focus-moving');
  }, []);

  const prepare = useCallback(
    (dir: StepDirection) => {
      const live = liveRef.current;
      if (!live || typeof live.animate !== 'function') return;
      // The previous card is still on screen when a second tap lands: drop it and snapshot what is shown now.
      stop();
      prepared.current = { ghost: makeGhost(live), dir, at: Date.now() };
    },
    [liveRef, stop],
  );

  useLayoutEffect(() => {
    if (lastStep.current === step) return;
    lastStep.current = step;
    const p = prepared.current;
    prepared.current = null;
    const stage = stageRef.current;
    const live = liveRef.current;
    if (!p || !stage || !live || Date.now() - p.at > PREPARED_TTL_MS) return;
    const mode = stepMode(prefersReducedMotion(), tier);
    const kf = stepKeyframes(mode, p.dir, stage.clientWidth);
    stage.appendChild(p.ghost);
    const scroller = stage.parentElement;
    scroller?.classList.add('focus-moving');
    const anims = [p.ghost.animate(kf.out, kf.options), live.animate(kf.in, kf.options)];
    const run: Running = { anims, ghost: p.ghost, scroller };
    running.current = run;
    // `finished` rejects when the next tap cancels the animation: that is the normal way out, not an error.
    void Promise.all(anims.map((a) => a.finished)).then(
      () => {
        if (running.current === run) stop();
      },
      () => undefined,
    );
  }, [step, stageRef, liveRef, tier, stop]);

  useEffect(() => stop, [stop]);

  return { prepare };
}
