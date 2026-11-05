import type { ReactNode } from 'react';
import { cx } from '../cx';
import '../tokens-b.css';
import './SkSectionHeader.css';

/** Section title (h2 by default) with an optional aside on the trailing side, e.g. a "See all" link. */
export function SkSectionHeader({
  title,
  aside,
  as: Tag = 'h2',
  className,
}: {
  title: ReactNode;
  aside?: ReactNode;
  as?: 'h2' | 'h3';
  className?: string;
}) {
  return (
    <div className={cx('sk-sec-hd', className)}>
      <Tag className="sk-sec-title">{title}</Tag>
      {aside && <div className="sk-sec-aside">{aside}</div>}
    </div>
  );
}

/** Text-button link used as a section aside. */
export function SkSectionLink({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button type="button" className="sk-link" onClick={onClick}>
      {children}
    </button>
  );
}
