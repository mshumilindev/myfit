import { PanelFooter } from '../layout/footerSlot';
import { useState } from 'react';
import './Schedule.css';
import { Icon } from '../../ui';
import { ActionMenu } from '../../components/ui/ActionMenu';
import { Button, IconButton } from '../../components/ui/Button';
import { ConfirmEffectsDialog } from '../../components/ui/ConfirmEffectsDialog';
import { ListRow } from '../../components/ui/GroupedList';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { Tag } from '../../components/ui/Tag';
import type { LocaleId } from '../../i18n';
import type { ScheduleStrings } from '../../i18n/coachSchedule';
import { ClientAvatar } from '../ClientAvatar';
import { coachClock } from '../format';
import { slotClock, slotTitle, statusWord } from './blockText';
import { GroupMoveSummary } from './GroupMoveSummary';
import { longDate, longWeekday, shortDate } from './labels';
import { clashWith, endOf, peopleOf, statusAt } from './model';
import type { People } from './people';
import { relativeTo, relativeWhen } from './relative';
import type { ScheduleStore } from './scheduleStore';
import { dayOfTs } from './time';
import { gymName, type RescheduleRequest, type ScheduleSlot } from './types';
import { requestsOf } from './view';

export interface SessionInspectorProps {
  slot: ScheduleSlot;
  clash: boolean;
  /** every session of the window: the overlapping ones are listed from it */
  slots: readonly ScheduleSlot[];
  requests: readonly RescheduleRequest[];
  store: ScheduleStore;
  people: People;
  t: ScheduleStrings;
  locale: LocaleId;
  now: number;
  /** Open the move form for the whole session, or for one person of a shared one. */
  onMove: (slot: ScheduleSlot, clientId?: string) => void;
  onOpenClient: (clientId: string) => void;
  onMessage: (clientId: string) => void;
  /** Show another session (an overlapping one) in this panel. */
  onJump: (slotId: string) => void;
}

const HERO_AVATARS = 3;

/**
 * What the trainer sees and can do with one session, in the drawer: who (avatars, name, status), when (the time range
 * large, the date, how far away it is), where, the note, how it repeats, a pending move request with its answer buttons,
 * the sessions it overlaps (each one a button that shows it), the clients with quick actions, and the action bar
 * (Move, Cancel, Mark done / missed).
 */
export function SessionInspector(p: SessionInspectorProps) {
  const { t, locale, slot, people } = p;
  const [confirm, setConfirm] = useState<{ clientId?: string } | null>(null);
  const ids = peopleOf(slot);
  const shared = slot.kind !== 'solo';
  const started = slot.start <= p.now;
  const mine = requestsOf(slot, p.requests);
  const open = mine.filter((r) => statusAt(r, p.now) === 'pending');
  const groupKeys = [...new Set(open.map((r) => r.groupKey).filter((g): g is string => !!g))];
  const single = open.filter((r) => !r.groupKey);
  const canMove = slot.status === 'planned' && !started && open.length === 0;
  const title = slotTitle(slot, people, t);
  const day = dayOfTs(slot.start);
  const overlaps = p.clash ? clashWith(slot, p.slots).filter((s) => s.status !== 'moved') : [];
  const statusOf = (id: string) =>
    slot.attendees.find((a) => a.clientId === id)?.status ?? slot.status;
  const unmarked = (status: 'done' | 'missed') => ids.filter((id) => statusOf(id) !== status);
  const live = started && slot.status !== 'moved';
  const canDone = live && slot.status !== 'done' && unmarked('done').length > 0;
  const canMissed = live && slot.status !== 'missed' && unmarked('missed').length > 0;
  const markAll = (status: 'done' | 'missed') => {
    for (const id of unmarked(status))
      void (status === 'done' ? p.store.markDone(slot, id) : p.store.markMissed(slot, id));
  };
  const when = relativeWhen(slot.start, endOf(slot), p.now, locale, { inProgress: t.scInProgress });

  return (
    <div className="sc-insp">
      <div className="sc-insp-hero">
        <span className="sc-insp-avatars" aria-hidden="true">
          {ids.slice(0, HERO_AVATARS).map((id) => (
            <ClientAvatar
              key={id}
              id={id}
              name={people.name(id)}
              size={44}
              hasPhoto={people.byId.get(id)?.hasPhoto}
            />
          ))}
          {ids.length > HERO_AVATARS && (
            <span className="sc-more">+{ids.length - HERO_AVATARS}</span>
          )}
        </span>
        <div className="sc-insp-id">
          <h3 className="sc-insp-title">{title}</h3>
          <div className="sc-insp-tags">
            <Tag
              tone={slot.status === 'done' ? 'ok' : slot.status === 'missed' ? 'danger' : 'accent'}
            >
              {statusWord(slot, t)}
            </Tag>
            {p.clash && (
              <Tag tone="danger" icon={<Icon name="warning" />}>
                {t.scOverlapTag}
              </Tag>
            )}
            {slot.justMoved && <Tag tone="ok">{t.scJustMoved}</Tag>}
            {slot.oneOff && <Tag tone="neutral">{t.scOneOffTag}</Tag>}
          </div>
        </div>
      </div>

      <section className="sc-insp-when" aria-label={t.scWhen}>
        <div className="sc-insp-time">{slotClock(slot)}</div>
        <div className="sc-insp-date">
          {longDate(day, locale)} · {t.scMinutes(slot.durationMin)}
        </div>
        <div className="sc-insp-rel">{when}</div>
      </section>

      <ul className="sc-insp-meta">
        <li>
          <Icon name="map-pin" />
          <span>
            <span className="sr-only">{t.scWhere}: </span>
            {gymName(slot.gymId)}
          </span>
        </li>
        <li>
          <Icon name="repeat" />
          <span>
            <span className="sr-only">{t.scRepeat}: </span>
            {slot.oneOff ? t.scOneOffOnly : t.scEvery(longWeekday(day, locale))}
          </span>
        </li>
      </ul>

      {slot.note && (
        <div className="sc-insp-note">
          <Icon name="note" />
          <p>
            <span className="sr-only">{t.scNote}: </span>
            {slot.note}
          </p>
        </div>
      )}

      {groupKeys.map((g) => (
        <GroupMoveSummary
          key={g}
          groupKey={g}
          requests={p.requests}
          store={p.store}
          people={people}
          t={t}
          now={p.now}
        />
      ))}
      {single.map((r) => {
        const byClient = r.from === 'client';
        const name = people.first(r.clientId);
        return (
          <section key={r.id} className="sc-insp-req" aria-label={t.scRequestOpen}>
            <div className="sc-insp-req-head">
              <Tag tone="accent">{t.scRequestOpen}</Tag>
              <span className="sc-insp-reqtext">
                {byClient
                  ? t.scReqBy(name)
                  : r.via === 'manager'
                    ? t.scReqByManager(r.byName || '')
                    : t.scReqByYou}
              </span>
            </div>
            <div className="sc-insp-req-move">
              <span className="sc-insp-req-at is-old">
                <small>{t.rcNowLabel}</small>
                {shortDate(dayOfTs(r.fromStart), locale)} {coachClock(r.fromStart)}
              </span>
              <Icon name="arrow-right" />
              <span className="sc-insp-req-at">
                <small>{t.rcProposed}</small>
                {shortDate(dayOfTs(r.toStart), locale)} {coachClock(r.toStart)}
              </span>
            </div>
            {r.note && <p className="sc-insp-reqtext">{r.note}</p>}
            <p className="sc-insp-reqtext">
              {t.scReqExpires(relativeTo(r.expiresAt, p.now, locale))}
            </p>
            <div className="sc-insp-req-actions">
              {byClient ? (
                <>
                  <Button
                    size="sm"
                    icon="check"
                    aria-label={t.rcAcceptAria(name)}
                    onClick={() => void p.store.respond(r.id, 'accepted', 'trainer')}
                  >
                    {t.rcAccept}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    aria-label={t.rcDeclineAria(name)}
                    onClick={() => void p.store.respond(r.id, 'declined', 'trainer')}
                  >
                    {t.rcDecline}
                  </Button>
                </>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void p.store.respond(r.id, 'cancelled', 'trainer')}
                >
                  {t.scCancelRequest}
                </Button>
              )}
            </div>
          </section>
        );
      })}

      {overlaps.length > 0 && (
        <section className="sc-insp-clash" aria-label={t.scConflictH}>
          <SectionLabel>{t.scConflictH}</SectionLabel>
          <ul>
            {overlaps.map((o) => (
              <li key={o.id}>
                <Icon name="warning" />
                <span className="sc-insp-clash-text">
                  <strong>{slotTitle(o, people, t)}</strong>
                  <small>{slotClock(o)}</small>
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label={t.scConflictShowAria(slotTitle(o, people, t))}
                  onClick={() => p.onJump(o.id)}
                >
                  {t.scConflictShow}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="sc-insp-who" aria-label={t.scClientsH}>
        <SectionLabel>{t.scClientsH}</SectionLabel>
        <div className="sc-insp-people">
          {ids.map((id) => {
            const att = slot.attendees.find((a) => a.clientId === id);
            const items = [
              ...(canMove && shared
                ? [
                    {
                      id: 'one',
                      label: t.scMoveOne(people.first(id)),
                      icon: 'swap',
                      onSelect: () => p.onMove(slot, id),
                    },
                  ]
                : []),
              ...(live && att?.status !== 'done'
                ? [
                    {
                      id: 'done',
                      label: t.scMarkDone(people.first(id)),
                      icon: 'check-circle',
                      onSelect: () => void p.store.markDone(slot, id),
                    },
                  ]
                : []),
              ...(live && att?.status !== 'missed'
                ? [
                    {
                      id: 'miss',
                      label: t.scMarkMissed(people.first(id)),
                      icon: 'x-circle',
                      onSelect: () => void p.store.markMissed(slot, id),
                    },
                  ]
                : []),
              ...(shared && !started
                ? [
                    {
                      id: 'rm',
                      label: t.scCancelFor(people.first(id)),
                      icon: 'minus-circle',
                      onSelect: () => setConfirm({ clientId: id }),
                    },
                  ]
                : []),
              ...(groupKeys.length
                ? [
                    {
                      id: 'keep',
                      label: t.scKeepOld(people.first(id)),
                      icon: 'clock-counter-clockwise',
                      onSelect: () => void p.store.keepOnOldTime(slot, id),
                    },
                  ]
                : []),
            ];
            return (
              <ListRow
                key={id}
                dense
                icon={
                  <ClientAvatar
                    id={id}
                    name={people.name(id)}
                    size={32}
                    hasPhoto={people.byId.get(id)?.hasPhoto}
                  />
                }
                label={people.name(id)}
                sub={
                  att && att.status !== 'planned'
                    ? att.status === 'declined'
                      ? t.scDeclinedTag
                      : statusWord({ ...slot, status: att.status }, t)
                    : undefined
                }
                trailing={
                  <span className="sc-insp-quick">
                    <IconButton
                      icon="chat-circle"
                      variant="ghost"
                      label={`${t.scMessage}: ${people.first(id)}`}
                      onClick={() => p.onMessage(id)}
                    />
                    <IconButton
                      icon="user"
                      variant="ghost"
                      label={`${t.scOpenClient}: ${people.first(id)}`}
                      onClick={() => p.onOpenClient(id)}
                    />
                    {items.length > 0 && <ActionMenu label={people.first(id)} items={items} />}
                  </span>
                }
              />
            );
          })}
        </div>
      </section>

      {started && slot.status === 'planned' && <p className="sc-insp-hint">{t.scPastLocked}</p>}
      {(canMove || canDone || canMissed || (!started && slot.status === 'planned')) && (
        <PanelFooter>
          {canMove && (
            <Button icon="swap" onClick={() => p.onMove(slot)}>
              {t.scMove}
            </Button>
          )}
          {canDone && (
            <Button icon="check-circle" variant="secondary" onClick={() => markAll('done')}>
              {t.scMarkDoneAll}
            </Button>
          )}
          {canMissed && (
            <Button icon="x-circle" variant="secondary" onClick={() => markAll('missed')}>
              {t.scMarkMissedAll}
            </Button>
          )}
          {!started && slot.status === 'planned' && (
            <Button variant="secondary" icon="x" onClick={() => setConfirm({})}>
              {t.scCancelSession}
            </Button>
          )}
        </PanelFooter>
      )}

      {confirm && (
        <ConfirmEffectsDialog
          title={t.scCancelH}
          body={t.scCancelBody(confirm.clientId ? people.name(confirm.clientId) : title)}
          effects={[
            {
              icon: 'eye',
              text: t.scCancelEffect(
                (confirm.clientId ? [confirm.clientId] : ids).map(people.first).join(', '),
              ),
            },
          ]}
          confirmLabel={
            confirm.clientId ? t.scCancelFor(people.first(confirm.clientId)) : t.scCancelConfirm
          }
          cancelLabel={t.scKeep}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            const c = confirm;
            setConfirm(null);
            void p.store.cancelSession(slot, c.clientId);
          }}
        />
      )}
    </div>
  );
}
