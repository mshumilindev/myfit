/**
 * TimelineRange (design 06) — pick an activity's start and end on a day
 * timeline instead of separate Start + Duration fields. The scale always begins
 * at the start of the calendar day (00:00) and only extends to the right as the
 * activity runs later — we add hours at the end, never trim the morning. Both
 * handles drag along the fixed scale; duration is capped at 12h. The scale's
 * right extent is recomputed when you release a handle, not while dragging.
 * Value is start-minutes into the day + duration in minutes.
 */
import { useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';

const MAX_DUR = 720; // longest activity: 12h
const DAY = 1440; // 00:00 → 00:00 next day
const MAX_END = DAY + MAX_DUR; // late start + 12h can spill past midnight
const SNAP = 5; // minute granularity

function fmtTime(min: number): string {
  const m = ((min % DAY) + DAY) % DAY;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
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
/** Scale runs 00:00 → 00:00 next day (the whole calendar day), and only
 *  stretches past midnight when the start is late enough that +12h spills over. */
const winEndFor = (start: number) => clamp(Math.max(DAY, start + MAX_DUR), DAY, MAX_END);

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
  const dur = clamp(duration, 0, MAX_DUR);
  const end = start + dur;
  // The visible scale end — frozen while dragging, recomputed on release.
  const [winEnd, setWinEnd] = useState(() => winEndFor(start));

  const startPct = clamp((start / winEnd) * 100, 0, 100);
  const endPct = clamp((end / winEnd) * 100, 0, 100);

  const posMin = (e: ReactPointerEvent, el: Element) => {
    const r = el.getBoundingClientRect();
    return snap(clamp((e.clientX - r.left) / r.width, 0, 1) * winEnd);
  };
  const trackOf = (e: ReactPointerEvent) =>
    (e.currentTarget as Element).closest('.tlr-track') as Element | null;

  const [mode, setMode] = useState<'start' | 'end' | null>(null);

  const onStartDown = (e: ReactPointerEvent) => {
    const el = trackOf(e);
    if (el) el.setPointerCapture(e.pointerId);
    setMode('start');
  };
  const onEndDown = (e: ReactPointerEvent) => {
    const el = trackOf(e);
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    setMode('end');
    const m = clamp(posMin(e, el), start, start + MAX_DUR);
    onChange(start, m - start);
  };
  const onMove = (e: ReactPointerEvent) => {
    if (!mode) return;
    const el = trackOf(e);
    if (!el) return;
    const m = posMin(e, el);
    if (mode === 'end') {
      const ne = clamp(m, start, start + MAX_DUR);
      onChange(start, ne - start);
    } else {
      const ns = clamp(m, Math.max(0, end - MAX_DUR), end);
      onChange(ns, end - ns);
    }
  };
  const onUp = () => {
    setMode(null);
    setWinEnd(winEndFor(start)); // day scale, extended past midnight only if needed
  };

  const marks = [0, 0.25, 0.5, 0.75, 1].map((f) => fmtTime(f * winEnd));
  const rangeStyle = { left: `${startPct}%`, width: `${endPct - startPct}%` } as CSSProperties;
  const startStyle = { left: `${startPct}%` } as CSSProperties;
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

      <div className="tlr-track" onPointerMove={onMove} onPointerUp={onUp}>
        <div className="tlr-bg" />
        <div className="tlr-range" style={rangeStyle} onPointerDown={onStartDown} />
        <span
          className="tlr-handle tlr-h-start"
          role="slider"
          aria-label="start"
          style={startStyle}
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
