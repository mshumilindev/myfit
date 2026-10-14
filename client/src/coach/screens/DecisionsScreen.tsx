import { useMemo, useRef, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Chip, ChipGroup } from '../../components/ui/Chip';
import { EmptyState } from '../../components/ui/EmptyState';
import { ExportMenu } from '../../components/ui/ExportMenu';
import { GroupedList, ListPanel, ListRow } from '../../components/ui/GroupedList';
import { SearchField } from '../../components/ui/SearchField';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { COACH_BREAKPOINT, useMinWidth } from '../../components/ui/breakpoints';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { Icon } from '../../ui';
import { useC360T } from '../../i18n/coachClient360';
import { useDecisionsT } from '../../i18n/coachDecisions';
import { useRosterT } from '../../i18n/coachRoster';
import { useTodayT } from '../../i18n/coachToday';
import { useCoachWorld, type CoachWorldPort } from '../data';
import type { OutcomeResult } from '../domain/decisions';
import { DAY } from '../domain/time';
import type { SignalKind } from '../domain/types';
import { ClientAvatar } from '../ClientAvatar';
import { coachDayMonth } from '../format';
import { Header, Inspector, Page, Split } from '../layout/Layout';
import type { CoachRoute } from '../routes';
import { DataStatusBar } from './DataStatus';
import { DecisionRecordView } from './DecisionRecordView';
import {
  decisionRows,
  groupDecisions,
  insightOf,
  resultLabel,
  RESULT_TONE,
  type DecisionResult,
  type DecisionRow,
  type GroupBy,
} from './decisionModel';
import { downloadCsv } from './csvDownload';
import { exportStrings } from './exportStrings';
import { useReauthGuard } from '../security/useReauthGuard';
import './Decisions.css';
import { FILTERS, PAGE, type Filter, type Range } from './decisions/decisionsConfig';
import {
  decisionsCsvOf,
  groupNameOf,
  groupTitleOf,
  rangeLabelOf,
} from './decisions/decisionLabels';
import { DecisionsSummary } from './decisions/DecisionsSummary';
import { DecisionsFilterPanel } from './decisions/DecisionsFilterPanel';
import { WorldFailed } from '../today/WorldNotices';

export interface DecisionsScreenProps {
  onNavigate: (r: CoachRoute) => void;
  /** Opens the evidence of a decision (the Decision screen keyed by signal). */
  onOpenDecision?: (signalKey: string) => void;
  port?: CoachWorldPort;
}

/**
 * Decisions (S-19): summary with the one insight the numbers support, history with search and filters, the
 * Decision record (side panel on a wide screen, inline under the row on a phone) and the CSV export.
 */
export function DecisionsScreen({ onNavigate, onOpenDecision, port }: DecisionsScreenProps) {
  const { d } = useDecisionsT();
  const { c } = useC360T();
  const { r, locale } = useRosterT();
  const { t } = useTodayT();
  const desktop = useMinWidth(COACH_BREAKPOINT);
  const api = useCoachWorld(port);
  const world = api.world;
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [who, setWho] = useState('all');
  const [kind, setKind] = useState<'all' | SignalKind>('all');
  const [range, setRange] = useState<Range>('all');
  const [group, setGroup] = useState<GroupBy>('none');
  const [shown, setShown] = useState(PAGE);
  const [pick, setPick] = useState('');
  const [panel, setPanel] = useState(false);
  const filterBtn = useRef<HTMLSpanElement>(null);

  const all = useMemo(() => (world ? decisionRows(world, t) : []), [world, t]);
  const programs = useMemo(
    () => new Map((world?.rows ?? []).map((x) => [x.client.id, x.client.program])),
    [world],
  );
  const now = world?.now ?? 0;

  const label = (x: DecisionResult) => resultLabel(t, d, x);
  const ql = q.trim().toLowerCase();
  const base = all.filter(
    (x) =>
      (!ql || x.title.toLowerCase().includes(ql) || x.name.toLowerCase().includes(ql)) &&
      (who === 'all' || x.rec.clientId === who) &&
      (kind === 'all' || x.rec.signal.kind === kind) &&
      (range === 'all' || x.rec.decidedAt >= now - Number(range) * DAY),
  );
  const count = (f: Filter) =>
    f === 'all' ? base.length : base.filter((x) => x.result === f).length;
  const list = base.filter((x) => filter === 'all' || x.result === filter);
  // Group by: the list is ordered by group first, so paging ("Show 12 more") walks the groups in order.
  const ordered = groupDecisions(list, group).flatMap((g) => g.rows);
  const vis = ordered.slice(0, shown);
  const visGroups = groupDecisions(vis, group);
  const filtering =
    filter !== 'all' || ql !== '' || who !== 'all' || kind !== 'all' || range !== 'all';
  const nAct = [who !== 'all', kind !== 'all', range !== 'all'].filter(Boolean).length;
  const current: DecisionRow | undefined = ordered.find((x) => x.rec.id === pick) ?? ordered[0];

  const reset = () => {
    setFilter('all');
    setQ('');
    setWho('all');
    setKind('all');
    setRange('all');
    setShown(PAGE);
  };
  const reveal = (fn: () => void) => {
    fn();
    setShown(PAGE);
  };

  const summary = world?.summary;
  const pct = summary && summary.total ? Math.round((summary.improved / summary.total) * 100) : 0;
  const insight = useMemo(() => insightOf(c, all), [c, all]);

  const csv = (rows: readonly DecisionRow[]) => decisionsCsvOf(rows, { c, now, label });
  const view = csv(list);
  const { ask, dialog: reauthDialog } = useReauthGuard();
  const doExport = async (everything: boolean): Promise<string | undefined> => {
    if (!(await ask('export'))) return undefined;
    const spec = everything ? csv(all) : view;
    downloadCsv(
      c.exFileDecisions,
      spec.columns.map((k) => c.exColDecisions[k]),
      spec.rows,
    );
    return c.exDone(c.exFileDecisions, spec.rows.length);
  };
  const exportMenu = (
    <ExportMenu
      strings={exportStrings(c, c.exScopeDecisions)}
      size={desktop ? 'sm' : 'md'}
      rows={view.rows.length}
      allRows={filtering ? all.length : undefined}
      columns={view.columns.map((k) => c.exColDecisions[k])}
      onExport={doExport}
    />
  );

  const header = (
    <Header
      title={d.dcTitle}
      subtitle={world ? d.dcCount(all.length) : undefined}
      actions={desktop && world && all.length > 0 ? exportMenu : undefined}
    />
  );

  if (!world) {
    return (
      <Page>
        {header}
        {api.loading ? <SkeletonRows rows={6} label={d.dcLoading} /> : <WorldFailed api={api} />}
      </Page>
    );
  }

  const parts: { key: OutcomeResult; n: number }[] = summary
    ? [
        { key: 'improved', n: summary.improved },
        { key: 'no-clear-change', n: summary.noChange },
        { key: 'declined', n: summary.declined },
        { key: 'measuring', n: summary.measuring },
      ]
    : [];

  const recordFor = (row: DecisionRow) => (
    <DecisionRecordView
      row={row}
      c={c}
      d={d}
      r={r}
      t={t}
      locale={locale}
      now={now}
      program={programs.get(row.rec.clientId) ?? ''}
      onOpenClient={() => onNavigate({ screen: 'client', cid: row.rec.clientId })}
      onOpenEvidence={() =>
        onOpenDecision ? onOpenDecision(row.rec.signal.key) : onNavigate({ screen: 'agenda' })
      }
      onNewDecision={() => onNavigate({ screen: 'client', cid: row.rec.clientId })}
    />
  );

  const clients = [...new Map(all.map((x) => [x.rec.clientId, x.name])).entries()].sort((a, b) =>
    a[1].localeCompare(b[1]),
  );
  const rangeLabel = (v: Range) => rangeLabelOf(c, v);
  const groupName = (g: GroupBy): string => groupNameOf(d, g);
  const groupTitle = (key: string, rows: readonly DecisionRow[]): string =>
    groupTitleOf({ group, key, rows, r, locale, label });
  const active: { k: string; text: string; off: () => void }[] = [];
  if (group !== 'none')
    active.push({
      k: 'group',
      text: `${d.dcGrouped}: ${groupName(group)}`,
      off: () => reveal(() => setGroup('none')),
    });
  if (who !== 'all')
    active.push({
      k: 'who',
      text: clients.find(([id]) => id === who)?.[1] ?? who,
      off: () => reveal(() => setWho('all')),
    });
  if (kind !== 'all')
    active.push({ k: 'kind', text: r.sgKind[kind], off: () => reveal(() => setKind('all')) });
  if (range !== 'all')
    active.push({ k: 'range', text: rangeLabel(range), off: () => reveal(() => setRange('all')) });

  const renderRow = (x: DecisionRow) => {
    const on = x.rec.id === current?.rec.id;
    const open = !desktop && x.rec.id === pick;
    return (
      <li key={x.rec.id}>
        <ListRow
          icon={<ClientAvatar id={x.rec.clientId} name={x.name} hasPhoto={x.hasPhoto} size={32} />}
          strong
          selected={desktop && on}
          label={x.title}
          sub={`${x.name} · ${coachDayMonth(x.rec.decidedAt, locale)}`}
          trailing={
            <Chip
              tone={RESULT_TONE[x.result]}
              icon={x.result === 'measuring' ? 'hourglass' : undefined}
            >
              {label(x.result)}
            </Chip>
          }
          aria-expanded={desktop ? undefined : open}
          aria-current={desktop && on ? 'true' : undefined}
          aria-label={`${c.drOpenRecord(x.title)}. ${x.name}. ${label(x.result)}`}
          onClick={() => setPick(!desktop && open ? '' : x.rec.id)}
        />
        {open && <ListPanel>{recordFor(x)}</ListPanel>}
      </li>
    );
  };

  const body = (
    <div className="dc-body">
      {summary && summary.total > 0 && (
        <DecisionsSummary
          summary={summary}
          pct={pct}
          parts={parts}
          label={label}
          insight={insight}
          c={c}
          d={d}
        />
      )}

      <section className="dc-hist" aria-label={d.dcHistory}>
        <div className="dc-hist-h">
          <SectionLabel role="heading" aria-level={2}>
            {d.dcHistory}
          </SectionLabel>
          <span className="dc-h2-n">{d.dcCount(count('all'))}</span>
          {!desktop && all.length > 0 && exportMenu}
        </div>
        <div className="dc-tools ctl-row--md">
          <SearchField
            value={q}
            onChange={(v) => reveal(() => setQ(v))}
            placeholder={d.dcSearch}
            clearLabel={d.dcClearSearch}
            aria-label={d.dcSearch}
          />
          <span ref={filterBtn} className="dc-fbtn">
            <Button
              variant="secondary"
              icon="funnel-simple"
              aria-haspopup="dialog"
              aria-expanded={panel}
              onClick={() => setPanel((o) => !o)}
            >
              {nAct ? c.drFiltersN(nAct) : c.drFiltersBtn}
            </Button>
          </span>
        </div>
        <DecisionsFilterPanel
          open={panel}
          onClose={() => setPanel(false)}
          anchorRef={filterBtn}
          c={c}
          d={d}
          r={r}
          filtering={filtering}
          onReset={reset}
          shownCount={list.length}
          reveal={reveal}
          group={group}
          setGroup={setGroup}
          who={who}
          setWho={setWho}
          kind={kind}
          setKind={setKind}
          range={range}
          setRange={setRange}
          clients={clients}
          groupName={groupName}
          rangeLabel={rangeLabel}
        />
        <ChipGroup role="group" aria-label={d.dcFilterLabel}>
          {FILTERS.map((f) => (
            <Chip
              key={f}
              selected={filter === f}
              aria-pressed={filter === f}
              count={count(f)}
              onClick={() => reveal(() => setFilter(f))}
            >
              {f === 'all' ? d.dcAll : label(f)}
            </Chip>
          ))}
        </ChipGroup>
        {active.length > 0 && (
          <ChipGroup role="group" aria-label={c.drFActive}>
            {active.map((a) => (
              <Chip key={a.k} selected aria-label={c.drFRemove(a.text)} onClick={a.off}>
                {a.text} <Icon name="x" />
              </Chip>
            ))}
            <Button variant="link" size="sm" onClick={reset}>
              {c.drFClearAll}
            </Button>
          </ChipGroup>
        )}

        {list.length === 0 ? (
          <Card>
            <EmptyState titleAs="h2" icon="magnifying-glass" title={d.dcNoMatch}>
              {filtering && (
                <Button variant="secondary" onClick={reset}>
                  {d.dcClear}
                </Button>
              )}
            </EmptyState>
          </Card>
        ) : (
          visGroups.map((g) => (
            <section
              key={g.key || 'all'}
              className="dc-group"
              aria-label={group === 'none' ? undefined : groupTitle(g.key, g.rows)}
            >
              {group !== 'none' && (
                <SectionLabel role="heading" aria-level={3} action={g.rows.length}>
                  {groupTitle(g.key, g.rows)}
                </SectionLabel>
              )}
              <GroupedList list label={group === 'none' ? d.dcList : groupTitle(g.key, g.rows)}>
                {g.rows.map(renderRow)}
              </GroupedList>
            </section>
          ))
        )}
        <div className="dc-more">
          {list.length > vis.length ? (
            <Button variant="secondary" size="sm" onClick={() => setShown((n) => n + PAGE)}>
              {c.drLeft(Math.min(PAGE, list.length - vis.length), list.length - vis.length)}
            </Button>
          ) : (
            list.length > 0 && <small className="dc-h2-n">{c.drAllShown(list.length)}</small>
          )}
        </div>
      </section>
    </div>
  );

  return (
    <Page className="dc">
      <DataStatusBar state={api} retry={api.retry} now={world.now} />
      {header}
      {all.length === 0 ? (
        <Card pad="lg">
          <EmptyState titleAs="h2" icon="check-circle" title={d.dcEmptyH} body={d.dcEmptyBody}>
            <Button variant="secondary" onClick={() => onNavigate({ screen: 'agenda' })}>
              {d.dcToAgenda}
            </Button>
          </EmptyState>
        </Card>
      ) : desktop ? (
        <Split ratio="5-7">
          {body}
          <Inspector label={c.drRecord} className="dc-rec">
            <h2 className="dc-rec-t">{c.drRecord}</h2>
            {current ? recordFor(current) : <p className="dc-h2-n">{c.drPick}</p>}
          </Inspector>
        </Split>
      ) : (
        body
      )}
      {reauthDialog}
    </Page>
  );
}
