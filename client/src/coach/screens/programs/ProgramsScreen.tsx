import { useEffect, useMemo, useRef, useState } from 'react';
import { BackButton } from '../../../components/ui/BackButton';
import { Button, IconButton } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { GroupedList, ListRow } from '../../../components/ui/GroupedList';
import { IconTile } from '../../../components/ui/IconTile';
import { Notice } from '../../../components/ui/Notice';
import { ResponsivePanel } from '../../../components/ui/ResponsivePanel';
import { SearchField } from '../../../components/ui/SearchField';
import { SkeletonRows } from '../../../components/ui/Skeleton';
import { COACH_BREAKPOINT, useMinWidth } from '../../../components/ui/breakpoints';
import { useProgramsT } from '../../../i18n/coachPrograms';
import { useRosterT } from '../../../i18n/coachRoster';
import { ClientAvatar } from '../../ClientAvatar';
import { useCoachWorld, type CoachWorldPort } from '../../data';
import { Header, Inspector, Page, Split } from '../../layout/Layout';
import { getProgramPort } from '../../program/config';
import type { ProgramPort } from '../../program/port';
import type { ProgramBundle } from '../../program/types';
import { programPageRoute, type CoachRoute } from '../../routes';
import { firstName, trainerDaysText } from '../format';
import { followerNames, matchGroup, programGroups, type ProgramGroup } from './model';
import './Programs.css';
import { WorldFailed } from '../../today/WorldNotices';

export interface ProgramsScreenProps {
  onNavigate: (r: CoachRoute) => void;
  /** Test / story seams. */
  port?: CoachWorldPort;
  programPort?: ProgramPort;
}

/**
 * Programs (S-21, `#/c/programs`): every program the roster follows, who follows it, and a way into the editor of
 * each client's own copy. A program is written per client (the editor says so); a shared program shows who keeps an
 * older version. Master list, then detail (pushed on a phone).
 */
export function ProgramsScreen({ onNavigate, port, programPort }: ProgramsScreenProps) {
  const { pg } = useProgramsT();
  const { r } = useRosterT();
  const desktop = useMinWidth(COACH_BREAKPOINT);
  const api = useCoachWorld(port);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [pickNew, setPickNew] = useState(false);
  const newRef = useRef<HTMLSpanElement>(null);

  const groups = useMemo(
    () => programGroups((api.world?.rows ?? []).map((x) => x.client)),
    [api.world],
  );
  const clientCount = groups.reduce((n, g) => n + g.clients.length, 0);
  const shown = groups.filter((g) => matchGroup(g, q));
  const open = shown.find((g) => g.name === sel) ?? (desktop ? shown[0] : undefined);
  const hasData = groups.length > 0;

  const goEditor = (cid: string) => onNavigate(programPageRoute(cid, 'edit', 'list'));

  const newButton = (
    <span ref={newRef}>
      {desktop ? (
        <Button
          variant="secondary"
          icon="plus"
          aria-haspopup="dialog"
          aria-expanded={pickNew}
          onClick={() => setPickNew(true)}
        >
          {pg.pgNew}
        </Button>
      ) : (
        <IconButton
          variant="secondary"
          icon="plus"
          label={pg.pgNew}
          aria-haspopup="dialog"
          aria-expanded={pickNew}
          onClick={() => setPickNew(true)}
        />
      )}
    </span>
  );
  const chooser = (
    <ResponsivePanel
      open={pickNew}
      onClose={() => setPickNew(false)}
      anchorRef={newRef}
      label={pg.pgNewLabel}
      title={pg.pgNewTitle}
    >
      <p className="pgm-hint">{pg.pgNewBody}</p>
      <GroupedList list surface="raised" label={pg.pgNewLabel}>
        {(api.world?.rows ?? [])
          .filter((x) => !x.client.invite)
          .map((x) => (
            <li key={x.client.id}>
              <ListRow
                strong
                icon={
                  <ClientAvatar
                    id={x.client.id}
                    name={x.client.name}
                    hasPhoto={x.client.hasPhoto}
                    size={40}
                  />
                }
                label={x.client.name}
                sub={x.client.program}
                chevron
                onClick={() => {
                  setPickNew(false);
                  goEditor(x.client.id);
                }}
              />
            </li>
          ))}
      </GroupedList>
    </ResponsivePanel>
  );

  const header = (
    <Header
      title={pg.pgTitle}
      subtitle={hasData ? pg.pgSubtitle(groups.length, clientCount) : undefined}
      actions={newButton}
    />
  );

  if (!api.world) {
    return (
      <Page>
        {header}
        {api.loading ? <SkeletonRows rows={5} label={r.roLoading} /> : <WorldFailed api={api} />}
        {chooser}
      </Page>
    );
  }

  if (!hasData) {
    return (
      <Page>
        {header}
        <Card pad="lg">
          <EmptyState titleAs="h2" centered icon="list-checks" title={pg.pgNoneH} body={pg.pgNoneB}>
            <Button variant="primary" icon="plus" onClick={() => setPickNew(true)}>
              {pg.pgNew}
            </Button>
          </EmptyState>
        </Card>
        {chooser}
      </Page>
    );
  }

  const detail = open && (
    <ProgramDetail key={open.name} group={open} programPort={programPort} onOpen={goEditor} />
  );

  // Phone with a program open: the detail is the screen, Back returns to the list.
  if (!desktop && open) {
    return (
      <Page>
        <div>
          <BackButton label={pg.pgBack} text={pg.pgBack} onClick={() => setSel(null)} />
        </div>
        {detail}
      </Page>
    );
  }

  const list =
    shown.length === 0 ? (
      <Card pad="lg">
        <EmptyState
          titleAs="h2"
          centered
          icon="magnifying-glass"
          title={pg.pgNoMatchH}
          body={pg.pgNoMatchB}
        />
      </Card>
    ) : (
      <GroupedList list label={pg.pgListLabel}>
        {shown.map((g) => {
          const f = followerNames(g, firstName);
          return (
            <li key={g.name}>
              <ListRow
                strong
                icon={<IconTile icon="list-checks" tone="coach" size={40} />}
                label={g.name}
                sub={pg.pgClientsLine(
                  g.clients.length,
                  f.more ? pg.pgNamesMore(f.names, f.more) : f.names,
                )}
                chevron
                selected={desktop && open?.name === g.name}
                aria-current={desktop && open?.name === g.name ? 'true' : undefined}
                onClick={() => setSel(g.name)}
              />
            </li>
          );
        })}
      </GroupedList>
    );

  return (
    <Page>
      {header}
      <SearchField
        className="pgm-search"
        value={q}
        onChange={setQ}
        placeholder={pg.pgSearch}
        clearLabel={pg.pgSearchClear}
      />
      {desktop ? (
        <Split ratio="5-7">
          <div className="pgm-col">{list}</div>
          <div className="pgm-col">{detail}</div>
        </Split>
      ) : (
        list
      )}
      {chooser}
    </Page>
  );
}

function ProgramDetail({
  group,
  programPort,
  onOpen,
}: {
  group: ProgramGroup;
  programPort?: ProgramPort;
  onOpen: (cid: string) => void;
}) {
  const { pg } = useProgramsT();
  const { r } = useRosterT();
  const port = programPort ?? getProgramPort();
  const lead = group.clients[0];
  // Who keeps an older version of this shared program: the lead client's bundle knows (never blocks).
  const [bundle, setBundle] = useState<ProgramBundle | null>(() => port.peek(lead.id));
  useEffect(() => {
    if (group.clients.length < 2) return;
    const ac = new AbortController();
    port
      .load(lead.id, { signal: ac.signal })
      .then(setBundle)
      .catch(() => undefined);
    return () => ac.abort();
  }, [port, lead.id, group.clients.length]);
  const older = (bundle?.sharedWith ?? []).filter(
    (s) =>
      bundle && s.version < bundle.liveVersion && group.clients.some((c) => c.id === s.clientId),
  );

  return (
    <Inspector label={group.name} bare={false}>
      <div className="pgm-detail">
        <h2 className="pgm-name">{group.name}</h2>
        <p className="pgm-follow">{pg.pgFollow(group.clients.length)}</p>
        {older.length > 0 && bundle && (
          <Notice tone="note" icon="info">
            <strong>{pg.pgSharedTitle}.</strong>{' '}
            {pg.pgKeeps(older.map((s) => firstName(s.name)).join(', '), older[0].version)}
          </Notice>
        )}
        <GroupedList list surface="raised" label={pg.pgClientsLabel}>
          {group.clients.map((c) => (
            <li key={c.id}>
              <ListRow
                strong
                icon={<ClientAvatar id={c.id} name={c.name} hasPhoto={c.hasPhoto} size={40} />}
                label={c.name}
                sub={
                  c.trainerDays.length
                    ? pg.pgWeekWith(c.programWeek, trainerDaysText(r, c.trainerDays))
                    : pg.pgWeekSolo(c.programWeek)
                }
                chevron
                aria-label={pg.pgOpenFor(c.name)}
                onClick={() => onOpen(c.id)}
              />
            </li>
          ))}
        </GroupedList>
        <Button variant="primary" icon="pencil-simple" onClick={() => onOpen(lead.id)}>
          {pg.pgOpenEditor}
        </Button>
      </div>
    </Inspector>
  );
}
