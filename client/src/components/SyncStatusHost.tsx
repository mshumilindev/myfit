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
  // Pages with the header SyncIndicator (SPO-375) show every state themselves; elsewhere this pill
  // is the indicator, and only for the states that need a Retry.
  const canRetry = state === 'slow' || state === 'offline' || state === 'failed';
  if (hasIcon || !canRetry) return null;
  const label =
    state === 'slow' ? t.syncSlow : state === 'offline' ? t.syncOfflineWork : t.syncProblem;
  return (
    <SyncStatus state={state} floating onRetry={retry} retryLabel={t.retry}>
      {label}
    </SyncStatus>
  );
}
