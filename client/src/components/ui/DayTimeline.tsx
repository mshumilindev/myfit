import type { ReactNode } from 'react';
import { Icon } from '../../ui';
import { toneClass, type Tone } from './tones';
import './DayTimeline.css';

export interface DayTimelineDayProps {
  /** Colour family of the day's state (trained ok · rest rest · missed danger …). */
  tone: Tone;
  /** Phosphor glyph in the node; omit for a plain dot (a logged day). */
  icon?: string;
  /** Accessible name of the node (the state), when it is not "trained". */
  nodeLabel?: string;
  /** The date line, already joined ("FRI · SEP 25 · MISSED"). */
  date: ReactNode;
  /** Right side of the date line. */
  aside?: ReactNode;
  isLast?: boolean;
  isToday?: boolean;
  /** Extra classes (legacy hooks kept by the page). */
  className?: string;
  /** The day's card(s). */
  children?: ReactNode;
}

/**
 * One day of a vertical timeline (kit `timeline`): a state node on a rail, a
 * caps date line, and the day's card. Graphite draws the node as a disc; Brass
 * Glass as a tinted rounded square — the tone family decides the colour.
 * Keeps the `hist-tl-*` hooks so the graphite look is untouched.
 */
export function DayTimelineDay({
  tone,
  icon,
  nodeLabel,
  date,
  aside,
  isLast = false,
  isToday = false,
  className,
  children,
}: DayTimelineDayProps) {
  const cls = [
    'uidt-day',
    toneClass(tone),
    isLast ? 'is-last' : '',
    isToday ? 'is-today' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={cls}>
      <div className="uidt-rail hist-tl-rail">
        {icon ? (
          <span className="uidt-node hist-tl-node" title={nodeLabel} aria-label={nodeLabel}>
            <Icon name={icon} />
          </span>
        ) : (
          <span className="uidt-dot hist-tl-dot" />
        )}
        <span className="uidt-line hist-tl-line" />
      </div>
      <div className="uidt-body hist-tl-body">
        <div className="uidt-head hist-tl-head">
          <span className="uidt-date hist-tl-date">{date}</span>
          {aside != null && <span className="uidt-aside hist-tl-aside">{aside}</span>}
        </div>
        {children}
      </div>
    </div>
  );
}
