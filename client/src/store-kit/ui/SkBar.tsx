import type { ReactNode } from 'react';
import { cx } from '../cx';
import '../tokens-d.css';
import './SkBar.css';

export interface SkBarProps {
  /** Usually one large `SkBtn` (or a pair). Several children are laid out in a row. */
  children: ReactNode;
  /** Optional line above the actions (price, hint). */
  note?: ReactNode;
  className?: string;
}

/** Bottom action bar: card surface, top hairline, bottom safe-area inset. */
export function SkBar({ children, note, className }: SkBarProps) {
  return (
    <div className={cx('sk-act', className)}>
      {note && <div className="sk-t-s sk-act-note">{note}</div>}
      <div className="sk-act-row">{children}</div>
    </div>
  );
}
