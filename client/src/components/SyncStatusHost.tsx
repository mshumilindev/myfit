import { useT } from '../i18n';
import { useSyncUi } from '../syncHealth';
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
  if (state === 'synced') return null;
  const label =
    state === 'saving'
      ? t.saving
      : state === 'slow'
        ? t.syncSlow
        : state === 'offline'
          ? t.syncOfflineWork
          : state === 'failed'
            ? t.syncProblem
            : t.syncing;
  const canRetry = state === 'slow' || state === 'offline' || state === 'failed';
  return (
    <SyncStatus state={state} floating onRetry={canRetry ? retry : undefined} retryLabel={t.retry}>
      {label}
    </SyncStatus>
  );
}
