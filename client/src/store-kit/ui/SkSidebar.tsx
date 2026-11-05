import type { ReactNode } from 'react';
import { cx } from '../cx';
import '../tokens-d.css';
import './SkSidebar.css';

export interface SkSidebarProps {
  /** Store title shown at the top. */
  title: string;
  /** Accessible name of the sidebar landmark. */
  label: string;
  /** `SkNavItem`s. */
  children: ReactNode;
  /** Separate item below the nav, e.g. back to Spotter (an `SkNavItem`). */
  back?: ReactNode;
  /** Pinned bottom block, usually `SkSidebarUser`. */
  user?: ReactNode;
  className?: string;
}

/** Desktop sidebar: title, nav, back item, user block. Visibility is decided by `SkShell`. */
export function SkSidebar({ title, label, children, back, user, className }: SkSidebarProps) {
  return (
    <aside className={cx('sk-sdb', className)} aria-label={label}>
      <div className="sk-sdb-head">
        <span className="sk-t-h2">{title}</span>
      </div>
      <nav className="sk-sdb-nav" aria-label={label}>
        {children}
      </nav>
      {back && <div className="sk-sdb-back">{back}</div>}
      {user && <div className="sk-sdb-user">{user}</div>}
    </aside>
  );
}

/** User block for the sidebar footer: avatar + name + role. */
export function SkSidebarUser({
  avatar,
  name,
  role,
}: {
  avatar: ReactNode;
  name: string;
  role?: string;
}) {
  return (
    <div className="sk-sdb-who">
      {avatar}
      <div className="sk-sdb-who-txt">
        <div className="sk-t-b sk-b6 sk-sdb-ell">{name}</div>
        {role && <div className="sk-t-c sk-sdb-ell">{role}</div>}
      </div>
    </div>
  );
}
