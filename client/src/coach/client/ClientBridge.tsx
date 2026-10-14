import { useEffect } from 'react';
import { dayOfTimestamp } from '../../components/ui/calendarDays';
import { statusAt } from '../schedule/model';
import { useSchedule } from '../schedule/useSchedule';
import { firstName } from '../screens/format';
import { useClientUnread } from './data/useClientChat';
import { useClientCoach, useClientCoachEnabled } from './data/useClientCoach';
import { useClientT } from '../../i18n/coachClient';
import type { Notif } from '../../notifications';
import { publishClientShared } from './shared';
import { setProgramOverlay } from '../../data/programMine';
import { applyProgramLayer } from '../data/firestore/clientProgram';

/**
 * Renders nothing. While the `coach` flag is on it keeps the eager parts of the real app up to date: the unread number
 * (nav badge, Today tile, chat divider), the days with a session with my trainer (calendar markers) and the notification
 * rows (new message, program updated, reschedule asked / answered). Without a trainer it publishes the empty state.
 */
export function ClientBridge() {
  const on = useClientCoachEnabled();
  const { cc } = useClientT();
  const { snapshot, store } = useClientCoach(undefined, on);
  const unread = useClientUnread();
  const sch = useSchedule();
  const link = snapshot?.link;
  const has = !!link && link.state !== 'none' && !!link.trainer;
  const first = firstName(link?.trainer?.name ?? '');
  const myId = link?.clientId ?? '';
  const prog = snapshot?.program;
  const now = store.port.now();

  useEffect(() => {
    if (!on || !has) {
      publishClientShared(null);
      return;
    }
    const days = new Set<number>();
    for (const s of sch.slots)
      if (
        (s.status === 'planned' || s.status === 'pending-move' || s.status === 'done') &&
        s.attendees.some((a) => a.clientId === myId)
      )
        days.add(dayOfTimestamp(s.start));
    const notifs: Notif[] = [];
    if (unread > 0)
      notifs.push({
        id: `trainer:msg:${unread}`,
        kind: 'trainer',
        ts: now,
        title: cc.nfMessage(first),
        subtitle: cc.ccUnreadAria(unread),
        nav: '#/trainer/chat',
      });
    if (prog && !prog.acked)
      notifs.push({
        id: `trainer:program:${prog.version}`,
        kind: 'trainer',
        ts: prog.updatedAt,
        title: cc.nfProgram(first),
        subtitle: prog.summary,
        nav: '#/programs',
      });
    for (const r of sch.requests) {
      if (r.clientId !== myId) continue;
      const st = statusAt(r, now);
      if (r.from === 'trainer' && st === 'pending')
        notifs.push({
          id: `trainer:rq:${r.id}`,
          kind: 'trainer',
          ts: r.createdAt,
          title: cc.nfResched(first),
          subtitle: r.note ?? '',
          nav: '#/trainer/chat',
        });
      else if (r.from === 'client' && (st === 'accepted' || st === 'declined'))
        notifs.push({
          id: `trainer:rqa:${r.id}`,
          kind: 'trainer',
          ts: r.decidedAt ?? r.createdAt,
          title: cc.nfReschedAnswer(first),
          subtitle: r.note ?? '',
          nav: '#/trainer/chat',
        });
    }
    publishClientShared({
      hasTrainer: true,
      trainerFirst: first,
      unread,
      unreadLabel: cc.ccUnreadAria(unread),
      trainerDays: days,
      markerLegend: cc.calMarkerLegend,
      markerDay: cc.calMarkerDay(first),
      notifs,
    });
  }, [on, has, first, myId, unread, prog, sch.slots, sch.requests, now, cc]);

  // the sealed trainer layer over the runnable program: the workout screen, the program review and the Today plan read
  // targets, RPE, rest, cues, warm-up weights and activities from it (the plaintext program document holds none)
  useEffect(() => {
    setProgramOverlay(on && has && prog?.program ? (p) => applyProgramLayer(p, prog) : null);
    return () => setProgramOverlay(null);
  }, [on, has, prog]);

  useEffect(() => () => publishClientShared(null), []);
  return null;
}
