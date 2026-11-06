import type { ReactNode } from 'react';
import { cx } from '../cx';
import '../tokens-b.css';
import './SkStat.css';

/** Big number with a caption. `tone` colours the number (default: foreground). */
export function SkStat({
  value,
  caption,
  tone,
  spec,
  className,
}: {
  value: ReactNode;
  caption: ReactNode;
  tone?: 'acc' | 'ok';
  /** Spec-sheet look (board 05/06): small caps label above a title-sized value, centred. */
  spec?: boolean;
  className?: string;
}) {
  return (
    <div className={cx('sk-stat', tone && `sk-stat-${tone}`, spec && 'sk-stat-spec', className)}>
      <span className="sk-stat-v">{value}</span>
      <span className="sk-stat-c">{caption}</span>
    </div>
  );
}
