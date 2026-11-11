import { useMemo, useState } from 'react';
import { Button } from '../components/ui/Button';
import { dayKeyOf } from '../components/ui/calendarDays';
import { EmptyState } from '../components/ui/EmptyState';
import { GroupedList, ListRow } from '../components/ui/GroupedList';
import { IconTile } from '../components/ui/IconTile';
import { MonthGrid, type MonthGridDay } from '../components/ui/MonthGrid';
import { ConfirmDialog } from '../components/ui/Overlays';
import { Segmented } from '../components/ui/Segmented';
import { WeekStepper } from '../components/ui/WeekStepper';
import { useT } from '../i18n';
import { uuid } from '../store';
import { useWeekStartDay } from '../weekStart';
import { draftToPlan, newDraft, planToDraft, type Draft } from './draft';
import { clock, dayFull, dayLong, dayMonth, leadText, monthYear, weekRange } from './fmt';
import { PlanForm } from './PlanForm';
import { occurrencesBetween } from './recurrence';
import { fill, STRINGS } from './strings';
import { deletePlan, savePlan, usePlans } from './sync';
import type { PlanDoc } from './types';
import {
  addDays,
  dayNumber,
  localParts,
  parseDay,
  weekday,
  zonedToUtc,
  type DayKey,
} from './zoned';
import './planner.css';

const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

interface Occ {
  day: DayKey;
  plan: PlanDoc;
  at: number;
}

/** The Planner page (design SPO-555): Week / Month, stepper, agenda of real plans, add / edit / delete. */
export function PlannerPage({ onClose }: { onClose: () => void }) {
  const { locale } = useT();
  const s = STRINGS[locale];
  const plans = usePlans();
  const ws = useWeekStartDay();
  const [form, setForm] = useState<{ draft: Draft; editing: boolean } | null>(null);
  const [asking, setAsking] = useState<PlanDoc | null>(null);
  const [view, setView] = useState<'week' | 'month'>('week');
  const [weekOff, setWeekOff] = useState(0);
  const [monthOff, setMonthOff] = useState(0);
  const [openedAt] = useState(() => Date.now());
  const tz = zone();
  const today = localParts(openedAt, tz).day;

  const weekStart = addDays(today, -((weekday(today) - (ws - 1) + 7) % 7) + weekOff * 7);
  const weekEnd = addDays(weekStart, 6);
  const mDay = parseDay(today);
  const monthFirst = dayKeyOf(mDay.y, mDay.m - 1 + monthOff, 1);
  const [selected, setSelected] = useState<number>(dayNumber(today));

  const between = (from: DayKey, to: DayKey): Occ[] => {
    const out: Occ[] = [];
    for (const plan of plans) {
      if (!plan.enabled) continue;
      for (const day of occurrencesBetween(plan.timing, from, to)) {
        out.push({ day, plan, at: zonedToUtc(day, plan.timing.time, plan.timing.tz) });
      }
    }
    return out.sort((a, b) => a.at - b.at);
  };
  const weekOcc = useMemo(() => between(weekStart, weekEnd), [plans, weekStart]); // eslint-disable-line react-hooks/exhaustive-deps
  const monthDays = useMemo(() => {
    const first = new Date(Date.UTC(1970, 0, 1) + monthFirst * 86_400_000);
    const from = addDays(
      `${first.getUTCFullYear()}-${String(first.getUTCMonth() + 1).padStart(2, '0')}-01`,
      -7,
    );
    return between(from, addDays(from, 7 * 7 + 7));
  }, [plans, monthFirst]); // eslint-disable-line react-hooks/exhaustive-deps

  const sub = (p: PlanDoc) =>
    `${p.mode === 'ring' ? s.ring : s.quiet} · ${leadText(s, p.timing.lead)}`;
  const open = (p: PlanDoc) => setForm({ draft: planToDraft(p), editing: true });
  const add = () =>
    setForm({
      draft: newDraft(
        uuid(),
        view === 'month' ? new Date(selected * 86_400_000).toISOString().slice(0, 10) : today,
      ),
      editing: false,
    });

  const save = async (d: Draft) => {
    const prev = plans.find((x) => x.id === d.id);
    await savePlan(draftToPlan(d, prev?.timing.tz ?? tz, prev));
    setForm(null);
  };

  if (form) {
    const p = plans.find((x) => x.id === form.draft.id);
    return (
      <>
        <PlanForm
          initial={form.draft}
          editing={form.editing}
          onSave={save}
          onDelete={p ? () => setAsking(p) : undefined}
          onClose={() => setForm(null)}
        />
        {asking && (
          <ConfirmDialog
            danger
            title={s.delTitle}
            body={s.delBody}
            confirmLabel={s.del}
            cancelLabel={s.cancel}
            onCancel={() => setAsking(null)}
            onConfirm={async () => {
              await deletePlan(asking.id);
              setAsking(null);
              setForm(null);
            }}
          />
        )}
      </>
    );
  }

  const row = (o: Occ, withEnd?: boolean) => (
    <ListRow
      key={`${o.plan.id}:${o.day}`}
      icon={<IconTile icon={o.plan.icon} tone={o.plan.color as never} size={withEnd ? 32 : 36} />}
      time={withEnd ? undefined : o.plan.timing.time}
      label={o.plan.title}
      sub={withEnd ? undefined : sub(o.plan)}
      chevron
      onClick={() => open(o.plan)}
    />
  );

  const monthGridDay = (d: number): MonthGridDay | undefined =>
    monthDays.some((o) => dayNumber(o.day) === d) ? { markers: ['planned'] } : undefined;
  const selKey = (() => {
    const x = new Date(selected * 86_400_000);
    return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, '0')}-${String(x.getUTCDate()).padStart(2, '0')}`;
  })();
  const selOcc = monthDays.filter((o) => o.day === selKey);

  return (
    <div className="screen pl-screen">
      <div className="pl-page">
        <header className="pl-page-h">
          <h1>{s.name}</h1>
          <Button icon="plus" size="sm" onClick={add}>
            {s.add}
          </Button>
        </header>
        <Segmented
          value={view}
          onChange={setView}
          label={s.view}
          fill
          options={[
            { value: 'week', label: s.week },
            { value: 'month', label: s.month },
          ]}
        />
        {plans.length === 0 ? (
          <EmptyState
            icon="calendar-plus"
            centered
            titleAs="h2"
            title={s.emptyTitle}
            body={s.emptyBody}
          >
            <Button icon="plus" onClick={add}>
              {s.addPlan}
            </Button>
          </EmptyState>
        ) : view === 'week' ? (
          <>
            <WeekStepper
              label={weekRange(locale, weekStart, weekEnd)}
              sub={weekOff === 0 ? s.thisWeek : undefined}
              onPrev={() => setWeekOff((x) => x - 1)}
              onNext={() => setWeekOff((x) => x + 1)}
              canPrev
              canNext
              prevLabel={s.prevWeek}
              nextLabel={s.nextWeek}
            />
            <div className="pl-ag">
              {Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((day) => {
                const es = weekOcc.filter((o) => o.day === day);
                return (
                  <div key={day} className={`pl-ag-d${day === today ? ' is-today' : ''}`}>
                    <div className="pl-ag-h">
                      <b>{dayLong(locale, day)}</b>
                      <span>
                        {dayMonth(locale, day)}
                        {day === today ? ` · ${s.today}` : ''}
                      </span>
                    </div>
                    {es.length ? (
                      <GroupedList>{es.map((o) => row(o))}</GroupedList>
                    ) : (
                      <p className="pl-ag-free ut-xs ut-faint">{s.freeDay}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <WeekStepper
              label={monthYear(
                locale,
                `${mDay.y}-${String(mDay.m).padStart(2, '0')}-01`.replace(
                  /^(\d+)-(\d+)/,
                  (_, y, m) => {
                    const t = new Date(Number(y), Number(m) - 1 + monthOff, 1);
                    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`;
                  },
                ),
              )}
              onPrev={() => setMonthOff((x) => x - 1)}
              onNext={() => setMonthOff((x) => x + 1)}
              canPrev
              canNext
              prevLabel={s.prevWeek}
              nextLabel={s.nextWeek}
            />
            <MonthGrid
              month={monthFirst}
              day={monthGridDay}
              selected={selected}
              onSelect={setSelected}
              size="sm"
              today={dayNumber(today)}
              weekStart={ws}
              label={s.month}
            />
            <GroupedList header={dayFull(locale, selKey)}>
              {selOcc.length ? (
                selOcc.map((o) => (
                  <ListRow
                    key={`${o.plan.id}:${o.day}`}
                    icon={<IconTile icon={o.plan.icon} tone={o.plan.color as never} size={32} />}
                    label={o.plan.title}
                    sub={`${o.plan.timing.time}–${clock(Number(o.plan.timing.time.slice(0, 2)) * 60 + Number(o.plan.timing.time.slice(3)) + (o.plan.durationMin ?? 60))} · ${fill(s.remindAt, { t: clock(Number(o.plan.timing.time.slice(0, 2)) * 60 + Number(o.plan.timing.time.slice(3)) - o.plan.timing.lead) })}`}
                    chevron
                    onClick={() => open(o.plan)}
                  />
                ))
              ) : (
                <ListRow label={s.freeDay} />
              )}
            </GroupedList>
          </>
        )}
        <span hidden onClick={onClose} />
      </div>
    </div>
  );
}
