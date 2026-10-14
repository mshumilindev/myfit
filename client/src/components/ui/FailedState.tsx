import type { ReactNode } from 'react';
import { Button } from './Button';
import { Icon } from '../../ui';
import './FailedState.css';

export interface FailedStateProps {
  title: ReactNode;
  body?: ReactNode;
  /** Phosphor icon (default a warning circle; `cloud-slash` when the cause is no network). */
  icon?: string;
  /** Retry label; renders the button when `onRetry` is given. */
  retryLabel?: ReactNode;
  onRetry?: () => void;
}

/**
 * "Couldn't load" (kit `failed`): a danger-tinted row with an optional Retry.
 * Pair with the offline Banner when the cause is no network.
 */
export function FailedState({
  title,
  body,
  icon = 'warning-circle',
  retryLabel,
  onRetry,
}: FailedStateProps) {
  return (
    <div className="uifailed" role="alert">
      <Icon name={icon} className="uifailed-i" />
      <div className="uifailed-t">
        <div className="uifailed-h">{title}</div>
        {body != null && <div className="uifailed-s">{body}</div>}
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
