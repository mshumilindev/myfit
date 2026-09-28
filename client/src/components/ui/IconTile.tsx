import type { CSSProperties, ReactNode } from 'react';
import { Icon } from '../../ui';
import { toneClass, type Tone } from './tones';
import './IconTile.css';

export type IconTileSize = 22 | 30 | 32 | 34 | 36 | 40 | 44 | 48 | 56;

export interface IconTileProps {
  /** Colour family; `inherit` reads --t-* from the nearest toned ancestor. */
  tone?: Tone | 'inherit';
  /** Side in px (radius and glyph scale with it). */
  size?: IconTileSize;
  /** Phosphor icon name (see ICONS in ui.tsx)… */
  icon?: string;
  /** …or any glyph node (e.g. a feature's inline SVG). */
  children?: ReactNode;
  /** Neutral outlined tile (placeholder / "add" affordance). */
  outline?: boolean;
  className?: string;
}

/**
 * The rounded icon square in a colour family — list rows, activity tiles,
 * category rows, sheet headers. Tint background, base-coloured glyph.
 */
export function IconTile({
  tone = 'neutral',
  size = 30,
  icon,
  children,
  outline = false,
  className,
}: IconTileProps) {
  const cls = [
    'uitile',
    tone === 'inherit' ? '' : toneClass(tone),
    outline ? 'uitile--outline' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <span className={cls} style={{ '--tile': `${size}px` } as CSSProperties} aria-hidden="true">
      {icon ? <Icon name={icon} /> : children}
    </span>
  );
}
