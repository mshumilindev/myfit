import { useMemo } from 'react';
import type { LiveWidgetProps } from '../../../components/ui/LiveWidget';
import { useLiveT } from '../../../i18n/coachLive';
import { useTodayT } from '../../../i18n/coachToday';
import { ClientAvatar } from '../../ClientAvatar';
import { coachClock } from '../../format';
import type { CoachRoute } from '../../routes';
import { detailLine, lastSeen, statusWord } from './liveText';
import { minutesOf } from './model';
import type { LivePort } from './port';
import { useCoachLive } from './useLive';

/**
 * The header "N live" widget over the live feed: live (running minutes), offline (frozen minutes, "Last seen"), finished
 * (totals). The pill shows the live count, or the title when only offline / finished sessions exist; null hides the
 * widget when there is nothing at all. Ticks once a minute (the page has the running clock).
 */
export function useLiveWidget(
  onNavigate: (r: CoachRoute) => void,
  opts: { port?: LivePort } = {},
): LiveWidgetProps | null {
  const { t } = useTodayT();
  const { lv } = useLiveT();
  const api = useCoachLive({ port: opts.port, tickMs: 30_000 });
  const { rows, counts } = api;
  return useMemo<LiveWidgetProps | null>(() => {
    if (!rows.length) return null;
    return {
      entries: rows.map((r) => {
        const min = minutesOf(r.elapsedMs);
        return {
          id: r.client.id,
          name: r.client.name,
          status: r.state,
          detail: detailLine(t, lv, r),
          metric:
            r.state === 'finished'
              ? coachClock(r.session.finishedAt ?? r.session.updatedAt)
              : t.liveMinutes(min),
          statusText:
            r.state === 'live'
              ? t.liveStatusNow
              : r.state === 'offline'
                ? lastSeen(lv, r.lastSeenS ?? 0)
                : t.liveStatusDone,
          avatar: (
            <ClientAvatar
              id={r.client.id}
              name={r.client.name}
              hasPhoto={r.client.hasPhoto}
              size={40}
            />
          ),
          ariaLabel: `${r.client.name}, ${statusWord(lv, r)}`,
          onOpen: () => onNavigate({ screen: 'client', cid: r.client.id, tab: 'live' }),
        };
      }),
      pillLabel: counts.live ? t.liveCount(counts.live) : lv.lvTitle,
      pillAria: t.liveClosedAria(counts.live),
      title: t.liveTitle,
      summary: t.liveSummary(counts.live, counts.offline, counts.finished),
      groupLabels: { live: t.liveNow, offline: t.liveOffline, finished: t.liveFinished },
      noneText: t.liveNone,
      privacy: t.livePrivacy,
    };
  }, [rows, counts, t, lv, onNavigate]);
}
