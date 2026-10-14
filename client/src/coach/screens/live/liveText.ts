/** Copy for a live row, shared by the header widget, the Live list and the one-client page. Pure. */
import type { LiveStrings } from '../../../i18n/coachLive';
import type { TodayStrings } from '../../../i18n/coachToday';
import { coachClock } from '../../format';
import { minutesOf, tonnesText, type LiveRow } from './model';

/** "12 s ago" / "3 min ago" for a heartbeat age. */
export const agoOf = (lv: LiveStrings, seconds: number): string =>
  seconds < 90 ? lv.lvAgoS(seconds) : lv.lvAgoMin(Math.round(seconds / 60));

/** "Last seen 12 s ago" */
export const lastSeen = (lv: LiveStrings, seconds: number): string =>
  seconds < 90 ? lv.lvLastSeenS(seconds) : lv.lvLastSeenMin(Math.round(seconds / 60));

export const statusWord = (lv: LiveStrings, r: Pick<LiveRow, 'state'>): string =>
  r.state === 'live'
    ? lv.lvStatusLive
    : r.state === 'offline'
      ? lv.lvStatusOffline
      : lv.lvStatusFinished;

/** The page sub-line: "Live, 38 min, Iron Yard". */
export function subLine(lv: LiveStrings, r: LiveRow): string {
  const gym = r.session.gymName ?? lv.lvUnknown;
  if (r.state === 'live') return lv.lvSubLive(minutesOf(r.elapsedMs), gym);
  if (r.state === 'offline') return lv.lvSubOffline(agoOf(lv, r.lastSeenS ?? 0), gym);
  return lv.lvSubFinished(coachClock(r.session.finishedAt ?? r.session.updatedAt), gym);
}

/** Row detail for the widget, one short line: "Iron Yard · since 08:27" or the finished totals. */
export function detailLine(t: TodayStrings, lv: LiveStrings, r: LiveRow): string {
  const s = r.session;
  const gym = s.gymName ?? lv.lvUnknown;
  if (r.state === 'finished' && s.finalSets != null) {
    return t.liveFinishedLine(s.finalSets, tonnesText(s.finalTonnageKg ?? 0), gym);
  }
  return t.liveSinceLine(coachClock(s.startedAt), gym);
}
