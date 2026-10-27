import { useT } from '../i18n';
import { useSyncUi } from '../syncHealth';
import { useHasSyncIndicator } from '../syncIndicatorPresence';
import { SyncStatus } from './ui/SyncStatus';

/**
 * The one app-wide sync indicator: a small floating chip, mounted once next to
 * the app root. It replaces the old full-screen "busy" scrim and any blocking
 * "Syncing…" screen — the shell is always usable from the local cache, and this
 * only tells the user what the background sync is doing (with Retry when the
 * connection is slow, offline, or the sync failed).
 */
export function SyncStatusHost() {
  const { t } = useT();
  const { state, retry } = useSyncUi();
  const hasIcon = useHasSyncIndicator();
  // Pages with the header SyncIndicator (SPO-375) show every state themselves; elsewhere this pill is
  // the indicator. It has no look for `locked`, and a saved copy (`stale`) reads as plain offline here.
  if (hasIcon || state === 'synced' || state === 'locked') return null;
  const shown = state === 'stale' ? 'offline' : state;
  const canRetry = shown === 'slow' || shown === 'offline' || shown === 'failed';
  const label =
    shown === 'saving'
      ? t.saving
      : shown === 'slow'
        ? t.syncSlow
        : shown === 'offline'
          ? t.syncOfflineWork
          : shown === 'failed'
            ? t.syncProblem
            : t.syncing;
  return (
    <SyncStatus state={shown} floating onRetry={canRetry ? retry : undefined} retryLabel={t.retry}>
      {label}
    </SyncStatus>
  );
}
