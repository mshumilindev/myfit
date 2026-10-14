import { useId, type ReactNode } from 'react';
import { DataTable } from './DataTable';
import './EvidenceChart.css';

export interface ChartPoint {
  /** Text for the table / screen readers (date or week label). */
  label: string;
  value: number;
}

export interface EvidenceTable {
  caption: string;
  head: string[];
  /** Each row = cells as text; the LAST cell is right-aligned and bold (the value). */
  rows: string[][];
}

export interface EvidenceChartProps {
  /** Oldest first. */
  points: readonly ChartPoint[];
  /** Left of the plot: first and last x label ("7 weeks ago", "This week"). */
  xStart: string;
  xEnd: string;
  /** Under the x labels ("Estimated 1RM, kg"). */
  unit: string;
  /** `flag` = the line is the flagged stall (red). Default neutral accent. */
  tone?: 'neutral' | 'flag';
  /** Spoken summary, e.g. "Estimated 1RM 111 to 116 kg over 7 weeks, flat for 4". */
  ariaLabel: string;
  /** Text table of the same numbers. Always in the DOM; `tableVisible` shows it. */
  table?: EvidenceTable;
  tableVisible?: boolean;
  /** Plot height in px (default 96). */
  height?: number;
  /** Optional dashed reference value (a plan). */
  plan?: number;
  className?: string;
  /** Shown instead of the chart (not enough data, locked). */
  empty?: ReactNode;
}

/**
 * Evidence line chart (C-16). SVG line with a marked last point, at most 3 y ticks (min, max and the
 * plan line when given), x labels never touching the y labels (they live in their own row), and the
 * same numbers as a text table for assistive tech. No colour is the only carrier: the table and the
 * aria label say what the line does.
 */
export function EvidenceChart({
  points,
  xStart,
  xEnd,
  unit,
  tone = 'neutral',
  ariaLabel,
  table,
  tableVisible = false,
  height = 96,
  plan,
  className,
  empty,
}: EvidenceChartProps) {
  const id = useId();
  if (empty != null || points.length < 2) {
    return (
      <div className={['uievc uievc--empty', className].filter(Boolean).join(' ')}>{empty}</div>
    );
  }
  const vals = points.map((p) => p.value);
  const all = plan != null ? [...vals, plan] : vals;
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const span = hi - lo || 1;
  const y = (v: number) => 100 - ((v - lo) / span) * 100;
  const x = (i: number) => (i / (points.length - 1)) * 100;
  const d = points
    .map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(2)} ${y(p.value).toFixed(2)}`)
    .join(' ');
  const last = points[points.length - 1];
  const fmt = (n: number) => String(Math.round(n * 10) / 10);
  return (
    <figure className={['uievc', `uievc--${tone}`, className].filter(Boolean).join(' ')}>
      <div className="uievc-plot" style={{ height }}>
        <div className="uievc-y" aria-hidden>
          <span>{fmt(hi)}</span>
          <span>{fmt(lo)}</span>
        </div>
        <div className="uievc-area">
          <svg
            className="uievc-svg"
            viewBox={`0 0 100 100`}
            preserveAspectRatio="none"
            role="img"
            aria-label={ariaLabel}
            aria-describedby={table ? `${id}-t` : undefined}
          >
            <line className="uievc-grid" x1="0" x2="100" y1="0" y2="0" />
            <line className="uievc-grid" x1="0" x2="100" y1="100" y2="100" />
            {plan != null && (
              <line className="uievc-plan" x1="0" x2="100" y1={y(plan)} y2={y(plan)} />
            )}
            <path className="uievc-line" d={d} fill="none" vectorEffect="non-scaling-stroke" />
          </svg>
          <span
            className="uievc-last"
            aria-hidden
            style={{ left: `${x(points.length - 1)}%`, top: `${y(last.value)}%` }}
          />
        </div>
      </div>
      <div className="uievc-x" aria-hidden>
        <span>{xStart}</span>
        <span>{xEnd}</span>
      </div>
      <figcaption className="uievc-unit">{unit}</figcaption>
      {table && (
        <div
          className={tableVisible ? 'uievc-table' : 'uievc-table visually-hidden'}
          id={`${id}-t`}
        >
          <DataTable
            bare
            label={table.caption}
            columns={table.head.map((h, i) => ({
              id: String(i),
              header: h,
              align: i === table.head.length - 1 ? ('end' as const) : ('start' as const),
              strong: i === table.head.length - 1,
              muted: i < table.head.length - 1,
              cell: (r: string[]) => r[i],
            }))}
            rows={table.rows}
            rowKey={(r) => r.join('|')}
          />
        </div>
      )}
    </figure>
  );
}
