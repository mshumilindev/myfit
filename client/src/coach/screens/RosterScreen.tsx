import { useMemo, useState } from 'react';
import { Button, IconButton } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { ExportMenu } from '../../components/ui/ExportMenu';
import { Notice } from '../../components/ui/Notice';
import { InvitePanel } from '../../components/ui/InvitePanel';
import { SearchField } from '../../components/ui/SearchField';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { Segmented } from '../../components/ui/Segmented';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { COACH_BREAKPOINT, useMinWidth } from '../../components/ui/breakpoints';
import type { LocaleId } from '../../i18n';
import { coachEyebrow } from '../format';
import { useC360T } from '../../i18n/coachClient360';
import { useSafeT } from '../../i18n/coachSafe';
import { useReauthGuard } from '../security/useReauthGuard';
import { exportStrings } from './exportStrings';
import { useRosterT } from '../../i18n/coachRoster';
import { useCoachWorld, type CoachWorldPort } from '../data';
import { useCoachInvites, type InvitePort } from '../data/inviteStore';
import { daysLeft, defaultRequest, effectiveRequest } from '../domain/invite';
import { type Consent, type LogMode } from '../domain/types';
import { Header, Page, Split, Toolbar } from '../layout/Layout';
import { chatRoute, type CoachRoute } from '../routes';
import { DataStatusBar } from './DataStatus';
import { firstName, toCsv } from './format';
import './Roster.css';
import { RosterDetailCard } from './roster/RosterDetailCard';
import { WithdrawInvite } from './roster/WithdrawInvite';
import { RosterNoMatch } from './roster/RosterNoMatch';
import { RosterList } from './roster/RosterList';
import { RosterFilters } from './roster/RosterFilters';
import { RosterHero } from './roster/RosterHero';
import { PendingInvites, pendingInviteRows } from './roster/PendingInvites';
import { RosterStrip } from './roster/RosterStrip';
import { inviteLabels } from './roster/inviteLabels';
import {
  NO_FILTER,
  downloadCsv,
  filterSortRoster,
  type RosterFilter,
  type SortKey,
  rosterCsvRows,
} from './roster/rosterLogic';
import { useCoachUnreadState } from '../data/useCoachUnread';
import { WorldFailed } from '../today/WorldNotices';

/** Kept here: the public home of the invite labels. */
export { inviteLabels };

export interface RosterScreenProps {
  onNavigate: (r: CoachRoute) => void;
  /** Test / story seams. */
  port?: CoachWorldPort;
  invitePort?: InvitePort;
  unreadByClient?: Readonly<Record<string, number>>;
  /** Stories: open the invite panel in a mode with a name filled in. */
  initialInvite?: { mode: LogMode; name?: string } | null;
  now?: number;
}

/** The strip shows as many bubbles as the row holds (measured); this is only an upper bound. */
const STRIP_MAX = 24;

const dateEyebrow = (locale: LocaleId, now: number) => coachEyebrow(now, locale);

/** Clients (S-17 / S-18): the roster with its detail preview, invite panel and every data state. */
export function RosterScreen({
  onNavigate,
  port,
  invitePort,
  unreadByClient: unreadProp,
  initialInvite = null,
  now: nowProp,
}: RosterScreenProps) {
  const liveUnread = useCoachUnreadState({ uid: unreadProp ? null : undefined });
  const unreadByClient = unreadProp ?? liveUnread.byClient;
  const { r, locale } = useRosterT();
  const { c: c360 } = useC360T();
  const { sf } = useSafeT();
  const { ask, dialog: reauthDialog } = useReauthGuard();
  const [withdrawFailed, setWithdrawFailed] = useState(false);
  // Resend = withdraw the old invite, then send a fresh one (one button); the new link is offered right here
  const [resent, setResent] = useState<{ name: string; url: string | null } | 'failed' | null>(
    null,
  );
  const [withdrawing, setWithdrawing] = useState<{ id: string; name: string } | null>(null);
  const desktop = useMinWidth(COACH_BREAKPOINT);
  const api = useCoachWorld(port);
  const invites = useCoachInvites(invitePort);
  const world = api.world;
  const now = nowProp ?? world?.now ?? 0;

  const [q, setQ] = useState('');
  const [view, setView] = useState<'all' | 'attn'>('all');
  const [sortK, setSortK] = useState<SortKey>('status');
  const [fl, setFl] = useState<RosterFilter>(NO_FILTER);
  const [fOpen, setFOpen] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(initialInvite != null);

  const clients = useMemo(() => (world?.rows ?? []).filter((x) => !x.client.invite), [world]);
  const pending = useMemo(() => (world?.rows ?? []).filter((x) => x.client.invite), [world]);

  const programs = useMemo(
    () => [...new Set(clients.map((x) => x.client.program))].sort(),
    [clients],
  );
  const gyms = useMemo(() => [...new Set(clients.map((x) => x.client.gym))].sort(), [clients]);
  const filtering = q !== '' || fl.program !== 'all' || fl.gym !== 'all' || fl.mode !== 'all';

  const list = useMemo(
    () => filterSortRoster(clients, { q, view, fl, sortK }),
    [clients, q, view, fl, sortK],
  );

  const selected = list.find((x) => x.client.id === sel) ?? list[0] ?? null;

  const createInvite = async (req: {
    name: string;
    mode: LogMode;
    request: Record<string, 'off' | 'effects' | 'full'>;
  }) => {
    const res = await invites.create({
      name: req.name,
      mode: req.mode,
      request: { ...defaultRequest('program'), ...req.request } as Consent,
    });
    return {
      id: res.id,
      url: res.url,
      expiresInDays: res.expiresAt != null ? daysLeft(res.expiresAt, res.sentAt) : null,
    };
  };

  const goClient = (id: string) => onNavigate({ screen: 'client', cid: id });
  const goChat = () => onNavigate({ screen: 'chat' });
  const sendInChat = (url: string) => {
    void navigator.clipboard?.writeText(url).catch(() => undefined);
    goChat();
  };

  /** Exports the given rows (the view, or every client); the roster is client data, so it asks for the password first. */
  const exportRows = async (everything: boolean): Promise<string | undefined> => {
    if (!(await ask('export'))) return undefined;
    const src = everything ? clients : list;
    const rows = rosterCsvRows(r, src);
    downloadCsv(toCsv(rows), r.roExportFile);
    return c360.exDone(r.roExportFile, src.length);
  };

  /* ---- loading / failed (nothing to show yet) ---- */
  if (!world) {
    return (
      <Page>
        <Header title={r.roTitle} />
        {api.loading ? <SkeletonRows rows={8} label={r.roLoading} /> : <WorldFailed api={api} />}
      </Page>
    );
  }

  const total = world.counts.clients;
  const attn = world.counts.needAttention;
  const createdHere = invites.created;
  const noOne = clients.length === 0 && pending.length === 0 && createdHere.length === 0;

  if (noOne) {
    return (
      <RosterHero
        r={r}
        labels={inviteLabels(r, true)}
        eyebrow={dateEyebrow(locale, now)}
        statusBar={<DataStatusBar state={api} retry={api.retry} now={now} />}
        onCreate={createInvite}
        onSendInChat={sendInChat}
        onOpenProfile={goClient}
      />
    );
  }

  /* ---- pieces ---- */
  const pendingRows = pendingInviteRows({
    r,
    now,
    created: createdHere,
    pending,
    withdrawn: invites.withdrawn,
  });

  const rowsEl = (
    <RosterList
      list={list}
      r={r}
      desktop={desktop}
      inviteOpen={inviteOpen}
      selectedId={selected?.client.id}
      unread={unreadByClient}
      onSelect={(id) => {
        setSel(id);
        setInviteOpen(false);
      }}
      onOpen={goClient}
    />
  );

  const detail = selected && (
    <RosterDetailCard
      row={selected}
      r={r}
      now={now}
      locale={locale}
      slots={world.slots}
      signals={world.signals.map((a) => a.signal)}
      onChat={() => onNavigate(chatRoute(selected.client.id))}
      onOpen={goClient}
    />
  );

  const invitePanel = (
    <Card pad="lg">
      <InvitePanel
        labels={inviteLabels(r)}
        defaultRequest={defaultRequest}
        onCreate={createInvite}
        onSendInChat={sendInChat}
        onOpenProfile={goClient}
        initialMode={initialInvite?.mode}
        initialName={initialInvite?.name}
      />
    </Card>
  );

  const inviteBtn = desktop ? (
    <Button
      variant="secondary"
      icon="plus"
      aria-expanded={inviteOpen}
      onClick={() => setInviteOpen((o) => !o)}
    >
      {r.roInvite}
    </Button>
  ) : (
    <IconButton
      variant="secondary"
      size="sm"
      icon="plus"
      label={r.roInviteShort}
      aria-expanded={inviteOpen}
      onClick={() => setInviteOpen((o) => !o)}
    />
  );

  const exportBtn = (
    <ExportMenu
      strings={exportStrings(c360, sf.exScopeRoster)}
      size="sm"
      rows={list.length}
      allRows={filtering ? clients.length : undefined}
      columns={r.roCsvCols}
      onExport={exportRows}
    />
  );

  const empty = list.length === 0;

  return (
    <Page>
      <DataStatusBar state={api} retry={api.retry} now={now} />
      <Header
        eyebrow={desktop ? dateEyebrow(locale, now) : undefined}
        title={r.roTitle}
        subtitle={r.roSubtitle(total, attn)}
        actions={inviteBtn}
      />
      <Toolbar label={r.roShow}>
        <Segmented<'all' | 'attn'>
          size="sm"
          label={r.roShow}
          value={view}
          onChange={setView}
          options={[
            { value: 'all', label: r.roAll(total) },
            { value: 'attn', label: r.roAttn(attn) },
          ]}
        />
        <span className="ro-grow" />
        <Button
          variant="ghost"
          size="sm"
          icon="funnel-simple"
          aria-expanded={fOpen}
          onClick={() => setFOpen((o) => !o)}
        >
          {r.roFilters}
        </Button>
        {desktop && exportBtn}
      </Toolbar>

      <Split ratio="5-7">
        <div className="ro-list">
          {!inviteOpen || desktop ? null : invitePanel}
          <RosterStrip
            clients={clients}
            max={STRIP_MAX}
            unread={unreadByClient}
            r={r}
            onOpen={goClient}
            onAll={() => {
              setView('all');
              setQ('');
            }}
          />
          <SearchField
            value={q}
            onChange={setQ}
            placeholder={r.roSearch}
            clearLabel={r.roClearSearch}
          />
          {fOpen && (
            <RosterFilters
              r={r}
              sortK={sortK}
              onSort={setSortK}
              fl={fl}
              onFilter={setFl}
              programs={programs}
              gyms={gyms}
            />
          )}
          <PendingInvites
            rows={pendingRows}
            r={r}
            sf={sf}
            onWithdraw={setWithdrawing}
            onResend={(w) => {
              setResent(null);
              void (async () => {
                if (!(await ask('revoke-invite'))) return;
                try {
                  await invites.revoke(w.id);
                  const fresh = await invites.create({
                    name: w.name,
                    mode: w.mode,
                    request: effectiveRequest(w.mode, defaultRequest(w.mode)),
                  });
                  setResent({ name: w.name, url: fresh.url });
                } catch {
                  setResent('failed');
                }
              })();
            }}
          />
          {pendingRows.length > 0 && (
            <SectionLabel role="heading" aria-level={2}>
              {r.roClientsH(list.length)}
            </SectionLabel>
          )}
          {empty ? (
            <RosterNoMatch
              r={r}
              q={q}
              filtering={filtering}
              onClear={() => {
                setQ('');
                setFl(NO_FILTER);
                setView('all');
              }}
            />
          ) : (
            rowsEl
          )}
          {!desktop && <div className="ro-btns">{exportBtn}</div>}
        </div>
        {desktop ? (
          <div className="ro-detail">
            {inviteOpen
              ? invitePanel
              : (detail ?? <EmptyState titleAs="h2" icon="user-focus" title={r.roPickClient} />)}
          </div>
        ) : null}
      </Split>
      {resent === 'failed' && (
        <Notice
          tone="danger"
          icon="warning-circle"
          trail={
            <Button variant="ghost" size="sm" onClick={() => setResent(null)}>
              {sf.raCancel}
            </Button>
          }
        >
          {sf.invResendFailed}
        </Notice>
      )}
      {resent && resent !== 'failed' && (
        <Notice
          tone="accent"
          icon="arrows-clockwise"
          trail={
            resent.url ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void navigator.clipboard?.writeText(resent.url ?? '')}
              >
                {sf.invCopyLink}
              </Button>
            ) : undefined
          }
        >
          {sf.invResendDone(firstName(resent.name))}
        </Notice>
      )}
      <WithdrawInvite
        sf={sf}
        withdrawing={withdrawing}
        failed={withdrawFailed}
        onCancel={() => setWithdrawing(null)}
        onDismissFailed={() => setWithdrawFailed(false)}
        onConfirm={(w) => {
          setWithdrawing(null);
          void (async () => {
            if (!(await ask('revoke-invite'))) return;
            try {
              await invites.revoke(w.id);
            } catch {
              setWithdrawFailed(true);
            }
          })();
        }}
      />
      {reauthDialog}
    </Page>
  );
}
