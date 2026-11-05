import type { ReactNode } from 'react';
import { cx } from '../cx';
import '../tokens-d.css';
import './SkTray.css';
import { SkBtn } from './SkBtn';

export interface SkTrayProps {
  /** "3 selected" text. */
  label: ReactNode;
  /** Action, e.g. "Review". */
  actionLabel: string;
  onAction: () => void;
  className?: string;
}

/**
 * Floating "N selected · Review" bar. Fills its container; inside `SkShell` the shell floats it
 * (full width on a phone, narrow and right-aligned on desktop).
 */
export function SkTray({ label, actionLabel, onAction, className }: SkTrayProps) {
  return (
    <div className={cx('sk-try', className)} role="status">
      <b className="sk-try-label">{label}</b>
      <SkBtn kind="inv" onClick={onAction}>
        {actionLabel}
      </SkBtn>
    </div>
  );
}
