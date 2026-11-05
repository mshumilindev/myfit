import type { HTMLAttributes } from 'react';
import { cx } from '../cx';
import '../tokens-b.css';
import './SkCard.css';
import './SkList.css';

/** Grouped card of `SkRow`s: shared inline padding, hairline separators between rows, none after the last. */
export function SkList({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('sk-card', 'sk-list', className)} {...rest} />;
}
