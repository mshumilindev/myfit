import { cx } from '../cx';
import '../tokens-a.css';
import './SkSwitch.css';

/** Toggle switch (role="switch"). Controlled: pass `on` and `onChange`. */
export function SkSwitch({
  on,
  onChange,
  label,
  disabled,
  className,
}: {
  on: boolean;
  onChange?: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      className={cx('sk-swb', className)}
      onClick={() => onChange?.(!on)}
    >
      <span className={cx('sk-sw', on && 'sk-on')} />
    </button>
  );
}
