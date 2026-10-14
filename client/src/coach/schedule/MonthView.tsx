import { MonthGrid, type MonthGridDay } from '../../components/ui/MonthGrid';
import './Schedule.css';
import type { ScheduleStrings } from '../../i18n/coachSchedule';
import { slotTitle } from './blockText';
import { onDay } from './model';
import type { People } from './people';
import type { ScheduleSlot } from './types';

export interface MonthViewProps {
  month: number;
  slots: readonly ScheduleSlot[];
  conflicts: ReadonlySet<string>;
  selected: number | null;
  onSelect: (day: number) => void;
  today: number;
  people: People;
  t: ScheduleStrings;
  size: 'sm' | 'lg';
}

const MAX_CHIPS = 2;

/** The kit month grid with the day's sessions as chips (desktop) or markers (phone). A tap opens that day. */
export function MonthView(p: MonthViewProps) {
  const { t } = p;
  const day = (d: number): MonthGridDay | undefined => {
    const list = onDay(p.slots, d);
    if (!list.length) return undefined;
    const clash = list.some((s) => p.conflicts.has(s.id));
    return {
      markers: ['workout'],
      chips: list.slice(0, MAX_CHIPS).map((s) => ({
        label: slotTitle(s, p.people, t),
        tone: p.conflicts.has(s.id) ? 'danger' : s.status === 'done' ? 'ok' : 'accent',
        planned: s.status === 'planned',
      })),
      notes: list.length > MAX_CHIPS ? [{ label: t.scMore(list.length - MAX_CHIPS) }] : undefined,
      label: `${t.scSessionsDay(list.length)}${clash ? `, ${t.scOverlapTag}` : ''}`,
    };
  };
  return (
    <MonthGrid
      month={p.month}
      day={day}
      selected={p.selected}
      onSelect={p.onSelect}
      size={p.size}
      today={p.today}
      weekStart={1}
      todayLabel={t.scToday}
      label={t.scMonthLabel}
    />
  );
}
