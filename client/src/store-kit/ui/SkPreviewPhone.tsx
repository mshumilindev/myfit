import type { CSSProperties, ReactNode } from 'react';
import { cx } from '../cx';
import '../tokens-c.css';
import './SkPreviewPhone.css';

/** Mini-phone preview on app pages (boards 05, 06). `size` m = 132×216, d = 176×288 (desktop). Decorative unless `label` is set. */
export function SkPreviewPhone({
  size = 'm',
  caption,
  label,
  children,
  className,
}: {
  size?: 'm' | 'd';
  caption?: string;
  label?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx('sk-phone', size === 'd' && 'sk-phone-d', className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {caption && <div className="sk-phone-cap">{caption}</div>}
      {children}
    </div>
  );
}

/** Card block inside the preview. `tall`: plot (centred dot area) / chart (bars area) fixed heights. */
export function SkPvBox({ tall, children }: { tall?: 'plot' | 'chart'; children?: ReactNode }) {
  return <div className={cx('sk-phone-bx', tall && `sk-phone-bx-${tall}`)}>{children}</div>;
}

/** Two placeholder text lines (second one shorter). */
export function SkPvLines() {
  return (
    <>
      <div className="sk-phone-l" />
      <div className="sk-phone-l sk-phone-l-s" />
    </>
  );
}

export function SkPvDot() {
  return <div className="sk-phone-dot" />;
}

/** Bar chart; `values` are 0..100 heights. */
export function SkPvBars({ values }: { values: number[] }) {
  return (
    <>
      {values.map((v, i) => (
        <i key={i} className="sk-phone-col" style={{ '--sk-pv-h': `${v}%` } as CSSProperties} />
      ))}
    </>
  );
}

/** Thin progress bar; `value` 0..100. */
export function SkPvProgress({ value }: { value: number }) {
  return (
    <div className="sk-phone-bar">
      <i style={{ '--sk-pv-pct': `${value}%` } as CSSProperties} />
    </div>
  );
}
