import { useMemo, useState } from 'react';
import { BackButton } from '../../components/ui/BackButton';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { GroupedList } from '../../components/ui/GroupedList';
import { LockedRow, SignalListRow, StatusLabel } from '../../components/ui/RosterRows';
import { Select } from '../../components/ui/Select';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { EvidenceChart } from '../../components/ui/EvidenceChart';
import { Tag } from '../../components/ui/Tag';
import { COACH_BREAKPOINT, useMinWidth } from '../../components/ui/breakpoints';
import { useCoachT } from '../../i18n/coach';
import { useRosterT, type RosterStrings } from '../../i18n/coachRoster';
import { useTodayT } from '../../i18n/coachToday';
import { useCoachWorld, type CoachWorldPort } from '../data';
import type { AnnotatedSignal, SignalState } from '../domain/decisions';
import { effectiveConsent } from '../domain/consent';
import type { CoachClient, Evidence, Severity, Signal } from '../domain/types';
import { Header, Inspector, Page, Split } from '../layout/Layout';
import { SidePanel } from '../layout/SidePanel';
import { chatRoute, type CoachRoute } from '../routes';
import { signalChart, type ChartModel } from '../today/signalCopy';
import { ClientAvatar } from '../ClientAvatar';
import { DataStatusBar } from './DataStatus';
import { ageLabel, firstName, signalBody, signalTitle, statusLabel } from './format';
import './Signals.css';
import { WorldFailed } from '../today/WorldNotices';

export interface SignalsScreenProps {
  onNavigate: (r: CoachRoute) => void;
  /** Open the decision for a signal key (the Decision screen owns the route; default = the decisions list). */
  onOpenDecision?: (signalKey: string) => void;
  port?: CoachWorldPort;
  now?: number;
}

const SEV_RANK: Record<Severity, number> = { urgent: 0, watch: 1, good: 2 };

/** All signals (S-20): list with filters, inspector with the evidence peek. */
export function SignalsScreen({
  onNavigate,
  onOpenDecision,
  port,
  now: nowProp,
}: SignalsScreenProps) {
  const { r } = useRosterT();
  const { c } = useCoachT();
  const desktop = useMinWidth(COACH_BREAKPOINT);
  const api = useCoachWorld(port);
  const world = api.world;
  const now = nowProp ?? world?.now ?? 0;

  const [client, setClient] = useState('all');
  const [sev, setSev] = useState<'all' | Severity>('all');
  const [state, setState] = useState<'all' | SignalState>('all');
  const [sel, setSel] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);

  const byId = useMemo(() => {
    const m = new Map<string, CoachClient>();
    for (const row of world?.rows ?? []) m.set(row.client.id, row.client);
    return m;
  }, [world]);

  const all: AnnotatedSignal[] = useMemo(
    () =>
      [...(world?.signals ?? [])].sort(
        (a, b) =>
          Number(a.state !== 'open') - Number(b.state !== 'open') ||
          SEV_RANK[a.signal.severity] - SEV_RANK[b.signal.severity],
      ),
    [world],
  );
  const list = all.filter(
    (a) =>
      byId.has(a.signal.clientId) &&
      (client === 'all' || a.signal.clientId === client) &&
      (sev === 'all' || a.signal.severity === sev) &&
      (state === 'all' || a.state === state),
  );
  const current = list.find((a) => a.signal.key === sel) ?? (desktop ? list[0] : undefined);
  const clientsWithSignals = [...new Set(all.map((a) => a.signal.clientId))]
    .map((id) => byId.get(id))
    .filter((x): x is CoachClient => !!x);

  const goDecision = (key: string) =>
    onOpenDecision ? onOpenDecision(key) : onNavigate({ screen: 'decisions' });

  const header = (
    <>
      <div>
        <BackButton
          label={r.sgBack}
          text={r.sgBack}
          onClick={() => onNavigate({ screen: 'agenda' })}
        />
      </div>
      <Header title={r.sgTitle} subtitle={world ? r.sgCount(list.length) : undefined} />
    </>
  );

  if (!world) {
    return (
      <Page>
        {header}
        {api.loading ? <SkeletonRows rows={6} label={r.roLoading} /> : <WorldFailed api={api} />}
      </Page>
    );
  }

  const filtering = client !== 'all' || sev !== 'all' || state !== 'all';

  const detail = current && (
    <SignalDetail
      a={current}
      client={byId.get(current.signal.clientId)!}
      r={r}
      now={now}
      onOpenDecision={() => goDecision(current.signal.key)}
      onMessage={() => onNavigate(chatRoute(current.signal.clientId))}
      onOpenClient={() => onNavigate({ screen: 'client', cid: current.signal.clientId })}
    />
  );

  return (
    <Page>
      <DataStatusBar state={api} retry={api.retry} now={now} />
      {header}
      <div className="sg-filters" role="group" aria-label={r.roFilters}>
        <Select
          aria-label={r.sgFilterLabelClient}
          value={client}
          onChange={(e) => setClient(e.target.value)}
        >
          <option value="all">{r.sgFilterClient}</option>
          {clientsWithSignals.map((cl) => (
            <option key={cl.id} value={cl.id}>
              {cl.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label={r.sgFilterLabelSeverity}
          value={sev}
          onChange={(e) => setSev(e.target.value as 'all' | Severity)}
        >
          <option value="all">{r.sgFilterSeverity}</option>
          <option value="urgent">{r.roStatusUrgent}</option>
          <option value="watch">{r.roStatusWatch}</option>
          <option value="good">{r.roStatusGood}</option>
        </Select>
        <Select
          aria-label={r.sgFilterLabelState}
          value={state}
          onChange={(e) => setState(e.target.value as 'all' | SignalState)}
        >
          <option value="all">{r.sgFilterState}</option>
          <option value="open">{r.sgStateOpen}</option>
          <option value="decided">{r.sgStateDecided}</option>
          <option value="snoozed">{r.sgStateSnoozed}</option>
          <option value="dismissed">{r.sgStateDismissed}</option>
        </Select>
      </div>

      <Split ratio="5-7">
        <div className="sg-list">
          {list.length === 0 ? (
            <Card>
              {filtering ? (
                <EmptyState titleAs="h2" icon="magnifying-glass" title={r.sgNoMatch}>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setClient('all');
                      setSev('all');
                      setState('all');
                    }}
                  >
                    {r.sgClearFilters}
                  </Button>
                </EmptyState>
              ) : (
                <EmptyState
                  titleAs="h2"
                  icon="check-circle"
                  title={r.sgEmptyH}
                  body={r.sgEmptyBody}
                />
              )}
            </Card>
          ) : (
            <GroupedList list label={r.sgListLabel}>
              {list.map((a) => {
                const cl = byId.get(a.signal.clientId)!;
                return (
                  <li key={a.signal.key}>
                    <SignalListRow
                      title={signalTitle(r, a.signal)}
                      clientName={cl.name}
                      avatar={
                        <ClientAvatar id={cl.id} name={cl.name} hasPhoto={cl.hasPhoto} size={40} />
                      }
                      severity={a.signal.severity}
                      severityLabel={statusLabel(r, a.signal.severity)}
                      kindLabel={r.sgKind[a.signal.kind]}
                      ageLabel={ageLabel(r, a.signal.detectedAt, now)}
                      decidedLabel={a.state === 'decided' ? r.sgStateDecided : undefined}
                      selected={desktop && current?.signal.key === a.signal.key}
                      onClick={() => {
                        setSel(a.signal.key);
                        if (!desktop) setDrawer(true);
                      }}
                    />
                  </li>
                );
              })}
            </GroupedList>
          )}
        </div>
        {desktop && (
          <Inspector label={r.sgEvidence}>
            {detail ?? <EmptyState titleAs="h2" icon="pulse" title={r.sgPick} />}
          </Inspector>
        )}
      </Split>

      {!desktop && (
        <SidePanel
          open={drawer && !!current}
          onClose={() => setDrawer(false)}
          title={r.sgEvidence}
          closeLabel={c.drawerClose}
        >
          {detail}
        </SidePanel>
      )}
    </Page>
  );
}

function SignalDetail({
  a,
  client,
  r,
  now,
  onOpenDecision,
  onMessage,
  onOpenClient,
}: {
  a: AnnotatedSignal;
  client: CoachClient;
  r: RosterStrings;
  now: number;
  onOpenDecision: () => void;
  onMessage: () => void;
  onOpenClient: () => void;
}) {
  const s = a.signal;
  const { t: tt, locale } = useTodayT();
  /* Re-gate before drawing: a category that is now off never reaches the chart. */
  const consent = effectiveConsent(client.mode, client.consent);
  const shown: Signal = { ...s, evidence: s.evidence.filter((e) => consent[e.category] !== 'off') };
  const chart = signalChart(tt, shown, now, locale, 'weekly');
  return (
    <div className="sg-det">
      <Card
        as="button"
        pad="none"
        emphasis="quiet"
        className="sg-det-who"
        aria-label={`${r.sgOpenClient}: ${client.name}`}
        onClick={onOpenClient}
      >
        <ClientAvatar id={client.id} name={client.name} hasPhoto={client.hasPhoto} size={40} />
        <span>
          <b>{client.name}</b>
          <small>{client.program}</small>
        </span>
      </Card>
      <div className="sg-det-tags">
        <StatusLabel status={s.severity}>{statusLabel(r, s.severity)}</StatusLabel>
        <Tag tone="neutral">{r.sgKind[s.kind]}</Tag>
        {a.state === 'decided' && <Tag tone="neutral">{r.sgStateDecided}</Tag>}
        <small>{ageLabel(r, s.detectedAt, now)}</small>
      </div>
      <h2 className="sg-det-t">{signalTitle(r, s)}</h2>
      <p className="sg-det-b">{signalBody(r, s)}</p>
      <EvidenceBlock signal={s} client={client} r={r} chart={chart} />
      <div className="sg-det-btns">
        <Button variant="primary" iconTrailing="arrow-right" onClick={onOpenDecision}>
          {r.sgOpenDecision}
        </Button>
        <Button variant="ghost" icon="envelope" onClick={onMessage}>
          {r.sgMessage(firstName(client.name))}
        </Button>
      </div>
    </div>
  );
}

/**
 * Evidence peek. The engine already cut rows to consent; this checks AGAIN against the client's current consent,
 * so a category that is (now) off renders the locked sentence and never a single row (R-FE-061).
 */
export function EvidenceBlock({
  signal,
  client,
  r,
  chart,
}: {
  signal: { evidence: readonly Evidence[] };
  client: CoachClient;
  r: RosterStrings;
  /** When given (and with enough points) the rows are drawn as the lab's line chart; the table stays for assistive tech. */
  chart?: ChartModel | null;
}) {
  const drawn = chart && !chart.notEnough ? chart : null;
  const consent = effectiveConsent(client.mode, client.consent);
  const first = firstName(client.name);
  return (
    <section className={drawn ? 'sg-ev sg-ev--chart' : 'sg-ev'} aria-label={r.sgEvidence}>
      <h3 className={drawn ? 'sg-ev-h visually-hidden' : 'sg-ev-h'}>{r.sgEvidence}</h3>
      {signal.evidence.length === 0 && <p className="sg-ev-none">{r.sgEvidenceNone}</p>}
      {signal.evidence.map((e, i) =>
        consent[e.category] === 'off' ? (
          <LockedRow key={`${e.category}-${i}`}>{r.sgEvidenceLocked(first)}</LockedRow>
        ) : drawn ? (
          i ===
          signal.evidence.findIndex((x) => x.rows.length > 0 && consent[x.category] !== 'off') ? (
            <div key={`${e.category}-${i}`} className="sg-ev-blk">
              <EvidenceChart
                points={drawn.points}
                xStart={drawn.xStart}
                xEnd={drawn.xEnd}
                unit={drawn.unit}
                plan={drawn.plan}
                tone={drawn.tone}
                ariaLabel={drawn.aria}
                table={drawn.table}
              />
              {!e.granular && <p className="sg-ev-none">{r.sgEvidenceNeedsFull}</p>}
            </div>
          ) : null
        ) : (
          <div key={`${e.category}-${i}`} className="sg-ev-blk">
            {!e.granular && <p className="sg-ev-none">{r.sgEvidenceNeedsFull}</p>}
            <DataTable
              bare
              headless
              label={r.sgEvidence}
              columns={[
                { id: 'label', header: r.sgEvidence, strong: true, cell: (x) => x.label },
                {
                  id: 'value',
                  header: r.sgEvidence,
                  cell: (x) => `${x.value} ${r.sgUnits[x.unit]}`,
                },
                { id: 'detail', header: r.sgEvidence, muted: true, cell: (x) => x.detail ?? '' },
              ]}
              rows={e.rows}
              rowKey={(x) => `${x.at}|${x.label}|${x.value}`}
            />
          </div>
        ),
      )}
    </section>
  );
}
