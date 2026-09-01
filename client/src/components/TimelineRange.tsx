/**
 * TimelineRange (design 06) — pick an activity's start and end on a day
 * timeline instead of separate Start + Duration fields. The scale is dynamic:
 * it always spans 12 hours from the start, so the range uses the full width and
 * you can log up to +12h. Drag the left handle (or the bar) to slide the start
 * in time; drag the right handle to set how long it ran. Value is start-minutes
 * into the day + duration in minutes.
 */
import { useRef } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';

const WINDOW = 720; // minutes shown across the track (12h)
const SNAP = 5; // minute granularity
const DAY = 1440;

function fmtTime(min: number): string {
  const m = ((min % DAY) + DAY) % DAY;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
function fmtDur(min: number, t: { hrShort: string; minShort: string }): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}${t.hrShort} ${m}${t.minShort}`;
  if (h) return `${h}${t.hrShort}`;
  return `${m}${t.minShort}`;
}
const snap = (v: number) => Math.round(v / SNAP) * SNAP;
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

export function TimelineRange({
  start,
  duration,
  onChange,
  units,
}: {
  start: number; // minutes into the day (0–1439)
  duration: number; // minutes (0–720)
  onChange: (start: number, duration: number) => void;
  units: { hrShort: string; minShort: string };
}) {
  const drag = useRef<{ mode: 'start' | 'end'; downX: number; start0: number } | null>(null);

  const dur = clamp(duration, 0, WINDOW);
  const endPct = (dur / WINDOW) * 100;
  const end = start + dur;

  const trackEl = (e: ReactPointerEvent) =>
    (e.currentTarget as Element).closest('.tlr-track') as Element | null;

  const onMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const el = trackEl(e);
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (d.mode === 'end') {
      const pct = clamp((e.clientX - r.left) / r.width, 0, 1);
      onChange(start, snap(pct * WINDOW));
    } else {
      const deltaMin = ((e.clientX - d.downX) / r.width) * WINDOW;
      onChange(clamp(snap(d.start0 + deltaMin), 0, DAY - 1), dur);
    }
  };
  const onStartDown = (e: ReactPointerEvent) => {
    const el = trackEl(e);
    if (el) el.setPointerCapture(e.pointerId);
    drag.current = { mode: 'start', downX: e.clientX, start0: start };
  };
  const onEndDown = (e: ReactPointerEvent) => {
    const el = trackEl(e);
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    drag.current = { mode: 'end', downX: e.clientX, start0: start };
    const r = el.getBoundingClientRect();
    const pct = clamp((e.clientX - r.left) / r.width, 0, 1);
    onChange(start, snap(pct * WINDOW));
  };
  const up = () => {
    drag.current = null;
  };

  // Scale ticks: start, +3h, +6h, +9h, +12h.
  const marks = [0, 0.25, 0.5, 0.75, 1].map((f) => fmtTime(start + f * WINDOW));
  const rangeStyle = { width: `${endPct}%` } as CSSProperties;
  const endStyle = { left: `${endPct}%` } as CSSProperties;

  return (
    <div className="tlr">
      <div className="tlr-head">
        <div className="tlr-times">
          <span className="tlr-start num">{fmtTime(start)}</span>
          <span className="tlr-arrow">→</span>
          <span className="tlr-end num">{fmtTime(end)}</span>
        </div>
        <span className="tlr-dur num">{fmtDur(dur, units)}</span>
      </div>

      <div className="tlr-track" onPointerMove={onMove} onPointerUp={up}>
        <div className="tlr-bg" />
        <div className="tlr-range" style={rangeStyle} onPointerDown={onStartDown} />
        <span
          className="tlr-handle tlr-h-start"
          role="slider"
          aria-label="start"
          onPointerDown={onStartDown}
        />
        <span
          className="tlr-handle tlr-h-end"
          role="slider"
          aria-label="end"
          style={endStyle}
          onPointerDown={onEndDown}
        />
      </div>

      <div className="tlr-scale">
        {marks.map((m, i) => (
          <span key={i}>{m}</span>
        ))}
      </div>
    </div>
  );
}
