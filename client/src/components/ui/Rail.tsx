import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon } from '../../ui';
import './Rail.css';

export interface RailItemProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Icon name; omit when passing a custom `glyph`. */
  icon?: string;
  /** Custom graphic in place of the icon (e.g. the mastery ring) — same tile, same states. */
  glyph?: ReactNode;
  /** Visible label under the icon (some foot items are icon-only). */
  label?: ReactNode;
  /** Accessible name; defaults to the label when it is a string. */
  ariaLabel?: string;
  active?: boolean;
  /** Filled icon when active (nav items). */
  fillWhenActive?: boolean;
  /** Always-filled icon (the bell). */
  fill?: boolean;
  /** Small count badge (notifications). */
  badge?: ReactNode;
  /** Live-session dot (the Today item while a session is open). */
  live?: boolean;
}

/** One rail tile: icon, optional label, badge / live dot. */
export function RailItem({
  icon,
  glyph,
  label,
  ariaLabel,
  active,
  fillWhenActive,
  fill,
  badge,
  live,
  className,
  ...rest
}: RailItemProps) {
  const name = ariaLabel ?? (typeof label === 'string' ? label : undefined);
  const cls = ['rail-item', active ? 'active' : '', className].filter(Boolean).join(' ');
  return (
    <button type="button" className={cls} aria-label={name} title={name} {...rest}>
      {glyph ?? (
        <Icon name={icon ?? ''} weight={fill || (fillWhenActive && active) ? 'fill' : undefined} />
      )}
      {label != null && <span className="rail-label">{label}</span>}
      {badge != null && <span className="rail-notif-badge">{badge}</span>}
      {live && <span className="rail-live-dot" aria-hidden />}
    </button>
  );
}

export interface RailProps {
  /** The brand mark at the top. */
  brand: ReactNode;
  /** Nav items (RailItem) — the middle of the rail. */
  children: ReactNode;
  /** The foot: mastery, notifications, apps, settings, language, account. */
  foot?: ReactNode;
  className?: string;
}

/**
 * The desktop rail (kit `rail`, ≥720px): brand on top, nav tiles, a foot.
 * Both the Gym rail (App.tsx) and the sub-app rail (AppRail) render this; the
 * accent skin comes from the wrapping .theme-* class. Hidden on phones, where
 * TabBar takes over.
 */
export function Rail({ brand, children, foot, className }: RailProps) {
  return (
    <aside className={['rail', className].filter(Boolean).join(' ')}>
      <div className="rail-brand">{brand}</div>
      {children}
      {foot != null && <div className="rail-foot">{foot}</div>}
    </aside>
  );
}
