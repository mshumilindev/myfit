import type { ReactNode } from 'react';
import { cx } from '../cx';
import { SK_ICONS } from '../icons';
import '../tokens-e.css';
import './SkToast.css';

export type SkToastTone = 'info' | 'ok' | 'warn' | 'bad';

const DEFAULT_ICON: Record<SkToastTone, keyof typeof SK_ICONS> = {
  info: 'bell',
  ok: 'check',
  warn: 'alert',
  bad: 'alert',
};

function ToneIcon({ name }: { name: keyof typeof SK_ICONS }) {
  return (
    <svg className="sk-toast-ic" viewBox="0 0 24 24" aria-hidden="true">
      <path d={SK_ICONS[name]} />
    </svg>
  );
}

/**
 * Transient message floating above the tab bar. A polite live region (`role="status"`); `bad` uses
 * `role="alert"`. The caller owns the timer: render it, then unmount it.
 */
export function SkToast({
  tone = 'info',
  icon,
  action,
  onDismiss,
  dismissLabel = 'Dismiss',
  contained,
  children,
  className,
}: {
  tone?: SkToastTone;
  /** Override the tone icon. */
  icon?: ReactNode;
  /** Optional trailing action, e.g. an Undo button. */
  action?: ReactNode;
  onDismiss?: () => void;
  dismissLabel?: string;
  /** Position inside the nearest positioned ancestor instead of the viewport. */
  contained?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === 'bad' ? 'alert' : 'status'}
      className={cx('sk-toast', `sk-toast-${tone}`, contained && 'sk-toast-in', className)}
    >
      {icon ?? <ToneIcon name={DEFAULT_ICON[tone]} />}
      <div className="sk-toast-msg">{children}</div>
      {action}
      {onDismiss && (
        <button type="button" className="sk-toast-x" aria-label={dismissLabel} onClick={onDismiss}>
          <ToneIcon name="x" />
        </button>
      )}
    </div>
  );
}
