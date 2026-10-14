import type { HTMLAttributes } from 'react';
import { toneClass, type Tone } from './tones';
import './RangeBar.css';

export interface RangeBarProps extends HTMLAttributes<HTMLDivElement> {
  value: number;
  /** Scale end (the track is 0..max). */
  max: number;
  /** The target range, drawn as a pale band behind the fill. */
  band?: readonly [number, number];
  tone?: Tone;
  /** Spoken in full ("Chest 7 sets, range 10 to 16, below"): the bar itself carries no words. */
  label: string;
}

const pct = (n: number, max: number): number => Math.max(0, Math.min(100, (n / (max || 1)) * 100));

/**
 * A value against a target range on one scale (kit group `Coach/Range bar`): "7 sets against 10 to 16". The band is the
 * target, the fill is the value; the state is always said in text beside it (never colour only).
 */
export function RangeBar({
  value,
  max,
  band,
  tone = 'accent',
  label,
  className,
  style,
  ...rest
}: RangeBarProps) {
  return (
    <div
      role="img"
      aria-label={label}
      className={['uirange', toneClass(tone), className].filter(Boolean).join(' ')}
      style={
        {
          '--uirange-v': `${pct(value, max)}%`,
          '--uirange-b0': `${band ? pct(band[0], max) : 0}%`,
          '--uirange-bw': `${band ? pct(band[1], max) - pct(band[0], max) : 0}%`,
          ...style,
        } as React.CSSProperties
      }
      {...rest}
    >
      {band && <span className="uirange-band" />}
      <span className="uirange-fill" />
    </div>
  );
}
