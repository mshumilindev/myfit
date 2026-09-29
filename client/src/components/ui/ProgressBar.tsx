import type { HTMLAttributes } from 'react';
import { toneClass, type Tone } from './tones';
import './ProgressBar.css';

export interface ProgressBarProps extends HTMLAttributes<HTMLDivElement> {
  /** 0–100. */
  value: number;
  tone?: Tone;
  /** Track height in px (kit: 6). */
  height?: number;
  label?: string;
}

/** A thin horizontal progress bar (kit `bar`). */
export function ProgressBar({
  value,
  tone = 'accent',
  height = 6,
  label,
  className,
  style,
  ...rest
}: ProgressBarProps) {
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
