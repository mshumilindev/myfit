import type { ReactNode } from 'react';
import { Icon } from '../../ui';
import './EmptyState.css';

export interface EmptyStateProps {
  icon: string;
  title: ReactNode;
  body?: ReactNode;
  /** An action (a Button) under the text. */
  children?: ReactNode;
  /** Centre everything (a whole empty screen) instead of left-aligned. */
  centered?: boolean;
}

/**
 * "Nothing here yet" (kit `empty`): icon, title, one or two lines, optional
 * action. Every list area shows one of these when it has no rows.
 */
export function EmptyState({ icon, title, body, children, centered }: EmptyStateProps) {
  return (
    <div className={centered ? 'uiempty uiempty--center' : 'uiempty'}>
      <Icon name={icon} className="uiempty-i" />
      <h4 className="uiempty-t">{title}</h4>
      {body != null && <p className="uiempty-s">{body}</p>}
      {children}
    </div>
  );
}
