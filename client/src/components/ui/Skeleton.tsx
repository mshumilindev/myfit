import type { CSSProperties } from 'react';
import './Skeleton.css';

export interface SkeletonProps {
  /** Width in px or CSS; default fills the container. */
  width?: number | string;
  height?: number | string;
  /** Round (an avatar / tile). */
  round?: boolean;
  style?: CSSProperties;
  className?: string;
}

/** One shimmering placeholder block (the old `.sk`). */
export function Skeleton({ width, height, round, style, className }: SkeletonProps) {
  const cls = ['uisk', round ? 'uisk--round' : '', className].filter(Boolean).join(' ');
  // A feature class that sizes the block wins; with no class and no size it fills its row.
  const w = width ?? (className || style ? undefined : '100%');
  const h = height ?? (className || style ? undefined : 14);
  const sized = w !== undefined || h !== undefined || style;
  return (
    <div
      className={cls}
      style={sized ? { width: w, height: h, ...style } : undefined}
      aria-hidden="true"
    />
  );
}

/** N list rows of placeholder (kit `skel_rows`): tile + two lines each. */
export function SkeletonRows({ rows = 3, label }: { rows?: number; label?: string }) {
  return (
    <div className="uisk-rows" role="status" aria-live="polite" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="uisk-row">
          <Skeleton width={36} height={36} round />
          <div className="uisk-lines">
            <Skeleton width={`${55 + ((i * 17) % 30)}%`} height={12} />
            <Skeleton width={`${30 + ((i * 23) % 25)}%`} height={10} />
          </div>
        </div>
      ))}
    </div>
  );
}
