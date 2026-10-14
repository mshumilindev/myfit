import { Button } from '../../components/ui/Button';
import { Notice } from '../../components/ui/Notice';
import { useRosterT } from '../../i18n/coachRoster';
import type { WorldState } from '../data';
import { refreshNotice } from '../layout/refreshNotice';
import { coachClock } from '../format';
import { agoText } from './format';

/**
 * The quiet line above a screen (the kit `Notice`, the same one Today and Decision use via WorldNotices): offline (with age + Retry), a failing refresh (Retry) or data older than the threshold that is still refreshing (no Retry). A healthy background refresh shows nothing (refreshNotice). Never a
 * modal, never a full-screen overlay (R-FE-091). Renders nothing while ready or while there is no data yet
 * (the screen draws skeletons / the failed card itself).
 */
export function DataStatusBar({
  state,
  retry,
  now,
}: {
  state: Pick<WorldState, 'status' | 'updatedAt' | 'world' | 'error'>;
  retry: () => void;
  now: number;
}) {
  const { r } = useRosterT();
  if (!state.world || state.updatedAt == null) return null;
  const notice = refreshNotice(state, now);
  if (notice === 'none') return null;
  const retryBtn = (
    <Button variant="secondary" size="sm" onClick={retry}>
      {r.stRetry}
    </Button>
  );
  if (notice === 'offline') {
    return (
      <Notice tone="note" icon="cloud-slash" trail={retryBtn}>
        {r.stOffline(agoText(r, state.updatedAt, now))}
      </Notice>
    );
  }
  const time = coachClock(state.updatedAt);
  // failing keeps Retry; a healthy-but-old refresh is quiet and has none.
  return (
    <Notice
      tone="neutral"
      icon="arrows-clockwise"
      trail={notice === 'failing' ? retryBtn : undefined}
    >
      {r.stStale(time)}
    </Notice>
  );
}
