import type { HTMLAttributes } from 'react';
import { cx } from '../cx';
import '../tokens-b.css';
import './SkCard.css';

/** The store's one surface: card background, hairline border, large radius. `pad` adds inner padding. */
export function SkCard({
  pad,
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { pad?: boolean }) {
  return <div className={cx('sk-card', pad && 'sk-card-pad', className)} {...rest} />;
}
