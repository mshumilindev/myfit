import type { HTMLAttributes, MouseEvent as ReactMouseEvent, ReactNode } from 'react';

import { Icon } from '../../ui';

import './Chip.css';

export type ChipTone = 'neutral' | 'accent' | 'danger' | 'ok' | 'rest' | 'atlas';
/** Control scale: xs 28 (dense inline), sm 36 (default for chips), md 44, lg 52 — styles.css --ctl-h-*. */
export type ChipSize = 'xs' | 'sm' | 'md' | 'lg';

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
  /** A figure after the label ("All 14"): tabular, dimmed, announced as part of the name. */
  count?: number | string;
  /** A solid tab at the start of the chip ("×2"), in the chip's tone colour. */
  lead?: ReactNode;
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
  size = 'sm',
  selected = false,
  icon,
  onPhoto = false,
  muted = false,
  children,
  className,
  onClick,
  disabled,
  count,
  lead,
  nested = false,
  ...rest
}: ChipProps) {
  const cls = [
    'uichip',
    tone !== 'neutral' ? `uichip--${tone}` : '',
    `uichip--${size}`,
    selected ? 'is-selected' : '',
    onPhoto ? 'uichip--photo' : '',
    muted ? 'uichip--muted' : '',
    lead != null ? 'uichip--has-lead' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  const inner = (
    <>
      {lead != null && <b className="uichip-lead">{lead}</b>}
      {icon && <Icon name={icon} />}
      {(children != null || count != null) && (
        <span className="uichip-l">
          {children}
          {count != null && (
            <>
              {children != null && ' '}
              <span className="uichip-n">{count}</span>
            </>
          )}
        </span>
      )}
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

export interface ChipGroupProps extends HTMLAttributes<HTMLDivElement> {
  /** One row that scrolls sideways instead of wrapping (many filters on a phone). */
  scroll?: boolean;
  /** Equal-width chips across the row. */
  fill?: boolean;
}

/** Row of chips: wraps by default; `scroll` = one sideways-scrolling row; `fill` = equal columns. The only chip layout. */
export function ChipGroup({ children, className, scroll, fill, ...rest }: ChipGroupProps) {
  return (
    <div
      className={[
        'uichip-group',
        scroll ? 'uichip-group--scroll' : '',
        fill ? 'uichip-group--fill' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </div>
  );
}
