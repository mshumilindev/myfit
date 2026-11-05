import type { HTMLAttributes } from 'react';
import { cx } from '../cx';
import './SkScrim.css';

/** Dimming layer behind a sheet / modal. Decorative (aria-hidden); a click dismisses when `onDismiss` is given. */
export function SkScrim({
  onDismiss,
  contained,
  className,
  ...rest
}: Omit<HTMLAttributes<HTMLDivElement>, 'onClick'> & {
  onDismiss?: () => void;
  /** Cover the nearest positioned ancestor instead of the viewport (frames, stories). */
  contained?: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      data-testid="sk-scrim"
      className={cx('sk-scrim', contained && 'sk-scrim-in', className)}
      onClick={onDismiss}
      {...rest}
    />
  );
}
