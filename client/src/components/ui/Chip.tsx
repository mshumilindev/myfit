import type { HTMLAttributes, ReactNode } from 'react';

import { Icon } from '../../ui';

import './Chip.css';

export type ChipTone = 'neutral' | 'accent' | 'danger' | 'ok' | 'rest';
export type ChipSize = 'sm' | 'md';

export interface ChipProps extends HTMLAttributes<HTMLElement> {
  tone?: ChipTone;
  size?: ChipSize;
  /** Active look for selectable chips (accent fill). */
  selected?: boolean;
  icon?: string;
  disabled?: boolean;
  children?: ReactNode;
}

/**
 * Rounded chip / pill. Renders a <button> when `onClick` is given (selectable),
 * otherwise a <span> (static status pill). Tones map to token families.
 */
export function Chip({
  tone = 'neutral',
  size = 'md',
  selected = false,
  icon,
  children,
  className,
  onClick,
  disabled,
  ...rest
}: ChipProps) {
  const cls = [
    'uichip',
    tone !== 'neutral' ? `uichip--${tone}` : '',
    size === 'sm' ? 'uichip--sm' : '',
    selected ? 'is-selected' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  const inner = (
    <>
      {icon && <Icon name={icon} />}
      {children != null && <span>{children}</span>}
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        className={cls}
        onClick={onClick}
        disabled={disabled}
        aria-pressed={selected}
        {...rest}
      >
        {inner}
      </button>
    );
  }
  return (
    <span className={cls} {...rest}>
      {inner}
    </span>
  );
}

/** Wrapping row of chips (flex-wrap + gap). */
export function ChipGroup({ children, className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={['uichip-group', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </div>
  );
}
