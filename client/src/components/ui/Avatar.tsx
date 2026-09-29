import type { HTMLAttributes } from 'react';
import './Avatar.css';

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  /** Image URL; falls back to initials when missing or failing. */
  src?: string | null;
  /** The name the initials are cut from (first letters of the first two words). */
  name: string;
  /** Diameter in px. */
  size?: number;
}

export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * A round avatar (kit `avatar`): photo, or initials on the brass gradient.
 * Absorbs .avatar / .avatar.initials.
 */
export function Avatar({ src, name, size = 40, className, style, ...rest }: AvatarProps) {
  const cls = ['uiav', src ? 'uiav--img' : 'uiav--ini', className].filter(Boolean).join(' ');
  const fs = Math.round(size * 0.4);
  return (
    <span
      className={cls}
      style={{ width: size, height: size, fontSize: fs, ...style }}
      role="img"
      aria-label={name}
      {...rest}
    >
      {src ? <img className="uiav-img" src={src} alt="" /> : initialsOf(name)}
    </span>
  );
}
