import { useT } from '../i18n';
import { useSyncUi } from '../syncHealth';
import { useRegisterSyncIndicator } from '../syncIndicatorPresence';
import { SyncStateIcon, type SyncIconState } from './ui/SyncStateIcon';

/**
 * The one sync indicator for a page header: the kit `SyncStateIcon` driven by the app's real sync
 * health (SPO-375). It replaces the old dot + word chip. The state name is a tooltip (hover on a
 * mouse, tap on touch); the same text is the accessible name.
 */
export function SyncIndicator({ size = 'xl' }: { size?: 'md' | 'lg' | 'xl' }) {
  const { t } = useT();
  const { state, count } = useSyncUi();
  useRegisterSyncIndicator();
  const names: Record<SyncIconState, string> = {
    synced: t.synced,
    syncing: t.syncing,
    saving: t.saving,
    slow: t.syncSlow,
    offline: t.offline,
    stale: t.syncStale,
    failed: t.syncProblem,
    locked: t.syncLocked,
  };
  return <SyncStateIcon state={state} size={size} count={count} label={names[state]} tooltip />;
}
