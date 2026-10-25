import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { Icon } from '../../ui';
import { Badge } from './Badge';
import './TabBar.css';

export interface TabBarItem<Id extends string = string> {
  id: Id;
  label: ReactNode;
  icon: string;
  active?: boolean;
  /**
   * Corner badge on the icon. A number renders the kit `Badge` (1..9, "9+", 0
   * hidden); any other node is placed as given. Pair with `ariaLabel` so the
   * count is spoken (the badge glyph is aria-hidden).
   */
  badge?: ReactNode;
  /** Accessible name when it differs from the visible label ("Chat, 3 unread"). */
  ariaLabel?: string;
}

export interface TabBarProps<Id extends string = string> {
  /** Tabs. With a `fab` the first two sit left of the notch, the rest right of it. */
  items: readonly TabBarItem<Id>[];
  onSelect: (id: Id) => void;
  /** The trailing "Apps" button (opens the suite switcher). */
  apps?: { label: ReactNode; ariaLabel: string; onClick: () => void };
  /**
   * The trailing "More" tab (Coach, and every sub-app since the suite shell): opens the More
   * sheet (destinations, Apps last, account). Lit while the sheet is open or the current screen
   * lives inside it. Replaces `apps`; pass one or the other.
   */
  more?: {
    label: ReactNode;
    ariaLabel?: string;
    /** The sheet is open. */
    open?: boolean;
    /** Lit: open, or the current screen lives inside the sheet. Defaults to `open`. */
    active?: boolean;
    onClick: () => void;
  };
  /** Tab semantics (tablist / tab / aria-selected) — sub-apps that swap a panel. */
  tabs?: boolean;
  /** Filled icon on the active tab. */
  activeFill?: boolean;
  /** The floating Start "+" in the notch. */
  /** `attention` pulses a slow ripple to invite a session; turn it off once one is done today. */
  fab?: { ariaLabel: string; onClick: () => void; attention?: boolean };
  /**
   * Which width swaps this bar for the rail. `app` (default) keeps the real
   * app's 720; `coach` keeps the bar up to 767 (see breakpoints.ts).
   */
  breakpoint?: 'app' | 'coach';
}

/**
 * The phone tab bar (kit `tabbar`): Today · Overview · (+) · Gyms · Apps. The
 * one shell piece whose shape the Brass Glass theme changes (glass plate,
 * glass FAB) — pages never draw their own bar.
 */
export function TabBar<Id extends string = string>({
  items,
  onSelect,
  apps,
  more,
  fab,
  tabs,
  activeFill,
  breakpoint = 'app',
}: TabBarProps<Id>) {
  const navRef = useRef<HTMLElement>(null);
  // The active-tab indicator is one element that slides between tabs (a theme draws it; see the Cyberpunk structure
  // sheet): measure the lit tab and publish its box as CSS variables. No markup is added, other themes ignore them.
  const measure = () => {
    const nav = navRef.current;
    if (!nav) return;
    const on = nav.querySelector<HTMLElement>(':scope > button.active');
    nav.style.setProperty('--tab-ind-o', on ? '1' : '0');
    if (on) {
      nav.style.setProperty('--tab-ind-x', `${on.offsetLeft}px`);
      nav.style.setProperty('--tab-ind-w', `${on.offsetWidth}px`);
    }
  };
  useLayoutEffect(measure);
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return undefined;
    // Animate only after the first placement, so the strip does not slide in from the left edge on mount.
    const raf = requestAnimationFrame(() => nav.setAttribute('data-ind', ''));
    if (typeof ResizeObserver === 'undefined') return () => cancelAnimationFrame(raf);
    const ro = new ResizeObserver(measure);
    ro.observe(nav);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);
  const btn = (x: TabBarItem<Id>) => {
    const icon = <Icon name={x.icon} weight={activeFill && x.active ? 'fill' : undefined} />;
    const badge =
      typeof x.badge === 'number' ? <Badge n={x.badge} anchor="corner" /> : (x.badge ?? null);
    const hasBadge = typeof x.badge === 'number' ? x.badge > 0 : x.badge != null;
    return (
      <button
        key={x.id}
        className={x.active ? 'active' : ''}
        role={tabs ? 'tab' : undefined}
        aria-selected={tabs ? !!x.active : undefined}
        aria-label={x.ariaLabel}
        onClick={() => onSelect(x.id)}
      >
        {/* No badge → the original markup, byte for byte. */}
        {hasBadge ? (
          <span className="tabbar-ico">
            {icon}
            {badge}
          </span>
        ) : (
          icon
        )}
        <span>{x.label}</span>
      </button>
    );
  };
  const cols = items.length + (apps ? 1 : 0) + (more ? 1 : 0) + (fab ? 1 : 0);
  // A bar with a single destination navigates nowhere (the admin Users app): no bar at all.
  if (cols <= 1) return null;
  return (
    <div
      className={`tabbar-wrap${fab ? ' tabbar-wrap--fab' : ''}${breakpoint === 'coach' ? ' tabbar-wrap--coach' : ''}`}
    >
      <nav
        ref={navRef}
        className={`tabbar${fab ? ' tabbar-notched' : ''}${breakpoint === 'coach' ? ' tabbar--coach' : ''}`}
        role={tabs ? 'tablist' : undefined}
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {fab ? items.slice(0, 2).map(btn) : items.map(btn)}
        {/* The notch — the Start "+" floats in it (sibling below, so the
            notch mask doesn't clip it). */}
        {fab && <span className="tabbar-gap" aria-hidden />}
        {fab && items.slice(2).map(btn)}
        {apps && (
          <button onClick={apps.onClick} aria-label={apps.ariaLabel}>
            <Icon name="squares-four" />
            <span>{apps.label}</span>
          </button>
        )}
        {more && (
          <button
            type="button"
            className={(more.active ?? more.open) ? 'active' : ''}
            aria-label={more.ariaLabel}
            aria-haspopup="dialog"
            aria-expanded={!!more.open}
            onClick={more.onClick}
          >
            <Icon name="dots-three" />
            <span>{more.label}</span>
          </button>
        )}
      </nav>
      {fab && (
        <button
          type="button"
          className={`tabbar-fab${fab.attention ? ' is-attention' : ''}`}
          onClick={fab.onClick}
          aria-label={fab.ariaLabel}
        >
          <Icon name="plus" weight="bold" />
        </button>
      )}
    </div>
  );
}
