/**
 * The Today card "Make it yours" (SPO-500 I5): offers the add-ons after onboarding, when the person chose nothing or skipped.
 * "Seen" is a marker in the synced add-ons list (like `migrated:roles-v1`): it rides the existing sync, is kept by
 * `foreign()` on every write and is ignored when reading the enabled set. Shown only while at least two substantial items remain to install; hidden for good once the person opens the store from
 * the card or picks a set in onboarding, and for a month after "Not interested".
 */
import { useSyncExternalStore } from 'react';
import { getRole, type Role } from '../api';
import { addonById } from './manifest';
import { addonsPref, allowedIds, isAddonBase, storeRole, useEnabledAddons } from './enabledSet';

export const INVITE_SEEN = 'seen:make-it-yours';
/** "Not interested": `later:make-it-yours:<ms of the tap>:<how many times>`. The card returns after a month, at most three times. */
const LATER = 'later:make-it-yours:';
export const INVITE_REMIND_MS = 30 * 24 * 3600 * 1000;
export const INVITE_MAX_NOS = 3;
/** The card is worth showing only while at least this many substantial items could still be installed. */
export const INVITE_MIN_LEFT = 2;

/** Substantial items a person could install right now: apps and add-ons (not modules, looks or "coming soon") whose app is there. */
export function offerable(role: Role, enabled: ReadonlySet<string>): string[] {
  return allowedIds(role).filter((id) => {
    const m = addonById(id);
    if (!m || (m.kind !== 'app' && m.kind !== 'addon') || enabled.has(id) || isAddonBase(id, role))
      return false;
    return !m.requires || isAddonBase(m.requires, role) || enabled.has(m.requires);
  });
}

function laterOf(list: readonly string[]): { at: number; n: number } | null {
  const m = list.find((x) => x.startsWith(LATER));
  if (!m) return null;
  const [at, n] = m.slice(LATER.length).split(':').map(Number);
  return Number.isFinite(at) && Number.isFinite(n) ? { at, n } : null;
}

/** Pure rule: the role has a store, the card was not seen and nothing optional is installed yet. */
export function inviteDue(
  list: readonly string[],
  enabled: ReadonlySet<string>,
  role: Role,
  now = Date.now(),
): boolean {
  if (!storeRole(role) || list.includes(INVITE_SEEN)) return false;
  const later = laterOf(list);
  if (later && (later.n >= INVITE_MAX_NOS || now - later.at < INVITE_REMIND_MS)) return false;
  return offerable(role, enabled).length >= INVITE_MIN_LEFT;
}

export function markInviteSeen(): void {
  const list = addonsPref.snapshot().list;
  if (!list.includes(INVITE_SEEN)) addonsPref.set([...list, INVITE_SEEN]);
}

/** "Not interested": hide the card for a month (then once more, up to three times in all). Replaces the earlier tap. */
export function snoozeInvite(now = Date.now()): void {
  const list = addonsPref.snapshot().list;
  const n = (laterOf(list)?.n ?? 0) + 1;
  addonsPref.set([...list.filter((x) => !x.startsWith(LATER)), `${LATER}${now}:${n}`]);
}

export function useMakeItYoursInvite(): boolean {
  const enabled = useEnabledAddons();
  const list = useSyncExternalStore(addonsPref.subscribe, () => addonsPref.snapshot().list);
  return inviteDue(list, enabled, getRole());
}
