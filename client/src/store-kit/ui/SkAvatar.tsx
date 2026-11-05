import { cx } from '../cx';
import '../tokens-a.css';
import './SkAvatar.css';

export type SkAvatarSize = 24 | 32 | 36 | 40;

/**
 * Round avatar: image if `src`, else initials on a neutral tone. With `onClick` it is a real button
 * (needs `label`); without, a decorative span (or role="img" when `label` is given).
 */
export function SkAvatar({
  initials,
  src,
  label,
  onClick,
  size = 36,
  className,
}: {
  initials: string;
  src?: string;
  label?: string;
  onClick?: () => void;
  size?: SkAvatarSize;
  className?: string;
}) {
  const cls = cx('sk-av', `sk-av-${size}`, onClick && 'sk-avbtn', className);
  const inner = src ? (
    <img className="sk-av-img" src={src} alt="" />
  ) : (
    <span aria-hidden="true">{initials.slice(0, 2)}</span>
  );
  if (onClick)
    return (
      <button type="button" className={cls} aria-label={label} onClick={onClick}>
        {inner}
      </button>
    );
  return (
    <span className={cls} role={label ? 'img' : undefined} aria-label={label}>
      {inner}
    </span>
  );
}
