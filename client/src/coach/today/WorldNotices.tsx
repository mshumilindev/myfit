import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Notice } from '../../components/ui/Notice';
import { coachClock } from '../format';
import { useTodayT } from '../../i18n/coachToday';
import type { CoachWorldApi } from '../data/useCoachWorld';
import { CoachProblemState } from '../BackendNotice';
import { problemOfCode } from '../data/problem';
import { refreshNotice } from '../layout/refreshNotice';

/**
 * Inline, non-blocking data states (R-FE-091/092/094): offline, stale/refreshing, queued changes.
 * Never a banner that covers the screen; the data below stays usable.
 */
export function WorldNotices({ api }: { api: CoachWorldApi }) {
  const { t } = useTodayT();
  if (!api.world) return null;
  const notice = refreshNotice(api, api.world.now);
  const clock = api.updatedAt != null ? coachClock(api.updatedAt) : '';
  const retry = (
    <Button variant="secondary" size="sm" onClick={api.retry}>
      {t.retry}
    </Button>
  );
  return (
    <div className="td-notices">
      {notice === 'offline' && (
        <Notice tone="note" icon="cloud-slash" role="status" trail={retry}>
          {clock ? t.offlineUpdated(clock) : t.offlineNote}
        </Notice>
      )}
      {(notice === 'failing' || notice === 'quiet') && (
        <Notice
          tone="neutral"
          icon="arrows-clockwise"
          role="status"
          trail={notice === 'failing' && !api.refreshing ? retry : undefined}
        >
          {notice === 'quiet' && api.refreshing ? t.staleRefreshing(clock) : t.updatedAt(clock)}
        </Notice>
      )}
      {api.unsynced > 0 && (
        <Notice tone="neutral" icon="clock-counter-clockwise" role="status">
          {t.unsynced(api.unsynced)}
        </Notice>
      )}
    </div>
  );
}

/**
 * Nothing to show and the load failed: an error that replaces the data, with Retry (R-FE-092). Says WHY in plain words
 * (offline / service not deployed / access denied / too slow / unknown); in `npm run dev` also a hint.
 */
export function WorldFailed({ api }: { api: CoachWorldApi }) {
  const { t } = useTodayT();
  if (api.error === 'vault-locked')
    return (
      <EmptyState
        titleAs="h2"
        centered
        icon="lock"
        title={t.vaultLockedTitle}
        body={t.vaultLockedBody}
      />
    );
  const offline = api.status === 'offline' || api.error === 'offline';
  return (
    <CoachProblemState
      inline
      problem={offline ? 'offline' : problemOfCode(api.error)}
      onRetry={api.retry}
    />
  );
}
