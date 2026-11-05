/** Role-visible store catalog (SPO-513): what a role may see, enabled or not, "coming soon" included. */
import type { Role } from '../api';
import { ADDONS, type AddonManifest } from '../addons/manifest';
import { isAddonAllowed, storeRole } from '../addons/enabledSet';

export type StoreCategory = AddonManifest['category'];
export const STORE_CATEGORIES: readonly StoreCategory[] = [
  'recovery',
  'food',
  'insights',
  'look',
  'coach',
];

/** Manager has no store. */
export function hasStore(role: Role): boolean {
  return storeRole(role) !== null;
}

/** Everything this role sees: allowed items and the "coming soon" items its role lists. */
export function catalogForRole(role: Role): AddonManifest[] {
  const r = storeRole(role);
  if (!r) return [];
  return ADDONS.filter((a) => a.roles.includes(r));
}

/** Items that can actually be turned on. */
export function availableForRole(role: Role): AddonManifest[] {
  return catalogForRole(role).filter((a) => isAddonAllowed(a.id, role));
}

export function comingSoonForRole(role: Role): AddonManifest[] {
  return catalogForRole(role).filter((a) => a.soon);
}
