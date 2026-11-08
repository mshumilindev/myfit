/**
 * The Today card "Make it yours" (SPO-500 I5): offers the add-ons after onboarding, when the person chose nothing or skipped.
 * "Seen" is a marker in the synced add-ons list (like `migrated:roles-v1`): it rides the existing sync, is kept by
 * `foreign()` on every write and is ignored when reading the enabled set. Shown at most until the person opens the store
 * from the card, picks a set in onboarding, or installs anything themselves.
 */
import { useSyncExternalStore } from 'react';
import { getRole, type Role } from '../api';
import { addonsPref, allowedIds, isAddonBase, storeRole, useEnabledAddons } from './enabledSet';

export const INVITE_SEEN = 'seen:make-it-yours';

/** Pure rule: the role has a store, the card was not seen and nothing optional is installed yet. */
export function inviteDue(
  list: readonly string[],
  enabled: ReadonlySet<string>,
  role: Role,
): boolean {
  if (!storeRole(role) || list.includes(INVITE_SEEN)) return false;
  return !allowedIds(role).some((id) => !isAddonBase(id, role) && enabled.has(id));
}

export function markInviteSeen(): void {
  const list = addonsPref.snapshot().list;
  if (!list.includes(INVITE_SEEN)) addonsPref.set([...list, INVITE_SEEN]);
}

export function useMakeItYoursInvite(): boolean {
  const enabled = useEnabledAddons();
  const list = useSyncExternalStore(addonsPref.subscribe, () => addonsPref.snapshot().list);
  return inviteDue(list, enabled, getRole());
}
