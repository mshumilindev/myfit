import type { ReactNode } from 'react';
import { cx } from '../cx';
import '../tokens-b.css';
import './SkStat.css';

/** Big number with a caption. `tone` colours the number (default: foreground). */
export function SkStat({
  value,
  caption,
  tone,
  className,
}: {
  value: ReactNode;
  caption: ReactNode;
  tone?: 'acc' | 'ok';
  className?: string;
}) {
  return (
    <div className={cx('sk-stat', tone && `sk-stat-${tone}`, className)}>
      <span className="sk-stat-v">{value}</span>
      <span className="sk-stat-c">{caption}</span>
    </div>
  );
}
