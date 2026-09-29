/**
 * A row of numbers in one card (the History "Last 30 days"): each cell is a
 * value (optionally a unit and a colour family) over a short label, cells
 * split by hairlines. Cells share the width equally.
 */
import type { ReactNode } from 'react';
import { toneClass, type Tone } from './tones';
import './StatStrip.css';

export interface StatStripItem {
  value: ReactNode;
  label: string;
  unit?: string;
  /** Colour family of the value (default: plain text). */
  tone?: Tone;
}

export function StatStrip({
  items,
  label,
  className,
}: {
  items: StatStripItem[];
  /** Accessible name of the group. */
  label?: string;
  className?: string;
}) {
  return (
    <div className={['uiss', className].filter(Boolean).join(' ')} role="group" aria-label={label}>
      {items.map((it) => (
        <div key={it.label} className="uiss-cell">
          <span className={`uiss-val${it.tone ? ` is-toned ${toneClass(it.tone)}` : ''}`}>
            {it.value}
            {it.unit && <span className="uiss-unit">{it.unit}</span>}
          </span>
          <span className="uiss-lab">{it.label}</span>
        </div>
      ))}
    </div>
  );
}
