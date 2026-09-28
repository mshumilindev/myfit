import type { ReactNode } from 'react';
import { Icon } from '../../ui';
import { toneClass, type Tone } from './tones';
import './Snackbar.css';

export interface SnackbarAction {
  label: string;
  /** Fuller accessible name ("Undo logging Dance"). */
  ariaLabel?: string;
  onClick: () => void;
}

export interface SnackbarProps {
  text: ReactNode;
  sub?: ReactNode;
  /** Phosphor icon (default a filled check). */
  icon?: string;
  /** Colour family of the icon; `inherit` reads --t-* from an ancestor. */
  tone?: Tone | 'inherit';
  /** Usually Undo. */
  action?: SnackbarAction;
  /** `fixed` floats above the page bottom (safe-area aware); `inline` stays in flow. */
  position?: 'fixed' | 'inline';
  className?: string;
}

/**
 * Transient confirmation with an optional Undo — "Dance · 120 min logged".
 * Presentational: the caller owns the timer and unmounts it. Announced
 * politely (role="status").
 */
export function Snackbar({
  text,
  sub,
  icon = 'check-circle',
  tone = 'ok',
  action,
  position = 'fixed',
  className,
}: SnackbarProps) {
  return (
    <div
      className={[
        'uisnack',
        `uisnack--${position}`,
        tone === 'inherit' ? '' : toneClass(tone),
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      role="status"
      aria-live="polite"
    >
      <span className="uisnack-ic">
        <Icon name={icon} weight="fill" />
      </span>
      <span className="uisnack-t">
        {text}
        {sub != null && <span className="uisnack-s">{sub}</span>}
      </span>
      {action && (
        <button
          type="button"
          className="uisnack-act"
          aria-label={action.ariaLabel}
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
