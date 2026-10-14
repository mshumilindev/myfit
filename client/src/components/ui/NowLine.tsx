/**
 * "Now" for time grids and agendas (the Teams-style current-time marker).
 *
 * - `useMinuteClock(getNow)`: the app clock, re-read on every minute boundary of THAT clock (so a fixture clock in a
 *   story or test drives it), paused while the tab is hidden and re-synced when it is visible again. Cleans up on
 *   unmount. Components never read `Date` themselves: the caller passes the clock.
 * - `NowLine`: a thin rule across a day column with a dot at its left end and an optional time chip. It is positioned
 *   by wall-clock minutes since midnight (the caller computes them in the right zone, so a DST day stays correct), is
 *   `aria-hidden` and `pointer-events: none`, and draws nothing outside the visible hour range.
 * - `NowStatus`: the one visually-hidden "Now, HH:MM" status for the whole view. It speaks when the view mounts and
 *   when the hour changes, never every minute.
 * - `NowDivider`: the "Now" separator of a phone agenda between past and upcoming rows.
 * - `useScrollToNow`: on opening a view, scroll so "now" sits about a third from the top, once, and only if the
 *   user has not scrolled yet.
 */
import { useEffect, useRef, useState, type RefObject } from 'react';
import './NowLine.css';

const MINUTE = 60_000;

/** Fraction (0..1) of the visible range `[from, to]` (minutes) where `minutes` sits; null when outside it. */
export function nowOffset(minutes: number, from: number, to: number): number | null {
  if (!(to > from) || minutes < from || minutes > to) return null;
  return (minutes - from) / (to - from);
}

/** Milliseconds until the next minute boundary of `now` (a call exactly on a boundary waits a full minute). */
export const msToNextMinute = (now: number): number =>
  MINUTE - (((now % MINUTE) + MINUTE) % MINUTE);

/**
 * The clock value, refreshed on each minute boundary of the clock. While `document.hidden` no timer runs; when the tab
 * becomes visible the value is re-read at once and the timer re-aligned.
 */
export function useMinuteClock(getNow: () => number): number {
  const read = useRef(getNow);
  const [now, setNow] = useState(() => getNow());
  useEffect(() => {
    read.current = getNow;
  });
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
    };
    const arm = () => {
      stop();
      if (document.hidden) return;
      timer = setTimeout(() => {
        setNow(read.current());
        arm();
      }, msToNextMinute(read.current()));
    };
    const onVisibility = () => {
      if (document.hidden) stop();
      else {
        setNow(read.current());
        arm();
      }
    };
    setNow(read.current());
    arm();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
  return now;
}

export interface NowLineProps {
  /** Wall-clock minutes since local midnight of the shown day (zone and DST are the caller's business). */
  minutes: number;
  /** Visible range in minutes since midnight. */
  from: number;
  to: number;
  /** Time chip text ("09:05"), day view; omit for a plain line (week view). */
  label?: string;
  className?: string;
}

/** Put it inside a `position: relative` day column whose height spans `[from, to]`. */
export function NowLine({ minutes, from, to, label, className }: NowLineProps) {
  const at = nowOffset(minutes, from, to);
  if (at === null) return null;
  return (
    <div
      className={['uinow', label ? 'has-chip' : '', className].filter(Boolean).join(' ')}
      style={{ top: `${at * 100}%` }}
      aria-hidden="true"
      data-now-line=""
    >
      <i className="uinow-dot" />
      <i className="uinow-rule" />
      {label ? <span className="uinow-chip">{label}</span> : null}
    </div>
  );
}

/**
 * Visually hidden status text, announced on mount and when `hour` changes (not every minute). `text` is the already
 * localised "Now, 09:05"; it is frozen between announcements.
 */
export function NowStatus({ text, hour }: { text: string; hour: number }) {
  const [said, setSaid] = useState('');
  const latest = useRef(text);
  useEffect(() => {
    latest.current = text;
  });
  useEffect(() => {
    setSaid(latest.current);
  }, [hour]);
  return (
    <span className="sr-only" role="status" data-now-status="">
      {said}
    </span>
  );
}

export interface NowDividerProps {
  /** "Now" */
  label: string;
  /** "09:05" */
  time?: string;
  className?: string;
}

/** The "Now" separator between past and upcoming rows of today's agenda. */
export function NowDivider({ label, time, className }: NowDividerProps) {
  return (
    <div
      className={['uinow-divider', className].filter(Boolean).join(' ')}
      role="separator"
      aria-label={time ? `${label}, ${time}` : label}
    >
      <i className="uinow-dot" aria-hidden="true" />
      <span className="uinow-divider-text" aria-hidden="true">
        {label}
        {time ? ` · ${time}` : ''}
      </span>
      <i className="uinow-rule" aria-hidden="true" />
    </div>
  );
}

function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const y = getComputedStyle(p).overflowY;
    if ((y === 'auto' || y === 'scroll') && p.scrollHeight > p.clientHeight) return p;
  }
  return null;
}

/**
 * Scrolls the nearest scrolling ancestor of the `[data-now-line]` inside `scope` so the line sits about a third from the
 * top. Runs once each time `active` turns true, and not at all if the view is already scrolled (the user moved it, or
 * a position was restored). `active` should be "today is visible and the line is inside the hour range".
 */
export function useScrollToNow(scope: RefObject<HTMLElement | null>, active: boolean): void {
  useEffect(() => {
    const root = scope.current;
    if (!active || !root) return;
    const line = root.querySelector<HTMLElement>('[data-now-line]');
    if (!line) return;
    const box = scrollParent(line);
    const top = box ? box.scrollTop : window.scrollY;
    if (top > 1) return;
    const view = box ? box.clientHeight : window.innerHeight;
    const lineY =
      line.getBoundingClientRect().top - (box ? box.getBoundingClientRect().top : 0) + top;
    const to = Math.max(0, Math.round(lineY - view / 3));
    if (to === 0) return;
    if (box) box.scrollTo({ top: to, behavior: 'auto' });
    else window.scrollTo({ top: to, behavior: 'auto' });
  }, [scope, active]);
}
