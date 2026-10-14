import { forwardRef, type ReactNode, type SelectHTMLAttributes } from 'react';
import { Icon } from '../../ui';
import './Field.css';

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  /** Control scale step (styles.css --ctl-h-*): sm 36 / md 44 (default) / lg 52. */
  size?: 'sm' | 'md' | 'lg';
  label?: ReactNode;
  /**
   * Put the label INSIDE the well, before the value ("Gym  All gyms"), instead of stacked above it: a filter in a
   * toolbar then has the same height as its neighbours. Needs a text `label` (it also names the select).
   */
  labelInline?: boolean;
  error?: ReactNode;
  hint?: ReactNode;
  /** `<option>` children. */
  children: ReactNode;
}

/** A native select in the Field well (label, hint, error, caret). */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, labelInline = false, error, hint, size = 'md', className, children, ...rest },
  ref,
) {
  const inline = labelInline && label != null;
  const cls = [
    'uifield',
    `uifield--${size}`,
    error ? 'uifield--err' : '',
    inline ? 'uifield--inline' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <label className={cls}>
      {label != null && !inline && <span className="uifield-l">{label}</span>}
      <span className="uifield-box">
        {inline && <span className="uifield-pre">{label}</span>}
        <select
          ref={ref}
          className="uifield-in uifield-select"
          aria-invalid={!!error || undefined}
          aria-label={inline && typeof label === 'string' ? label : undefined}
          {...rest}
        >
          {children}
        </select>
        <Icon name="caret-down" className="uifield-caret" />
      </span>
      {error != null ? (
        <span className="uifield-err" role="alert">
          {error}
        </span>
      ) : (
        hint != null && <span className="uifield-hint">{hint}</span>
      )}
    </label>
  );
});
