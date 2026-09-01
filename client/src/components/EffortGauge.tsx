/**
 * EffortGauge — a semicircular gauge for the three effort levels (design 03).
 * The needle swings and a brass arc fills from Light up to the chosen level;
 * the row of labels below is the actual selector. Accent-tokened, so it reads
 * brass in the Gym. Generic over the option value, but shaped for exactly three.
 */
import type { CSSProperties } from 'react';
import { Icon } from '../ui';

export type GaugeOption<T extends string> = { value: T; label: string };

export function EffortGauge<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: GaugeOption<T>[]; // exactly three: light → moderate → hard
  onChange: (v: T) => void;
  ariaLabel?: string;
}) {
  const idx = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const current = options[idx];
  const needleStyle = { transform: `rotate(${(idx - 1) * 90}deg)` } as CSSProperties;
  const arcStyle = { strokeDashoffset: 100 - idx * 50 } as CSSProperties;

  return (
    <div className="eg">
      <svg className="eg-svg" viewBox="0 0 200 112" role="img" aria-label={current?.label}>
        <defs>
          <linearGradient id="effGrad" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" className="eg-g0" />
            <stop offset="1" className="eg-g1" />
          </linearGradient>
        </defs>
        <path className="eg-track" d="M18 100 A82 82 0 0 1 182 100" />
        <path
          className="eg-arc"
          d="M18 100 A82 82 0 0 1 182 100"
          pathLength={100}
          style={arcStyle}
        />
        <g className="eg-ticks">
          <line x1="18" y1="100" x2="26" y2="100" />
          <line x1="100" y1="18" x2="100" y2="27" />
          <line x1="182" y1="100" x2="174" y2="100" />
        </g>
        <g className="eg-needle" style={needleStyle}>
          <line x1="100" y1="100" x2="100" y2="34" />
        </g>
        <circle className="eg-hub" cx="100" cy="100" r="7" />
      </svg>

      <div className="eg-current">
        <Icon name="gauge" weight="fill" />
        <span>{current?.label}</span>
      </div>

      <div className="eg-legend" role="radiogroup" aria-label={ariaLabel}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            className={`eg-opt${value === o.value ? ' on' : ''}`}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
