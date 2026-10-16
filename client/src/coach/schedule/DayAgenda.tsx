import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import './Schedule.css';
import { GroupedList, ListRow } from '../../components/ui/GroupedList';
import { NowDivider } from '../../components/ui/NowLine';
import { Tag } from '../../components/ui/Tag';
import { WeekdayToggle } from '../../components/ui/WeekdayToggle';
import type { LocaleId } from '../../i18n';
import type { ScheduleStrings } from '../../i18n/coachSchedule';
import { ClientAvatar } from '../ClientAvatar';
import { coachClock } from '../format';
import { slotClock, slotTitle, statusWord } from './blockText';
import { dayNumber, longDate, shortWeekday } from './labels';
import { endOf, onDay, peopleOf } from './model';
import { cardStateOf, minutesLeft, nowDividerIndex } from './status';
import type { People } from './people';
import { gymName, type ScheduleSlot } from './types';

export interface DayAgendaProps {
  /** the seven day keys of the week */
  days: readonly number[];
  day: number;
  onDay: (d: number) => void;
  slots: readonly ScheduleSlot[];
  conflicts: ReadonlySet<string>;
  selected: string | null;
  onSelect: (id: string) => void;
  people: People;
  t: ScheduleStrings;
  locale: LocaleId;
  today: number;
  /** The app clock: with it, today's agenda gets a "Now" divider between past and upcoming sessions. */
  now?: number;
  /** "Add a session on this day": opens the create flow for the day shown. */
  onCreate?: (day: number) => void;
}

/** Phone: a seven-day strip and the day's sessions as rows (the grid does not fit 390 px). */
export function DayAgenda(p: DayAgendaProps) {
  const { t, locale } = p;
  const list = onDay(p.slots, p.day).sort((a, b) => a.start - b.start || endOf(a) - endOf(b));
  const live = p.now !== undefined && p.day === p.today && list.length > 0;
  const isPast = (s: ScheduleSlot) => p.now !== undefined && endOf(s) <= p.now;
  /* the divider sits before the first session that has not started (by start time): a running session is above it */
  const nowAt = live ? nowDividerIndex(list, p.now as number) : -1;
  const divider = live ? (
    <NowDivider key="now" label={t.scNow} time={coachClock(p.now as number)} />
  ) : null;
  const add = p.onCreate ? (
    <Button
      variant="secondary"
      size="sm"
      icon="plus"
      onClick={() => p.onCreate?.(p.day)}
      className="sc-agenda-add"
    >
      {t.qcAddOn(longDate(p.day, locale))}
    </Button>
  ) : null;
  return (
    <div className="sc-agenda">
      <WeekdayToggle
        label={t.scDayStripLabel}
        days={p.days.map((d) => ({
          id: String(d),
          label: shortWeekday(d, locale),
          sub: String(dayNumber(d)),
          on: d === p.day,
          ariaLabel: `${longDate(d, locale)}, ${t.scSessionsDay(onDay(p.slots, d).length)}`,
        }))}
        onToggle={(id) => p.onDay(Number(id))}
      />
      {list.length === 0 ? (
        <EmptyState
          titleAs="h2"
          icon="calendar-blank"
          title={t.scNoSessions}
          body={longDate(p.day, locale)}
        >
          {add}
        </EmptyState>
      ) : (
        <GroupedList header={longDate(p.day, locale)} aria-label={t.scAgendaLabel}>
          {list.flatMap((s, i) => {
            const ids = peopleOf(s);
            const clash = p.conflicts.has(s.id);
            const state = cardStateOf(s, p.now ?? 0);
            const running = p.now !== undefined && state === 'inprogress';
            const row = (
              <ListRow
                key={s.id}
                dim={isPast(s) && !running && p.selected !== s.id}
                time={slotClock(s).split('–')[0]}
                icon={
                  <ClientAvatar
                    id={ids[0]}
                    name={p.people.name(ids[0] ?? '')}
                    size={32}
                    hasPhoto={p.people.byId.get(ids[0] ?? '')?.hasPhoto}
                  />
                }
                label={slotTitle(s, p.people, t)}
                sub={`${slotClock(s)} · ${gymName(s.gymId)}${running ? ` · ${p.t.scLeftMin(minutesLeft(s, p.now as number))}` : ''}`}
                trailing={
                  <Tag
                    tone={
                      clash
                        ? 'danger'
                        : s.status === 'done'
                          ? 'ok'
                          : s.status === 'missed'
                            ? 'danger'
                            : 'accent'
                    }
                  >
                    {clash ? t.scOverlapTag : statusWord(s, t, p.now)}
                  </Tag>
                }
                chevron
                selected={p.selected === s.id}
                onClick={() => p.onSelect(s.id)}
              />
            );
            return divider && i === nowAt ? [divider, row] : [row];
          })}
          {divider && nowAt >= list.length ? divider : null}
        </GroupedList>
      )}
      {list.length > 0 && add}
    </div>
  );
}
