import './TimeRangeRow.css';

export interface TimeRangeRowProps {
  /** Caption and value of each end (the caller words and formats them: "From" / "09:00"). */
  fromLabel: string;
  toLabel: string;
  from: string;
  to: string;
  onFrom: () => void;
  onTo: () => void;
  className?: string;
}

/**
 * A time range on one row: two equal tap targets side by side (caption above the value), split by a hairline. A tap on a half
 * opens that one time. Sits inside a `GroupedList` like any row, so the group's surface, radius and hairlines are the kit's.
 */
export function TimeRangeRow(p: TimeRangeRowProps) {
  return (
    <div className={['uitr', p.className].filter(Boolean).join(' ')}>
      <button type="button" className="uitr-end" onClick={p.onFrom}>
        <span className="uitr-l">{p.fromLabel}</span>
        <span className="uitr-v">{p.from}</span>
      </button>
      <button type="button" className="uitr-end" onClick={p.onTo}>
        <span className="uitr-l">{p.toLabel}</span>
        <span className="uitr-v">{p.to}</span>
      </button>
    </div>
  );
}
