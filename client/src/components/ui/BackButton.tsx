import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon } from '../../ui';
import './BackButton.css';

export interface BackButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'aria-label' | 'children'
> {
  /** Accessible label ("Back"). */
  label: string;
  /** Visible destination text next to the arrow ("Overview") — turns the round button into a pill. */
  text?: ReactNode;
  /** Over a photo / hero image: dark translucent well instead of the surface one. */
  overlay?: boolean;
}

/**
 * THE back button — every screen, sheet and header uses this one (kit `ibtn`).
 * A 36 px round well with a chevron; `text` adds the destination, `overlay`
 * sits on photos. Sizes/colours live in BackButton.css + glass.css only.
 */
export function BackButton({
  label,
  text,
  overlay,
  className,
  type = 'button',
  ...rest
}: BackButtonProps) {
  return (
    <button
      type={type}
      className={[
        'uiback',
        'back',
        text ? 'uiback--text' : '',
        overlay ? 'uiback--overlay' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={label}
      {...rest}
    >
      <Icon name="caret-left" />
      {text && <span className="uiback-t">{text}</span>}
    </button>
  );
}
