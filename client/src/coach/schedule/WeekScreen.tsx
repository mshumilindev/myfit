import { useMemo } from 'react';
import { Button, IconButton } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { GroupedList, ListRow } from '../../components/ui/GroupedList';
import { NowDivider } from '../../components/ui/NowLine';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { Skeleton } from '../../components/ui/Skeleton';
import { Tag } from '../../components/ui/Tag';
import { useScheduleT } from '../../i18n/coachSchedule';
import { ClientAvatar } from '../ClientAvatar';
import { coachClock } from '../format';
import type { CoachWorldPort } from '../data/port';
import { useCoachWorld } from '../data/useCoachWorld';
import { DOWS } from '../domain/types';
import { Header, Page, Split } from '../layout/Layout';
import type { CoachRoute } from '../routes';
import { slotClock, slotTitle, statusWord } from './blockText';
import { longDate, rangeLabel, shortWeekday } from './labels';
import { endOf, onDay, peopleOf, statusAt } from './model';
import { cardStateOf, minutesLeft, nowDividerIndex } from './status';
import { usePeople } from './people';
import type { SchedulePort } from './port';
import { ScheduleRequestCard } from './ScheduleRequestCard';
import { dayOfTs, weekStartDay } from './time';
import { useSchedule } from './useSchedule';
import { WeekDigestStrip } from './digest/WeekDigestStrip';
import { scheduleHref, useScheduleParams } from './useScheduleParams';
import './Schedule.css';
import { CoachProblemState } from '../BackendNotice';
import { offlineOrUnknown } from '../data/problem';

export interface WeekScreenProps {
  onNavigate: (r: CoachRoute) => void;
  port?: SchedulePort;
  worldPort?: CoachWorldPort;
}

const MAX_REQUESTS = 4;

/**
 * Week (`#/c/week`, S-14): the week at a glance. The counts come from the same world as Today and Roster (so they are
 * equal); sessions per day and the day list come from the schedule. Open reschedule requests are answerable here.
 */
export function WeekScreen(p: WeekScreenProps) {
  const { s: t, locale } = useScheduleT();
  const sch = useSchedule(p.port);
  const world = useCoachWorld(p.worldPort);
  const people = usePeople(p.worldPort);
  const prm = useScheduleParams();
  const today = dayOfTs(sch.now);
  const day = prm.d ?? today;
  const monday = weekStartDay(day);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => monday + i), [monday]);
  const week = sch.slots.filter((s) => s.status !== 'moved' && days.includes(dayOfTs(s.start)));
  const isThis = monday === weekStartDay(today);
  const counts = world.world?.counts;
  const total = isThis && counts ? counts.weekPlanned : week.length;
  const done = isThis && counts ? counts.weekDone : week.filter((s) => s.status === 'done').length;
  const clientsN = counts?.clients ?? people.list.length;
  const per = days.map((d) => onDay(sch.slots, d).length);
  const max = Math.max(1, ...per);
  const selected = days.includes(day) ? day : monday;
  const open = sch.requests.filter((r) => statusAt(r, sch.now) === 'pending');
  const go = (d: number) => prm.set({ d });
  const loading = (sch.loading && sch.state.docs.length === 0) || world.loading;

  if (sch.state.status === 'error' && sch.state.docs.length === 0)
    return (
      <Page>
        <Header title={t.wkTitle} />
        <CoachProblemState inline problem={offlineOrUnknown()} onRetry={sch.store.retry} />
      </Page>
    );

  return (
    <Page>
      <Header
        eyebrow={t.scEyebrow}
        title={t.wkTitle}
        subtitle={rangeLabel(days[0], days[6], locale)}
        actions={
          <>
            <IconButton
              icon="caret-left"
              variant="secondary"
              label={t.wkPrevLabel}
              onClick={() => go(monday - 7)}
            />
            <Button variant="secondary" disabled={isThis} onClick={() => prm.set({ d: null })}>
              {t.wkThisWeek}
            </Button>
            <IconButton
              icon="caret-right"
              variant="secondary"
              label={t.wkNextLabel}
              onClick={() => go(monday + 7)}
            />
          </>
        }
      />
      {loading ? (
        <div className="sc-loading" role="status" aria-label={t.wkLoad}>
          <Skeleton height={64} />
          <Skeleton height={240} />
        </div>
      ) : (
        <Split ratio="8-4">
          <div className="sc-stack">
            <WeekDigestStrip
              days={days}
              isThisWeek={isThis}
              port={p.port}
              worldPort={p.worldPort}
            />
            <Card pad="md" className="sc-weeksummary">
              <p className="sc-weeksummary-text" role="status">
                {counts && isThis && counts.needDecision > 0
                  ? `${t.wkDecisions(counts.needDecision)} `
                  : ''}
                {t.wkSummary(done, total, clientsN)}
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => p.onNavigate({ screen: 'agenda' })}
              >
                {t.wkOpenAgenda}
              </Button>
            </Card>

            <section aria-label={t.wkRequests} className="sc-stack">
              <SectionLabel>{t.wkRequests}</SectionLabel>
              {open.length === 0 ? (
                <p className="sc-form-hint">{t.wkNoRequests}</p>
              ) : (
                open
                  .slice(0, MAX_REQUESTS)
                  .map((r) => (
                    <ScheduleRequestCard
                      key={r.id}
                      reqId={r.id}
                      people={people}
                      port={p.port}
                      side="trainer"
                    />
                  ))
              )}
            </section>

            <section aria-label={t.wkPerDay} className="sc-stack">
              <SectionLabel>{t.wkPerDay}</SectionLabel>
              <GroupedList>
                {days.map((d, i) => (
                  <ListRow
                    key={d}
                    dense
                    label={`${shortWeekday(d, locale)}${d === today ? ` · ${t.scToday}` : ''}`}
                    sub={
                      <ProgressBar
                        value={(per[i] / max) * 100}
                        tone="accent"
                        label={t.scSessionsDay(per[i])}
                      />
                    }
                    value={String(per[i])}
                    selected={d === selected}
                    onClick={() => go(d)}
                  />
                ))}
              </GroupedList>
            </section>

            <section aria-label={t.wkDay} className="sc-stack">
              <SectionLabel>{longDate(selected, locale)}</SectionLabel>
              {onDay(sch.slots, selected).length === 0 ? (
                <EmptyState titleAs="h2" icon="calendar-blank" title={t.wkNoDay} />
              ) : (
                <GroupedList>
                  {onDay(sch.slots, selected)
                    .sort((a, b) => a.start - b.start || endOf(a) - endOf(b))
                    .flatMap((s, i, list) => {
                      const ids = peopleOf(s);
                      /* the Now divider sits before the first session that has not started; a running one is above it */
                      const at = nowDividerIndex(list, sch.now);
                      const showNow =
                        selected === today &&
                        (i === at || (at >= list.length && i === list.length - 1));
                      const running = cardStateOf(s, sch.now) === 'inprogress';
                      const row = (
                        <ListRow
                          key={s.id}
                          dense
                          dim={selected === today && endOf(s) <= sch.now && !running}
                          time={slotClock(s).split('–')[0]}
                          icon={
                            <ClientAvatar id={ids[0]} name={people.name(ids[0] ?? '')} size={32} />
                          }
                          label={slotTitle(s, people, t)}
                          sub={
                            running
                              ? `${slotClock(s)} · ${t.scLeftMin(minutesLeft(s, sch.now))}`
                              : slotClock(s)
                          }
                          trailing={
                            <>
                              <Tag
                                tone={
                                  s.status === 'done'
                                    ? 'ok'
                                    : s.status === 'missed'
                                      ? 'danger'
                                      : 'accent'
                                }
                              >
                                {statusWord(s, t, sch.now)}
                              </Tag>
                              {s.status === 'planned' && s.start > sch.now && (
                                <Button
                                  variant="link"
                                  size="sm"
                                  onClick={() => {
                                    window.location.assign(
                                      scheduleHref({ form: 'move', slot: s.id }),
                                    );
                                  }}
                                >
                                  {t.wkReschedule}
                                </Button>
                              )}
                            </>
                          }
                        />
                      );
                      if (!showNow) return [row];
                      const mark = (
                        <NowDivider key="now" label={t.scNow} time={coachClock(sch.now)} />
                      );
                      return at >= list.length ? [row, mark] : [mark, row];
                    })}
                </GroupedList>
              )}
            </section>

            <section className="sc-stack">
              <SectionLabel>{t.wkAll}</SectionLabel>
              <DataTable
                label={t.wkAll}
                rowKey={(c) => c.id}
                rows={people.list}
                columns={[
                  { id: 'c', header: t.wkClient, strong: true, cell: (c) => c.name },
                  { id: 'p', header: t.wkProgram, muted: true, cell: (c) => c.program },
                  {
                    id: 's',
                    header: t.wkSessions,
                    align: 'end',
                    cell: (c) => t.wkOf(c.done, c.planned),
                  },
                  {
                    id: 'd',
                    header: t.wkTrainerDays,
                    muted: true,
                    cell: (c) =>
                      c.trainerDays.length
                        ? c.trainerDays
                            .map((x) => shortWeekday(monday + DOWS.indexOf(x), locale))
                            .join(', ')
                        : t.wkNoTrainerDays,
                  },
                ]}
              />
            </section>
          </div>
          <aside className="sc-stack" aria-label={t.wkWithToday}>
            <Card pad="md">
              <SectionLabel>{t.wkWithToday}</SectionLabel>
              {onDay(sch.slots, today).length === 0 ? (
                <p className="sc-form-hint">{t.wkNobodyToday}</p>
              ) : (
                <ul className="sc-today-list">
                  {[...new Set(onDay(sch.slots, today).flatMap(peopleOf))].map((id) => (
                    <li key={id}>
                      <Button
                        variant="link"
                        onClick={() => p.onNavigate({ screen: 'client', cid: id })}
                      >
                        {people.name(id)}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </aside>
        </Split>
      )}
    </Page>
  );
}
