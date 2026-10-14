import type { ReactNode } from 'react';
import { Icon } from '../../ui';
import { Tag } from './Tag';
import { toneClass, type Tone } from './tones';
import './FindingRow.css';

export interface FindingRowProps {
  /** Glyph by severity (warning, info, check-circle). Decoration: the status word says it. */
  icon: string;
  tone: Tone;
  title: ReactNode;
  /** One line of why. */
  body?: ReactNode;
  /** The status word ("To fix", "Fine"): always text, never colour only. */
  status: string;
  /** A trailing action under the text (a `link` Button, "Fix in editor"). */
  action?: ReactNode;
  className?: string;
}

/**
 * One finding of a check (kit group `Coach/Finding row`): severity icon, title, the reason, the status word, an action.
 * Meant for a `<ul>` (renders an `<li>`). The status pill moves onto the title row on a phone.
 */
export function FindingRow({
  icon,
  tone,
  title,
  body,
  status,
  action,
  className,
}: FindingRowProps) {
  return (
    <li className={['uifind', toneClass(tone), className].filter(Boolean).join(' ')}>
      <Icon name={icon} className="uifind-i" aria-hidden />
      <span className="uifind-t">
        <span className="uifind-h">
          <b className="uifind-title">{title}</b>
          <Tag tone={tone} className="uifind-tag">
            {status}
          </Tag>
        </span>
        {body != null && <span className="uifind-b">{body}</span>}
        {action != null && <span className="uifind-a">{action}</span>}
      </span>
    </li>
  );
}
