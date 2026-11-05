import type { ReactNode } from 'react';
import { cx } from '../cx';
import '../tokens-c.css';
import './SkStatusHeader.css';

export type SkStatus = 'ok' | 'warn' | 'bad' | 'progress';

/**
 * Page heading for outcome screens (review 09, installing 10, done 11, offline 15, failed 16):
 * a bare icon (no background) and a title, both coloured by status.
 */
export function SkStatusHeader({
  status,
  icon,
  title,
  statusLabel,
  aside,
  className,
}: {
  status: SkStatus;
  icon: ReactNode;
  title?: ReactNode;
  /** Screen-reader text for the status when the title alone does not say it. */
  statusLabel?: string;
  /** Right side (e.g. the avatar). */
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cx('sk-sth', `sk-sth-${status}`, className)} data-status={status}>
      <div className="sk-sth-main">
        <span className="sk-sth-icon" aria-hidden="true">
          {icon}
        </span>
        {(title || statusLabel) && (
          <h1 className="sk-sth-title">
            {statusLabel && <span className="sk-sth-sr">{statusLabel}: </span>}
            {title}
          </h1>
        )}
      </div>
      {aside}
    </header>
  );
}
