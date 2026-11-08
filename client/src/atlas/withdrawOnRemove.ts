/**
 * Removing the Atlas add-on ends AI processing (SPO-518, legal-compliance rule 4): every (re)install is a fresh choice,
 * so the AI consents are withdrawn, not just paused. Fail-closed order:
 *  1. stop sending on this device at once (local override + local-off mark, kept across a reload, also offline);
 *  2. queue the withdrawals UNCONDITIONALLY through the persisted queue (the server treats a withdrawal of something
 *     that is not on as success, like `withdrawAtlas`) — never decided from a possibly stale cache snapshot.
 * The saved chat copy (`atlas-history`) is not touched: deleting it stays the person's own choice in Privacy.
 */
import { currentUid } from '../api';
import { subscribeConsentRecords } from '../legal/consentApi';
import { currentVersion, optionalConsentOn, type ConsentKind } from '../legal/consents';
import { markLocalOff } from '../legal/localOff';
import { sendConsentDurably } from '../legal/signupConsents';
import { isAddonEnabled, onAddonsRemoved } from '../addons/enabledSet';
import { AI_KIND, setAiOverride } from './aiConsent';

const KINDS: readonly ConsentKind[] = [AI_KIND.puter, AI_KIND.gemini];

const queueWithdrawals = (): void => {
  for (const kind of KINDS)
    void sendConsentDurably({ kind, action: 'withdraw', version: currentVersion(kind) });
};

/** The add-on was just removed: stop now and withdraw. */
export function withdrawAtlasAi(): void {
  const uid = currentUid();
  if (!uid) return;
  for (const kind of KINDS) markLocalOff(uid, kind);
  setAiOverride('gemini', false);
  queueWithdrawals();
}

/**
 * An account that holds AI consent but never had (or lost) the add-on, e.g. before the store existed: once the SERVER
 * has answered (a cache-only snapshot is not an answer) and Atlas is still not installed, withdraw. Checked again at
 * that moment so a reinstall made meanwhile (and its new grant) is never withdrawn.
 */
export function reconcileAtlasConsent(): () => void {
  const uid = currentUid();
  if (!uid || isAddonEnabled('atlas')) return () => undefined;
  const off = subscribeConsentRecords(
    uid,
    (records, meta) => {
      if (meta.fromCache) return;
      off();
      if (!isAddonEnabled('atlas') && KINDS.some((k) => optionalConsentOn(records, k)))
        withdrawAtlasAi();
    },
    () => undefined,
  );
  return () => off();
}

/**
 * The add-on list reaches a new device (empty local storage) only after `meta/prefs` has answered. Until then "Atlas is
 * not installed" may just mean "not loaded yet", and a consent answer that came first would wrongly withdraw the AI
 * consent of someone who has Atlas. So the check starts only once the list is known (`whenReady` = `whenPrefsLoaded`).
 */
export function reconcileAtlasConsentAfter(whenReady: (cb: () => void) => () => void): () => void {
  let stop = (): void => undefined;
  const cancel = whenReady(() => {
    stop = reconcileAtlasConsent();
  });
  return () => {
    cancel();
    stop();
  };
}

/** Wire it once at start-up; returns the unsubscribe. */
export function watchAtlasRemoval(): () => void {
  return onAddonsRemoved((removed) => {
    if (removed.has('atlas')) withdrawAtlasAi();
  });
}
