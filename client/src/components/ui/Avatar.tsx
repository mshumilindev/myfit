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
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * A round avatar (kit `avatar`): photo, or initials on the brass gradient.
 * Absorbs .avatar / .avatar.initials.
 */
export function Avatar({ src, name, size = 40, className, style, ...rest }: AvatarProps) {
  const cls = ['uiav', src ? 'uiav--img' : 'uiav--ini', className].filter(Boolean).join(' ');
  const fs = Math.max(10, Math.round(size * 0.38));
  return (
    <span
      className={cls}
      style={{ width: size, height: size, fontSize: fs, ...style }}
      role="img"
      aria-label={name}
      {...rest}
    >
      {src ? <img className="uiav-img lighten" src={src} alt="" /> : initialsOf(name)}
    </span>
  );
}
