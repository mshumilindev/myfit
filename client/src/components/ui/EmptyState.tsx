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
  /** Heading element of the title (default h4, where the title sits under a card heading). A page whose
   *  top heading is the h1 uses h2, so the outline never skips a level. */
  titleAs?: 'h2' | 'h3' | 'h4';
}

/**
 * "Nothing here yet" (kit `empty`): icon, title, one or two lines, optional
 * action. Every list area shows one of these when it has no rows.
 */
export function EmptyState({
  icon,
  title,
  body,
  children,
  centered,
  titleAs: Title = 'h4',
}: EmptyStateProps) {
  return (
    <div className={centered ? 'uiempty uiempty--center' : 'uiempty'}>
      <Icon name={icon} className="uiempty-i" />
      <Title className="uiempty-t">{title}</Title>
      {body != null && <p className="uiempty-s">{body}</p>}
      {children}
    </div>
  );
}
