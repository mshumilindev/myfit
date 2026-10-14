import type { HTMLAttributes } from 'react';
import { toneClass, type Tone } from './tones';
import './ProgressBar.css';

export interface ProgressBarSegment {
  /** Share of the whole (any positive number; segments are sized by their ratio). */
  value: number;
  tone: Tone;
}

export interface ProgressBarProps extends HTMLAttributes<HTMLDivElement> {
  /** 0–100. Ignored when `segments` is given. */
  value: number;
  /**
   * A stacked bar: one coloured segment per part, sized by `value` (an outcome split, "5 improved ·
   * 2 no change"). Decorative (`aria-hidden`): say the numbers in text next to it.
   */
  segments?: readonly ProgressBarSegment[];
  tone?: Tone;
  /** Track height in px (kit: 6). */
  height?: number;
  label?: string;
}

/** A thin horizontal progress bar (kit `bar`). */
export function ProgressBar({
  value,
  segments,
  tone = 'accent',
  height = 6,
  label,
  className,
  style,
  ...rest
}: ProgressBarProps) {
  if (segments) {
    return (
      <div
        className={['uibar', 'uibar--stack', className].filter(Boolean).join(' ')}
        style={{ height, ...style }}
        aria-hidden="true"
        {...rest}
      >
        {segments
          .filter((g) => g.value > 0)
          .map((g, i) => (
            <span
              key={i}
              className={`uibar-seg ${toneClass(g.tone)}`}
              style={{ flexGrow: g.value }}
            />
          ))}
      </div>
    );
  }
  const pct = Math.max(0, Math.min(100, value));
  const cls = ['uibar', toneClass(tone), className].filter(Boolean).join(' ');
  return (
    <div
      className={cls}
      style={{ height, ...style }}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-label={label}
      {...rest}
    >
      <span className="uibar-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}
