import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';

import { Icon } from '../../ui';

import './Button.css';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'rest'
  | 'fill'
  | 'sleep'
  | 'sleep-fill'
  | 'link'
  | 'ok'
  | 'photo';
export type ButtonSize = 'sm' | 'md' | 'lg';
/** Corner shape override: `pill` (fully rounded) or `round` (a true circle for square buttons). */
export type ButtonShape = 'pill' | 'round';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: ButtonShape;
  fullWidth?: boolean;
  loading?: boolean;
  /** Phosphor icon name (see ICONS in ui.tsx) rendered before the label. */
  icon?: string;
  /** Phosphor icon name rendered after the label. */
  iconTrailing?: string;
  children?: ReactNode;
}

export interface LinkButtonProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: ButtonShape;
  fullWidth?: boolean;
  icon?: string;
  iconTrailing?: string;
  children?: ReactNode;
}

/** A link that looks like a Button (website, call, mailto, in-app hash links). */
export function LinkButton({
  variant = 'primary',
  size = 'md',
  shape,
  fullWidth = false,
  icon,
  iconTrailing,
  children,
  className,
  ...rest
}: LinkButtonProps) {
  const cls = [
    'uibtn',
    `uibtn--${variant}`,
    `uibtn--${size}`,
    shape ? `uibtn--${shape}` : '',
    fullWidth ? 'uibtn--full' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <a className={cls} {...rest}>
      {icon && <Icon name={icon} />}
      {children != null && <span className="uibtn-label">{children}</span>}
      {iconTrailing && <Icon name={iconTrailing} />}
    </a>
  );
}

/**
 * The canonical Spotter button. One component for every variant/size/state so
 * new features stop hand-rolling `.btn`/`.rx .btn` look-alikes. Colours come
 * from token families only.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  shape,
  fullWidth = false,
  loading = false,
  icon,
  iconTrailing,
  disabled,
  children,
  type = 'button',
  className,
  ...rest
}: ButtonProps) {
  // A caller's className adds to the kit classes — it must never replace them.
  const cls = [
    'uibtn',
    `uibtn--${variant}`,
    `uibtn--${size}`,
    shape ? `uibtn--${shape}` : '',
    fullWidth ? 'uibtn--full' : '',
    loading ? 'is-loading' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      type={type}
      className={cls}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <span className="uibtn-spin" aria-hidden />}
      {icon && <Icon name={icon} />}
      {children != null && <span className="uibtn-label">{children}</span>}
      {iconTrailing && <Icon name={iconTrailing} />}
    </button>
  );
}

export interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'aria-label'
> {
  /** Required accessible label (icon-only button has no visible text). */
  label: string;
  icon: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: ButtonShape;
}

/** Square, icon-only button. Defaults to the ghost variant. */
export function IconButton({
  label,
  icon,
  variant = 'ghost',
  size = 'md',
  shape,
  disabled,
  type = 'button',
  className,
  ...rest
}: IconButtonProps) {
  const cls = [
    'uibtn',
    'uibtn--icon',
    `uibtn--${variant}`,
    `uibtn--${size}`,
    shape ? `uibtn--${shape}` : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button type={type} className={cls} aria-label={label} disabled={disabled} {...rest}>
      <Icon name={icon} />
    </button>
  );
}
