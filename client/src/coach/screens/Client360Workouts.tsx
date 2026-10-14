import { useMemo, useState } from 'react';
import { COACH_BREAKPOINT, useMinWidth } from '../../components/ui/breakpoints';
import { Button, IconButton } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ExportMenu, type ExportMenuStrings } from '../../components/ui/ExportMenu';
import { GroupedList, ListRow } from '../../components/ui/GroupedList';
import { Switch } from '../../components/ui/Switch';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { Tag } from '../../components/ui/Tag';
import { Icon } from '../../ui';
import type { C360Strings } from '../../i18n/coachClient360';
import type { RosterStrings } from '../../i18n/coachRoster';
import type { LocaleId } from '../../i18n';
import { useReadLog, localReadLog, type ReadLogPort } from '../data/readLog';
import type { DerivedWorld } from '../data/deriveWorld';
import { askable } from '../domain/consent';
import { setsCsv, workoutsCsv } from '../domain/csv';
import { hasClient } from '../domain/slots';
import { DAY, weekStartOf } from '../domain/time';
import type { CoachClient, Dow, Slot } from '../domain/types';
import { gateWorkouts, groupByWeek, SESSIONS_PAGE, type WorkoutEntry } from '../domain/workouts';
import { coachClock, coachDayMonth, coachWeekday } from '../format';
import { chatRoute, type CoachRoute } from '../routes';
import { requestsOf } from '../today/model';
import { useScheduleRequestPort } from '../schedule/requestPort';
import { scheduleHref } from '../schedule/useScheduleParams';
import { type RescheduleRequestPort } from '../today/requestPort';
import { ClientRequests } from './Client360Overview';
import { useReauthGuard } from '../security/useReauthGuard';
import { downloadCsv, fileSlug } from './csvDownload';
import { exportStrings } from './exportStrings';
import { firstName } from './format';
import { WorkoutsHistory } from './workouts/WorkoutsHistory';

export interface WorkoutsTabProps {
  client: CoachClient;
  world: DerivedWorld;
  r: RosterStrings;
  c: C360Strings;
  locale: LocaleId;
  now: number;
  onNavigate: (r: CoachRoute) => void;
  requestPort?: RescheduleRequestPort;
  readLog?: ReadLogPort;
}

const NEXT_COUNT = 3;

interface Next {
  key: string;
  start: number;
  title: string;
  /** Present for trainer sessions: carries the pending-move status. */
  slot?: Slot;
}

/** Title of an upcoming slot: the session this weekday had last time (a slot itself carries none). */
function slotTitle(s: Slot, entries: readonly WorkoutEntry[], fallback: string): string {
  if (s.title) return s.title;
  const dow = coachWeekday(s.start, 'en');
  return entries.find((e) => coachWeekday(e.at, 'en') === dow)?.title ?? fallback;
}

/** Client 360, Workouts tab (S-04): today, next sessions, reschedule requests, history by week + CSV. */
export function WorkoutsTab({
  client,
  world,
  r,
  c,
  locale,
  now,
  onNavigate,
  requestPort,
  readLog,
}: WorkoutsTabProps) {
  const first = firstName(client.name);
  const data = world.history[client.id]?.workouts;
  const gated = useMemo(
    () => gateWorkouts(data, client.mode, client.consent),
    [data, client.mode, client.consent],
  );
  const log = readLog ?? localReadLog;
  useReadLog(
    log,
    client.id,
    'workouts',
    gated.state === 'full' ? ['totals', 'sets'] : gated.state === 'totals' ? ['totals'] : [],
    gated.state === 'locked' || gated.state === 'program',
  );
  const [shown, setShown] = useState(SESSIONS_PAGE);
  const [open, setOpen] = useState<string>('');
  const askN = askable(client.mode, client.consent).length;
  const ask = () => onNavigate(chatRoute(client.id));

  const today = Math.floor(now / DAY);
  const mine = world.slots.filter((s) => hasClient(s, client.id));
  const todaySlot = mine.find((s) => Math.floor(s.start / DAY) === today);
  const entries = data?.entries ?? [];
  /* One list: trainer sessions are slots (with their reschedule status); the client's own program days come from
     the plan. A day that has a slot is the slot. */
  const slotsUp = mine.filter(
    (s) => s.start > now && (s.status === 'planned' || s.status === 'pending-move'),
  );
  const upcoming: Next[] = [
    ...slotsUp.map((s) => ({
      key: s.id,
      start: s.start,
      title: slotTitle(s, entries, client.program),
      slot: s,
    })),
    ...(data?.planned ?? [])
      .filter(
        (p) =>
          p.at > now && !slotsUp.some((s) => Math.floor(s.start / DAY) === Math.floor(p.at / DAY)),
      )
      .map((p) => ({ key: `p${p.at}`, start: p.at, title: p.title })),
  ]
    .sort((a, b) => a.start - b.start)
    .slice(0, NEXT_COUNT);
  const reqs = requestsOf(world).filter((q) => q.client.id === client.id);
  const schedulePort = useScheduleRequestPort();
  const toSchedule = () =>
    window.location.assign(scheduleHref({ form: 'pick', client: client.id }));
  const port = requestPort ?? schedulePort;

  const visible = gated.entries.slice(0, shown);
  const groups = groupByWeek(visible);
  const thisWeek = weekStartOf(now);
  const wkTitle = (start: number): string => {
    const range = `${coachDayMonth(start, locale)} – ${coachDayMonth(start + 6 * DAY, locale)}`;
    return start === thisWeek
      ? c.wkThisWeek(range)
      : start === thisWeek - 7 * DAY
        ? c.wkLastWeek(range)
        : range;
  };
  const tonnes = (kg: number) =>
    r.c3Tonnes(
      new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(
        kg / 1000,
      ),
    );

  // "One row per set" is offered only where the client shares sets and the record carries them.
  const hasSets = gated.detail && gated.entries.some((e) => (e.exercises?.length ?? 0) > 0);
  const [perSet, setPerSet] = useState(false);
  const bySet = hasSets && perSet;
  const sessionsCsv = workoutsCsv(gated.entries, gated.detail);
  const setRows = setsCsv(gated.entries);
  const csv = bySet ? setRows : sessionsCsv;
  const labels = bySet ? c.exColSets : c.exColWorkouts;
  const { ask: askReauth, dialog: reauthDialog } = useReauthGuard();
  const doExport = async (): Promise<string | undefined> => {
    if (!(await askReauth('export'))) return undefined;
    const file = bySet ? c.exFileSets(fileSlug(first)) : c.exFileWorkouts(fileSlug(first));
    downloadCsv(
      file,
      csv.columns.map((k) => (labels as Record<string, string>)[k]),
      csv.rows,
    );
    try {
      for (const cat of gated.detail ? (['totals', 'sets'] as const) : (['totals'] as const)) {
        log.logRead({ clientId: client.id, category: cat, via: 'export' });
      }
    } catch {
      /* the log never breaks the export */
    }
    return c.exDone(file, csv.rows.length);
  };
  const strings: ExportMenuStrings = exportStrings(c, c.exScopeWorkouts);

  const wide = useMinWidth(COACH_BREAKPOINT);
  const requestBtn = (n: Next) =>
    n.slot?.status === 'pending-move' ? (
      <span className="c3t-pend">
        <Icon name="hourglass" />
        {n.slot.move?.from === 'client' ? c.wkMoveRequested : c.wkWaitingFor(first)}
      </span>
    ) : wide ? (
      <Button
        variant="secondary"
        size="sm"
        icon="calendar-blank"
        aria-label={c.wkRequestFor(n.title, coachDayMonth(n.start, locale))}
        onClick={toSchedule}
      >
        {c.wkRequestResched}
      </Button>
    ) : (
      // Phone: icon only, so the session title keeps its line (long uk/pl labels squeezed it to two lines).
      <IconButton
        variant="secondary"
        icon="calendar-blank"
        label={c.wkRequestFor(n.title, coachDayMonth(n.start, locale))}
        onClick={toSchedule}
      />
    );

  const withTrainer = (start: number) =>
    client.trainerDays.includes(coachWeekday(start, 'en') as Dow);

  const history = (
    <WorkoutsHistory
      gated={gated}
      c={c}
      client={client}
      first={first}
      locale={locale}
      askN={askN}
      ask={ask}
      groups={groups}
      wkTitle={wkTitle}
      tonnes={tonnes}
      open={open}
      setOpen={setOpen}
      shown={shown}
      setShown={setShown}
      sessionsCsv={sessionsCsv}
    />
  );

  const nextUp = upcoming[0];

  return (
    <div className="c3-main c3t">
      {reauthDialog}
      <section aria-labelledby="c3t-today">
        <SectionLabel
          id="c3t-today"
          action={<span className="c3-meta">{coachDayMonth(now, locale)}</span>}
        >
          {c.wkToday}
        </SectionLabel>
        <GroupedList>
          <ListRow
            strong
            label={todaySlot ? c.wkSessionToday(coachClock(todaySlot.start)) : c.wkRest}
            sub={
              todaySlot
                ? undefined
                : nextUp
                  ? `${c.wkNoSession}. ${c.wkTrainsAgain(first, `${coachWeekday(nextUp.start, locale)} ${coachDayMonth(nextUp.start, locale)}`)}`
                  : `${c.wkNoSession}. ${c.wkNoMoreSessions(first)}`
            }
          />
        </GroupedList>
      </section>

      {reqs.length > 0 && (
        <section aria-labelledby="c3t-reqs">
          <SectionLabel
            id="c3t-reqs"
            action={<span className="c3-meta">{c.wkPending(reqs.length)}</span>}
          >
            {c.wkReqs}
          </SectionLabel>
          <Card pad="lg">
            <ClientRequests reqs={reqs} port={port} locale={locale} />
          </Card>
        </section>
      )}

      {upcoming.length > 0 && (
        <section aria-labelledby="c3t-next">
          <SectionLabel id="c3t-next" action={<span className="c3-meta">{c.wkPlanned}</span>}>
            {c.wkNext}
          </SectionLabel>
          <GroupedList list label={c.wkNext}>
            {upcoming.map((n) => (
              <li key={n.key}>
                <ListRow
                  strong
                  time={
                    <span className="c3t-dt">
                      <b>{coachWeekday(n.start, locale)}</b>
                      <small>{coachDayMonth(n.start, locale)}</small>
                    </span>
                  }
                  label={n.title}
                  sub={
                    <span className="c3t-sub">
                      {coachClock(n.start)}
                      {withTrainer(n.start) && (
                        <Tag tone="coach" icon={<Icon name="user-focus" />}>
                          {c.wkWithTrainer}
                        </Tag>
                      )}
                    </span>
                  }
                  trailing={requestBtn(n)}
                />
              </li>
            ))}
          </GroupedList>
        </section>
      )}

      <section aria-labelledby="c3t-hist">
        <SectionLabel
          id="c3t-hist"
          action={
            gated.state === 'totals' || gated.state === 'full' ? (
              <span className="c3t-hist-a">
                <span className="c3-meta">{c.wkSessionsIn(gated.entries.length, 12)}</span>
                <ExportMenu
                  strings={strings}
                  size="sm"
                  rows={csv.rows.length}
                  columns={csv.columns.map((k) => (labels as Record<string, string>)[k])}
                  omitted={csv.omitted.map((k) => (labels as Record<string, string>)[k])}
                  onExport={doExport}
                  extra={
                    hasSets ? (
                      <GroupedList surface="raised">
                        <ListRow
                          as="label"
                          label={c.exPerSet}
                          sub={c.exPerSetHint}
                          trailing={<Switch checked={perSet} onChange={setPerSet} />}
                        />
                      </GroupedList>
                    ) : undefined
                  }
                />
              </span>
            ) : undefined
          }
        >
          {c.wkHistory}
        </SectionLabel>
        {history}
      </section>
    </div>
  );
}
