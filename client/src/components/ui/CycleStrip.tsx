import type { KeyboardEvent } from 'react';
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
  // Tablist keyboard model: one tab stop (the selected week), arrows / Home / End move the selection and the focus.
  const move = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const to =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? Math.min(weeks.length - 1, i + 1)
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? Math.max(0, i - 1)
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? weeks.length - 1
              : -1;
    if (to < 0) return;
    e.preventDefault();
    onPick?.(weeks[to].n);
    (e.currentTarget.parentElement?.children[to] as HTMLElement | undefined)?.focus();
  };
  return (
    <div className="uicy" role="tablist" aria-label={label}>
      {weeks.map((w, i) => (
        <button
          key={w.n}
          type="button"
          role="tab"
          aria-selected={w.n === value}
          tabIndex={w.n === value ? 0 : -1}
          className="uicy-wk"
          onClick={() => onPick?.(w.n)}
          onKeyDown={(e) => move(e, i)}
        >
          <b>{w.title}</b>
          <Tag tone={w.tone ?? 'neutral'}>{w.tag}</Tag>
        </button>
      ))}
    </div>
  );
}
