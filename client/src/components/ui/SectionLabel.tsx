import type { HTMLAttributes, ReactNode } from 'react';
import { toneClass, type Tone } from './tones';
import './SectionLabel.css';

export interface SectionLabelProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Optional action rendered on the right (a text Button, "See all"). */
  action?: ReactNode;
  /** Colour the label in a family (illness, sleep…); default neutral grey. */
  tone?: Tone;
}

/**
 * The uppercase caps label above a group of content (kit `section` / `lbl`:
 * 10.5px, .12em tracking). Absorbs .section-label, .kicker and
 * .settings-group-label. Use a real heading element via `as` when the section
 * needs one for assistive tech.
 */
export function SectionLabel({ children, action, tone, className, ...rest }: SectionLabelProps) {
  const cls = ['uisec', tone ? toneClass(tone) : '', tone ? 'uisec--toned' : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={cls} {...rest}>
      <span className="uisec-l">{children}</span>
      {action != null && <span className="uisec-a">{action}</span>}
    </div>
  );
}
