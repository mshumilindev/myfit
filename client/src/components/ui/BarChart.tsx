import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import './BarChart.css';

/** Colour family of one bar (token-only; `muted` = older, `accent` = newest). */
export type BarTone = 'accent' | 'accent-600' | 'accent-700' | 'accent-800' | 'muted';

export interface BarChartBar {
  /** Period the bar covers, e.g. "13–19 Oct" — shown in the tip and spoken. */
  label: string;
  /** Value already formatted for the reader, e.g. "24.8 t" or "No workouts". */
  valueText: string;
  value: number;
  tone?: BarTone;
}

export interface BarChartProps {
  bars: BarChartBar[];
  /** Scale top; defaults to the biggest value. */
  max?: number;
  /** Accessible name of the whole chart. */
  label: string;
  className?: string;
}

const TIP_GAP = 8;

/**
 * Column chart where every bar is a button (kit `bar-chart`): hover, focus or
 * tap shows a tip with the bar's period and value; a second tap, Esc, an
 * outside press or leaving the chart hides it. ←/→/Home/End move between bars.
 * The tip never leaves the chart box (it flips beside a tall bar).
 */
export function BarChart({ bars, max, label, className }: BarChartProps) {
  const top = max ?? Math.max(...bars.map((b) => b.value), 1);
  const [hover, setHover] = useState<number | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  // The latest pointer/keyboard target wins; a tap-pinned bar is the fallback.
  const active = hover ?? focus ?? pinned;
  const root = useRef<HTMLDivElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  const cells = useRef<(HTMLButtonElement | null)[]>([]);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const r = root.current;
    const tp = tip.current;
    const cell = active === null ? null : cells.current[active];
    if (!r || !tp || !cell) {
      setPos(null);
      return;
    }
    const box = r.getBoundingClientRect();
    const bar = cell.querySelector('.uibc-bar')!.getBoundingClientRect();
    const w = tp.offsetWidth;
    const h = tp.offsetHeight;
    const mid = bar.left + bar.width / 2 - box.left;
    const clamp = (v: number) => Math.max(0, Math.min(v, box.width - w));
    // Sit above every bar the tip spans (not just the chosen one) so it covers none of them.
    const at = clamp(mid - w / 2);
    let peak = bar.top;
    for (const c of cells.current) {
      const rect = c?.querySelector('.uibc-bar')?.getBoundingClientRect();
      if (rect && rect.right > box.left + at && rect.left < box.left + at + w)
        peak = Math.min(peak, rect.top);
    }
    const above = peak - box.top - h - TIP_GAP;
    if (above >= 0) {
      setPos({ left: at, top: above });
    } else {
      // Tall bar: put the tip beside it, on the side with more room, top-aligned.
      const left = bar.left - box.left - TIP_GAP - w;
      const right = bar.right - box.left + TIP_GAP;
      setPos({ left: clamp(left >= 0 ? left : right), top: 0 });
    }
  }, [active, bars.length]);

  const dismiss = useCallback(() => {
    setPinned(null);
    setHover(null);
  }, []);

  useEffect(() => {
    if (pinned === null) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setPinned(null);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [pinned]);

  const onKey = (e: KeyboardEvent, i: number) => {
    const to =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? Math.min(i + 1, bars.length - 1)
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? Math.max(i - 1, 0)
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? bars.length - 1
              : null;
    if (to !== null) {
      e.preventDefault();
      cells.current[to]?.focus();
    } else if (e.key === 'Escape' && active !== null) {
      e.stopPropagation();
      dismiss();
      setFocus(null);
    }
  };

  const shown = active === null ? null : bars[active];
  return (
    <div
      ref={root}
      role="group"
      aria-label={label}
      className={['uibc', className].filter(Boolean).join(' ')}
      onPointerLeave={() => setHover(null)}
    >
      {bars.map((b, i) => (
        <button
          key={i}
          ref={(el) => {
            cells.current[i] = el;
          }}
          type="button"
          className="uibc-cell"
          aria-label={`${b.label}, ${b.valueText}`}
          aria-pressed={pinned === i}
          tabIndex={i === (active ?? bars.length - 1) ? 0 : -1}
          data-active={active === i ? '' : undefined}
          onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(i)}
          onFocus={() => setFocus(i)}
          onBlur={() => setFocus(null)}
          onClick={(e) => {
            if (pinned !== i) return setPinned(i);
            // Second tap hides the tip; a touch tap leaves focus behind, so drop it (not for Enter/Space).
            setPinned(null);
            if (e.detail > 0) e.currentTarget.blur();
          }}
          onKeyDown={(e) => onKey(e, i)}
        >
          <i
            className={`uibc-bar uibc-bar--${b.tone ?? 'muted'}`}
            style={{ height: `${Math.max((b.value / top) * 100, 4)}%` }}
          />
        </button>
      ))}
      <div
        ref={tip}
        className="uibc-tip"
        aria-hidden
        data-show={shown && pos ? '' : undefined}
        style={{ left: pos?.left ?? 0, top: pos?.top ?? 0 }}
      >
        <span className="uibc-tip-label">{shown?.label}</span>
        <span className="uibc-tip-value">{shown?.valueText}</span>
      </div>
    </div>
  );
}
