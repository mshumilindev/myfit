import type { HTMLAttributes, ReactNode } from 'react';
import { toneClass, type Tone } from './tones';
import './SeverityDot.css';

export interface SeverityDotProps extends HTMLAttributes<HTMLSpanElement> {
  /** Colour family of the dot. The label is always text: severity is never colour only. */
  tone?: Tone;
  /** Hide the dot (a neutral "All clear" word). */
  dot?: boolean;
  children: ReactNode;
}

/**
 * A status dot with its word ("Urgent", "Watch", "Improved"). Used on Today rows and board cards
 * and in the Signals list. The dot is decoration, the word carries the meaning.
 */
export function SeverityDot({
  tone = 'neutral',
  dot = true,
  children,
  className,
  ...rest
}: SeverityDotProps) {
  return (
    <span className={['uisevdot', toneClass(tone), className].filter(Boolean).join(' ')} {...rest}>
      {dot && <span className="uisevdot-d" aria-hidden />}
      <span className="uisevdot-t">{children}</span>
    </span>
  );
}
