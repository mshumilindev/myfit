import { Icon } from '../../ui';
import './SearchField.css';

export interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** Accessible label for the clear button. */
  clearLabel: string;
  autoFocus?: boolean;
  className?: string;
}

/** A single-line search input: magnifier, text, and a clear (×) once typed. */
export function SearchField({
  value,
  onChange,
  placeholder,
  clearLabel,
  autoFocus,
  className,
}: SearchFieldProps) {
  return (
    <label className={['uisearch', className ?? ''].filter(Boolean).join(' ')}>
      <Icon name="magnifying-glass" className="uisearch-ic" />
      <input
        type="search"
        className="uisearch-input"
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        autoFocus={autoFocus}
        enterKeyHint="search"
        onChange={(e) => onChange(e.target.value)}
      />
      {value !== '' && (
        <button
          type="button"
          className="uisearch-clear"
          aria-label={clearLabel}
          onClick={() => onChange('')}
        >
          <Icon name="x" />
        </button>
      )}
    </label>
  );
}
