import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import './ScrollTabs.css';

export interface ScrollTab {
  id: string;
  label: string;
  /** Spoken name when the visible label is short. */
  ariaLabel?: string;
}

/**
 * Tab row for a page (Client 360: Overview, Workouts, ...). `role="tablist"`, roving tabindex, Left/Right/Home/End
 * move and activate. Narrow screens scroll sideways: edges fade where more tabs hide, and the active tab is
 * scrolled into view so the NEXT tab always peeks out. Panels: give the panel `id={panelId(tab)}`,
 * `role="tabpanel"` and `aria-labelledby={tabId(tab)}`.
 */
export function ScrollTabs({
  tabs,
  value,
  onChange,
  label,
  idBase,
}: {
  tabs: readonly ScrollTab[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  /** Base for ids; defaults to a generated one (pass it to build panel ids). */
  idBase?: string;
}) {
  const gen = useId();
  const base = idBase ?? gen;
  const listRef = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: false, end: false });

  const measure = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const start = el.scrollLeft > 1;
    const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setEdge((e) => (e.start === start && e.end === end ? e : { start, end }));
  }, []);

  useEffect(() => {
    measure();
    const el = listRef.current;
    if (!el) return;
    const on = () => measure();
    window.addEventListener('resize', on);
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(on);
      ro.observe(el);
    }
    return () => {
      window.removeEventListener('resize', on);
      ro?.disconnect();
    };
  }, [measure, tabs.length]);

  // Keep the active tab visible with the next one peeking.
  useEffect(() => {
    const el = listRef.current;
    const cur = el?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!el || !cur || el.scrollWidth <= el.clientWidth) return;
    const pad = 48;
    const left = cur.offsetLeft - pad;
    const right = cur.offsetLeft + cur.offsetWidth + pad - el.clientWidth;
    if (left < el.scrollLeft) el.scrollLeft = Math.max(0, left);
    else if (right > el.scrollLeft) el.scrollLeft = right;
    measure();
  }, [value, measure]);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = tabs.findIndex((t) => t.id === value);
    let n = -1;
    if (e.key === 'ArrowRight') n = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = tabs.length - 1;
    if (n < 0) return;
    e.preventDefault();
    onChange(tabs[n].id);
    requestAnimationFrame(() => document.getElementById(`${base}-tab-${tabs[n].id}`)?.focus());
  };

  return (
    <div
      className={`stab${edge.start ? ' has-start' : ''}${edge.end ? ' has-end' : ''}`}
      data-edge-start={edge.start}
      data-edge-end={edge.end}
    >
      <div
        ref={listRef}
        className="stab-list"
        role="tablist"
        aria-label={label}
        onKeyDown={onKey}
        onScroll={measure}
      >
        {tabs.map((t) => {
          const on = t.id === value;
          return (
            <button
              key={t.id}
              id={`${base}-tab-${t.id}`}
              type="button"
              role="tab"
              className={`stab-t${on ? ' is-on' : ''}`}
              aria-selected={on}
              aria-controls={on ? `${base}-panel-${t.id}` : undefined}
              aria-label={t.ariaLabel}
              tabIndex={on ? 0 : -1}
              onClick={() => onChange(t.id)}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Ids for the panel that belongs to a tab of a `ScrollTabs` rendered with the same `idBase`. */
export const tabIds = (base: string, id: string) => ({
  tab: `${base}-tab-${id}`,
  panel: `${base}-panel-${id}`,
});
