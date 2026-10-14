import { useId, useMemo, useState } from 'react';
import './Schedule.css';
import { Button } from '../../components/ui/Button';
import { Chip, ChipGroup } from '../../components/ui/Chip';
import { Notice } from '../../components/ui/Notice';
import { NumberStepper } from '../../components/ui/NumberStepper';
import { SearchField } from '../../components/ui/SearchField';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { Segmented } from '../../components/ui/Segmented';
import { Select } from '../../components/ui/Select';
import { Switch } from '../../components/ui/Switch';
import { Textarea } from '../../components/ui/Textarea';
import { TimeField } from '../../components/ui/TimeField';
import type { LocaleId } from '../../i18n';
import type { ScheduleStrings } from '../../i18n/coachSchedule';
import { coachClock } from '../format';
import { PanelFooter } from '../layout/footerSlot';
import { useCalendarSettings } from './calendarSettings';
import { defaultGym } from './hours';
import { HoursNotice } from './HoursNotice';
import { lastDuration, lastGym, rememberDuration, rememberGym, type CreateDraft } from './grid';
import { newId } from './ids';
import { clashWith, draftSlots, peopleOf } from './model';
import type { People } from './people';
import type { ScheduleStore } from './scheduleStore';
import { longDate, longWeekday, shortDate } from './labels';
import { dayOfTs, dowOfDay, fromMin, toMin, tsOf } from './time';
import {
  MAX_NOTE,
  scheduleGyms,
  type OneOffDoc,
  type PatternDoc,
  type Row,
  type ScheduleSlot,
  type ShareInfo,
} from './types';

export interface QuickCreateProps {
  store: ScheduleStore;
  people: People;
  /** the sessions already on the calendar (clash check) */
  slots: readonly ScheduleSlot[];
  t: ScheduleStrings;
  locale: LocaleId;
  now: number;
  draft: CreateDraft;
  onClose: () => void;
}

const DURATIONS = [30, 45, 60, 90] as const;
const SHOWN_CLASHES = 3;
const SHOWN_CLIENTS = 40;

/**
 * Create a session from an empty slot of the week grid: the day and the snapped start come from the click, the length
 * from the drag or the last one used. One tap saves a one-off for the chosen client(s); "Repeat every week" makes a
 * weekly plan instead. It goes through the same store `save` as the Add sessions form (sealed write, undo toast, the
 * client's copy), and an overlap is shown before saving, never blocking.
 */
export function QuickCreate(p: QuickCreateProps) {
  const { t, locale, people } = p;
  const formId = useId();
  const { day } = p.draft;
  const [ids, setIds] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [start, setStart] = useState(() => fromMin(p.draft.start));
  const [dur, setDur] = useState<number>(() => p.draft.dur ?? lastDuration());
  const cal = useCalendarSettings();
  const [gymId, setGymId] = useState(() => {
    const last = lastGym();
    const gyms = scheduleGyms();
    const known = gyms.map((g) => g.id);
    // the gyms the trainer works at come first (settings), then the last one used, then any
    return (
      defaultGym(cal.settings, known) ?? gyms.find((g) => g.id === last)?.id ?? gyms[0]?.id ?? ''
    );
  });
  const [note, setNote] = useState('');
  const [repeat, setRepeat] = useState(false);
  const [weeks, setWeeks] = useState(8);
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);

  const startMin = toMin(start || '00:00');
  const startTs = tsOf(day, startMin);
  const endLabel = coachClock(startTs + dur * 60_000);
  const kind = ids.length >= 3 ? 'group' : ids.length === 2 ? 'split' : 'solo';
  const groupId = useMemo(() => newId('g-'), []);
  const rowId = useMemo(() => newId('r-'), []);
  const share: ShareInfo | undefined =
    kind === 'solo'
      ? undefined
      : {
          groupId,
          kind,
          ...(kind === 'group' ? { title: t.scGroupTitle, capacity: Math.max(8, ids.length) } : {}),
        };
  const row: Row = {
    id: rowId,
    dow: dowOfDay(day),
    start,
    dur,
    gymId,
    dayLabel: null,
    programDayId: null,
  };
  const drafts = useMemo(
    () =>
      repeat
        ? draftSlots([row], day, weeks)
        : [{ start: startTs, durationMin: dur, id: 'one', day, gymId, rowId, dow: row.dow }],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [repeat, day, weeks, start, dur, gymId],
  );
  const clashes = useMemo(
    () =>
      drafts.flatMap((d) =>
        clashWith(
          { start: d.start, durationMin: d.durationMin },
          p.slots.filter((s) => s.status !== 'moved'),
        ).map((hit) => ({ d, hit })),
      ),
    [drafts, p.slots],
  );

  const match = q.trim().toLowerCase();
  const found = people.list
    .filter((c) => !ids.includes(c.id) && (!match || c.name.toLowerCase().includes(match)))
    .slice(0, SHOWN_CLIENTS);
  const toggle = (id: string) =>
    setIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const problem = ids.length === 0 ? t.bdNoClient : startTs < p.now ? t.qcPast : null;
  const names = ids.map(people.first).join(', ');
  const durations = DURATIONS.includes(dur as (typeof DURATIONS)[number])
    ? DURATIONS
    : ([...DURATIONS, dur].sort((a, b) => a - b) as readonly number[]);

  const save = async () => {
    setTried(true);
    if (problem) return;
    setBusy(true);
    let ok: boolean;
    if (repeat) {
      const pattern: PatternDoc = {
        id: newId('p-'),
        fromDay: day,
        weeks,
        rows: [row],
        ...(share ? { share } : {}),
      };
      ok = await p.store.save({
        clientIds: ids,
        pattern,
        label: t.bdSavedWeekly(drafts.length, names),
      });
    } else {
      const oneOff: OneOffDoc = {
        id: newId('o-'),
        day,
        start,
        dur,
        gymId,
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(share ? { share } : {}),
      };
      ok = await p.store.save({
        clientIds: ids,
        oneOff,
        label: t.bdSavedOneOff(names, shortDate(day, locale)),
      });
    }
    setBusy(false);
    if (ok) {
      rememberDuration(dur);
      if (gymId) rememberGym(gymId);
      p.onClose();
    }
  };

  return (
    <form
      id={formId}
      className="sc-form sc-quick"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      aria-label={t.qcTitle}
    >
      <p className="sc-form-sub">
        {longDate(dayOfTs(startTs), locale)} · {start} – {endLabel}
      </p>

      <div className="sc-form-block">
        <SectionLabel>{t.bdClients}</SectionLabel>
        {people.list.length === 0 ? (
          <p className="sc-form-hint">{t.qcNoClients}</p>
        ) : (
          <>
            {ids.length > 0 && (
              <ChipGroup role="group" aria-label={t.bdPickClients}>
                {ids.map((id) => (
                  <Chip key={id} selected icon="check" aria-pressed onClick={() => toggle(id)}>
                    {people.first(id)}
                  </Chip>
                ))}
              </ChipGroup>
            )}
            <SearchField
              value={q}
              onChange={setQ}
              placeholder={t.qcSearch}
              clearLabel={t.qcSearchClear}
            />
            <div className="sc-picker" role="group" aria-label={t.bdPickClients}>
              {found.map((c) => (
                <Chip key={c.id} aria-pressed={false} onClick={() => toggle(c.id)}>
                  {c.name}
                </Chip>
              ))}
              {found.length === 0 && <p className="sc-form-hint">{t.qcNoMatch}</p>}
            </div>
          </>
        )}
        <p className="sc-form-hint">
          {ids.length
            ? kind === 'group'
              ? t.bdKindGroup
              : kind === 'split'
                ? t.bdKindSplit
                : t.bdKindSolo
            : t.bdClientsHint}
        </p>
        {tried && ids.length === 0 && (
          <p className="sc-form-err" role="alert">
            {t.bdNoClient}
          </p>
        )}
      </div>

      <div className="sc-form-row">
        <TimeField
          label={t.bdStart}
          value={start}
          onChange={(e) => setStart(e.target.value)}
          step={900}
        />
        <Select label={t.bdGym} value={gymId} onChange={(e) => setGymId(e.target.value)}>
          {scheduleGyms().map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </Select>
      </div>
      {tried && startTs < p.now && (
        <p className="sc-form-err" role="alert">
          {t.qcPast}
        </p>
      )}
      <div className="sc-form-block">
        <SectionLabel>{t.bdDuration}</SectionLabel>
        <Segmented
          label={t.bdDuration}
          fill
          value={dur}
          onChange={setDur}
          options={durations.map((m) => ({ value: m, label: t.scMinutes(m) }))}
        />
      </div>

      <div className="sc-form-block">
        <label className="sc-quick-repeat">
          <span>
            <strong>{t.qcRepeat}</strong>
            <small>{t.scEvery(longWeekday(day, locale))}</small>
          </span>
          <Switch checked={repeat} onChange={setRepeat} aria-label={t.qcRepeat} />
        </label>
        {repeat && (
          <NumberStepper label={t.bdWeeks} value={weeks} onChange={setWeeks} min={1} max={26} />
        )}
      </div>

      {!repeat && (
        <Textarea
          label={t.bdNote}
          placeholder={t.bdNotePlaceholder}
          value={note}
          maxLength={MAX_NOTE}
          rows={2}
          onChange={(e) => setNote(e.target.value)}
        />
      )}
      {clashes.length > 0 && (
        <Notice tone="danger" icon="warning" role="status">
          <strong>{t.bdClashH}</strong>
          <ul className="sc-clashes">
            {clashes.slice(0, SHOWN_CLASHES).map(({ d, hit }) => (
              <li key={d.id + d.start + hit.id}>
                {t.bdClash(
                  peopleOf(hit).map(people.first).join(', '),
                  `${shortDate(dayOfTs(d.start), locale)} ${coachClock(d.start)}`,
                )}
              </li>
            ))}
          </ul>
          <span>{t.bdClashB}</span>
        </Notice>
      )}
      <HoursNotice drafts={drafts} t={t} />
      {p.store.getState().failed === 'limit' && (
        <Notice tone="danger" icon="warning" role="alert">
          {t.scFailLimit}
        </Notice>
      )}

      <PanelFooter>
        <Button variant="secondary" type="button" onClick={p.onClose}>
          {t.bdCancel}
        </Button>
        <Button type="submit" form={formId} loading={busy} disabled={busy} icon="calendar-plus">
          {busy ? t.bdSaving : t.qcCreate}
        </Button>
      </PanelFooter>
    </form>
  );
}
