import type { ReactNode } from 'react';
import { cx } from '../cx';
import '../tokens-a.css';
import './SkBadge.css';

export type SkBadgeKind = 'app' | 'add' | 'soon' | 'ok' | 'warn' | 'new';

/** Small uppercase label: app / add-on / coming soon / ok / warn / new. */
export function SkBadge({
  kind,
  children,
  className,
}: {
  kind: SkBadgeKind;
  children: ReactNode;
  className?: string;
}) {
  return <span className={cx('sk-bd', `sk-bd-${kind}`, className)}>{children}</span>;
}
