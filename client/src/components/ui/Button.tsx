import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { Icon } from '../../ui';

import './Button.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'rest' | 'fill';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  /** Phosphor icon name (see ICONS in ui.tsx) rendered before the label. */
  icon?: string;
  /** Phosphor icon name rendered after the label. */
  iconTrailing?: string;
  children?: ReactNode;
}

/**
 * The canonical Spotter button. One component for every variant/size/state so
 * new features stop hand-rolling `.btn`/`.rx .btn` look-alikes. Colours come
 * from token families only.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  icon,
  iconTrailing,
  disabled,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const cls = [
    'uibtn',
    `uibtn--${variant}`,
    `uibtn--${size}`,
    fullWidth ? 'uibtn--full' : '',
    loading ? 'is-loading' : '',
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
}

/** Square, icon-only button. Defaults to the ghost variant. */
export function IconButton({
  label,
  icon,
  variant = 'ghost',
  size = 'md',
  disabled,
  type = 'button',
  ...rest
}: IconButtonProps) {
  const cls = ['uibtn', 'uibtn--icon', `uibtn--${variant}`, `uibtn--${size}`].join(' ');
  return (
    <button type={type} className={cls} aria-label={label} disabled={disabled} {...rest}>
      <Icon name={icon} />
    </button>
  );
}
