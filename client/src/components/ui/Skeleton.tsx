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
export function Skeleton({ width = '100%', height = 14, round, style, className }: SkeletonProps) {
  const cls = ['uisk', round ? 'uisk--round' : '', className].filter(Boolean).join(' ');
  return <div className={cls} style={{ width, height, ...style }} aria-hidden="true" />;
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
