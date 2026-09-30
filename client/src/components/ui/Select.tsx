import { forwardRef, type ReactNode, type SelectHTMLAttributes } from 'react';
import { Icon } from '../../ui';
import './Field.css';

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: ReactNode;
  error?: ReactNode;
  hint?: ReactNode;
  /** `<option>` children. */
  children: ReactNode;
}

/** A native select in the Field well (label, hint, error, caret). */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, hint, className, children, ...rest },
  ref,
) {
  const cls = ['uifield', error ? 'uifield--err' : '', className].filter(Boolean).join(' ');
  return (
    <label className={cls}>
      {label != null && <span className="uifield-l">{label}</span>}
      <span className="uifield-box">
        <select
          ref={ref}
          className="uifield-in uifield-select"
          aria-invalid={!!error || undefined}
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
