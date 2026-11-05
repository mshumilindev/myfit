import type { ReactNode } from 'react';
import { cx } from '../cx';
import { SkIcon, type SkIconName } from './SkIcon';
import '../tokens-a.css';
import './SkNote.css';

export type SkNoteTone = 'info' | 'ok' | 'warn' | 'bad';

/** Inline note box. `bad` and `warn` are announced (role=alert / status); optional leading icon. */
export function SkNote({
  tone = 'info',
  icon,
  children,
  className,
}: {
  tone?: SkNoteTone;
  icon?: SkIconName;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx('sk-note', tone !== 'info' && `sk-${tone}`, className)}
      role={tone === 'bad' ? 'alert' : tone === 'warn' ? 'status' : undefined}
    >
      {icon && <SkIcon name={icon} />}
      <div className="sk-note-b">{children}</div>
    </div>
  );
}
