import { cx } from '../cx';
import '../tokens-a.css';
import './SkSegmented.css';

export type SkSegmentedOption<V extends string = string> = { value: V; label: string };

/** Segmented control: one option selected. Buttons with aria-pressed inside a labelled group. */
export function SkSegmented<V extends string = string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: SkSegmentedOption<V>[];
  value: V;
  onChange?: (v: V) => void;
  label: string;
  className?: string;
}) {
  return (
    <div className={cx('sk-seg', className)} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={cx('sk-seg-i', o.value === value && 'sk-on')}
          aria-pressed={o.value === value}
          onClick={() => onChange?.(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
