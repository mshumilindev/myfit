import type { CSSProperties } from 'react';
import { cx } from '../cx';
import '../tokens-a.css';
import './SkProgress.css';

/** Determinate progress bar. `value` 0..100 is passed to CSS as `--sk-pg-value`. */
export function SkProgress({
  value,
  label,
  className,
}: {
  value: number;
  label: string;
  className?: string;
}) {
  const v = Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : 0;
  return (
    <div
      className={cx('sk-pg', className)}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={v}
      style={{ '--sk-pg-value': `${v}%` } as CSSProperties}
    >
      <i />
    </div>
  );
}
