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
  /** Exactly four tabs: two left of the notch, two right of it. */
  items: readonly TabBarItem<Id>[];
  onSelect: (id: Id) => void;
  /** The trailing "Apps" button (opens the suite switcher). */
  apps?: { label: ReactNode; ariaLabel: string; onClick: () => void };
  /** The floating Start "+" in the notch. */
  fab?: { ariaLabel: string; onClick: () => void };
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
}: TabBarProps<Id>) {
  const btn = (x: TabBarItem<Id>) => (
    <button key={x.id} className={x.active ? 'active' : ''} onClick={() => onSelect(x.id)}>
      <Icon name={x.icon} />
      <span>{x.label}</span>
    </button>
  );
  return (
    <div className="tabbar-wrap">
      <nav className="tabbar tabbar-notched">
        {items.slice(0, 2).map(btn)}
        {/* The notch — the Start "+" floats in it (sibling below, so the
            notch mask doesn't clip it). */}
        <span className="tabbar-gap" aria-hidden />
        {items.slice(2).map(btn)}
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
          className="tabbar-fab"
          onClick={fab.onClick}
          aria-label={fab.ariaLabel}
        >
          <Icon name="plus" weight="bold" />
        </button>
      )}
    </div>
  );
}
