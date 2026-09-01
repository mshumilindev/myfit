/**
 * EffortGauge — the semicircular effort dial (design 03), colour-graded by
 * level: the arc runs green → amber → red and fills from Light up to the chosen
 * level; the needle, hub, current label and active tick all take that level's
 * colour (a calm green for Light, brass for Moderate, a hot red for Hard). The
 * Light/Moderate/Hard row below is the selector. Generic value, shaped for three.
 */
import { useRef } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { Icon } from '../ui';

export type GaugeOption<T extends string> = { value: T; label: string };

/** Level colours, low → high effort — our theme tokens: emerald, amber, ruby. */
const LEVEL_COLOR = ['var(--color-ok)', 'var(--color-accent)', 'var(--color-danger)'];

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
  const svgRef = useRef<SVGSVGElement>(null);
  const idx = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const current = options[idx];
  const bodyStyle = { '--eff': LEVEL_COLOR[idx] ?? LEVEL_COLOR[1] } as CSSProperties;
  const needleStyle = { transform: `rotate(${(idx - 1) * 90}deg)` } as CSSProperties;
  // Hide the arc entirely at Light — a fully-offset dash still renders a round
  // cap dot at the path end otherwise.
  const arcStyle = {
    strokeDashoffset: 100 - idx * 50,
    opacity: idx === 0 ? 0 : 1,
  } as CSSProperties;

  // Drag anywhere on the dial: the angle from the hub snaps to the nearest of
  // the three levels (left → Light, top → Moderate, right → Hard).
  const pick = (e: ReactPointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 200;
    const y = ((e.clientY - r.top) / r.height) * 112;
    let ang = (Math.atan2(100 - y, x - 100) * 180) / Math.PI; // 0=right, 90=up, 180=left
    if (ang < 0) ang = x < 100 ? 180 : 0; // below the hub → clamp to the near end
    const i = ang > 135 ? 0 : ang >= 45 ? 1 : 2;
    const next = options[i]?.value;
    if (next !== undefined && next !== value) onChange(next);
  };
  const onDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pick(e);
  };
  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.buttons) pick(e);
  };

  return (
    <div className="eg-card">
      <div className="eg-kicker">{title}</div>
      <div className="eg-body" style={bodyStyle}>
        <svg
          ref={svgRef}
          className="eg-svg"
          viewBox="0 0 200 112"
          role="slider"
          aria-label={title}
          aria-valuetext={current?.label}
          onPointerDown={onDown}
          onPointerMove={onMove}
        >
          <defs>
            {/* Horizontal so the arc reads green(left)→amber(top)→ruby(right),
                matching Light/Moderate/Hard along the dial. */}
            <linearGradient id="egGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" className="eg-g0" />
              <stop offset="0.5" className="eg-g1" />
              <stop offset="1" className="eg-g2" />
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
            <line x1="25" y1="100" x2="31" y2="100" />
            <line x1="100" y1="25" x2="100" y2="31" />
            <line x1="175" y1="100" x2="169" y2="100" />
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
