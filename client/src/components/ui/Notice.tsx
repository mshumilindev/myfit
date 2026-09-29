import type { HTMLAttributes, ReactNode } from 'react';
import { Icon } from '../../ui';
import { toneClass, type Tone } from './tones';
import './Notice.css';

export interface NoticeProps extends HTMLAttributes<HTMLDivElement> {
  tone?: Tone;
  icon?: string;
  children: ReactNode;
  /** A small trailing action (a text Button) or value. */
  trail?: ReactNode;
  /** Content under the text line (a ProgressBar, a second line). */
  below?: ReactNode;
}

/**
 * A compact one-line notice strip (kit `banner`): offline, syncing, a hint.
 * Tinted by family with a left accent rule. The big frosted Banner is for
 * advisory cards with a kicker and actions; this is the quiet strip.
 */
export function Notice({
  tone = 'neutral',
  icon,
  children,
  trail,
  below,
  className,
  ...rest
}: NoticeProps) {
  const cls = ['uinotice', toneClass(tone), className].filter(Boolean).join(' ');
  return (
    <div className={cls} role={tone === 'danger' ? 'alert' : 'status'} {...rest}>
      <div className="uinotice-row">
        {icon && <Icon name={icon} className="uinotice-i" />}
        <span className="uinotice-t">{children}</span>
        {trail != null && <span className="uinotice-tr">{trail}</span>}
      </div>
      {below != null && <div className="uinotice-b">{below}</div>}
    </div>
  );
}
