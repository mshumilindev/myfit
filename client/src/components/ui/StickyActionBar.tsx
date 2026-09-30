import type { ReactNode } from 'react';
import './StickyActionBar.css';

export interface StickyActionBarProps {
  children: ReactNode;
  /**
   * `page` — full-width bar pinned under a scrolling page (mobile), clears
   * the home indicator (safe area). Buttons share the width, the last
   * (primary) one wider. `panel` — right-aligned buttons at a side panel's foot.
   */
  variant?: 'page' | 'panel';
  /** Surface behind the bar (match what it sits on). */
  surface?: 'bg' | 'surface';
  /** Optional line above the buttons (a note, an error). */
  note?: ReactNode;
  className?: string;
}

/**
 * The pinned bottom action bar (Cancel · Save). Put it after the scroll
 * container in a flex column so it never scrolls away.
 */
export function StickyActionBar({
  children,
  variant = 'page',
  surface = 'bg',
  note,
  className,
}: StickyActionBarProps) {
  return (
    <div
      className={['uiab', `uiab--${variant}`, `uiab--on-${surface}`, className]
        .filter(Boolean)
        .join(' ')}
    >
      {note != null && <div className="uiab-note">{note}</div>}
      <div className="uiab-acts">{children}</div>
    </div>
  );
}
