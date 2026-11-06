import type { KeyboardEvent, ReactNode } from 'react';
import { cx } from '../cx';
import '../tokens-b.css';
import './SkRow.css';

export interface SkRowProps {
  /** Leading tile / icon slot (e.g. SkTile). */
  tile?: ReactNode;
  name: ReactNode;
  desc?: ReactNode;
  /** Badge slot under the description (e.g. SkBadge). */
  badge?: ReactNode;
  /** "Works with …" relation text; render the link icon inside it if wanted. */
  rel?: ReactNode;
  /** Trailing action slot (button, status label, switch). */
  action?: ReactNode;
  /** Makes the text block a keyboard-focusable button. */
  onOpen?: () => void;
  /** Hide the bottom hairline even when not last. */
  noBorder?: boolean;
  className?: string;
}

/** One list item: tile, name + description + badge/relation, trailing action. */
export function SkRow({
  tile,
  name,
  desc,
  badge,
  rel,
  action,
  onOpen,
  noBorder,
  className,
}: SkRowProps) {
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen?.();
    }
  };
  return (
    <div className={cx('sk-row', noBorder && 'sk-nb', className)}>
      {tile && (
        // Pointer shortcut only: the text block is the keyboard-focusable opener.
        <div className={cx('sk-row-tile', onOpen && 'sk-row-open')} onClick={onOpen}>
          {tile}
        </div>
      )}
      <div
        className={cx('sk-row-main', onOpen && 'sk-row-open')}
        role={onOpen ? 'button' : undefined}
        tabIndex={onOpen ? 0 : undefined}
        onClick={onOpen}
        onKeyDown={onOpen ? onKey : undefined}
      >
        <div className="sk-row-name">{name}</div>
        {desc && <div className="sk-row-desc">{desc}</div>}
        {(badge || rel) && (
          <div className="sk-row-meta">
            {badge}
            {rel && <span className="sk-rel">{rel}</span>}
          </div>
        )}
      </div>
      {action}
    </div>
  );
}
