import type { ButtonHTMLAttributes } from 'react';
import { cx } from '../cx';
import '../tokens-a.css';
import './SkChip.css';

/** Filter chip (toggle). `on` = selected (aria-pressed). */
export function SkChip({
  on,
  className,
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { on?: boolean }) {
  return (
    <button
      type={type}
      className={cx('sk-chip', on && 'sk-on', className)}
      aria-pressed={on ?? false}
      {...rest}
    />
  );
}
