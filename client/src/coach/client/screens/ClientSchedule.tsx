import { useMemo, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { GroupedList, ListRow } from '../../../components/ui/GroupedList';
import { IconTile } from '../../../components/ui/IconTile';
import { Sheet } from '../../../components/ui/Overlays';
import { Tag } from '../../../components/ui/Tag';
import { useClientT, type ClientStrings } from '../../../i18n/coachClient';
import { useScheduleT } from '../../../i18n/coachSchedule';
import { Icon } from '../../../ui';
import { coachClock } from '../../format';
import { slotClock } from '../../schedule/blockText';
import { opaqueSlotKey } from '../../schedule/ids';
import { shortDate } from '../../schedule/labels';
import { hasClient, peopleOf, statusAt } from '../../schedule/model';
import type { People } from '../../schedule/people';
import type { SchedulePort } from '../../schedule/port';
import { RescheduleForm } from '../../schedule/RescheduleForm';
import { dayOfTs } from '../../schedule/time';
import { gymName, type RescheduleRequest, type ScheduleSlot } from '../../schedule/types';
import { postRequestCard, useSchedule } from '../../schedule/useSchedule';
import { firstName } from '../../screens/format';
import { useTrainerLink } from '../data/useClientCoach';
import '../ClientCoach.css';

export interface MySessions {
  loading: boolean;
  myId: string;
  first: string;
  now: number;
  today: number;
  /** future sessions with the trainer, soonest first (planned or with a move waiting) */
  upcoming: ScheduleSlot[];
  requests: readonly RescheduleRequest[];
  /** the open request for a session (asked by me or by the trainer) */
  openFor(s: ScheduleSlot): RescheduleRequest | undefined;
  sch: ReturnType<typeof useSchedule>;
}

/** My side of the schedule: only sessions I attend. Names of other attendees never reach this screen. */
export function useMySessions(port?: SchedulePort): MySessions | null {
  const link = useTrainerLink();
  const sch = useSchedule(port);
  const myId = link?.clientId ?? '';
  return useMemo(() => {
    if (!link) return null;
    const upcoming = sch.slots
      .filter(
        (s) =>
          (s.status === 'planned' || s.status === 'pending-move') &&
          s.start > sch.now &&
          hasClient(s, myId),
      )
      .sort((a, b) => a.start - b.start);
    const mine = sch.requests.filter((r) => r.clientId === myId);
    return {
      loading: sch.loading,
      myId,
      first: firstName(link.trainer?.name ?? ''),
      now: sch.now,
      today: dayOfTs(sch.now),
      upcoming,
      requests: mine,
      openFor: (s: ScheduleSlot) =>
        mine.find((r) => r.slotKey === opaqueSlotKey(s.key) && statusAt(r, sch.now) === 'pending'),
      sch,
    };
  }, [link, sch, myId]);
}

/** A People of one: me. Other attendees of a shared session are never named on this side. */
function myPeople(myId: string, name: string): People {
  return {
    list: [],
    byId: new Map(),
    name: (id) => (id === myId ? name : ''),
    first: (id) => (id === myId ? name : ''),
    loading: false,
  };
}

export const sessionTitle = (cc: ClientStrings, s: ScheduleSlot, first: string): string =>
  s.kind === 'group'
    ? cc.mtGroup(s.title ?? '')
    : s.kind === 'split'
      ? cc.mtSplit(first)
      : cc.mtSessionWith(first);

function whenText(s: ScheduleSlot, locale: Parameters<typeof shortDate>[1]): string {
  return `${shortDate(dayOfTs(s.start), locale)} · ${slotClock(s)}`;
}
function askedText(r: RescheduleRequest, locale: Parameters<typeof shortDate>[1]): string {
  return `${shortDate(dayOfTs(r.toStart), locale)} ${coachClock(r.toStart)}`;
}

/** The client's device posts the request card into the chat through the installed client chat port (sealed `request` body). */
export function postClientRequestCard(r: RescheduleRequest): void {
  if (r.from !== 'client') return;
  postRequestCard(r);
}

/** The reschedule form as a sheet, in the client's voice. `slot` = the session is known (from Today / the list). */
export function ClientRescheduleSheet({
  my,
  slot,
  counterOf,
  onClose,
  onOpenChat,
}: {
  my: MySessions;
  slot?: ScheduleSlot;
  /** "Suggest another time" on the trainer's request card: the form answers THAT request (it becomes a counter). */
  counterOf?: RescheduleRequest;
  onClose: () => void;
  onOpenChat?: () => void;
}) {
  const { cc, locale } = useClientT();
  const { s: t } = useScheduleT();
  const people = useMemo(() => myPeople(my.myId, my.first), [my.myId, my.first]);
  // the store posts the card (new request and counter alike) through the client's chat (`postRequestCard`)
  const store = my.sch.store;
  return (
    <Sheet onClose={onClose} label={t.rfTitle} padded className="sc-sheet">
      <RescheduleForm
        store={store}
        people={people}
        slots={my.sch.slots.filter((s) => hasClient(s, my.myId))}
        requests={my.requests}
        t={t}
        locale={locale}
        now={my.now}
        today={my.today}
        mode={counterOf ? 'counter' : slot ? 'known' : 'pick'}
        counterOf={counterOf}
        slot={slot}
        clientId={my.myId}
        side="client"
        copy={{
          title: cc.rqTitle,
          sub: cc.rqSub(my.first),
          sent: cc.rqSent,
          sentB: cc.rqSentB(my.first),
          noSessions: cc.mtNoSessions,
          noSessionsB: cc.rqNoSessionsB,
        }}
        onClose={onClose}
        onOpenChat={onOpenChat ? () => onOpenChat() : undefined}
      />
    </Sheet>
  );
}

/** Upcoming sessions with the trainer (My trainer page). Move opens the form with the session chosen. */
export function UpcomingSessions({
  my,
  n = 3,
  onMove,
}: {
  my: MySessions;
  n?: number;
  onMove: (s: ScheduleSlot) => void;
}) {
  const { cc, locale } = useClientT();
  const [all, setAll] = useState(false);
  const rows = all ? my.upcoming : my.upcoming.slice(0, n);
  const shared = my.upcoming.some((s) => s.kind !== 'solo');
  if (my.upcoming.length === 0)
    return (
      <GroupedList header={cc.mtUpcomingHead(my.first)}>
        <ListRow label={cc.mtNoSessions} />
      </GroupedList>
    );
  return (
    <GroupedList
      header={cc.mtUpcomingHead(my.first)}
      footer={shared ? cc.mtUpcomingGroupFoot : cc.mtUpcomingFoot(my.first)}
    >
      {rows.map((s) => {
        const r = my.openFor(s);
        const waiting = !!r && r.from === 'client';
        const people = s.kind === 'solo' ? '' : ` · ${cc.mtPeople(peopleOf(s).length)}`;
        return (
          <ListRow
            key={s.id}
            icon={
              <IconTile
                tone={r ? 'illness' : 'people'}
                size={30}
                icon={
                  r
                    ? 'clock-counter-clockwise'
                    : s.kind === 'solo'
                      ? 'calendar-blank'
                      : 'user-square'
                }
              />
            }
            label={sessionTitle(cc, s, my.first)}
            sub={`${whenText(s, locale)} · ${gymName(s.gymId)}${people}${waiting && r ? `. ${cc.mtYouAsked(askedText(r, locale))}` : ''}`}
            trailing={
              r ? (
                <Tag tone="illness">{waiting ? cc.mtWaiting : cc.mtReqAnswer}</Tag>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => onMove(s)}>
                  {cc.mtMove}
                </Button>
              )
            }
          />
        );
      })}
      {!all && my.upcoming.length > n && (
        <ListRow
          action
          tone="accent"
          label={cc.mtShowAll(my.upcoming.length)}
          onClick={() => setAll(true)}
        />
      )}
    </GroupedList>
  );
}

/** Today: the next session with the trainer, with Request reschedule and the pending / counter states. */
export function NextSessionTile({
  my,
  onRequest,
}: {
  my: MySessions;
  onRequest: (s: ScheduleSlot) => void;
}) {
  const { cc, locale } = useClientT();
  const s = my.upcoming[0];
  if (!s) return null;
  const r = my.openFor(s);
  const mineReq = !!r && r.from === 'client';
  const counter = !!r && r.from === 'trainer';
  const day = shortDate(dayOfTs(s.start), locale);
  return (
    <Card emphasis="card" pad="md" className="cc-next">
      <div className="cc-next-h">
        <div className="cc-next-t">
          <span className="cc-next-k">
            {s.kind === 'group' ? cc.tdNextGroupKind(my.first) : cc.tdNextKind(my.first)}
          </span>
          <b>
            {sessionTitle(cc, s, my.first)} · {day}, {coachClock(s.start)}
          </b>
          <span className="cc-next-s">
            <Icon name="map-pin" /> {gymName(s.gymId)}
            {s.kind !== 'solo' ? ` · ${cc.mtPeople(peopleOf(s).length)}` : ''}
          </span>
        </div>
        {/* ONE status chip, top right: the card itself stays quiet */}
        {counter && (
          <Tag tone="illness" icon={<Icon name="clock-counter-clockwise" />}>
            {cc.tdCounterTag(my.first)}
          </Tag>
        )}
        {mineReq && (
          <Tag tone="illness" icon={<Icon name="hourglass" />}>
            {cc.tdWaitingTag(my.first)}
          </Tag>
        )}
      </div>
      {counter && r ? (
        <div className="cc-next-p">
          <p className="cc-next-body">{cc.tdCounterBody(askedText(r, locale))}</p>
          <div className="cc-actions">
            <Button
              variant="primary"
              size="sm"
              onClick={() => void my.sch.store.respond(r.id, 'accepted', 'client')}
            >
              {cc.tdAccept}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void my.sch.store.respond(r.id, 'declined', 'client')}
            >
              {cc.tdDecline}
            </Button>
          </div>
        </div>
      ) : mineReq && r ? (
        <div className="cc-next-p">
          <p className="cc-next-body">
            {cc.mtYouAsked(askedText(r, locale))}. {cc.tdWaitingBody(day)}
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void my.sch.store.respond(r.id, 'cancelled', 'client')}
          >
            {cc.tdCancelReq}
          </Button>
        </div>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          icon="calendar-blank"
          className="cc-reqbtn"
          onClick={() => onRequest(s)}
        >
          {cc.tdRequest}
        </Button>
      )}
    </Card>
  );
}
