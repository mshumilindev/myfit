import { useState } from 'react';
import './Schedule.css';
import {
  RescheduleMessage,
  type RescheduleMessageProps,
} from '../../components/ui/RescheduleMessage';
import { useScheduleT } from '../../i18n/coachSchedule';
import { coachClock } from '../format';
import { slotTitle } from './blockText';
import { GroupMoveSummary } from './GroupMoveSummary';
import { shortDate } from './labels';
import { statusAt } from './model';
import type { People } from './people';
import type { SchedulePort } from './port';
import { dayOfTs } from './time';
import { gymName } from './types';
import { useScheduleState } from './useSchedule';
import { scheduleHref } from './useScheduleParams';
import { slotOfRequest } from './view';

export interface ScheduleRequestCardProps {
  reqId: string;
  people: People;
  port?: SchedulePort;
  /** which of the two cards this is for: the trainer's chat (default) */
  side?: 'trainer' | 'client';
  onCounter?: (reqId: string) => void;
  onOpenCalendar?: (day: number) => void;
}

/**
 * The reschedule request inside a chat thread: a LIVE view over the request in the schedule store (the message only
 * carries the request id). The person who has to answer gets Accept / Decline / Suggest another time; the person who
 * asked gets Cancel request. After the answer the card says what happened; the calendar already shows the result.
 */
export function ScheduleRequestCard(p: ScheduleRequestCardProps) {
  const { s: t, locale } = useScheduleT();
  const { store, state, now } = useScheduleState(p.port);
  const [busy, setBusy] = useState(false);
  const side = p.side ?? 'trainer';
  const r = state.requests.find((x) => x.id === p.reqId);
  if (!r) {
    return state.status === 'loading' ? (
      <RescheduleMessage
        status="pending"
        kindLabel={t.rcKind}
        statusLabel={t.scLoading}
        title=""
        session={{ bold: '…' }}
        from={{ label: t.rcNowLabel, day: '…', time: '' }}
        to={{ label: t.rcProposed, day: '…', time: '' }}
        /* same height as the answerable card, so the thread does not jump when the request arrives */
        accept={{ label: t.rcAccept, onClick: () => undefined }}
        decline={{ label: t.rcDecline, onClick: () => undefined }}
        counter={{ label: t.rcCounter, onClick: () => undefined }}
        busy
      />
    ) : (
      <RescheduleMessage
        status="cancelled"
        kindLabel={t.rcKind}
        statusLabel={t.rcCancelled}
        title={t.rcMissing}
        session={{ bold: '—' }}
        from={{ label: t.rcNowLabel, day: '—', time: '' }}
        to={{ label: t.rcProposed, day: '—', time: '' }}
      />
    );
  }
  const status = statusAt(r, now);
  const slot = slotOfRequest(state.docs, state.requests, r, now);
  const name = p.people.first(r.clientId);
  const mine = r.from === side;
  const accepted = status === 'accepted';
  const act = (label: string, to: 'accepted' | 'declined' | 'cancelled', ariaLabel?: string) => ({
    label,
    ariaLabel,
    onClick: () => {
      setBusy(true);
      void store.respond(r.id, to, side).finally(() => setBusy(false));
    },
  });
  const word =
    status === 'pending'
      ? mine
        ? t.rcPending
        : t.rcPending
      : status === 'accepted'
        ? t.rcAccepted
        : status === 'declined'
          ? t.rcDeclined
          : status === 'expired'
            ? t.rcExpired
            : status === 'cancelled'
              ? t.rcCancelled
              : t.rcCountered;
  const outcome: RescheduleMessageProps['outcome'] =
    status === 'accepted'
      ? {
          text: mine ? t.rcOutcomeAccepted(name) : t.rcOutcomeAcceptedMine,
          when: r.decidedAt ? coachClock(r.decidedAt) : undefined,
        }
      : status === 'declined'
        ? {
            text: mine ? t.rcOutcomeDeclined(name) : t.rcOutcomeDeclinedMine,
            when: r.decidedAt ? coachClock(r.decidedAt) : undefined,
          }
        : status === 'expired'
          ? { text: t.rcOutcomeExpired }
          : status === 'cancelled'
            ? { text: t.rcOutcomeCancelled }
            : status === 'countered'
              ? { text: t.rcOutcomeCountered }
              : undefined;
  const pending = status === 'pending';
  const slotId = slot?.id;
  return (
    <div className={`sc-chatrow${mine ? ' is-mine' : ''}`}>
      <RescheduleMessage
        status={status}
        mine={mine}
        kindLabel={t.rcKind}
        statusLabel={word}
        title={
          r.via === 'manager'
            ? t.rcTitleManager(r.byName || '', name)
            : mine
              ? t.rcTitleMine(name)
              : t.rcTitleTheirs(name)
        }
        session={{
          bold: slot ? slotTitle(slot, p.people, t) : name,
          rest: slot ? ` · ${t.scMinutes(slot.durationMin)} · ${gymName(slot.gymId)}` : undefined,
          icon: 'barbell',
        }}
        from={{
          label: accepted ? t.rcWas : t.rcNowLabel,
          day: shortDate(dayOfTs(r.fromStart), locale),
          time: coachClock(r.fromStart),
          struck: accepted,
        }}
        to={{
          label: accepted ? t.rcNowLabel : t.rcProposed,
          day: shortDate(dayOfTs(r.toStart), locale),
          time: coachClock(r.toStart),
        }}
        note={r.note}
        accept={pending && !mine ? act(t.rcAccept, 'accepted', t.rcAcceptAria(name)) : undefined}
        decline={pending && !mine ? act(t.rcDecline, 'declined', t.rcDeclineAria(name)) : undefined}
        counter={
          pending && !mine
            ? {
                label: t.rcCounter,
                onClick: () =>
                  p.onCounter
                    ? p.onCounter(r.id)
                    : window.location.assign(scheduleHref({ form: 'counter', req: r.id })),
              }
            : undefined
        }
        waiting={
          pending && mine
            ? {
                text: t.rcWaitingFor(
                  name,
                  `${shortDate(dayOfTs(r.expiresAt), locale)} ${coachClock(r.expiresAt)}`,
                ),
                cancel: act(t.rcCancelReq, 'cancelled'),
              }
            : undefined
        }
        outcome={outcome}
        followUp={
          !pending && status !== 'countered' && mine && !accepted && slotId
            ? {
                label: t.rcFollowNew,
                onClick: () => window.location.assign(scheduleHref({ form: 'move', slot: slotId })),
              }
            : accepted
              ? {
                  label: t.rcFollowOpen,
                  onClick: () =>
                    p.onOpenCalendar
                      ? p.onOpenCalendar(dayOfTs(r.toStart))
                      : window.location.assign(scheduleHref({ d: dayOfTs(r.toStart) })),
                }
              : undefined
        }
        busy={busy}
        errorText={
          state.failed === 'expired'
            ? t.rcErrExpired
            : state.failed === 'answer'
              ? t.rcErr
              : undefined
        }
      />
      {mine && r.groupKey && side === 'trainer' && (
        <GroupMoveSummary
          groupKey={r.groupKey}
          requests={state.requests}
          store={store}
          people={p.people}
          t={t}
          now={now}
        />
      )}
    </div>
  );
}
