import { useMemo, useState } from 'react';
import { Button } from '../components/ui/Button';
import { DayBar } from '../components/ui/DayBar';
import { GroupedList, ListRow } from '../components/ui/GroupedList';
import { IconTile } from '../components/ui/IconTile';
import { PageHead } from '../components/ui/PageHead';
import { ConfirmDialog, Sheet, SheetFoot, SheetPin } from '../components/ui/Overlays';
import { SaveGuide, useSaveGuide } from '../components/ui/SaveGuide';
import { StickyActionBar } from '../components/ui/StickyActionBar';
import { Switch } from '../components/ui/Switch';
import { restPeriodShown } from '../healthAddons';
import { useT } from '../i18n';
import { useStore } from '../store';
import {
  copyDay,
  dayRanges,
  DAY,
  EVERY_DAY,
  overrides,
  rangesText,
  setDay,
  timeText,
  WEEKDAYS,
  type Range,
} from './availability';
import { HM } from './PlanForm';
import { fill, STRINGS } from './strings';
import { savePrefs, usePrefs } from './sync';
import type { PlannerPrefs } from './types';
import { dayFromNumber } from './zoned';
import { dayMonth, dayShort } from './fmt';
import './planner.css';

/** Name of weekday `i` (0 = Monday): 2024-01-01 is a Monday. */
const weekdayName = (locale: Parameters<typeof dayShort>[0], i: number, long = true): string =>
  new Intl.DateTimeFormat({ en: 'en', uk: 'uk', pl: 'pl', lt: 'lt', et: 'et' }[locale], {
    weekday: long ? 'long' : 'short',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(2024, 0, 1 + i)));

/**
 * One range being added (`index` null) or changed, in minutes. `step` is the time the sheet is asking for; a new range asks From
 * and then, straight after, To (`chain`); a tap on From or To of an existing range asks just that one.
 */
interface Editing {
  index: number | null;
  from: number;
  to: number;
  step: 'from' | 'to';
  chain: boolean;
}

const STEP = 5;

/**
 * My availability (design SPO-555, screens 32-34): the hours the person usually can train, per weekday, and the Health states that
 * override them (read-only). Edits save at once. Whether a trainer sees any of it is a separate consent (I10); the switch here only
 * records the wish.
 */
export function AvailabilityPage({ onBack }: { onBack: () => void }) {
  const { t, locale } = useT();
  const s = STRINGS[locale];
  const prefs = usePrefs();
  const { restPeriods } = useStore();
  const [day, setDayOpen] = useState<number | null>(null);
  const [resetting, setResetting] = useState(false);

  const week = prefs.availability;
  const write = (next: Partial<PlannerPrefs>) => void savePrefs({ ...prefs, ...next });
  const [today] = useState(() => Math.floor(Date.now() / 86_400_000));
  const health = useMemo(
    () => overrides(restPeriods, today, restPeriodShown),
    // The gate reads the installed list, which changes with `restPeriods` re-renders; today is stable for a render.
    [restPeriods, today],
  );

  if (day !== null) {
    return (
      <DayEditor
        day={day}
        week={week}
        onSave={(w) => {
          write({ availability: w });
          setDayOpen(null);
        }}
        onClose={() => setDayOpen(null)}
      />
    );
  }

  const range = (o: { startDay: number; endDay: number | null }) => {
    const a = dayMonth(locale, dayFromNumber(o.startDay));
    return o.endDay === null ? a : `${a} – ${dayMonth(locale, dayFromNumber(o.endDay))}`;
  };

  return (
    <div className="screen pl-screen">
      <div className="pl-page">
        <PageHead back={{ label: t.backAction, onClick: onBack }} title={s.availTitle} />
        <GroupedList header={s.weeklyHours}>
          {EVERY_DAY.map((d) => {
            const r = dayRanges(week, d);
            return (
              <ListRow
                key={d}
                label={weekdayName(locale, d)}
                sub={r.length ? rangesText(r) : s.notFreeBar}
                trailing={<DayBar ranges={r} />}
                chevron
                onClick={() => setDayOpen(d)}
              />
            );
          })}
        </GroupedList>
        {health.length > 0 && (
          <GroupedList header={s.overriding}>
            {health.map((o) => (
              <ListRow
                key={o.id}
                icon={
                  <IconTile
                    tone={o.kind === 'unwell' ? 'danger' : 'accent'}
                    size={40}
                    icon={o.kind === 'unwell' ? 'thermometer-simple' : 'moon'}
                  />
                }
                label={o.kind === 'unwell' ? s.unwell : s.fullRest}
                sub={o.active ? `${range(o)} · ${s.activeNow}` : range(o)}
              />
            ))}
          </GroupedList>
        )}
        <GroupedList header={s.sharing}>
          <ListRow
            as="label"
            label={s.shareTitle}
            trailing={
              <Switch
                checked={prefs.shareAvailability}
                onChange={(v) => write({ shareAvailability: v })}
                aria-label={s.shareTitle}
              />
            }
          />
        </GroupedList>
        {EVERY_DAY.some((d) => dayRanges(week, d).length > 0) && (
          <Button variant="danger" icon="trash" fullWidth onClick={() => setResetting(true)}>
            {s.clearAll}
          </Button>
        )}
      </div>
      {resetting && (
        <ConfirmDialog
          danger
          title={s.resetTitle}
          body={s.resetBody}
          confirmLabel={s.resetBtn}
          cancelLabel={t.cancel}
          onConfirm={() => {
            write({ availability: {} });
            setResetting(false);
          }}
          onCancel={() => setResetting(false)}
        />
      )}
    </div>
  );
}

type Scope = 'only' | 'weekdays' | 'weekends' | 'every';
const SCOPE_DAYS: Record<Scope, readonly number[]> = {
  only: [],
  weekdays: WEEKDAYS,
  weekends: [5, 6],
  every: EVERY_DAY,
};

/**
 * One day: its ranges (From and To are both shown), add / change / remove. "Apply to" sets how far an edit reaches: only this day,
 * Mon-Fri, or every day. Picking a wider group copies this day's hours onto it at once; edits after that go to the whole group.
 */
function DayEditor(p: {
  day: number;
  week: PlannerPrefs['availability'];
  onSave: (w: PlannerPrefs['availability']) => void;
  onClose: () => void;
}) {
  const { t, locale } = useT();
  const s = STRINGS[locale];
  const [editing, setEditing] = useState<Editing | null>(null);
  const [removing, setRemoving] = useState<number | null>(null);
  // Nothing is picked until the person picks: an edit then only changes this day.
  const [scope, setScope] = useState<Scope | null>(null);
  // Edits go to a copy; Save writes it, Back / Cancel drop it (after asking when something changed).
  const [week, setWeek] = useState(p.week);
  const [askLeave, setAskLeave] = useState(false);
  const dirty = JSON.stringify(week) !== JSON.stringify(p.week);
  const guide = useSaveGuide([
    { id: 'hours', label: s.needChange, done: dirty },
    { id: 'scope', label: s.needScope, done: scope !== null },
  ]);
  const leave = () => (dirty ? setAskLeave(true) : p.onClose());
  const ranges = dayRanges(week, p.day);
  const reach = [...new Set([p.day, ...(scope ? SCOPE_DAYS[scope] : [])])];
  const commit = (next: Range[]) => setWeek(reach.reduce((w, d) => setDay(w, d, next), week));

  const pick = (next: Scope) => {
    setScope(next);
    const days = [...new Set([p.day, ...SCOPE_DAYS[next]])];
    if (next !== 'only') setWeek(copyDay(week, p.day, days));
  };

  const save = (e: Editing) => {
    const next = ranges.map((r) => [...r] as Range);
    if (e.index === null) next.push([e.from, e.to]);
    else next[e.index] = [e.from, e.to];
    commit(next);
    setEditing(null);
  };
  // A new range starts an hour after the last one ends (or at 09:00) and runs an hour.
  const fresh = (): Editing => {
    const last = ranges[ranges.length - 1];
    const from = last ? Math.min(DAY - 120, last[1] + 60) : 540;
    return { index: null, from, to: from + 60, step: 'from', chain: true };
  };
  const name = weekdayName(locale, p.day);

  return (
    <>
      <div className="screen pl-screen">
        <div className="pl-page">
          <PageHead back={{ label: t.backAction, onClick: leave }} title={name} />
          <DayBar
            wide
            ranges={ranges}
            label={ranges.length ? fill(s.freeBar, { t: rangesText(ranges) }) : s.notFreeBar}
          />
          {ranges.map(([a, b], i) => (
            <GroupedList key={`${a}-${b}`} header={rangesText([[a, b]])}>
              <ListRow
                label={s.fromL}
                value={timeText(a)}
                valueStrong
                chevron
                onClick={() => setEditing({ index: i, from: a, to: b, step: 'from', chain: false })}
              />
              <ListRow
                label={s.toL}
                value={timeText(b)}
                valueStrong
                chevron
                onClick={() => setEditing({ index: i, from: a, to: b, step: 'to', chain: false })}
              />
              <ListRow action tone="danger" label={s.removeHours} onClick={() => setRemoving(i)} />
            </GroupedList>
          ))}
          <GroupedList>
            <ListRow
              icon={<IconTile tone="accent" size={32} icon="plus" />}
              label={s.addHours}
              guide={guide.field('hours')}
              chevron
              onClick={() => setEditing(fresh())}
            />
          </GroupedList>
          <GroupedList header={s.applyTo}>
            <ListRow
              label={fill(s.onlyDay, { d: name })}
              check={scope === 'only'}
              guide={guide.field('scope')}
              onClick={() => pick('only')}
            />
            <ListRow
              label={s.weekdaysL}
              sub={s.weekdaysSub}
              check={scope === 'weekdays'}
              guide={guide.field('scope')}
              onClick={() => pick('weekdays')}
            />
            <ListRow
              label={s.weekendsL}
              sub={s.weekendsSub}
              check={scope === 'weekends'}
              guide={guide.field('scope')}
              onClick={() => pick('weekends')}
            />
            <ListRow
              label={s.everyDay}
              check={scope === 'every'}
              guide={guide.field('scope')}
              onClick={() => pick('every')}
            />
          </GroupedList>
        </div>
      </div>
      <StickyActionBar>
        <Button variant="secondary" onClick={leave}>
          {t.cancel}
        </Button>
        <SaveGuide
          guide={guide}
          label={t.save}
          heading={s.stillNeeded}
          onSave={() => p.onSave(week)}
        />
      </StickyActionBar>
      {askLeave && (
        <ConfirmDialog
          danger
          title={s.discardT}
          body={s.discardHoursB}
          confirmLabel={s.discardOk}
          cancelLabel={s.keepEditing}
          onConfirm={p.onClose}
          onCancel={() => setAskLeave(false)}
        />
      )}
      {editing && (
        <TimeSheet
          value={editing}
          onClose={() => setEditing(null)}
          onSave={save}
          labels={{
            from: s.fromL,
            to: s.toL,
            next: s.nextL,
            cancel: t.cancel,
            save: t.save,
            hour: s.hour,
            minutes: s.minutes,
          }}
        />
      )}
      {removing !== null && (
        <ConfirmDialog
          danger
          title={s.removeHours}
          body={rangesText([ranges[removing]])}
          confirmLabel={s.removeHours}
          cancelLabel={t.cancel}
          onConfirm={() => {
            commit(ranges.filter((_, i) => i !== removing));
            setRemoving(null);
          }}
          onCancel={() => setRemoving(null)}
        />
      )}
    </>
  );
}

/** One time of the range on hour and minute wheels (as in the plan form). To always stays after From. */
function TimeSheet(p: {
  value: Editing;
  onClose: () => void;
  onSave: (e: Editing) => void;
  labels: {
    from: string;
    to: string;
    next: string;
    cancel: string;
    save: string;
    hour: string;
    minutes: string;
  };
}) {
  const [v, setV] = useState(p.value);
  const isFrom = v.step === 'from';
  const title = isFrom ? p.labels.from : p.labels.to;
  const time = isFrom ? v.from : v.to;
  const set = (h: number, m: number) => {
    const total = Math.min(DAY, h * 60 + (h === 24 ? 0 : m));
    setV((c) =>
      isFrom
        ? { ...c, from: Math.min(total, DAY - STEP), to: Math.max(c.to, total + STEP) }
        : { ...c, to: Math.max(total, c.from + STEP) },
    );
  };
  const last = !(v.chain && isFrom);
  return (
    <Sheet onClose={p.onClose} label={title}>
      <div className="ul-flex ul-col ug-20">
        <SheetPin>
          <h2 className="ut-xl ut-w7">{title}</h2>
        </SheetPin>
        <HM
          h={Math.floor(time / 60)}
          m={time % 60}
          hl={p.labels.hour}
          ml={p.labels.minutes}
          hMax={isFrom ? 23 : 24}
          onChange={set}
        />
        <SheetFoot>
          <Button fullWidth variant="secondary" onClick={p.onClose}>
            {p.labels.cancel}
          </Button>
          <Button
            fullWidth
            onClick={() => (last ? p.onSave(v) : setV((c) => ({ ...c, step: 'to' })))}
          >
            {last ? p.labels.save : p.labels.next}
          </Button>
        </SheetFoot>
      </div>
    </Sheet>
  );
}
