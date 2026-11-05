import { SK_ICONS } from '../icons';
import { cx } from '../cx';
import '../tokens-b.css';
import './SkSearchField.css';

/** Pill search input with a leading icon and a clear button (shown when there is text and `onClear` is given). */
export function SkSearchField({
  value,
  placeholder,
  onChange,
  onFocus,
  onClear,
  clearLabel,
  autoFocus,
  className,
}: {
  value: string;
  placeholder: string;
  onChange?: (v: string) => void;
  onFocus?: () => void;
  onClear?: () => void;
  clearLabel?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  return (
    <label className={cx('sk-search', value && 'sk-on', className)}>
      <svg className="sk-search-ic" viewBox="0 0 24 24" aria-hidden="true">
        <path d={SK_ICONS.search} />
      </svg>
      <input
        className="sk-search-in"
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        autoFocus={autoFocus}
        onFocus={onFocus}
        onChange={(e) => onChange?.(e.target.value)}
      />
      {value && onClear && (
        <button type="button" className="sk-search-x" aria-label={clearLabel} onClick={onClear}>
          <svg className="sk-search-ic sk-search-ic-s" viewBox="0 0 24 24" aria-hidden="true">
            <path d={SK_ICONS.x} />
          </svg>
        </button>
      )}
    </label>
  );
}
