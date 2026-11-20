/**
 * No add-on, no consent (SPO-571, owner decision 11.11): when the add-on that owns a consent is removed, the consent is
 * withdrawn, so every (re)install is a fresh choice and nothing keeps processing "in reserve". The owner of each consent
 * and what happens on removal come from the registry (`legal/categoryRegistry.ts`); the saved Atlas chat copy is
 * `keep` (only the person deletes it). Fail-closed order for every kind: stop on this device at once, then queue the
 * withdrawal through the persisted consent queue (an offline withdrawal is sent later, not lost). The records are never
 * deleted: history stays as evidence.
 *
 * Two triggers, neither of which reads "the add-on vanished from the resolved set" (that also happens on sign-out, an
 * account switch and a role change, and would withdraw consents nobody removed):
 *  1. the person's own action: `disableAddons` -> `onAddonsDisabled`;
 *  2. a removal made on another device: once the account's add-on list is known AND the server has answered about the
 *     consents (a cache-only snapshot is not an answer), a consent whose owner can be installed but is not is withdrawn.
 *     Checked again at that moment, so a reinstall made meanwhile (and its new grant) is never withdrawn.
 */
import { currentUid, getRole } from '../api';
import { withdrawAtlasAi } from '../atlas/withdrawOnRemove';
import { GEO_ENGINES, setGeoOverride } from '../data/geoSearchGate';
import { CATEGORY_REGISTRY, type CategoryEntry } from '../legal/categoryRegistry';
import { subscribeConsentRecords } from '../legal/consentApi';
import { currentVersion, optionalConsentOn, type ConsentRecord } from '../legal/consents';
import { withdrawHealth } from '../legal/healthConsentActions';
import { healthFeatureOf } from '../legal/healthFeatures';
import { markLocalOff } from '../legal/localOff';
import { sendConsentDurably } from '../legal/signupConsents';
import { forgetShareLevel } from '../store';
import { addonsPref, isAddonAllowed, isAddonEnabled, onAddonsDisabled } from './enabledSet';

const withdrawable = (
  e: CategoryEntry,
): e is CategoryEntry & { consent: NonNullable<CategoryEntry['consent']> } =>
  !!e.consent && e.onRemove === 'withdraw';

function withdrawEntry(
  e: CategoryEntry & { consent: NonNullable<CategoryEntry['consent']> },
): void {
  const kind = e.consent;
  const feature = healthFeatureOf(kind);
  if (feature) {
    void withdrawHealth(feature);
    return;
  }
  if (kind === 'geo-search') {
    markLocalOff(currentUid(), kind);
    setGeoOverride(false);
    void sendConsentDurably({
      kind,
      action: 'withdraw',
      version: currentVersion(kind),
      engines: [...GEO_ENGINES],
    });
  }
  // atlas-ai and atlas-puter are withdrawn together by `withdrawAtlasAi` (once per batch, below).
}

/** Withdraw the consents of these entries (the Atlas engines in one call). */
function withdrawEntries(entries: readonly CategoryEntry[]): void {
  let atlas = false;
  for (const e of entries) {
    if (!withdrawable(e)) continue;
    if (e.consent === 'atlas-ai' || e.consent === 'atlas-puter') atlas = true;
    else withdrawEntry(e);
  }
  if (atlas) withdrawAtlasAi();
}

/** The consents owned by one of these (just removed) add-ons. */
export function entriesOwnedBy(removed: ReadonlySet<string>): CategoryEntry[] {
  return CATEGORY_REGISTRY.filter((e) => withdrawable(e) && removed.has(e.owner));
}

/**
 * Sharing-only settings (no consent of their own): with the add-on gone the trainer's access to its data goes to Off,
 * best effort like the health consents' trainer revoke (offline or no trainer link: the person can finish it in
 * Trainer sharing). Sleep is a trainer grant; availability lives in the Planner's own prefs.
 */
async function stopSharing(removed: ReadonlySet<string>): Promise<void> {
  if (removed.has('planner')) forgetShareLevel('availability');
  if (removed.has('sleep')) {
    try {
      const { getClientPort } = await import('../coach/client/data/config');
      await getClientPort().setLevel('sleep', 'off');
    } catch {
      // Offline or no trainer link: nothing to switch off here; Trainer sharing still shows the level.
    }
  }
}

/** The person removed these add-ons: withdraw what they owned, and stop sharing what they produced. */
export function withdrawForRemoved(removed: ReadonlySet<string>): void {
  withdrawEntries(entriesOwnedBy(removed));
  void stopSharing(removed);
}

/** Wire the person's own removals once at start-up; returns the unsubscribe. */
export function watchAddonRemoval(): () => void {
  return onAddonsDisabled(withdrawForRemoved);
}

/**
 * A consent is "orphaned" when its owner can be installed for this role but is not. A role the store does not offer the
 * owner to, an unknown role (not loaded yet) and the core are never orphaned: they are not "removed".
 */
export function isOrphaned(e: CategoryEntry): boolean {
  const role = getRole();
  return e.owner !== 'core' && isAddonAllowed(e.owner, role) && !isAddonEnabled(e.owner, role);
}

/** The orphaned consents that are still on, judged on the server's records. Pure apart from the gates it reads. */
export function orphanedOn(records: readonly ConsentRecord[]): CategoryEntry[] {
  return CATEGORY_REGISTRY.filter(
    (e) => withdrawable(e) && isOrphaned(e) && optionalConsentOn(records, e.consent),
  );
}

/** Once the server has answered (not the cache), withdraw consents whose add-on is not installed. Returns the stop. */
export function reconcileOrphanedConsents(): () => void {
  const uid = currentUid();
  if (!uid) return () => undefined;
  const off = subscribeConsentRecords(
    uid,
    (records, meta) => {
      if (meta.fromCache) return;
      off();
      // The list must have been written or synced at least once: an empty never-loaded list is not "removed everything".
      if (addonsPref.snapshot().updatedAt <= 0) return;
      withdrawEntries(orphanedOn(records));
    },
    () => undefined,
  );
  return () => off();
}

/**
 * The account's add-on list reaches a new device only after `meta/prefs` has answered; until then "not installed" may
 * just mean "not loaded yet". So the reconcile starts only once the list is known (`whenReady` = `whenPrefsLoaded`).
 */
export function reconcileOrphanedConsentsAfter(
  whenReady: (cb: () => void) => () => void,
): () => void {
  let stop = (): void => undefined;
  const cancel = whenReady(() => {
    stop = reconcileOrphanedConsents();
  });
  return () => {
    cancel();
    stop();
  };
}
