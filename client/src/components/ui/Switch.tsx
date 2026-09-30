import type { InputHTMLAttributes } from 'react';
import { toneClass, type Tone } from './tones';
import './Switch.css';

export interface SwitchProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'onChange' | 'size' | 'role'
> {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Colour family of the "on" track; `inherit` reads --t-* from an ancestor. */
  tone?: Tone | 'inherit';
  size?: 'sm' | 'md';
}

/**
 * iOS-style switch: a real checkbox with role="switch" (keyboard, forms,
 * label clicks for free) under a drawn track. Label it with a wrapping
 * <label>, aria-label or aria-labelledby.
 */
export function Switch({
  checked,
  onChange,
  tone = 'accent',
  size = 'md',
  className,
  disabled,
  ...rest
}: SwitchProps) {
  return (
    <span
      className={['uisw', `uisw--${size}`, tone === 'inherit' ? '' : toneClass(tone), className]
        .filter(Boolean)
        .join(' ')}
    >
      <input
        type="checkbox"
        role="switch"
        className="uisw-input"
        checked={checked}
        aria-checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        {...rest}
      />
      <span className="uisw-track" aria-hidden="true" />
    </span>
  );
}

/**
 * The same switch drawn as a read-only indicator, for a row that is itself the
 * button (the row owns the click; a nested input would toggle twice). Exposes
 * role="switch" + aria-checked like the old ui.tsx Switch.
 */
export function SwitchIndicator({
  on,
  tone = 'accent',
  size = 'md',
  className,
}: {
  on: boolean;
  tone?: Tone | 'inherit';
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <span
      className={[
        'uisw',
        'uisw--ind',
        `uisw--${size}`,
        on ? 'is-on' : '',
        tone === 'inherit' ? '' : toneClass(tone),
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      role="switch"
      aria-checked={on}
    >
      <span className="uisw-track" aria-hidden="true" />
    </span>
  );
}
