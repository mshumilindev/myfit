import { useMemo, useState } from 'react';
import { COACH_BREAKPOINT, useMinWidth } from '../../components/ui/breakpoints';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { GroupedList, ListRow } from '../../components/ui/GroupedList';
import { Notice } from '../../components/ui/Notice';
import { SearchField } from '../../components/ui/SearchField';
import { Segmented } from '../../components/ui/Segmented';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { Tag } from '../../components/ui/Tag';
import { useTeamT } from '../../i18n/coachTeam';
import { ClientAvatar } from '../ClientAvatar';
import { coachClock, coachDayMonth, coachWeekday } from '../format';
import { Header, Inspector, Page, Split } from '../layout/Layout';
import { type CoachRoute } from '../routes';
import { hasClient } from '../schedule/model';
import { useSchedule } from '../schedule/useSchedule';
import {
  useManagerClients,
  type ManagerClientRow,
  type ManagerClientsPort,
} from './managerClients';
import './ManagerClients.css';

const ALL = 'all';

/** "Olena K." for the trainer chip and the row sub-line. */
const shortName = (full: string): string => {
  const parts = full.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[1]![0]}.` : full;
};

/**
 * Clients of the team for a MANAGER (SPO-202, boards D29 / P15): who the team's trainers have, whose schedule the manager can
 * already read (the client's device delegated the keys) and the next session. No client content is shown here: a manager
 * opens the schedule, not the client's record.
 */
export function ManagerClientsScreen({
  onNavigate,
  port,
}: {
  onNavigate: (r: CoachRoute) => void;
  port?: ManagerClientsPort;
}) {
  const { tm, locale } = useTeamT();
  const rows = useManagerClients(port);
  const { slots, now } = useSchedule();
  const desktop = useMinWidth(COACH_BREAKPOINT);
  const [trainer, setTrainer] = useState<string>(ALL);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string | null>(null);

  const nextOf = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of [...slots].sort((a, b) => a.start - b.start)) {
      if (s.start < now || s.status !== 'planned') continue;
      for (const r of rows ?? [])
        if (!m.has(r.clientId) && hasClient(s, r.clientId)) m.set(r.clientId, s.start);
    }
    return m;
  }, [slots, rows, now]);

  if (!rows) {
    return (
      <Page>
        <Header title={tm.mcTitle} slots={false} />
        <SkeletonRows rows={6} />
      </Page>
    );
  }

  const trainers = [...new Map(rows.map((r) => [r.trainerId, r.trainerName])).entries()];
  const ready = rows.filter((r) => r.ready).length;
  const waiting = rows.length - ready;
  const q = query.trim().toLowerCase();
  const list = rows
    .filter((r) => trainer === ALL || r.trainerId === trainer)
    .filter((r) => !q || `${r.name} ${r.trainerName}`.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
  const selected = list.find((r) => r.clientId === picked) ?? (desktop ? list[0] : undefined);

  const when = (ts: number) =>
    desktop
      ? `${coachWeekday(ts, locale)} ${coachDayMonth(ts, locale)} · ${coachClock(ts)}`
      : `${coachWeekday(ts, locale)} ${coachDayMonth(ts, locale).split(' ')[0]} · ${coachClock(ts)}`;
  const trailing = (r: ManagerClientRow) => {
    const next = nextOf.get(r.clientId);
    if (!r.ready) return <Tag tone="neutral">{tm.mcWaiting}</Tag>;
    return (
      <span className="mc-next">
        <span className="mc-next-k">{desktop ? tm.mcNext : tm.mcNextShort}</span>
        <Tag tone="neutral">{next != null ? when(next) : tm.mcNoSession}</Tag>
      </span>
    );
  };

  return (
    <Page>
      <Header title={tm.mcTitle} slots={false} subtitle={tm.mcSub(rows.length, ready)} />
      {rows.length === 0 ? (
        <EmptyState icon="users" title={tm.mcEmptyTitle} body={tm.mcEmptyBody} />
      ) : (
        <>
          <Segmented
            label={tm.mcFilterLabel}
            variant="track"
            hug
            scroll
            options={[
              { value: ALL, label: tm.mcAll(rows.length) },
              ...trainers.map(([id, name]) => ({
                value: id,
                label: tm.mcTrainerChip(
                  shortName(name),
                  rows.filter((r) => r.trainerId === id).length,
                ),
              })),
            ]}
            value={trainer}
            onChange={setTrainer}
          />
          {waiting > 0 && <Notice icon="hourglass">{tm.mcPending(waiting)}</Notice>}
          <Split ratio="5-7">
            <div className="mc-main">
              <SearchField
                value={query}
                onChange={setQuery}
                placeholder={tm.mcSearch}
                clearLabel={tm.mcSearchClear}
              />
              {list.length === 0 ? (
                <EmptyState icon="magnifying-glass" title={tm.mcNoMatch} />
              ) : (
                <GroupedList list label={tm.mcListLabel}>
                  {list.map((r) => (
                    <li key={r.clientId}>
                      <ListRow
                        strong
                        selected={desktop && selected?.clientId === r.clientId}
                        icon={<ClientAvatar id={r.clientId} name={r.name} size={40} />}
                        label={r.name}
                        sub={shortName(r.trainerName)}
                        trailing={trailing(r)}
                        onClick={() => setPicked(r.clientId)}
                      />
                    </li>
                  ))}
                </GroupedList>
              )}
            </div>
            {desktop && selected && (
              <Inspector bare label={selected.name}>
                <div className="mc-detail">
                  <div className="mc-detail-head">
                    <ClientAvatar id={selected.clientId} name={selected.name} size={56} />
                    <div>
                      <h2 className="mc-detail-name">{selected.name}</h2>
                      <p className="mc-detail-sub">{shortName(selected.trainerName)}</p>
                    </div>
                  </div>
                  <GroupedList>
                    <ListRow label={tm.mcDetailTrainer} trailing={selected.trainerName} />
                    <ListRow
                      label={tm.mcNext}
                      trailing={
                        !selected.ready
                          ? tm.mcWaiting
                          : nextOf.has(selected.clientId)
                            ? when(nextOf.get(selected.clientId)!)
                            : tm.mcNoSession
                      }
                    />
                  </GroupedList>
                  <Button
                    variant="secondary"
                    disabled={!selected.ready}
                    onClick={() => onNavigate({ screen: 'schedule' })}
                  >
                    {tm.mcOpenSchedule}
                  </Button>
                </div>
              </Inspector>
            )}
          </Split>
        </>
      )}
    </Page>
  );
}
