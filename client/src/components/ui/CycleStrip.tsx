import { Tag } from './Tag';
import type { Tone } from './tones';
import './CycleStrip.css';

export interface CycleStripWeek {
  /** The week's number (1-based); the value the strip reports. */
  n: number;
  /** "Week 2". */
  title: string;
  /** The hint under it: "Base", "Deload". */
  tag: string;
  tone?: Tone;
}

export interface CycleStripProps {
  weeks: readonly CycleStripWeek[];
  /** The week being edited or shown. */
  value: number;
  onPick?: (n: number) => void;
  /** Accessible name of the strip ("Cycle weeks"). */
  label: string;
}

/**
 * One cell per week of a cycle (kit `cyclestrip`): the week's title and a hint tag ("Base", "Deload"). The selected week is
 * ringed. Words come from the caller (the kit holds no dictionary).
 */
export function CycleStrip({ weeks, value, onPick, label }: CycleStripProps) {
  return (
    <div className="uicy" role="tablist" aria-label={label}>
      {weeks.map((w) => (
        <button
          key={w.n}
          type="button"
          role="tab"
          aria-selected={w.n === value}
          className="uicy-wk"
          onClick={() => onPick?.(w.n)}
        >
          <b>{w.title}</b>
          <Tag tone={w.tone ?? 'neutral'}>{w.tag}</Tag>
        </button>
      ))}
    </div>
  );
}
