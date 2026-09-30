import type { HTMLAttributes, MouseEvent as ReactMouseEvent, ReactNode } from 'react';

import { Icon } from '../../ui';

import './Chip.css';

export type ChipTone = 'neutral' | 'accent' | 'danger' | 'ok' | 'rest' | 'atlas';
export type ChipSize = 'sm' | 'md';

export interface ChipProps extends HTMLAttributes<HTMLElement> {
  tone?: ChipTone;
  size?: ChipSize;
  /** Active look for selectable chips (accent fill). */
  selected?: boolean;
  icon?: string;
  /** Dimmed ink for secondary information (assisting muscles etc.). */
  muted?: boolean;
  /** Frosted look for a chip that sits on top of imagery. */
  onPhoto?: boolean;
  disabled?: boolean;
  /** Interactive chip that lives inside another clickable element (a card /
   *  button): renders a span[role=button] instead of a nested <button>. */
  nested?: boolean;
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
  onPhoto = false,
  muted = false,
  children,
  className,
  onClick,
  disabled,
  nested = false,
  ...rest
}: ChipProps) {
  const cls = [
    'uichip',
    tone !== 'neutral' ? `uichip--${tone}` : '',
    size === 'sm' ? 'uichip--sm' : '',
    selected ? 'is-selected' : '',
    onPhoto ? 'uichip--photo' : '',
    muted ? 'uichip--muted' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  const inner = (
    <>
      {icon && <Icon name={icon} />}
      {children != null && <span className="uichip-l">{children}</span>}
    </>
  );
  if (onClick && nested) {
    return (
      <span
        className={cls}
        role="button"
        tabIndex={0}
        onClick={(event) => {
          event.stopPropagation();
          onClick(event);
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          event.stopPropagation();
          onClick(event as unknown as ReactMouseEvent<HTMLElement>);
        }}
        {...rest}
      >
        {inner}
      </span>
    );
  }
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
