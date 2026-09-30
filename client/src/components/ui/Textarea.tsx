import { forwardRef, type ReactNode, type TextareaHTMLAttributes } from 'react';
import './Field.css';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  error?: ReactNode;
  hint?: ReactNode;
}

/** A multi-line input in the Field well (label, hint, error). */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, hint, className, rows = 4, ...rest },
  ref,
) {
  const cls = ['uifield', error ? 'uifield--err' : '', className].filter(Boolean).join(' ');
  return (
    <label className={cls}>
      {label != null && <span className="uifield-l">{label}</span>}
      <span className="uifield-box uifield-box--area">
        <textarea
          ref={ref}
          rows={rows}
          className="uifield-in uifield-area"
          aria-invalid={!!error || undefined}
          {...rest}
        />
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
