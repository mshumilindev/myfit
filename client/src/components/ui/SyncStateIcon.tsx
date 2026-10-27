import { useEffect, useRef, useState } from 'react';
import type { HTMLAttributes } from 'react';
import { Badge } from './Badge';
import { toneClass, type Tone } from './tones';
import {
  DURATION_MS,
  SEGMENTS,
  SHAPES,
  SPIN_PER_MS,
  blend,
  pieces,
  type Pt,
  type SyncIconState,
} from './syncStateShapes';
import './SyncStateIcon.css';

export type { SyncIconState } from './syncStateShapes';
export { SYNC_ICON_STATES } from './syncStateShapes';

/**
 * Every connection / sync state the app can show as one icon (SPO-375).
 * The icon is ONE continuous calligraphy line. A state is a shape of that line, and a change of state
 * makes it turn into the next shape like a snake (no cross-fade, nothing is swapped):
 *  synced   check             syncing  circular arrow, turning slowly
 *  saving   arrow up onto a tray        slow     hourglass
 *  offline  ring + slash      stale     spiral (a saved copy, going back in time)
 *  failed   bolt              locked    padlock
 * Colour comes from the tone (`--t-base`), so every theme re-skins it.
 */
export type SyncIconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface SyncStateIconProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  state: SyncIconState;
  /** xs 16 · sm 20 · md 24 (default) · lg 32 · xl 48 (a page-header slot). */
  size?: SyncIconSize;
  /** Queued changes. Shown as a kit Badge on the corner (0 hides it); part of the accessible name. */
  count?: number;
  /** Accessible name (already localised). Omit when the icon sits next to its own text: then it is decorative. */
  label?: string;
  /** Show the label as a tooltip: on hover (mouse) or on tap (touch). Needs `label`. */
  tooltip?: boolean;
}

/** Offline is a normal state, so only `failed` is danger. */
const TONE: Record<SyncIconState, Tone> = {
  synced: 'ok',
  syncing: 'accent',
  saving: 'accent',
  slow: 'neutral',
  offline: 'neutral',
  stale: 'neutral',
  failed: 'danger',
  locked: 'neutral',
};

const TIP_MS = 2200;
const SHAKE_MS = 420;

const reducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

interface Engine {
  state: SyncIconState;
  cur: Pt[];
  from: Pt[];
  to: Pt[];
  t0: number;
  tweening: boolean;
  spin: number;
  last: number;
  enteredAt: number;
  raf: number;
  visible: boolean;
}

export function SyncStateIcon({
  state,
  size = 'md',
  count = 0,
  label,
  tooltip = false,
  className,
  ...rest
}: SyncStateIconProps) {
  const host = useRef<HTMLSpanElement>(null);
  const group = useRef<SVGGElement>(null);
  const paths = useRef<(SVGPathElement | null)[]>([]);
  const engine = useRef<Engine | null>(null);
  const kick = useRef<() => void>(() => undefined);
  const [first] = useState(() => pieces(SHAPES[state]));
  const [tip, setTip] = useState(false);

  // The loop: runs only while something moves AND the icon is on screen.
  useEffect(() => {
    const e: Engine = {
      state,
      cur: SHAPES[state].map((p) => [p[0], p[1]] as Pt),
      from: SHAPES[state],
      to: SHAPES[state],
      t0: 0,
      tweening: false,
      spin: 0,
      last: 0,
      enteredAt: 0,
      raf: 0,
      visible: true,
    };
    engine.current = e;
    const reduce = reducedMotion();

    const draw = (dx: number) => {
      const ps = pieces(e.cur);
      for (let k = 0; k < SEGMENTS; k++) {
        const el = paths.current[k];
        if (!el) continue;
        el.setAttribute('d', ps[k].d);
        el.setAttribute('stroke-width', ps[k].w.toFixed(2));
      }
      group.current?.setAttribute(
        'transform',
        e.spin || dx ? `translate(${dx.toFixed(2)} 0) rotate(${e.spin.toFixed(1)} 12 12)` : '',
      );
    };

    const loop = (now: number) => {
      e.raf = 0;
      const dt = e.last ? Math.min(64, now - e.last) : 16;
      e.last = now;
      if (e.tweening) {
        const el = (now - e.t0) / DURATION_MS;
        if (el >= 1) {
          e.cur = e.to.map((p) => [p[0], p[1]] as Pt);
          e.tweening = false;
        } else {
          e.cur = blend(e.from, e.to, el);
        }
      }
      let dx = 0;
      let moving = e.tweening;
      if (e.state === 'syncing') {
        e.spin += dt * SPIN_PER_MS;
        moving = true;
      } else if (e.spin !== 0) {
        // Leaving syncing: settle on the nearest upright position, no extra turns.
        const target = Math.round(e.spin / 360) * 360;
        e.spin += (target - e.spin) * (1 - Math.exp(-dt / 260));
        if (Math.abs(target - e.spin) < 0.2) e.spin = 0;
        else moving = true;
      }
      if (e.state === 'failed') {
        const age = now - e.enteredAt;
        if (age < SHAKE_MS) {
          dx = Math.sin(age / 28) * (1 - age / SHAKE_MS) * 0.5;
          moving = true;
        }
      }
      draw(dx);
      if (moving && e.visible && !document.hidden) e.raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (!e.raf && !reduce) {
        e.last = 0;
        e.raf = requestAnimationFrame(loop);
      }
    };
    kick.current = start;

    const onVis = () => {
      if (document.hidden) {
        if (e.raf) cancelAnimationFrame(e.raf);
        e.raf = 0;
      } else if (e.tweening || e.state === 'syncing') start();
    };
    document.addEventListener('visibilitychange', onVis);
    let io: IntersectionObserver | undefined;
    if (typeof IntersectionObserver === 'function' && host.current) {
      io = new IntersectionObserver((entries) => {
        e.visible = entries[entries.length - 1]?.isIntersecting ?? true;
        if (e.visible && (e.tweening || e.state === 'syncing')) start();
      });
      io.observe(host.current);
    }
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      io?.disconnect();
      if (e.raf) cancelAnimationFrame(e.raf);
      engine.current = null;
    };
    // The engine is created once; state changes are handled by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A state change: turn the stroke into the new shape (or jump, under reduced motion).
  useEffect(() => {
    const e = engine.current;
    if (!e || e.state === state) return;
    e.state = state;
    e.enteredAt = performance.now();
    if (reducedMotion()) {
      e.cur = SHAPES[state].map((p) => [p[0], p[1]] as Pt);
      e.spin = 0;
      e.tweening = false;
      const ps = pieces(e.cur);
      for (let k = 0; k < SEGMENTS; k++) {
        const el = paths.current[k];
        if (!el) continue;
        el.setAttribute('d', ps[k].d);
        el.setAttribute('stroke-width', ps[k].w.toFixed(2));
      }
      group.current?.setAttribute('transform', '');
      return;
    }
    e.from = e.cur.map((p) => [p[0], p[1]] as Pt);
    e.to = SHAPES[state];
    e.t0 = e.enteredAt;
    e.tweening = true;
    kick.current();
  }, [state]);

  // Tap tooltip auto-hides.
  useEffect(() => {
    if (!tip) return;
    const t = setTimeout(() => setTip(false), TIP_MS);
    return () => clearTimeout(t);
  }, [tip]);

  const queued = Math.max(0, Math.floor(count));
  const name = label ? (queued > 0 ? `${label} · ${queued}` : label) : undefined;
  const hasTip = tooltip && !!name;
  const cls = [
    'uisi',
    `uisi--${size}`,
    toneClass(TONE[state]),
    hasTip && 'uisi--tip',
    hasTip && tip && 'is-tip',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <span
      ref={host}
      className={cls}
      data-state={state}
      role={name ? 'img' : undefined}
      aria-label={name}
      aria-hidden={name ? undefined : true}
      tabIndex={hasTip ? 0 : undefined}
      onClick={hasTip ? () => setTip((v) => !v) : undefined}
      onBlur={hasTip ? () => setTip(false) : undefined}
      {...rest}
    >
      <svg className="uisi-svg" viewBox="0 0 24 24" focusable="false" aria-hidden>
        <g ref={group}>
          {first.map((p, k) => (
            <path
              key={k}
              ref={(n) => {
                paths.current[k] = n;
              }}
              d={p.d}
              strokeWidth={p.w.toFixed(2)}
            />
          ))}
        </g>
      </svg>
      {queued > 0 && (
        <span className="uisi-count">
          <Badge n={queued} tone={state === 'failed' ? 'danger' : 'neutral'} />
        </span>
      )}
      {hasTip && (
        <span className="uisi-tip" aria-hidden>
          {name}
        </span>
      )}
    </span>
  );
}
