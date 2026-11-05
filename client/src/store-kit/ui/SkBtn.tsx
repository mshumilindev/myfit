import type { ButtonHTMLAttributes } from 'react';
import { cx } from '../cx';
import './SkBtn.css';

export type SkBtnKind = 'pri' | 'tint' | 'ghost' | 'dash' | 'bad' | 'inv' | 'ok';
export type SkBtnSize = 'l' | 's';

export function SkBtn({
  kind = 'tint',
  size,
  className,
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { kind?: SkBtnKind; size?: SkBtnSize }) {
  return (
    <button
      type={type}
      className={cx('sk-bt', `sk-bt-${kind}`, size && `sk-bt-${size}`, className)}
      {...rest}
    />
  );
}
