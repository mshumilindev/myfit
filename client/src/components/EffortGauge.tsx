/**
 * EffortGauge — the semicircular effort dial (design 03), colour-graded by
 * level: the arc runs green → amber → red and fills from Light up to the chosen
 * level; the needle, hub, current label and active tick all take that level's
 * colour (a calm green for Light, brass for Moderate, a hot red for Hard). The
 * Light/Moderate/Hard row below is the selector. Generic value, shaped for three.
 */
import type { CSSProperties } from 'react';
import { Icon } from '../ui';

export type GaugeOption<T extends string> = { value: T; label: string };

/** Level colours, low → high effort. */
const LEVEL_COLOR = ['#63c088', '#e4bb76', '#e2644a'];

export function EffortGauge<T extends string>({
  title,
  value,
  options,
  onChange,
}: {
  title: string;
  value: T;
  options: GaugeOption<T>[]; // exactly three: light → moderate → hard
  onChange: (v: T) => void;
}) {
  const idx = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const current = options[idx];
  const bodyStyle = { '--eff': LEVEL_COLOR[idx] ?? LEVEL_COLOR[1] } as CSSProperties;
  const needleStyle = { transform: `rotate(${(idx - 1) * 90}deg)` } as CSSProperties;
  const arcStyle = { strokeDashoffset: 100 - idx * 50 } as CSSProperties;

  return (
    <div className="eg-card">
      <div className="eg-kicker">{title}</div>
      <div className="eg-body" style={bodyStyle}>
        <svg className="eg-svg" viewBox="0 0 200 112" role="img" aria-label={current?.label}>
          <defs>
            <linearGradient id="egGrad" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0" stopColor={LEVEL_COLOR[0]} />
              <stop offset="0.5" stopColor={LEVEL_COLOR[1]} />
              <stop offset="1" stopColor={LEVEL_COLOR[2]} />
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

        <div className="eg-legend" role="radiogroup" aria-label={title}>
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
    </div>
  );
}
