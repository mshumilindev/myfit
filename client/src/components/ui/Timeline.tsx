/**
 * Read-only period rail (Health history timeline): a date column, a vertical
 * rail with coloured period bars in up to two lanes, and the row content.
 * Newest on top. Nothing on it is interactive — it only shows.
 */
import type { ReactNode } from 'react';
import { toneClass, type Tone } from './tones';
import './Timeline.css';

export type TimelineEdge = 'edge' | 'inset' | 'mid';

export interface TimelineBar {
  tone: Tone;
  /** `single` centred, or lane 0 / 1 when two periods overlap. */
  lane: 'single' | 0 | 1;
  /** Where the bar starts / stops in the row; `inset` ends are rounded. */
  top?: TimelineEdge;
  bottom?: Exclude<TimelineEdge, 'mid'>;
  /** Planned (future) — drawn faded. */
  faded?: boolean;
}

export interface TimelineRowSpec {
  key: string;
  /** Left column (use <TimelineDate>). */
  date?: ReactNode;
  /**
   * The rail through this row: `solid`, `dashed` (future), `now` (dashed
   * above, solid below, with the Now ring), `origin` (solid above, end dot).
   */
  rail?: 'solid' | 'dashed' | 'now' | 'origin';
  bars?: TimelineBar[];
  /** `month` — uppercase divider row; `gap` — faint free-days row. */
  kind?: 'item' | 'month' | 'gap';
  label?: ReactNode;
  sub?: ReactNode;
  value?: ReactNode;
  /** Emphasised label (the Now row). */
  strong?: boolean;
}

export function Timeline({ rows, label }: { rows: TimelineRowSpec[]; label?: string }) {
  return (
    <div className="uitl" role="list" aria-label={label}>
      {rows.map((r) => (
        <div
          key={r.key}
          role="listitem"
          className={['uitl-row', r.kind && r.kind !== 'item' ? `uitl-row--${r.kind}` : '']
            .filter(Boolean)
            .join(' ')}
        >
          <div className="uitl-date">{r.date}</div>
          <div className="uitl-rail" aria-hidden="true">
            <Rail kind={r.rail ?? 'solid'} />
            {r.bars?.map((b, i) => (
              <span
                key={i}
                className={[
                  'uitl-bar',
                  `uitl-bar--${b.lane === 'single' ? 's' : b.lane === 0 ? 'a' : 'b'}`,
                  `top-${b.top ?? 'inset'}`,
                  `bot-${b.bottom ?? 'inset'}`,
                  b.faded ? 'is-faded' : '',
                  toneClass(b.tone),
                ]
                  .filter(Boolean)
                  .join(' ')}
              />
            ))}
            {r.rail === 'now' && <span className="uitl-now" />}
            {r.rail === 'origin' && <span className="uitl-end" />}
          </div>
          <div className={`uitl-body${r.strong ? ' is-strong' : ''}`}>
            <span className="uitl-lb">
              <span className={`uitl-l${r.strong ? ' is-strong' : ''}`}>{r.label}</span>
              {r.sub != null && <span className="uitl-s">{r.sub}</span>}
            </span>
            {r.value != null && <span className="uitl-v">{r.value}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function Rail({ kind }: { kind: 'solid' | 'dashed' | 'now' | 'origin' }) {
  if (kind === 'now')
    return (
      <>
        <span className="uitl-line is-dashed to-mid" />
        <span className="uitl-line from-mid" />
      </>
    );
  if (kind === 'origin') return <span className="uitl-line to-mid" />;
  return <span className={`uitl-line${kind === 'dashed' ? ' is-dashed' : ''}`} />;
}

/** Date column: the end day on top, the start day at the bottom for a range. */
export function TimelineDate({
  day,
  weekday,
  startDay,
  startWeekday,
  text,
  emphasis = false,
}: {
  day?: ReactNode;
  weekday?: ReactNode;
  startDay?: ReactNode;
  startWeekday?: ReactNode;
  /** A single small caption instead (Later, a gap's date, Now). */
  text?: ReactNode;
  /** Bold caption (the Now row). */
  emphasis?: boolean;
}) {
  if (text != null) return <span className={`uitl-dtext${emphasis ? ' is-em' : ''}`}>{text}</span>;
  return (
    <>
      <span className="uitl-d">
        <b>{day}</b>
        <span>{weekday}</span>
      </span>
      {startDay != null && (
        <span className="uitl-d">
          <b>{startDay}</b>
          <span>{startWeekday}</span>
        </span>
      )}
    </>
  );
}
