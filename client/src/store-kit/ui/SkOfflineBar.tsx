import type { ReactNode } from 'react';
import { cx } from '../cx';
import { SK_ICONS } from '../icons';
import '../tokens-e.css';
import './SkOfflineBar.css';

/**
 * Offline banner (board 15). Offline is a normal state, not an error: calm warning tone, a polite status
 * role (never `alert`), no dismiss. The message is passed in; `title` is the bold lead ("You are offline.").
 */
export function SkOfflineBar({
  title,
  children,
  icon,
  className,
}: {
  title?: ReactNode;
  children?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div role="status" className={cx('sk-offbar', className)}>
      {icon ?? (
        <svg className="sk-offbar-ic" viewBox="0 0 24 24" aria-hidden="true">
          <path d={SK_ICONS.alert} />
        </svg>
      )}
      <div className="sk-offbar-msg">
        {title && <b>{title}</b>} {children}
      </div>
    </div>
  );
}
