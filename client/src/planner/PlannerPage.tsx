import { useMemo, useState } from 'react';
import { Button, IconButton } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { GroupedList, ListRow } from '../components/ui/GroupedList';
import { IconTile } from '../components/ui/IconTile';
import { PageHead } from '../components/ui/PageHead';
import { ConfirmDialog } from '../components/ui/Overlays';
import type { Tone } from '../components/ui/tones';
import { useT } from '../i18n';
import { uuid } from '../store';
import { PlanForm } from './PlanForm';
import { draftToPlan, newDraft, planToDraft, type Draft } from './draft';
import { occurrencesBetween } from './recurrence';
import { deletePlan, savePlan, usePlans } from './sync';
import { STRINGS } from './strings';
import type { PlanDoc } from './types';
import { addDays, dayNumber, localParts, zonedToUtc, type DayKey } from './zoned';
import './planner.css';

const HORIZON = 14;
const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

interface Row {
  day: DayKey;
  plan: PlanDoc;
  at: number;
}

/** The Planner screen: the next 14 days from real plans, add / edit / delete. */
export function PlannerPage({ onClose }: { onClose: () => void }) {
  const { t, locale } = useT();
  const s = STRINGS[locale];
  const plans = usePlans();
  const [form, setForm] = useState<{ draft: Draft; editing: boolean } | null>(null);
  const [asking, setAsking] = useState<PlanDoc | null>(null);
  const tz = zone();
  const [openedAt] = useState(() => Date.now());
  const today = localParts(openedAt, tz).day;

  const rows = useMemo(() => {
    const to = addDays(today, HORIZON - 1);
    const out: Row[] = [];
    for (const plan of plans) {
      if (!plan.enabled) continue;
      for (const day of occurrencesBetween(plan.timing, today, to)) {
        out.push({ day, plan, at: zonedToUtc(day, plan.timing.time, plan.timing.tz) });
      }
    }
    return out.sort((a, b) => a.at - b.at);
  }, [plans, today]);

  const byDay = useMemo(() => {
    const m = new Map<DayKey, Row[]>();
    for (const r of rows) m.set(r.day, [...(m.get(r.day) ?? []), r]);
    return [...m.entries()];
  }, [rows]);

  const dayLabel = (day: DayKey) => {
    const n = dayNumber(day) - dayNumber(today);
    if (n === 0) return s.today;
    if (n === 1) return s.tomorrow;
    const [y, m, d] = day.split('-').map(Number);
    return new Date(y!, m! - 1, d!).toLocaleDateString(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
    });
  };

  const save = async (d: Draft) => {
    const prev = plans.find((x) => x.id === d.id);
    await savePlan(draftToPlan(d, prev?.timing.tz ?? tz, prev, Date.now()));
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

  const add = () => setForm({ draft: newDraft(uuid(), today), editing: false });
  return (
    <div className="screen">
      <PageHead
        back={{ label: t.backAction, onClick: onClose }}
        title={s.name}
        actions={<IconButton label={s.add} icon="plus" onClick={add} />}
      />
      {plans.length === 0 ? (
        <EmptyState
          icon="calendar-plus"
          centered
          titleAs="h2"
          title={s.emptyTitle}
          body={s.emptyBody}
        >
          <Button onClick={add}>{s.add}</Button>
        </EmptyState>
      ) : byDay.length === 0 ? (
        <EmptyState icon="calendar-dots" centered titleAs="h2" title={s.nothingSoon} />
      ) : (
        byDay.map(([day, list]) => (
          <GroupedList key={day} header={dayLabel(day)}>
            {list.map((r) => (
              <ListRow
                key={`${r.plan.id}:${day}`}
                icon={<IconTile icon={r.plan.icon} tone={r.plan.color as Tone} size={36} />}
                time={r.plan.timing.time}
                label={r.plan.title}
                chevron
                onClick={() => setForm({ draft: planToDraft(r.plan), editing: true })}
              />
            ))}
          </GroupedList>
        ))
      )}
    </div>
  );
}
