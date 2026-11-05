import type { ReactNode } from 'react';
import { cx } from '../cx';
import '../tokens-d.css';
import './SkNavItem.css';

export interface SkNavItemProps {
  icon?: ReactNode;
  label: string;
  /** Count chip; hidden when 0 or undefined, capped at 99+. */
  count?: number;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

/** One sidebar row: icon, label, optional count chip. Active = `aria-current="page"`. */
export function SkNavItem({ icon, label, count, active, onClick, className }: SkNavItemProps) {
  return (
    <button
      type="button"
      className={cx('sk-nvi', active && 'sk-nvi-on', className)}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
    >
      {icon}
      <span className="sk-nvi-label">{label}</span>
      {count != null && count > 0 && (
        <span className="sk-nvi-cnt">{count > 99 ? '99+' : count}</span>
      )}
    </button>
  );
}
