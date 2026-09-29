import type { HTMLAttributes, ReactNode } from 'react';
import { toneClass, type Tone } from './tones';
import './Tag.css';

export interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  /** Solid family fill with dark ink (PR badge) instead of the tint. */
  solid?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

/**
 * A small 22px status tag (kit `tag`): PR, F, set kind, "auto", counts.
 * Not a Chip — tags are read-only and never toggle. Absorbs .tag and .badge.
 */
export function Tag({
  tone = 'accent',
  solid = false,
  icon,
  children,
  className,
  ...rest
}: TagProps) {
  const cls = ['uitag', toneClass(tone), solid ? 'uitag--solid' : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <span className={cls} {...rest}>
      {icon != null && <span className="uitag-i">{icon}</span>}
      {children}
    </span>
  );
}
