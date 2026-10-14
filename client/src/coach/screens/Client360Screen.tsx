import { useMemo, useState } from 'react';
import { ActionMenu, type ActionMenuItem } from '../../components/ui/ActionMenu';
import { ClientAvatar } from '../ClientAvatar';
import { BackButton } from '../../components/ui/BackButton';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { ScrollTabs, tabIds } from '../../components/ui/ScrollTabs';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { COACH_BREAKPOINT, useMinWidth } from '../../components/ui/breakpoints';
import { IconButton } from '../../components/ui/Button';
import { useC360T } from '../../i18n/coachClient360';
import { useDecisionsT } from '../../i18n/coachDecisions';
import { useRosterT } from '../../i18n/coachRoster';
import { useTodayT } from '../../i18n/coachToday';
import { useCoachWorld, type CoachWorldPort } from '../data';
import { getTrainerUid } from '../data/config';
import { ConfirmEffectsDialog } from '../../components/ui/ConfirmEffectsDialog';
import { Notice } from '../../components/ui/Notice';
import { useReauthGuard } from '../security/useReauthGuard';
import { SecurityCodeDialog } from '../security/SecurityCodeDialog';
import { useSecurity } from '../security/useSecurity';
import { useSafeT } from '../../i18n/coachSafe';
import { useReadLog, type ReadLogPort } from '../data/readLog';
import { useCoachUnreadState } from '../data/useCoachUnread';
import { askable, effectiveConsent } from '../domain/consent';
import type { Category } from '../domain/types';
import { Header, Page } from '../layout/Layout';
import { chatRoute, type CoachRoute } from '../routes';
import type { RescheduleRequestPort } from '../today/requestPort';
import { scheduleHref } from '../schedule/useScheduleParams';
import { DecisionsTab } from './Client360Decisions';
import { Overview } from './Client360Overview';
import { StrengthTab } from './Client360Strength';
import { WorkoutsTab } from './Client360Workouts';
import { NotesPanel } from '../notes/NotesPanel';
import { ProgramTab } from '../program/ProgramTab';
import { DataStatusBar } from './DataStatus';
import { firstName } from './format';
import './Client360.css';
import { WorldFailed } from '../today/WorldNotices';

export const CLIENT_TABS = [
  'overview',
  'workouts',
  'strength',
  'program',
  'decisions',
  'notes',
] as const;
export type ClientTab = (typeof CLIENT_TABS)[number];

export const tabOf = (raw: string | undefined): ClientTab =>
  (CLIENT_TABS as readonly string[]).includes(raw ?? '') ? (raw as ClientTab) : 'overview';

export interface Client360Props {
  cid: string;
  tab?: string;
  onNavigate: (r: CoachRoute) => void;
  onOpenDecision?: (signalKey: string) => void;
  port?: CoachWorldPort;
  /** Tests / stories. Without it the screen reads the live unread store. */
  unreadByClient?: Readonly<Record<string, number>>;
  /** Stories: force the access-revoked state (the real signal is a `forbidden` read error). */
  revoked?: boolean;
  /** Stories / tests: where reschedule answers go (default: resolve at once, Propose another opens Schedule). */
  requestPort?: RescheduleRequestPort;
  /** Where "reads are logged" entries go (default: the local session log; the real one is a server call). */
  readLog?: ReadLogPort;
  now?: number;
}

/** Client 360 shell (S-03): header, tabs, locked / offline / revoked states. Overview is real; other tabs are next. */
export function Client360Screen({
  cid,
  tab: tabRaw,
  onNavigate,
  onOpenDecision,
  port,
  unreadByClient,
  revoked,
  requestPort,
  readLog,
  now: nowProp,
}: Client360Props) {
  const { r, locale } = useRosterT();
  const { c } = useC360T();
  const { d } = useDecisionsT();
  const { t: tt } = useTodayT();
  const desktop = useMinWidth(COACH_BREAKPOINT);
  const api = useCoachWorld(port);
  const live = useCoachUnreadState({ uid: unreadByClient ? null : undefined });
  const unread = (unreadByClient ?? live.byClient)[cid] ?? 0;
  const world = api.world;
  const now = nowProp ?? world?.now ?? 0;
  const tab = tabOf(tabRaw);

  const row = useMemo(() => world?.rows.find((x) => x.client.id === cid), [world, cid]);
  const client = row?.client;

  /* Reads are logged once per tab open, only for what this screen really reads under the client's consent.
     Workouts and Strength log inside their own tab (they know whether they drew data). */
  const shownCats: Category[] = (() => {
    if (!client || client.invite || (tab !== 'overview' && tab !== 'decisions')) return [];
    const ec = effectiveConsent(client.mode, client.consent);
    const want: Category[] = tab === 'overview' ? ['totals', 'sets', 'injury'] : ['sets'];
    return want.filter((k) => ec[k] !== 'off');
  })();
  useReadLog(readLog, cid, tab, shownCats, revoked === true || api.error === 'forbidden');
  // Security code of the trainer's own key: read out to this client (plan Part C.2 no. 5)
  const { sf } = useSafeT();
  const security = useSecurity(getTrainerUid(), cid);
  const [codeOpen, setCodeOpen] = useState(false);
  // End coaching: confirm (who stops seeing what), then the password (plan 2.7), then the callable.
  const { ask, dialog: reauthDialog } = useReauthGuard();
  const [ending, setEnding] = useState<'confirm' | 'failed' | null>(null);

  const back = (
    <BackButton
      label={r.roBack}
      text={r.roBack}
      onClick={() => onNavigate({ screen: 'clients' })}
    />
  );

  if (!world) {
    return (
      <Page>
        <div>{back}</div>
        {api.loading ? <SkeletonRows rows={5} label={r.c3Loading} /> : <WorldFailed api={api} />}
      </Page>
    );
  }

  if (!client || client.invite) {
    return (
      <Page>
        <div>{back}</div>
        <Card>
          <EmptyState
            titleAs="h2"
            icon="user-focus"
            title={r.stNoClientTitle}
            body={r.stNoClientBody}
          >
            <Button variant="primary" onClick={() => onNavigate({ screen: 'clients' })}>
              {r.stBackToClients}
            </Button>
          </EmptyState>
        </Card>
      </Page>
    );
  }

  const first = firstName(client.name);

  /* err-access-revoked: full frame, nothing of the client's data is read or drawn. */
  if (revoked || api.error === 'forbidden') {
    return (
      <Page>
        <div>{back}</div>
        <Header
          title={client.name}
          subtitle={
            <ClientAvatar id={client.id} name={client.name} hasPhoto={client.hasPhoto} size={22} />
          }
          slots={false}
        />
        <Card pad="lg" role="alert" className="c3-revoked">
          <EmptyState
            titleAs="h2"
            icon="lock-simple"
            title={r.stRevokedTitle(first)}
            body={r.stRevokedBody(first)}
          >
            <div className="c3-btns">
              <Button variant="primary" onClick={() => onNavigate({ screen: 'clients' })}>
                {r.stBackToClients}
              </Button>
              <Button
                variant="secondary"
                icon="key"
                onClick={() => onNavigate(chatRoute(client.id))}
              >
                {r.stAskAgain(first)}
              </Button>
            </div>
          </EmptyState>
        </Card>
      </Page>
    );
  }

  const idBase = `c360-${cid}`;
  const ids = tabIds(idBase, tab);
  const askN = askable(client.mode, client.consent).length;
  const spoken = unread > 0 ? r.c3MessageUnread(first, unread) : undefined;

  const items: ActionMenuItem[] = [
    {
      id: 'msg',
      label: r.c3MenuMessage(first),
      icon: 'envelope',
      onSelect: () => onNavigate(chatRoute(client.id)),
    },
    ...(askN > 0
      ? [
          {
            id: 'ask',
            label: r.c3MenuAsk(first),
            icon: 'key',
            onSelect: () => onNavigate(chatRoute(client.id)),
          },
        ]
      : []),
    {
      id: 'resched',
      label: r.c3MenuReschedule,
      icon: 'calendar-blank',
      onSelect: () => window.location.assign(scheduleHref({ form: 'pick', client: cid })),
    },
    {
      id: 'sched',
      label: r.c3MenuSchedule,
      icon: 'calendar-plus',
      onSelect: () => window.location.assign(scheduleHref({ form: 'plan', client: cid })),
    },
    {
      id: 'edit',
      label: r.c3MenuEdit,
      icon: 'pencil-simple',
      onSelect: () => onNavigate({ screen: 'programs' }),
    },
    {
      id: 'code',
      label: sf.scMenu,
      icon: 'shield-check',
      onSelect: () => setCodeOpen(true),
    },
    {
      id: 'end',
      label: sf.ecMenu(first),
      icon: 'sign-out',
      onSelect: () => setEnding('confirm'),
    },
  ];

  const sub = (
    <span className="c3-sub">
      <ClientAvatar id={client.id} name={client.name} hasPhoto={client.hasPhoto} size={22} />
      <span>
        {[client.goal, r.roProgramWeek(client.program, client.programWeek), client.gym]
          .filter((x) => x)
          .join(' · ')}
      </span>
    </span>
  );

  const actions = desktop ? (
    <>
      <Button
        variant="secondary"
        icon="calendar-plus"
        onClick={() => window.location.assign(scheduleHref({ form: 'plan', client: cid }))}
      >
        {r.c3Schedule}
      </Button>
      <Button
        variant="secondary"
        icon="envelope"
        aria-label={spoken ?? `${r.c3Message} ${first}`}
        onClick={() => onNavigate(chatRoute(client.id))}
      >
        {r.c3Message}
        {unread > 0 && <Badge n={unread} tone="danger" anchor="none" />}
      </Button>
      <ActionMenu label={r.c3MenuLabel} items={items} note={r.c3ReadsNamed(first)} />
    </>
  ) : (
    <>
      <IconButton
        icon="envelope"
        label={spoken ?? `${r.c3Message} ${first}`}
        badge={unread}
        onClick={() => onNavigate(chatRoute(client.id))}
      />
      <IconButton
        icon="calendar-plus"
        label={r.c3Schedule}
        onClick={() => window.location.assign(scheduleHref({ form: 'plan', client: cid }))}
      />
      <ActionMenu
        label={r.c3MenuLabel}
        items={items}
        note={r.c3ReadsNamed(first)}
        dot={unread > 0}
        dotLabel={r.c3MenuUnread(unread)}
      />
    </>
  );

  const tabs = CLIENT_TABS.map((id) => ({ id, label: r.c3Tabs[id] }));

  return (
    <Page>
      {codeOpen && (
        <SecurityCodeDialog
          security={security}
          side="trainer"
          name={first}
          onClose={() => setCodeOpen(false)}
        />
      )}
      {ending === 'confirm' && (
        <ConfirmEffectsDialog
          title={sf.ecTitle(first)}
          icon="sign-out"
          body={sf.ecBody}
          effects={[
            { icon: 'eye-slash', text: sf.ecEffectSee(first) },
            { icon: 'envelope', text: sf.ecEffectKeeps(first) },
            { icon: 'pencil-simple', text: sf.ecEffectNotes },
          ]}
          confirmLabel={sf.ecConfirm}
          cancelLabel={sf.raCancel}
          onCancel={() => setEnding(null)}
          onConfirm={() => {
            setEnding(null);
            void (async () => {
              if (!(await ask('end'))) return;
              if (await api.endCoaching(client.id)) onNavigate({ screen: 'clients' });
              else setEnding('failed');
            })();
          }}
        />
      )}
      {ending === 'failed' && (
        <Notice tone="danger" icon="warning-circle">
          {sf.ecFailed}
        </Notice>
      )}
      {reauthDialog}
      <DataStatusBar state={api} retry={api.retry} now={now} />
      <div>{back}</div>
      <Header title={client.name} subtitle={sub} actions={actions} slots={false} />
      <ScrollTabs
        tabs={tabs}
        value={tab}
        label={r.c3TabsLabel}
        idBase={idBase}
        onChange={(id) =>
          onNavigate(
            id === 'overview' ? { screen: 'client', cid } : { screen: 'client', cid, tab: id },
          )
        }
      />
      <div role="tabpanel" id={ids.panel} aria-labelledby={ids.tab} className="c3-panel">
        {tab === 'overview' ? (
          <Overview
            client={client}
            top={
              row?.topSignalKey
                ? world.signals.find((a) => a.signal.key === row.topSignalKey)?.signal
                : undefined
            }
            world={world}
            r={r}
            now={now}
            wide={desktop}
            requestPort={requestPort}
            onNavigate={onNavigate}
            onOpenDecision={onOpenDecision}
          />
        ) : tab === 'workouts' ? (
          <WorkoutsTab
            client={client}
            world={world}
            r={r}
            c={c}
            locale={locale}
            now={now}
            onNavigate={onNavigate}
            requestPort={requestPort}
            readLog={readLog}
          />
        ) : tab === 'strength' ? (
          <StrengthTab
            client={client}
            world={world}
            c={c}
            locale={locale}
            onNavigate={onNavigate}
            readLog={readLog}
          />
        ) : tab === 'decisions' ? (
          <DecisionsTab
            client={client}
            world={world}
            c={c}
            d={d}
            r={r}
            t={tt}
            locale={locale}
            now={now}
            onNavigate={onNavigate}
            onOpenDecision={onOpenDecision}
          />
        ) : tab === 'program' ? (
          <ProgramTab client={client} onNavigate={onNavigate} />
        ) : tab === 'notes' ? (
          <NotesPanel
            clientId={client.id}
            first={first}
            variant="page"
            now={now || undefined}
            onJump={(a) => {
              if (a.kind === 'message') onNavigate(chatRoute(client.id));
              else if (a.kind === 'decision') onNavigate({ screen: 'decisions' });
              else onNavigate({ screen: 'client', cid: client.id, tab: 'program' });
            }}
          />
        ) : (
          <Card>
            <EmptyState
              titleAs="h2"
              icon="hourglass"
              title={r.c3SoonH(r.c3Tabs[tab])}
              body={r.c3SoonBody}
            />
          </Card>
        )}
      </div>
    </Page>
  );
}
