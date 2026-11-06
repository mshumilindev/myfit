/**
 * The "Selected" list (SPO-511): add-ons a person picked in the store but has not installed yet. It stays until
 * they install or remove the items, so they can pick now and install later from anywhere. Pure rules + a device
 * store; the account-synced copy lands with the enabled set.
 */
import { useSyncExternalStore } from 'react';
import { createListPref, registerListPref } from '../activityPrefs';
import { getRole, onRoleChange, type Role } from '../api';
import { ADDONS, addonById } from './manifest';
import {
  closeDependencies,
  enableAddons,
  isAddonAllowed,
  resolveEnabled,
  addonsPref,
} from './enabledSet';

export const addonsQueuePref = createListPref('spotter.addons.queue');
registerListPref('addonsQueue', addonsQueuePref);

/** The queue for a role: allowed ids with their parents, minus what is already installed. */
export function resolveQueue(
  queue: readonly string[],
  enabled: ReadonlySet<string>,
  role: Role,
): string[] {
  return closeDependencies(queue, role).filter((id) => !enabled.has(id));
}

/** Pick items (with the parents they need). Idempotent. */
export function queueAdd(ids: string[], role: Role = getRole()): void {
  const enabled = resolveEnabled(addonsPref.snapshot(), role);
  addonsQueuePref.set(resolveQueue([...addonsQueuePref.get(), ...ids], enabled, role));
}

/** Un-pick items; an app takes its picked add-ons with it. */
export function queueRemove(ids: string[], role: Role = getRole()): void {
  const gone = new Set(
    ids.flatMap((id) => ADDONS.filter((a) => a.id === id || a.parent === id).map((a) => a.id)),
  );
  const enabled = resolveEnabled(addonsPref.snapshot(), role);
  addonsQueuePref.set(
    resolveQueue(
      addonsQueuePref.get().filter((i) => !gone.has(i)),
      enabled,
      role,
    ),
  );
}

export function queueClear(): void {
  addonsQueuePref.set([]);
}

/** Turn on everything picked and empty the list. Returns what was installed. */
export function installQueue(role: Role = getRole()): string[] {
  const enabled = resolveEnabled(addonsPref.snapshot(), role);
  const ids = resolveQueue(addonsQueuePref.get(), enabled, role).filter((id) =>
    isAddonAllowed(id, role),
  );
  if (ids.length) enableAddons(ids, role);
  queueClear();
  return ids;
}

/** Items that cannot be taken out of the list on their own: an app a picked add-on needs. */
export function isRequiredByQueue(id: string, queue: readonly string[]): boolean {
  return queue.some((q) => addonById(q)?.parent === id);
}

let cachedKey = '';
let cached: readonly string[] = [];
function snapshot(): readonly string[] {
  const role = getRole();
  const p = addonsQueuePref.snapshot();
  const e = addonsPref.snapshot();
  const key = `${role}|${p.updatedAt}|${p.list.join(',')}|${e.updatedAt}|${e.list.join(',')}`;
  if (key !== cachedKey) {
    cachedKey = key;
    cached = resolveQueue(p.list, resolveEnabled(e, role), role);
  }
  return cached;
}
function subscribe(fn: () => void): () => void {
  const a = addonsQueuePref.subscribe(fn);
  const b = addonsPref.subscribe(fn);
  const c = onRoleChange(fn);
  return () => {
    a();
    b();
    c();
  };
}
/** React: the picked-but-not-installed ids. */
export function useQueuedAddons(): readonly string[] {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
