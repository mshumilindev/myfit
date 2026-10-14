import { useId, useMemo, useState } from 'react';
import './Schedule.css';
import { Button } from '../../components/ui/Button';
import { Calendar } from '../../components/ui/Calendar';
import { Chip, ChipGroup } from '../../components/ui/Chip';
import { Field } from '../../components/ui/Field';
import { Notice } from '../../components/ui/Notice';
import { NumberStepper } from '../../components/ui/NumberStepper';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { Segmented } from '../../components/ui/Segmented';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { TimeField } from '../../components/ui/TimeField';
import { WeekdayToggle } from '../../components/ui/WeekdayToggle';
import type { LocaleId } from '../../i18n';
import type { ScheduleStrings } from '../../i18n/coachSchedule';
import { coachClock } from '../format';
import { PanelFooter } from '../layout/footerSlot';
import { useCalendarSettings } from './calendarSettings';
import { defaultGym } from './hours';
import { HoursNotice } from './HoursNotice';
import { newId } from './ids';
import { draftSlots, peopleOf, clashWith } from './model';
import type { People } from './people';
import type { ScheduleStore } from './scheduleStore';
import { shortDate, shortWeekday, longWeekday } from './labels';
import { dayOfTs, toMin, tsOf, weekStartDay } from './time';
import {
  scheduleGyms,
  MAX_NOTE,
  MAX_ROWS,
  type OneOffDoc,
  type PatternDoc,
  type Row,
  type ScheduleSlot,
  type ShareInfo,
} from './types';

export type BuilderMode = 'weekly' | 'oneoff';

export interface ScheduleBuilderProps {
  store: ScheduleStore;
  people: People;
  /** the sessions already on the calendar (clash check) */
  slots: readonly ScheduleSlot[];
  t: ScheduleStrings;
  locale: LocaleId;
  today: number;
  mode?: BuilderMode;
  clientIds?: readonly string[];
  onClose: () => void;
}

const DURATIONS = [30, 45, 60, 90] as const;
const SHOWN_CLASHES = 3;

/**
 * Add sessions: a weekly plan (days, time, length, gym, weeks) or a one-off session. One client is a solo session,
 * two a split, three or more a group (named, with a capacity). Clashes are shown before saving; saving is never
 * blocked by them (both sessions stay on the calendar and are marked). The screen offers an 8 s Undo after save.
 */
export function ScheduleBuilder(p: ScheduleBuilderProps) {
  const { t, locale, people, today } = p;
  const formId = useId();
  const [mode, setMode] = useState<BuilderMode>(p.mode ?? 'weekly');
  const [ids, setIds] = useState<string[]>([...(p.clientIds ?? [])]);
  const [title, setTitle] = useState('');
  const [capacity, setCapacity] = useState(8);
  const [dows, setDows] = useState<number[]>([]);
  const [start, setStart] = useState('18:00');
  const [dur, setDur] = useState<number>(60);
  const cal = useCalendarSettings();
  const [gymId, setGymId] = useState(
    () =>
      defaultGym(
        cal.settings,
        scheduleGyms().map((g) => g.id),
      ) ??
      scheduleGyms()[0]?.id ??
      '',
  );
  const [weeks, setWeeks] = useState(8);
  const [next, setNext] = useState(false);
  const [day, setDay] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);

  const kind = ids.length >= 3 ? 'group' : ids.length === 2 ? 'split' : 'solo';
  const monday = weekStartDay(today);
  const fromDay = monday + (next ? 7 : 0);
  const groupId = useMemo(() => newId('g-'), []);
  const rowIds = useMemo(() => Array.from({ length: 7 }, () => newId('r-')), []);
  const share: ShareInfo | undefined =
    kind === 'solo'
      ? undefined
      : {
          groupId,
          kind,
          ...(kind === 'group' ? { title: title.trim() || t.scGroupTitle, capacity } : {}),
        };

  const rows: Row[] = dows.map((dow) => ({
    id: rowIds[dow],
    dow,
    start,
    dur,
    gymId,
    dayLabel: null,
    programDayId: null,
  }));
  const drafts = useMemo(
    () =>
      mode === 'weekly'
        ? draftSlots(rows, fromDay, weeks)
        : day != null
          ? [
              {
                id: 'one',
                day,
                start: tsOf(day, toMin(start)),
                durationMin: dur,
                gymId,
                rowId: 'one',
                dow: 0,
              },
            ]
          : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, dows, start, dur, gymId, fromDay, weeks, day],
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

  const toggle = (id: string) =>
    setIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const problem =
    ids.length === 0
      ? t.bdNoClient
      : mode === 'weekly'
        ? dows.length === 0
          ? t.bdPickDay
          : dows.length > MAX_ROWS
            ? t.bdTooMany
            : null
        : day == null
          ? t.bdPickDate
          : null;

  const names = ids.map(people.first).join(', ');
  const save = async () => {
    setTried(true);
    if (problem) return;
    setBusy(true);
    let ok: boolean;
    if (mode === 'weekly') {
      const pattern: PatternDoc = {
        id: newId('p-'),
        fromDay,
        weeks,
        rows,
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
        day: day as number,
        start,
        dur,
        gymId,
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(share ? { share } : {}),
      };
      ok = await p.store.save({
        clientIds: ids,
        oneOff,
        label: t.bdSavedOneOff(names, shortDate(day as number, locale)),
      });
    }
    setBusy(false);
    if (ok) p.onClose();
  };

  return (
    <form
      id={formId}
      className="sc-form"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      aria-label={t.bdTitle}
    >
      <p className="sc-form-sub">{t.bdSub}</p>
      <Segmented
        label={t.bdMode}
        fill
        value={mode}
        onChange={setMode}
        options={[
          { value: 'weekly', label: t.bdWeekly },
          { value: 'oneoff', label: t.bdOneOffMode },
        ]}
      />

      <div className="sc-form-block">
        <SectionLabel>{t.bdClients}</SectionLabel>
        <ChipGroup role="group" aria-label={t.bdPickClients}>
          {people.list.map((c) => (
            <Chip
              key={c.id}
              selected={ids.includes(c.id)}
              aria-pressed={ids.includes(c.id)}
              onClick={() => toggle(c.id)}
            >
              {people.first(c.id)}
            </Chip>
          ))}
        </ChipGroup>
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
        {kind === 'group' && (
          <div className="sc-form-row">
            <Field
              label={t.bdGroupName}
              hint={t.bdGroupNameHint}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={60}
            />
            <NumberStepper
              label={t.bdCapacity}
              value={capacity}
              onChange={setCapacity}
              min={ids.length}
              max={12}
            />
          </div>
        )}
      </div>

      {mode === 'weekly' ? (
        <div className="sc-form-block">
          <SectionLabel>{t.bdDaysLabel}</SectionLabel>
          <WeekdayToggle
            label={t.bdDaysLabel}
            days={Array.from({ length: 7 }, (_, i) => ({
              id: String(i),
              label: shortWeekday(monday + i, locale),
              on: dows.includes(i),
              ariaLabel: longWeekday(monday + i, locale),
            }))}
            onToggle={(id) =>
              setDows((cur) =>
                cur.includes(Number(id))
                  ? cur.filter((x) => x !== Number(id))
                  : [...cur, Number(id)].sort(),
              )
            }
          />
          {tried && dows.length === 0 && (
            <p className="sc-form-err" role="alert">
              {t.bdPickDay}
            </p>
          )}
        </div>
      ) : (
        <div className="sc-form-block">
          <SectionLabel>{t.bdDate}</SectionLabel>
          <Calendar
            value={day}
            onSelect={setDay}
            today={today}
            min={today}
            weekStart={1}
            label={t.bdPickDate}
          />
          {tried && day == null && (
            <p className="sc-form-err" role="alert">
              {t.bdPickDate}
            </p>
          )}
        </div>
      )}

      <div className="sc-form-row">
        <TimeField
          label={t.bdStart}
          value={start}
          onChange={(e) => setStart(e.target.value)}
          step={300}
        />
        <Select label={t.bdGym} value={gymId} onChange={(e) => setGymId(e.target.value)}>
          {scheduleGyms().map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="sc-form-block">
        <SectionLabel>{t.bdDuration}</SectionLabel>
        <Segmented
          label={t.bdDuration}
          fill
          value={dur}
          onChange={setDur}
          options={DURATIONS.map((m) => ({ value: m, label: t.scMinutes(m) }))}
        />
      </div>

      {mode === 'weekly' ? (
        <>
          <NumberStepper label={t.bdWeeks} value={weeks} onChange={setWeeks} min={1} max={26} />
          <div className="sc-form-block">
            <SectionLabel>{t.bdFrom}</SectionLabel>
            <Segmented
              label={t.bdFrom}
              fill
              value={next ? 'next' : 'this'}
              onChange={(v) => setNext(v === 'next')}
              options={[
                { value: 'this', label: t.bdThisWeek },
                { value: 'next', label: t.bdNextWeek },
              ]}
            />
          </div>
        </>
      ) : (
        <Textarea
          label={t.bdNote}
          placeholder={t.bdNotePlaceholder}
          value={note}
          maxLength={MAX_NOTE}
          rows={3}
          onChange={(e) => setNote(e.target.value)}
        />
      )}

      {mode === 'weekly' && drafts.length > 0 && (
        <p className="sc-form-hint" role="status">
          {t.bdPreviewLine(drafts.length, weeks)}
        </p>
      )}
      {clashes.length > 0 && (
        <Notice tone="danger" icon="warning" role="status">
          <strong>{t.bdClashH}</strong>
          <ul className="sc-clashes">
            {clashes.slice(0, SHOWN_CLASHES).map(({ d, hit }) => (
              <li key={d.id + hit.id}>
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
          {busy ? t.bdSaving : t.bdSave}
        </Button>
      </PanelFooter>
    </form>
  );
}
