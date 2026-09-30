import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import './Field.css';

export interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Label above the input. */
  label?: ReactNode;
  /** Error text under the input; also paints the error ring. */
  error?: ReactNode;
  /** Hint under the input (shown when there is no error). */
  hint?: ReactNode;
  /** Leading icon / glyph. */
  lead?: ReactNode;
  /** Trailing content (a unit, a clear button). */
  trail?: ReactNode;
  /** Well-less inline variant for a value inside a list row (no ring, no padding). */
  bare?: boolean;
}

/**
 * A text input with label, hint and error (kit `field`): a 50px well with a
 * hairline ring, accent ring on focus, danger ring on error. Absorbs .input
 * and the per-page field look-alikes. Numbers you step ± live in
 * NumberStepper; typed times in TimeInput.
 */
export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, error, hint, lead, trail, bare, className, id, ...rest },
  ref,
) {
  const cls = ['uifield', error ? 'uifield--err' : '', bare ? 'uifield--bare' : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <label className={cls}>
      {label != null && <span className="uifield-l">{label}</span>}
      <span className="uifield-box">
        {lead != null && <span className="uifield-lead">{lead}</span>}
        <input
          ref={ref}
          id={id}
          className="uifield-in"
          aria-invalid={!!error || undefined}
          {...rest}
        />
        {trail != null && <span className="uifield-trail">{trail}</span>}
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
