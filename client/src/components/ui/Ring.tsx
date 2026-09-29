import type { HTMLAttributes, ReactNode } from 'react';
import { toneClass, type Tone } from './tones';
import './Ring.css';

export interface RingProps extends HTMLAttributes<HTMLDivElement> {
  /** 0–100. */
  value: number;
  /** Diameter in px (kit: 64). */
  size?: number;
  /** Stroke width in px (kit: 6). */
  width?: number;
  tone?: Tone;
  /** What sits in the middle (a number, a glyph). */
  children?: ReactNode;
  label?: string;
}

/** A progress ring (kit `ring`): readiness, rest countdown, program %. */
export function Ring({
  value,
  size = 64,
  width = 6,
  tone = 'accent',
  children,
  label,
  className,
  style,
  ...rest
}: RingProps) {
  const pct = Math.max(0, Math.min(100, value));
  const r = (size - width) / 2;
  const c = 2 * Math.PI * r;
  const cls = ['uiring', toneClass(tone), className].filter(Boolean).join(' ');
  return (
    <div
      className={cls}
      style={{ width: size, height: size, ...style }}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-label={label}
      {...rest}
    >
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
        <circle className="uiring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={width} />
        <circle
          className="uiring-fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={width}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {children != null && <div className="uiring-c">{children}</div>}
    </div>
  );
}
