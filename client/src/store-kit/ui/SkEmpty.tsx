import type { ReactNode } from 'react';
import { cx } from '../cx';
import '../tokens-b.css';
import './SkEmpty.css';

/** Empty state (boards 17, 18, 32): optional icon tile, title, body, actions row, optional extra content. */
export function SkEmpty({
  icon,
  title,
  body,
  actions,
  children,
  className,
}: {
  /** Icon tile slot (e.g. a 64px SkTile with an SkIcon). */
  icon?: ReactNode;
  title?: ReactNode;
  body?: ReactNode;
  actions?: ReactNode;
  /** Extra content under the body (hints, suggestion chips). */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('sk-empty', className)} role="status">
      {icon}
      {title && <h2 className="sk-empty-title">{title}</h2>}
      {body && <p className="sk-empty-body">{body}</p>}
      {children}
      {actions && <div className="sk-empty-actions">{actions}</div>}
    </div>
  );
}
