/**
 * Coach layout kit (C-25): the ONLY place Coach screens get their widths.
 *
 *   <Page>
 *     <Header eyebrow title subtitle pills actions />
 *     <Toolbar>…</Toolbar>
 *     <Split ratio="5-7">  list | detail            (master-detail)
 *     <Split ratio="8-4">  main | <Inspector>        (main + sticky inspector)
 *   </Page>
 *
 * Widths come from the frame variables in frame.css (--co-frame, --co-insp…),
 * never from literals in screen CSS.
 */
import type { ReactNode } from 'react';
import { Card } from '../../components/ui/Card';
import { HeaderSlots } from './chrome';
import './frame.css';
import './Layout.css';

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={['co-page', className].filter(Boolean).join(' ')}>{children}</div>;
}

export interface HeaderProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Status pills; they sit on the title row so the subtitle never truncates next to them (R-FE-008). */
  pills?: ReactNode;
  /** Actions, flush right. */
  actions?: ReactNode;
  /** The shell's right-hand slots (live pill, search / bell + avatar). Off for sub-pages that bring their own. Default on; they only exist inside the Coach shell. */
  slots?: boolean;
}

export function Header({ eyebrow, title, subtitle, pills, actions, slots = true }: HeaderProps) {
  return (
    <header className="co-header">
      <div className="co-header-text">
        {eyebrow != null && <div className="co-eyebrow">{eyebrow}</div>}
        <div className="co-title-row">
          <h1 className="co-title">{title}</h1>
          {pills != null && <div className="co-pills">{pills}</div>}
        </div>
        {subtitle != null && <p className="co-subtitle">{subtitle}</p>}
      </div>
      {(actions != null || slots) && (
        <div className="co-actions ctl-row ctl-row--md">
          {actions}
          {slots && <HeaderSlots />}
        </div>
      )}
    </header>
  );
}

/** 48px filter / view row under the header. */
export function Toolbar({
  children,
  label,
  className,
}: {
  children: ReactNode;
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={['co-toolbar', 'ctl-row', 'ctl-row--md', className].filter(Boolean).join(' ')}
      role={label ? 'toolbar' : undefined}
      aria-label={label}
    >
      {children}
    </div>
  );
}

export type SplitRatio = '5-7' | '8-4';

/** Two columns: `5-7` master-detail, `8-4` main + inspector. Stacks below 768 (5-7) / 1100 (8-4). */
export function Split({ ratio, children }: { ratio: SplitRatio; children: ReactNode }) {
  return <div className={`co-split co-split--${ratio}`}>{children}</div>;
}

/**
 * Sticky side panel of a `8-4` split: stays in view, the page ends where content ends. The panel
 * surface is the kit `Card`; `bare` is for a side column that is itself a stack of Cards.
 */
export function Inspector({
  children,
  label,
  className,
  bare = false,
}: {
  children: ReactNode;
  label?: string;
  className?: string;
  bare?: boolean;
}) {
  return (
    <aside className={['co-inspector', className].filter(Boolean).join(' ')} aria-label={label}>
      {bare ? children : <Card pad="md">{children}</Card>}
    </aside>
  );
}
