import type { ReactNode } from 'react';
import { BackButton, type BackButtonProps } from './BackButton';
import './PageHead.css';

export interface PageHeadProps {
  /** Back control; omit on a root page. Rendered by the kit BackButton. */
  back?: Pick<BackButtonProps, 'label' | 'onClick' | 'text'>;
  /** Page title (rendered as h2 `title-26`). */
  title: ReactNode;
  /** One muted line under the title (count, date, user name). */
  sub?: ReactNode;
  /** Right-hand controls (delete, Save, share…), vertically centred on the same axis as the title. */
  actions?: ReactNode;
  className?: string;
}

/**
 * THE page header row (SPO-96): back, title (+ sub) and actions on one axis. Left/right edges are the
 * page's own edges (no inner padding) so the row lines up with the content under it; the row is never
 * shorter than `--s-36` so the back button sits at the same y on every screen. Geometry lives in
 * PageHead.css and redesign.css (`.hist-head`), never in a screen's own CSS.
 */
export function PageHead({ back, title, sub, actions, className }: PageHeadProps) {
  return (
    <div className={['uipagehead', 'hist-head', className].filter(Boolean).join(' ')}>
      {back && <BackButton {...back} />}
      <div className="uipagehead-t uf-1 umw-0">
        <h2 className="title-26">{title}</h2>
        {sub ? <div className="sub">{sub}</div> : null}
      </div>
      {actions ? <div className="uipagehead-a">{actions}</div> : null}
    </div>
  );
}
