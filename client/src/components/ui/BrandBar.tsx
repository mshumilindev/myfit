import type { ReactNode } from 'react';
import { Icon, LanguageSelector } from '../../ui';
import './BrandBar.css';

export interface BrandBarProps {
  /** Current app name beside the wordmark (Gym / Apex / …); also opens the app switcher. */
  app: string;
  onApp: () => void;
  /** Accessible label of the app-switcher button. */
  appLabel: string;
  /** Right-side controls — BellButton, MasteryBadge… (the language flag is always last, added by the bar). */
  actions?: ReactNode;
  /** Render as <header> (sub-apps) instead of <div>. */
  header?: boolean;
  className?: string;
}

/** Top brand bar of every phone screen: "spotter" wordmark + app name + round control cluster. */
export function BrandBar({ app, onApp, appLabel, actions, header, className }: BrandBarProps) {
  const Tag = header ? 'header' : 'div';
  return (
    <Tag
      className={`uibrand app-brand${header ? ' apex-head' : ''}${className ? ` ${className}` : ''}`}
      aria-label="Spotter"
    >
      <div className="uibrand-lead app-brand-lead">
        <span className="uibrand-word app-brand-word">spotter</span>
        <button
          type="button"
          className="uibrand-app app-brand-app"
          onClick={onApp}
          aria-label={appLabel}
        >
          {app}
        </button>
      </div>
      <div className="uibrand-actions app-brand-actions">
        {actions}
        <LanguageSelector compact />
      </div>
    </Tag>
  );
}

export interface BellButtonProps {
  label: string;
  onClick: () => void;
  /** Unread count; 0 hides the badge. */
  count?: number;
  /** Filled bell (the notifications tab is open). */
  active?: boolean;
}

/** Notifications bell with unread badge — a BrandBar control. */
export function BellButton({ label, onClick, count = 0, active }: BellButtonProps) {
  return (
    <button
      type="button"
      className="uibrand-ctl uibell app-bell"
      onClick={onClick}
      aria-label={label}
    >
      <Icon name="bell" weight={active ? 'fill' : undefined} className="app-brand-icon" />
      {count > 0 && <span className="uibell-badge app-bell-badge">{count > 9 ? '9+' : count}</span>}
    </button>
  );
}
