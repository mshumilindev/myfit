import { cx } from '../cx';
import { SK_ICON_PATHS, type SkIconName } from './SkIcon.paths';
import './SkIcon.css';

export type { SkIconName };

/** Stroke icon from the store set. Decorative unless `label` is given (then role="img"). */
export function SkIcon({
  name,
  small,
  label,
  className,
}: {
  name: SkIconName;
  small?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <svg
      className={cx('sk-svg', small && 'sk-svg-s', className)}
      viewBox="0 0 24 24"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <path d={SK_ICON_PATHS[name]} />
    </svg>
  );
}
