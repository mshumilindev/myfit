import type { InputHTMLAttributes } from 'react';
import { toneClass, type Tone } from './tones';
import './Checkbox.css';

export interface CheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'onChange' | 'size'
> {
  checked: boolean;
  onChange: (checked: boolean) => void;
  tone?: Tone;
}

/**
 * A 22px checkbox (kit `check`): a real <input type="checkbox"> under a drawn
 * box, so keyboard, forms and wrapping <label>s work. Label it with a wrapping
 * <label>, aria-label or aria-labelledby.
 */
export function Checkbox({
  checked,
  onChange,
  tone = 'accent',
  className,
  ...rest
}: CheckboxProps) {
  const cls = ['uicheck', toneClass(tone), className].filter(Boolean).join(' ');
  return (
    <span className={cls}>
      <input
        type="checkbox"
        className="uicheck-in"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        {...rest}
      />
      <span className="uicheck-box" aria-hidden="true">
        <svg viewBox="0 0 16 16" width="14" height="14">
          <path
            d="M3 8.5l3.2 3L13 4.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </span>
  );
}
