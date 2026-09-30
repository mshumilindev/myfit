import type { ReactNode } from 'react';
import { Icon } from '../../ui';
import './TabBar.css';

export interface TabBarItem<Id extends string = string> {
  id: Id;
  label: ReactNode;
  icon: string;
  active?: boolean;
}

export interface TabBarProps<Id extends string = string> {
  /** Tabs. With a `fab` the first two sit left of the notch, the rest right of it. */
  items: readonly TabBarItem<Id>[];
  onSelect: (id: Id) => void;
  /** The trailing "Apps" button (opens the suite switcher). */
  apps?: { label: ReactNode; ariaLabel: string; onClick: () => void };
  /** Tab semantics (tablist / tab / aria-selected) — sub-apps that swap a panel. */
  tabs?: boolean;
  /** Filled icon on the active tab. */
  activeFill?: boolean;
  /** The floating Start "+" in the notch. */
  /** `attention` pulses a slow ripple to invite a session; turn it off once one is done today. */
  fab?: { ariaLabel: string; onClick: () => void; attention?: boolean };
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
  fab,
  tabs,
  activeFill,
}: TabBarProps<Id>) {
  const btn = (x: TabBarItem<Id>) => (
    <button
      key={x.id}
      className={x.active ? 'active' : ''}
      role={tabs ? 'tab' : undefined}
      aria-selected={tabs ? !!x.active : undefined}
      onClick={() => onSelect(x.id)}
    >
      <Icon name={x.icon} weight={activeFill && x.active ? 'fill' : undefined} />
      <span>{x.label}</span>
    </button>
  );
  const cols = items.length + (apps ? 1 : 0) + (fab ? 1 : 0);
  return (
    <div className={`tabbar-wrap${fab ? ' tabbar-wrap--fab' : ''}`}>
      <nav
        className={`tabbar${fab ? ' tabbar-notched' : ''}`}
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
