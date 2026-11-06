/**
 * Which add-ons are on for this person (SPO-511). Pure rules + a device store.
 *
 * - No special modes (owner decision 05.11.2026): the enabled set is exactly what is stored for the account.
 *   An account with nothing stored — new or existing — has the base only.
 * - Enabling an add-on enables its parent app; removing an app removes its add-ons. Removing never deletes data.
 * - A role only ever gets items that list it; stored ids a role may not use are ignored, never errors.
 */
import { useSyncExternalStore } from 'react';
import { createListPref, registerListPref, type ListPref } from '../activityPrefs';
import { getRole, onRoleChange, type Role } from '../api';
import { ADDONS, addonById, type StoreRole } from './manifest';

export function storeRole(role: Role): StoreRole | null {
  return role === 'manager' ? null : role;
}

/** May this role see and enable the item? Unknown ids and "coming soon" items are never allowed. */
export function isAddonAllowed(id: string, role: Role): boolean {
  const r = storeRole(role);
  const m = addonById(id);
  return !!r && !!m && !m.soon && m.roles.includes(r);
}

export function allowedIds(role: Role): string[] {
  return ADDONS.filter((a) => isAddonAllowed(a.id, role)).map((a) => a.id);
}

/** Add the parent apps an add-on needs, and drop add-ons whose parent is off. */
export function closeDependencies(ids: Iterable<string>, role: Role): string[] {
  const on = new Set<string>();
  for (const id of ids) {
    if (!isAddonAllowed(id, role)) continue;
    on.add(id);
    const parent = addonById(id)?.parent;
    if (parent && isAddonAllowed(parent, role)) on.add(parent);
  }
  return ADDONS.filter((a) => on.has(a.id)).map((a) => a.id);
}

export function resolveEnabled(pref: ListPref, role: Role): Set<string> {
  return new Set(closeDependencies(pref.list, role));
}

/** Items that have to go when `id` is removed: itself and (for an app) its add-ons. */
export function removalSet(id: string): string[] {
  return ADDONS.filter((a) => a.id === id || a.parent === id).map((a) => a.id);
}

export const addonsPref = createListPref('spotter.addons');
// Synced into meta/prefs as `addons` + `addonsUpdatedAt` (last write wins, like the Learn lists).
registerListPref('addons', addonsPref);

function current(role: Role): Set<string> {
  return resolveEnabled(addonsPref.snapshot(), role);
}

export function isAddonEnabled(id: string, role: Role = getRole()): boolean {
  return isAddonAllowed(id, role) && current(role).has(id);
}

/** Turn items on together with what they need. Idempotent. */
export function enableAddons(ids: string[], role: Role = getRole()): void {
  addonsPref.set(closeDependencies([...current(role), ...ids], role));
}

/** Turn items off (an app takes its add-ons with it). Idempotent; data stays. */
export function disableAddons(ids: string[], role: Role = getRole()): void {
  const gone = new Set(ids.flatMap(removalSet));
  addonsPref.set(
    closeDependencies(
      [...current(role)].filter((i) => !gone.has(i)),
      role,
    ),
  );
}

let cachedRole: Role | null = null;
let cachedKey = '';
let cachedSet: ReadonlySet<string> = new Set();
function snapshot(): ReadonlySet<string> {
  const role = getRole();
  const p = addonsPref.snapshot();
  const key = `${role}|${p.updatedAt}|${p.list.join(',')}`;
  if (role !== cachedRole || key !== cachedKey) {
    cachedRole = role;
    cachedKey = key;
    cachedSet = resolveEnabled(p, role);
  }
  return cachedSet;
}
function subscribe(fn: () => void): () => void {
  const off = addonsPref.subscribe(fn);
  const offRole = onRoleChange(fn);
  return () => {
    off();
    offRole();
  };
}
/** React: the enabled ids, stable between unrelated renders. */
export function useEnabledAddons(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
export function useAddonEnabled(id: string): boolean {
  return useEnabledAddons().has(id);
}
