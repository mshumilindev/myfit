import type { ReactNode } from 'react';
import { cx } from '../cx';
import '../tokens-d.css';
import './SkShell.css';

export interface SkShellProps {
  /** `SkSidebar` — shown from `--sk-bp-wide` of the shell width. */
  sidebar?: ReactNode;
  /** `SkHeader` — mobile only. */
  header?: ReactNode;
  /** `SkTabBar` — mobile only; not rendered while `bar` is present (the bar replaces it). */
  tabBar?: ReactNode;
  /** `SkBar` — bottom action bar of a detail screen, all widths. */
  bar?: ReactNode;
  /** `SkTray` — floating over the content. */
  tray?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Responsive layout. Fills its parent (give the parent a height). Narrow: header, scroll area, tab bar.
 * Wide (container ≥ 45rem = --sk-bp-wide): sidebar + scroll area. Responds to its own width, so it works
 * in Storybook frames too.
 */
export function SkShell({ sidebar, header, tabBar, bar, tray, children, className }: SkShellProps) {
  return (
    <div className={cx('sk-shl', className)}>
      {sidebar && <div className="sk-shl-side">{sidebar}</div>}
      <div className="sk-shl-col">
        {header && <div className="sk-shl-hd">{header}</div>}
        <main className="sk-shl-main">
          <div className="sk-shl-in">{children}</div>
        </main>
        {bar ? (
          <div className="sk-shl-bar">{bar}</div>
        ) : (
          tabBar && <div className="sk-shl-tabs">{tabBar}</div>
        )}
      </div>
      {tray && <div className={cx('sk-shl-tray', !!bar && 'sk-shl-tray-bar')}>{tray}</div>}
    </div>
  );
}
