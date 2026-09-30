import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { Icon } from '../../ui';
import './SearchField.css';

export interface SearchFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type' | 'placeholder'
> {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** Accessible label for the clear button. */
  clearLabel: string;
  /** Shown at the end while the field is empty (e.g. "All types · 24"). */
  hint?: ReactNode;
}

/**
 * THE search input: magnifier, text, a clear (×) once typed, an optional hint
 * while empty. Every search box in the app (library, picker, gyms, activities…)
 * is this one component — pass `className` only for layout (margins/flex).
 */
export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  { value, onChange, placeholder, clearLabel, hint, className, ...rest },
  ref,
) {
  return (
    <label className={['uisearch', className ?? ''].filter(Boolean).join(' ')}>
      <Icon name="magnifying-glass" className="uisearch-ic" />
      <input
        {...rest}
        ref={ref}
        type="search"
        className="uisearch-input"
        value={value}
        placeholder={placeholder}
        aria-label={rest['aria-label'] ?? placeholder}
        enterKeyHint="search"
        onChange={(e) => onChange(e.target.value)}
      />
      {value !== '' ? (
        <button
          type="button"
          className="uisearch-clear"
          aria-label={clearLabel}
          onClick={() => {
            onChange('');
            if (ref && typeof ref !== 'function') ref.current?.focus();
          }}
        >
          <Icon name="x" />
        </button>
      ) : (
        hint != null && hint !== false && <span className="uisearch-hint">{hint}</span>
      )}
    </label>
  );
});
