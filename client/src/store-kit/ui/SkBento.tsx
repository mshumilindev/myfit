import type { ReactNode } from 'react';
import { cx } from '../cx';
import '../tokens-c.css';
import './SkBento.css';

/** Bento grid (design 01): 2 columns on a phone; `cols` 3 / 4 widen it from the wide breakpoint up; 12 is the design's desktop bento (hero 8x2, cells 4x1, wide 12). */
export function SkBento({
  cols = 2,
  children,
  className,
}: {
  cols?: 2 | 3 | 4 | 12;
  children: ReactNode;
  className?: string;
}) {
  return <div className={cx('sk-bgrid', `sk-bgrid-c${cols}`, className)}>{children}</div>;
}
