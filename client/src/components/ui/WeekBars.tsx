import { toneClass, type Tone } from './tones';
import './WeekBars.css';

/** One day of a week: its colour family (undefined = nothing recorded) and bar height. */
export interface WeekBar {
  tone?: Tone;
  level: 1 | 2 | 3;
}

/** Seven tiny bars — how a week was filled, at a glance (design B "Week strip"). */
export function WeekBars({ days, className }: { days: WeekBar[]; className?: string }) {
  return (
    <span className={['uiwb', className].filter(Boolean).join(' ')} aria-hidden>
      {days.map((d, i) => (
        <i
          key={i}
          className={`uiwb-bar uiwb-bar--${d.level}${d.tone ? ` ${toneClass(d.tone)}` : ' uiwb-bar--none'}`}
        />
      ))}
    </span>
  );
}
