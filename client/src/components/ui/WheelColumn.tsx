import { memo, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import './WheelPicker.css';

export interface WheelItem {
  key: string;
  label: string;
}

export interface WheelColumnProps {
  /** Accessible name of the column ("Weight"). */
  label: string;
  items: ReadonlyArray<WheelItem>;
  index: number;
  onIndex: (index: number) => void;
  /** Spoken value ("82.5 kg"); falls back to the item label. */
  valueText?: string;
  /** Shown right after the selected value, inside the band ("82.5 kg"). */
  unit?: string;
  disabled?: boolean;
  onFocus?: () => void;
  /** A tap (not a drag) on the already selected row — the picker uses it to open the keyboard. */
  onTapSelected?: () => void;
  /** Fires each time a row passes the selection band while the user spins the drum (haptic / sound hook). */
  onDetent?: () => void;
  /** The pointer went down on the drum — a user gesture, where a browser lets audio start (see `wheelFeedback.ts`). */
  onGrab?: () => void;
}

/** Movement under this is a tap, over it a drag (the usual touch slop). */
const SLOP = 6;
/** Picker-style deceleration (iOS's pickers stop much sooner than a scroll view's 0.998): 1 % of the speed per ms. */
const DECEL = 0.99;
const K = -Math.log(DECEL); // 1/ms
/** Only the last stretch of the gesture counts for the release velocity. */
const VELOCITY_WINDOW = 100;
const MAX_FLING = 4; // px/ms, so a hard flick cannot cross a 1000-row list in one go

/**
 * One scroll-snap drum. Mouse wheel, keyboard and programmatic moves are native scroll (snap included); a finger or a
 * mouse drag is driven here so it behaves like an iOS picker: a drag starts only after moving past the touch slop (a
 * tap on the number types, a tap on another row jumps to it), and on release the drum keeps spinning with iOS
 * deceleration and eases onto the row it lands on. The value is read where it settled and mirrored back to scroll
 * position. Spin button semantics + arrows / Page / Home / End keep it usable without a pointer.
 */
export function WheelColumn({
  label,
  items,
  index,
  onIndex,
  valueText,
  unit,
  disabled,
  onFocus,
  onTapSelected,
  onDetent,
  onGrab,
}: WheelColumnProps) {
  const detent = useRef(-1);
  /** The row under the band right now — follows the drum while it moves; `index` is what is committed. */
  const [live, setLive] = useState(index);
  const moving = useRef(false);
  const ref = useRef<HTMLDivElement>(null);
  const settle = useRef<number | undefined>(undefined);
  const userScrolling = useRef(false);
  const raf = useRef(0);
  const tapped = useRef(false);
  const painted = useRef<HTMLElement[]>([]);
  const drag = useRef<{
    id: number;
    y0: number;
    top0: number;
    on: boolean;
    samples: Array<{ t: number; top: number }>;
  } | null>(null);

  function rowH(): number {
    const row = ref.current?.querySelector<HTMLElement>('.uiwheel-i');
    return row?.offsetHeight || 1;
  }
  function read(): void {
    const el = ref.current;
    // a drag or glide commits when it ends; a `scrollend` mid-glide must not pull the drum onto a row
    if (!el || moving.current) return;
    userScrolling.current = false;
    const i = Math.min(items.length - 1, Math.max(0, Math.round(el.scrollTop / rowH())));
    setLive(i);
    if (i !== index) onIndex(i);
  }

  // value → scroll position (instant on mount / external change, ignored while the user's finger drives it)
  useEffect(() => {
    const el = ref.current;
    if (!el || userScrolling.current || moving.current) return;
    const top = index * rowH();
    detent.current = index;
    setLive(index);
    if (Math.abs(el.scrollTop - top) > 1) el.scrollTop = top;
    paint(el);
  }, [index, items.length]);

  useEffect(
    () => () => {
      window.clearTimeout(settle.current);
      cancelAnimationFrame(raf.current);
    },
    [],
  );

  function maxTop(): number {
    return (items.length - 1) * rowH();
  }
  function clampTop(v: number): number {
    return Math.min(maxTop(), Math.max(0, v));
  }
  function stopAnim(): void {
    cancelAnimationFrame(raf.current);
    moving.current = false;
    ref.current?.classList.remove('is-flinging');
  }
  /** Exponential ease onto `target` that starts at the release velocity `v` (px/ms) and ends with no jump. */
  function glide(target: number, v: number): void {
    const el = ref.current;
    if (!el) return;
    const from = el.scrollTop;
    const dist = target - from;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || Math.abs(dist) < 0.5) {
      el.scrollTop = target;
      el.classList.remove('is-flinging');
      moving.current = false;
      read();
      return;
    }
    const tau = v !== 0 && Math.sign(v) === Math.sign(dist) ? Math.abs(dist / v) : 140;
    const T = Math.min(420, Math.max(110, tau));
    moving.current = true;
    const t0 = performance.now();
    const step = (now: number) => {
      const x = target - dist * Math.exp(-(now - t0) / T);
      if (Math.abs(target - x) < 0.5) {
        el.scrollTop = target;
        el.classList.remove('is-flinging');
        moving.current = false;
        read();
        return;
      }
      el.scrollTop = x;
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>): void {
    if (disabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const el = ref.current;
    if (!el) return;
    stopAnim();
    onGrab?.();
    drag.current = {
      id: e.pointerId,
      y0: e.clientY,
      top0: el.scrollTop,
      on: false,
      samples: [{ t: performance.now(), top: el.scrollTop }],
    };
  }
  function onPointerMove(e: PointerEvent<HTMLDivElement>): void {
    const d = drag.current;
    const el = ref.current;
    if (!d || !el || d.id !== e.pointerId) return;
    const dy = d.y0 - e.clientY;
    if (!d.on) {
      if (Math.abs(dy) < SLOP) return;
      d.on = true;
      moving.current = true;
      userScrolling.current = true;
      el.classList.add('is-flinging');
      el.setPointerCapture?.(e.pointerId);
    }
    el.scrollTop = clampTop(d.top0 + dy);
    checkDetent(el);
    const now = performance.now();
    d.samples.push({ t: now, top: el.scrollTop });
    while (d.samples.length > 2 && now - d.samples[0].t > VELOCITY_WINDOW) d.samples.shift();
  }
  function onPointerUp(e: PointerEvent<HTMLDivElement>): void {
    const d = drag.current;
    const el = ref.current;
    drag.current = null;
    if (!d || !el || d.id !== e.pointerId) return;
    if (!d.on) {
      // a tap: the number types, another row jumps to it
      const row = (e.target as HTMLElement).closest<HTMLElement>('.uiwheel-i');
      const i = row ? Array.from(row.parentElement?.children ?? []).indexOf(row) : -1;
      // the number types — but on touch the emulated mouse events after pointerup would steal the focus, so the
      // keyboard opens from the click that follows
      if (i === index) tapped.current = true;
      else if (i >= 0) go(i);
      return;
    }
    el.releasePointerCapture?.(e.pointerId);
    const now = performance.now();
    const first = d.samples[0];
    const last = d.samples[d.samples.length - 1];
    const fresh = now - last.t < 80; // a pause before letting go means no fling
    let v = fresh && last.t > first.t ? (last.top - first.top) / (last.t - first.t) : 0;
    v = Math.max(-MAX_FLING, Math.min(MAX_FLING, v));
    const h = rowH();
    const rest = clampTop(el.scrollTop + v / K); // where the iOS deceleration would stop
    glide(clampTop(Math.round(rest / h) * h), v);
  }
  function onPointerCancel(): void {
    const d = drag.current;
    drag.current = null;
    if (d?.on) glide(clampTop(Math.round(ref.current!.scrollTop / rowH()) * rowH()), 0);
  }

  /**
   * Size, tilt and colour follow each row's distance from the band, continuously. Only the few rows near the band
   * are touched per frame (`--o` = signed offset in rows); the rest keep the resting look, so a long list costs
   * the same as a short one.
   */
  function paint(el: HTMLElement): void {
    const pos = el.scrollTop / rowH();
    const c = Math.round(pos);
    const next: HTMLElement[] = [];
    for (let k = Math.max(0, c - 3); k <= Math.min(items.length - 1, c + 3); k++) {
      const row = el.children[k] as HTMLElement | undefined;
      if (!row) continue;
      row.style.setProperty('--o', String(k - pos));
      next.push(row);
    }
    for (const r of painted.current) if (!next.includes(r)) r.style.removeProperty('--o');
    painted.current = next;
  }
  /** A row crossed the band. Also called from the drag itself: iOS only gives a haptic inside a user gesture. */
  function checkDetent(el: HTMLElement): void {
    if (!onDetent) return;
    const i = Math.round(el.scrollTop / rowH());
    if (detent.current !== i) {
      if (detent.current !== -1) onDetent();
      detent.current = i;
    }
  }
  function onScroll(): void {
    userScrolling.current = true;
    const el = ref.current;
    if (el) {
      paint(el);
      const l = Math.min(items.length - 1, Math.max(0, Math.round(el.scrollTop / rowH())));
      setLive(l);
    }
    if (el) checkDetent(el);
    window.clearTimeout(settle.current);
    // a drag or glide commits itself when it ends; the debounce is for native scrolls (wheel, scrollbar)
    if (!moving.current) settle.current = window.setTimeout(read, 120);
  }
  function go(i: number): void {
    if (disabled) return;
    onIndex(Math.min(items.length - 1, Math.max(0, i)));
  }
  function onKey(e: KeyboardEvent<HTMLDivElement>): void {
    const map: Record<string, number> = {
      ArrowUp: index - 1,
      ArrowDown: index + 1,
      PageUp: index - 5,
      PageDown: index + 5,
      Home: 0,
      End: items.length - 1,
    };
    if (e.key in map) {
      e.preventDefault();
      go(map[e.key]);
    }
  }

  const cur = items[index];
  return (
    <div
      ref={ref}
      className={`uiwheel${disabled ? ' is-disabled' : ''}`}
      role="spinbutton"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={items.length - 1}
      aria-valuenow={index}
      aria-valuetext={valueText ?? cur?.label}
      aria-disabled={disabled || undefined}
      onScroll={onScroll}
      onScrollEnd={read}
      onKeyDown={onKey}
      onFocus={onFocus}
      onClick={() => {
        if (!tapped.current) return;
        tapped.current = false;
        onTapSelected?.();
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      {items.map((it, i) => (
        <WheelRow
          key={it.key}
          label={it.label}
          unit={i === live ? unit : undefined}
          sel={i === live}
        />
      ))}
    </div>
  );
}

/** Memoised: while the drum spins only the two rows whose selected state flips re-render. */
const WheelRow = memo(function WheelRow({
  label,
  unit,
  sel,
}: {
  label: string;
  unit?: string;
  sel: boolean;
}) {
  return (
    <div className={`uiwheel-i${sel ? ' is-sel' : ''}`} aria-hidden="true">
      <span className="uiwheel-n">
        {label}
        {unit && <span className="uiwheel-u">{unit}</span>}
      </span>
    </div>
  );
});
