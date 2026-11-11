import { toneClass } from './tones';
import './DayBar.css';

export interface DayBarProps {
  /** Ranges in minutes [from, to) inside 0..1440, already sorted and non-overlapping. */
  ranges: readonly (readonly [number, number])[];
  /** Colour family of the filled parts. */
  tone?: 'accent' | 'inherit';
  /** Full-width bar for a page header instead of the compact one that sits in a row. */
  wide?: boolean;
  /** Spoken description ("Free 06:00-08:00 and 18:00-21:00"). The bar is a picture; without a label it is hidden from a screen reader. */
  label?: string;
  className?: string;
}

/**
 * A day as a strip: the hours that are on are filled, the rest is the empty track (kit `daybar`). It draws one thing, a day, and carries no text; the row or heading beside it says what it means. Used by the Planner's weekly hours.
 */
export function DayBar({ ranges, tone = 'accent', wide, label, className }: DayBarProps) {
  const cls = [
    'uidb',
    wide ? 'uidb--wide' : '',
    tone === 'inherit' ? '' : toneClass(tone),
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <span
      className={cls}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      {ranges.map(([a, b]) => (
        <span
          key={`${a}-${b}`}
          className="uidb-on"
          style={{ left: `${(a / 1440) * 100}%`, width: `${((b - a) / 1440) * 100}%` }}
        />
      ))}
    </span>
  );
}
