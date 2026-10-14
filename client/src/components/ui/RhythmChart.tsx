import './RhythmChart.css';

export interface RhythmBar {
  /** X label ("W-3", "Now"). */
  label: string;
  value: number;
  /** The running period: drawn dashed, not as a finished bar. */
  current?: boolean;
  /** Spoken name, "Week 3 weeks ago: 4 sessions". */
  ariaLabel: string;
}

export interface RhythmChartProps {
  bars: readonly RhythmBar[];
  /** The plan per bar, drawn as a dashed cap over every bar. */
  plan: number;
  /** Top of the y axis; defaults to the plan or the highest bar, rounded up to an even number. */
  max?: number;
  /** Plot height in px. */
  height?: number;
  /** Spoken name of the whole chart. */
  label: string;
  /** Legend: what a bar is, and what the dashed line is. */
  legendDone: string;
  legendPlan: string;
  className?: string;
}

/**
 * Bars per period with a dashed plan line (Client 360 rhythm). Axis 0..max (3 ticks), the value on top of every
 * bar, labels under, a legend that names both encodings. Bars are never the only carrier: each has an aria label.
 */
export function RhythmChart({
  bars,
  plan,
  max,
  height = 112,
  label,
  legendDone,
  legendPlan,
  className,
}: RhythmChartProps) {
  const top = max ?? Math.max(2, Math.ceil(Math.max(plan, ...bars.map((b) => b.value)) / 2) * 2);
  const ticks = [top, Math.round(top / 2), 0];
  const pct = (v: number) => `${(Math.min(v, top) / top) * 100}%`;
  return (
    <figure className={['uirh', className].filter(Boolean).join(' ')} aria-label={label}>
      <div className="uirh-plot">
        <div className="uirh-y" style={{ height }} aria-hidden>
          {ticks.map((t, i) => (
            <span key={i}>{t}</span>
          ))}
        </div>
        <div className="uirh-p">
          <div className="uirh-g" style={{ height }} aria-hidden>
            <i />
            <i />
            <i />
          </div>
          <ul className="uirh-c" style={{ height }}>
            {bars.map((b) => (
              <li key={b.label} className="uirh-bar" aria-label={b.ariaLabel}>
                <span
                  className={b.current ? 'uirh-s is-now' : 'uirh-s'}
                  style={{ height: pct(b.value) }}
                  aria-hidden
                >
                  <span className="uirh-v">{b.value}</span>
                </span>
                <u className="uirh-plan" style={{ bottom: pct(plan) }} aria-hidden />
              </li>
            ))}
          </ul>
          <div className="uirh-x" aria-hidden>
            {bars.map((b) => (
              <span key={b.label}>{b.label}</span>
            ))}
          </div>
        </div>
      </div>
      <figcaption className="uirh-leg">
        <span>
          <i /> {legendDone}
        </span>
        <span>{legendPlan}</span>
      </figcaption>
    </figure>
  );
}
