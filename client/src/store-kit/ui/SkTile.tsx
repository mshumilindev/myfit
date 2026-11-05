import type { ReactNode } from 'react';
import { cx } from '../cx';
import '../tokens-a.css';
import './SkTile.css';

export type SkTileSize = 32 | 40 | 64 | 96;
export type SkTileTone = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/** Coloured app tile with one letter, or an icon passed as children. `tone` 0..9 is the app colour family; default size 48. */
export function SkTile({
  letter,
  tone,
  size,
  className,
  children,
}: {
  letter: string;
  tone: number;
  size?: SkTileSize;
  className?: string;
  /** An icon instead of the letter (empty states). */
  children?: ReactNode;
}) {
  const t = Math.min(9, Math.max(0, Math.trunc(tone) || 0));
  return (
    <span className={cx('sk-ic', size && `sk-ic${size}`, `sk-i${t}`, className)} aria-hidden="true">
      {children ?? letter.slice(0, 1)}
    </span>
  );
}
