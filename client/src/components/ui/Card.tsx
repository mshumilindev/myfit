import type { HTMLAttributes, ReactNode } from 'react';

import './Card.css';

export type CardTone = 'neutral' | 'danger' | 'ok' | 'rest' | 'accent';
export type CardPad = 'sm' | 'md' | 'lg';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: CardTone;
  pad?: CardPad;
  /** Optional bold header rendered above the children. */
  header?: ReactNode;
  children?: ReactNode;
}

/**
 * The canonical surface container. Compose content inside it instead of
 * hand-rolling `.card`/`.rx .card` look-alikes. Tones map to token families.
 * Passes through div props (onClick, style for layout, etc.).
 */
export function Card({
  tone = 'neutral',
  pad = 'md',
  header,
  children,
  className,
  ...rest
}: CardProps) {
  const cls = ['uicard', `uicard--${tone}`, `uicard--pad-${pad}`, className]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={cls} {...rest}>
      {header != null && <div className="uicard-header">{header}</div>}
      {children}
    </div>
  );
}
