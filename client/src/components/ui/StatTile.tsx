import type { HTMLAttributes, ReactNode } from 'react';
import { toneClass, type Tone } from './tones';
import './StatTile.css';

export interface StatTileProps extends HTMLAttributes<HTMLDivElement> {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  /** A delta or trend shown beside the value ("+2.5 kg", "▲ 4%"). */
  delta?: ReactNode;
  /** A footnote under the value ("2 recovering", "02:00 → 10:30"). */
  sub?: ReactNode;
  /** Colours the label and delta; the value stays ink. */
  tone?: Tone;
  /** Big value (kit `stat(big)`: 44px) vs 28px. */
  big?: boolean;
  /** Optional 0–100 bar under the value. */
  bar?: number;
}

/**
 * One number with a label (kit `stat` / `stat_card`): the Today "Readiness" /
 * "Last night" tiles, KPI cards on Progress. Wrap in a Card for the chrome;
 * several in a row = StatStrip.
 */
export function StatTile({
  label,
  value,
  unit,
  delta,
  sub,
  tone = 'neutral',
  big = false,
  bar,
  className,
  ...rest
}: StatTileProps) {
  const cls = ['uistat', toneClass(tone), big ? 'uistat--big' : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={cls} {...rest}>
      <span className="uistat-l">{label}</span>
      <span className="uistat-row">
        <span className="uistat-v">{value}</span>
        {unit != null && <span className="uistat-u">{unit}</span>}
        {delta != null && <span className="uistat-d">{delta}</span>}
      </span>
      {bar != null && (
        <span className="uistat-bar" aria-hidden="true">
          <span style={{ width: `${Math.max(0, Math.min(100, bar))}%` }} />
        </span>
      )}
      {sub != null && <span className="uistat-s">{sub}</span>}
    </div>
  );
}
