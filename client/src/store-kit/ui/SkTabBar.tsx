import type { ReactNode } from 'react';
import { cx } from '../cx';
import '../tokens-d.css';
import './SkTabBar.css';

export interface SkTab {
  id: string;
  label: string;
  icon: ReactNode;
  /** Small dot on the icon (e.g. something selected). */
  dot?: boolean;
  /** Screen-reader text for the dot, e.g. "has items". */
  dotLabel?: string;
}

export interface SkTabBarProps {
  tabs: SkTab[];
  /** Active tab id; `null` when the current screen is not a tab (item page, search). */
  active: string | null;
  onSelect: (id: string) => void;
  label: string;
  className?: string;
}

/** Mobile bottom tab bar (5 tabs in the store): icon over label, active state, optional dot. */
export function SkTabBar({ tabs, active, onSelect, label, className }: SkTabBarProps) {
  return (
    <nav className={cx('sk-tbr', className)} aria-label={label}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          className={cx('sk-tbr-tab', active === t.id && 'sk-tbr-on')}
          aria-current={active === t.id ? 'page' : undefined}
          onClick={() => onSelect(t.id)}
        >
          <span className="sk-tbr-ic">
            {t.icon}
            {t.dot && <i className="sk-tbr-dot" aria-hidden="true" />}
          </span>
          <span className="sk-tbr-lbl">{t.label}</span>
          {t.dot && t.dotLabel && <span className="sk-tbr-sr">{t.dotLabel}</span>}
        </button>
      ))}
    </nav>
  );
}
