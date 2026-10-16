import { useId, useMemo, useState } from 'react';
import './Schedule.css';
import { Button } from '../../components/ui/Button';
import { Calendar } from '../../components/ui/Calendar';
import { Chip } from '../../components/ui/Chip';
import { EmptyState } from '../../components/ui/EmptyState';
import { GroupedList, ListRow } from '../../components/ui/GroupedList';
import { Notice } from '../../components/ui/Notice';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { Segmented } from '../../components/ui/Segmented';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { TimeField } from '../../components/ui/TimeField';
import type { LocaleId } from '../../i18n';
import type { ScheduleStrings } from '../../i18n/coachSchedule';
import { ClientAvatar } from '../ClientAvatar';
import { coachClock } from '../format';
import { PanelFooter } from '../layout/footerSlot';
import { slotClock, slotTitle } from './blockText';
import { newId, opaqueSlotKey } from './ids';
import { longDate, shortDate } from './labels';
import { clashWith, hasClient, peopleOf, statusAt } from './model';
import type { People } from './people';
import { RequestError, type RequestDraft } from './requests';
import type { ScheduleStore } from './scheduleStore';
import { dayOfTs, fromMin, minOfTs, toMin, tsOf } from './time';
import { gymName, MAX_NOTE, type RescheduleRequest, type ScheduleSlot } from './types';

export type RescheduleMode = 'known' | 'pick' | 'counter';

export interface RescheduleFormProps {
  store: ScheduleStore;
  people: People;
  slots: readonly ScheduleSlot[];
  requests: readonly RescheduleRequest[];
  t: ScheduleStrings;
  locale: LocaleId;
  now: number;
  today: number;
  mode: RescheduleMode;
  /** known: the session to move */
  slot?: ScheduleSlot;
  /** known: move only this person of a shared session; pick: the client whose sessions are listed */
  clientId?: string;
  /** counter: the client's request this one answers */
  counterOf?: RescheduleRequest;
  onClose: () => void;
  /** The form sits in a panel that already shows its title (the coach drawer): leave out its own heading. */
  titleInPanel?: boolean;
  /** after a send: the chat is where the answer shows up */
  onOpenChat?: (clientId: string) => void;
  /** M7: who is asking. `client` = the member's own form (no client picker, the request is `from: 'client'`). Default trainer. */
  side?: 'trainer' | 'client';
  /** M7: words in the asker's voice (the client's form); anything missing falls back to the trainer's copy. */
  copy?: Partial<{
    title: string;
    sub: string;
    sent: string;
    sentB: string;
    noSessions: string;
    noSessionsB: string;
  }>;
}

const FREE_FROM = 8 * 60;
const FREE_TO = 20 * 60;
const FREE_SHOWN = 5;

const errorText = (e: RequestError, t: ScheduleStrings): string =>
  e.code === 'same-time'
    ? t.rfSame
    : e.code === 'past'
      ? t.rfPast
      : e.code === 'open-request'
        ? t.rfDup
        : e.code === 'no-slot'
          ? t.rfNoSlot
          : t.rfFailed;

/**
 * Move a session. Three ways in: from the calendar (the session is known), from a client's profile or chat (pick which
 * of the client's next sessions), and as a counter-proposal to a request. Sending creates one request per attendee (a
 * whole-session move shares a group key) and the card appears in the chat; nothing changes until it is accepted.
 */
export function RescheduleForm(p: RescheduleFormProps) {
  const { t, locale, people, store } = p;
  const formId = useId();
  const counterSlot = useMemo(
    () =>
      p.counterOf
        ? p.slots.find((s) => opaqueSlotKey(s.key) === p.counterOf?.slotKey && s.status !== 'moved')
        : undefined,
    [p.counterOf, p.slots],
  );
  const [clientId, setClientId] = useState(
    p.clientId ?? p.counterOf?.clientId ?? people.list[0]?.id ?? '',
  );
  const [slot, setSlot] = useState<ScheduleSlot | undefined>(p.slot ?? counterSlot);
  const [day, setDay] = useState<number | null>(p.counterOf ? dayOfTs(p.counterOf.toStart) : null);
  const [time, setTime] = useState(p.counterOf ? fromMin(minOfTs(p.counterOf.toStart)) : '');
  const [note, setNote] = useState('');
  const [scope, setScope] = useState<'all' | 'one'>(
    p.mode === 'known' && p.clientId && p.slot && p.slot.kind !== 'solo' ? 'one' : 'all',
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState<number | null>(null);

  const upcoming = useMemo(
    () =>
      p.slots
        .filter((s) => s.status === 'planned' && s.start > p.now && hasClient(s, clientId))
        .filter(
          (s) =>
            !p.requests.some(
              (r) =>
                r.slotKey === opaqueSlotKey(s.key) &&
                r.clientId === clientId &&
                statusAt(r, p.now) === 'pending',
            ),
        )
        .sort((a, b) => a.start - b.start)
        .slice(0, 8),
    [p.slots, p.requests, p.now, clientId],
  );

  const shared = !!slot && slot.kind !== 'solo';
  const who = slot ? peopleOf(slot) : [];
  const toStart = day != null && time ? tsOf(day, toMin(time)) : null;
  const others = p.slots.filter((s) => s.id !== slot?.id && s.status !== 'moved');
  const hit =
    slot && toStart != null
      ? clashWith({ start: toStart, durationMin: slot.durationMin }, others)
      : [];
  const free = useMemo(() => {
    if (!slot || day == null) return [];
    const out: string[] = [];
    for (let m = FREE_FROM; m <= FREE_TO && out.length < FREE_SHOWN; m += 60) {
      if (!clashWith({ start: tsOf(day, m), durationMin: slot.durationMin }, others).length)
        out.push(fromMin(m));
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot, day, p.slots]);

  const send = async () => {
    setErr(null);
    if (!slot) return setErr(t.rfNoSlot);
    if (toStart == null) return setErr(t.rfPast);
    setBusy(true);
    try {
      const base = {
        slot: { key: slot.key, start: slot.start },
        toStart,
        note: note.trim() || undefined,
      };
      if (p.mode === 'counter' && p.counterOf) {
        const r = await store.counter(p.counterOf.id, {
          clientId: p.counterOf.clientId,
          slot: base.slot,
          toStart,
          note: base.note,
          scope: p.counterOf.scope,
          ...(p.counterOf.groupKey ? { groupKey: p.counterOf.groupKey } : {}),
        });
        if (r) setSent(1);
        else setErr(t.rfFailed);
      } else {
        const targets =
          shared && scope === 'all'
            ? who
            : [
                shared
                  ? p.clientId && who.includes(p.clientId)
                    ? p.clientId
                    : clientId
                  : (who[0] ?? clientId),
              ];
        const groupKey = shared && scope === 'all' && who.length > 1 ? newId('gk-') : undefined;
        const drafts: Omit<RequestDraft, 'id' | 'now'>[] = targets.map((id) => ({
          ...base,
          clientId: id,
          from: p.side ?? 'trainer',
          scope: shared && scope === 'one' ? 'one' : 'all',
          ...(groupKey ? { groupKey } : {}),
        }));
        const made = await store.request(drafts);
        if (made) setSent(made.length);
        else setErr(t.rfFailed);
      }
    } catch (e) {
      setErr(e instanceof RequestError ? errorText(e, t) : t.rfFailed);
    } finally {
      setBusy(false);
    }
  };

  const target = p.counterOf?.clientId ?? (slot && !shared ? who[0] : clientId);
  const title =
    p.copy?.title ??
    (p.mode === 'counter'
      ? t.rfTitleCounter
      : slot && !shared && who[0]
        ? t.rfTitleKnown(people.first(who[0]))
        : t.rfTitle);

  if (sent != null) {
    return (
      <div className="sc-form" role="status">
        <EmptyState
          titleAs="h2"
          icon="paper-plane-right"
          title={p.copy?.sent ?? (sent > 1 ? t.rfSentGroup(sent) : t.rfSent)}
          body={p.copy?.sentB ?? (sent > 1 ? t.rfSentGroupB : t.rfSentB(people.first(target)))}
        >
          <div className="sc-form-actions">
            {p.onOpenChat && (
              <Button variant="secondary" onClick={() => p.onOpenChat?.(target)}>
                {t.rfOpenChat}
              </Button>
            )}
            <Button onClick={p.onClose}>{t.rfDone}</Button>
          </div>
        </EmptyState>
      </div>
    );
  }

  return (
    <form
      id={formId}
      className="sc-form"
      aria-label={title}
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
    >
      <div className="sc-form-head">
        {!p.titleInPanel && <h2 className="sc-form-title">{title}</h2>}
        <p className="sc-form-sub">
          {p.counterOf && slot
            ? t.rfCounterOf(
                shortDate(dayOfTs(p.counterOf.toStart), locale),
                coachClock(p.counterOf.toStart),
              )
            : (p.copy?.sub ?? t.rfSub)}
        </p>
      </div>

      {p.mode === 'pick' && !p.slot && (
        <div className="sc-form-block">
          {p.side !== 'client' && (
            <Select
              label={t.rfClient}
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                setSlot(undefined);
              }}
            >
              {people.list.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
          <SectionLabel>{t.rfWhichH}</SectionLabel>
          {upcoming.length === 0 ? (
            <EmptyState
              titleAs="h2"
              icon="calendar-blank"
              title={p.copy?.noSessions ?? t.rfNoSessions}
              body={p.copy?.noSessionsB ?? t.rfNoSessionsB}
            />
          ) : (
            <GroupedList label={t.rfWhichHint}>
              {upcoming.map((s) => (
                <ListRow
                  key={s.id}
                  dense
                  icon={
                    <ClientAvatar
                      id={clientId}
                      name={people.name(clientId)}
                      size={32}
                      hasPhoto={people.byId.get(clientId)?.hasPhoto}
                    />
                  }
                  label={`${shortDate(dayOfTs(s.start), locale)} · ${slotClock(s)}`}
                  sub={`${slotTitle(s, people, t)} · ${gymName(s.gymId)}`}
                  selected={slot?.id === s.id}
                  check={slot?.id === s.id}
                  onClick={() => {
                    setSlot(s);
                    setScope('all');
                  }}
                />
              ))}
            </GroupedList>
          )}
        </div>
      )}

      {slot && (
        <>
          <div className="sc-form-block">
            <SectionLabel>{t.rfNow}</SectionLabel>
            <p className="sc-form-now">
              <strong>{slotTitle(slot, people, t)}</strong> ·{' '}
              {longDate(dayOfTs(slot.start), locale)}, {slotClock(slot)} · {gymName(slot.gymId)}
            </p>
          </div>

          {shared && p.mode !== 'counter' && (
            <div className="sc-form-block">
              <SectionLabel>{t.rfScope}</SectionLabel>
              <Segmented
                label={t.rfScope}
                fill
                value={scope}
                onChange={setScope}
                options={[
                  { value: 'all', label: t.rfScopeAll(who.length) },
                  {
                    value: 'one',
                    label: t.rfScopeOne(
                      people.first(
                        p.clientId && who.includes(p.clientId) ? p.clientId : (who[0] ?? ''),
                      ),
                    ),
                  },
                ]}
              />
              <p className="sc-form-hint">
                {scope === 'all' ? t.rfScopeAllHint : t.rfScopeOneHint}
              </p>
            </div>
          )}

          <div className="sc-form-block">
            <SectionLabel>{t.rfNewTime}</SectionLabel>
            <Calendar
              value={day}
              onSelect={setDay}
              today={p.today}
              min={p.today}
              weekStart={1}
              label={t.rfDate}
            />
            <TimeField
              label={t.rfStart}
              value={time}
              onChange={(e) => setTime(e.target.value)}
              step={300}
            />
            {day != null && (
              <div className="sc-free" role="group" aria-label={t.rfSuggested}>
                {free.length === 0 ? (
                  <span className="sc-form-hint">{t.rfNoFree}</span>
                ) : (
                  free.map((m) => (
                    <Chip
                      key={m}
                      selected={time === m}
                      aria-pressed={time === m}
                      onClick={() => setTime(m)}
                    >
                      {m}
                    </Chip>
                  ))
                )}
              </div>
            )}
          </div>
          {hit.length > 0 && (
            <Notice tone="note" icon="warning" role="status">
              <strong>{t.rfClashH}</strong>
              <span>
                {t.rfClashB(peopleOf(hit[0]).map(people.first).join(', '), slotClock(hit[0]))}
              </span>
            </Notice>
          )}
          <Textarea
            label={t.rfNote}
            placeholder={t.rfNotePlaceholder}
            value={note}
            maxLength={MAX_NOTE}
            rows={3}
            onChange={(e) => setNote(e.target.value)}
          />
        </>
      )}

      {err && (
        <Notice tone="danger" icon="warning" role="alert">
          {err}
        </Notice>
      )}
      <PanelFooter>
        <Button variant="secondary" type="button" onClick={p.onClose}>
          {t.rfCancel}
        </Button>
        <Button
          type="submit"
          form={formId}
          icon="paper-plane-right"
          loading={busy}
          disabled={busy || !slot || toStart == null}
        >
          {busy ? t.rfSending : t.rfSend}
        </Button>
      </PanelFooter>
    </form>
  );
}
