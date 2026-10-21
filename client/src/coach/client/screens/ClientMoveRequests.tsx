import { useState } from 'react';
import { RequestCard } from '../../../components/ui/RequestCard';
import { useClientT } from '../../../i18n/coachClient';
import { useScheduleT } from '../../../i18n/coachSchedule';
import { coachClock } from '../../format';
import { shortDate } from '../../schedule/labels';
import { dayOfTs } from '../../schedule/time';
import type { RescheduleRequest } from '../../schedule/types';
import type { MySessions } from './ClientSchedule';
import '../../../components/ui/RequestCard.css';

const when = (ts: number, locale: Parameters<typeof shortDate>[1]): string =>
  `${shortDate(dayOfTs(ts), locale)} ${coachClock(ts)}`;

/**
 * "Asks to move a session" (SPO-205, board C1): the open requests the trainer or a team manager made for ME. A manager has
 * no chat key, so this card (not a chat bubble) is where the client answers. Accept / Decline use the same store call as the
 * Today tile and the chat card (`respond`, side client); Propose another opens the reschedule form as a counter. Once the
 * answer is stored the request is no longer open, so the card goes and the session list shows the new time.
 */
export function ClientMoveRequests({
  my,
  trainerFirst,
  onPropose,
}: {
  my: MySessions;
  /** the trainer's first name: "Olena's team" */
  trainerFirst: string;
  onPropose: (r: RescheduleRequest) => void;
}) {
  const { cc, locale } = useClientT();
  const { s: t } = useScheduleT();
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const open = my.upcoming.flatMap((s) => {
    const r = my.openFor(s);
    return r && r.from === 'trainer' ? [r] : [];
  });
  if (open.length === 0) return null;
  const answer = async (r: RescheduleRequest, to: 'accepted' | 'declined') => {
    setBusy(r.id);
    setFailed(null);
    const ok = await my.sch.store.respond(r.id, to, 'client');
    setBusy(null);
    if (!ok) setFailed(r.id);
  };
  return (
    <>
      {open.map((r) => {
        const title =
          r.via === 'manager'
            ? cc.mtReqTitleManager(r.byName || '', trainerFirst)
            : cc.mtReqTitleTrainer(trainerFirst);
        const act = (label: string, onClick: () => void) => ({
          label,
          ariaLabel: `${label}: ${title}`,
          onClick,
        });
        return (
          <RequestCard
            key={r.id}
            title={title}
            status={cc.mtReqStatus}
            kind="answer"
            fromLabel={t.rcNowLabel}
            from={when(r.fromStart, locale)}
            toLabel={t.rcProposed}
            to={when(r.toStart, locale)}
            note={r.note}
            accept={act(t.rcAccept, () => void answer(r, 'accepted'))}
            decline={act(t.rcDecline, () => void answer(r, 'declined'))}
            propose={act(t.rcCounter, () => onPropose(r))}
            busy={busy === r.id}
            errorText={failed === r.id ? cc.mtReqFailed : undefined}
          />
        );
      })}
    </>
  );
}
