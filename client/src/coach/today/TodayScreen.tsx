import { useCallback, useMemo, useState } from 'react';
import { HubSlot } from '../../components/HubSlot';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { ClientRow } from '../../components/ui/RosterRows';
import { Segmented } from '../../components/ui/Segmented';
import { COACH_BREAKPOINT, useMinWidth } from '../../components/ui/breakpoints';
import { coachEyebrow } from '../format';
import { ClientAvatar } from '../ClientAvatar';
import { useCoachT } from '../../i18n/coach';
import { useTodayT } from '../../i18n/coachToday';
import type { CoachWorldPort } from '../data/port';
import { useCoachWorld, type CoachWorldApi } from '../data/useCoachWorld';
import type { WorldStoreOptions } from '../data/worldStore';
import type { Option } from '../domain/diff';
import type { Signal } from '../domain/types';
import { Header, Page, Split, Toolbar } from '../layout/Layout';
import { chatRoute, type CoachRoute } from '../routes';
import { DecisionScreen } from './DecisionScreen';
import { WorldFailed, WorldNotices } from './WorldNotices';
import { SignalPreview } from './SignalPreview';
import { buildToday, clientOf, defaultOpenKey, findSignal } from './model';
import { firstName } from './names';
import type { RescheduleRequestPort } from './requestPort';
import { useScheduleRequestPort } from '../schedule/requestPort';
import { severityWord, signalText } from './signalCopy';
import { useTodayParams } from './useTodayParams';
import './Today.css';
import { RequestsSection, CardsSection } from './TodaySections';
import { TeamRequestsSection } from '../team/TeamRequestsSection';
import { StageView, TodayLoading } from './TodayStage';

export interface TodayScreenProps {
  onNavigate: (route: CoachRoute) => void;
  /** Injected for stories and tests; the app uses the configured world port. */
  port?: CoachWorldPort;
  worldOptions?: WorldStoreOptions;
  requestPort?: RescheduleRequestPort;
}

/** Agenda, formerly Today (`#/c/agenda`): by priority or by stage, and the Decision screen when `?decision=` is set. */
export function TodayScreen(props: TodayScreenProps) {
  const api = useCoachWorld(props.port, props.worldOptions);
  const params = useTodayParams();
  const schedulePort = useScheduleRequestPort();
  if (params.decision) {
    return <DecisionScreen api={api} params={params} onNavigate={props.onNavigate} />;
  }
  return (
    <TodayView
      api={api}
      params={params}
      onNavigate={props.onNavigate}
      requestPort={props.requestPort ?? schedulePort}
    />
  );
}

function TodayView({
  api,
  params,
  onNavigate,
  requestPort,
}: {
  api: CoachWorldApi;
  params: ReturnType<typeof useTodayParams>;
  onNavigate: (r: CoachRoute) => void;
  requestPort: RescheduleRequestPort;
}) {
  const { t, locale } = useTodayT();
  const { c } = useCoachT();
  const desktop = useMinWidth(COACH_BREAKPOINT);
  const world = api.world;
  const model = useMemo(() => (world ? buildToday(world) : null), [world]);
  const [digestOpen, setDigestOpen] = useState(false);

  const openKey = useMemo(() => {
    if (!world || !model) return null;
    const asked = params.open ? findSignal(world, params.open) : undefined;
    return asked && asked.state === 'open' ? asked.signal.key : defaultOpenKey(model);
  }, [world, model, params.open]);
  const selected = world && openKey ? (findSignal(world, openKey)?.signal ?? null) : null;

  const goDecision = useCallback(
    (s: Signal, optionId?: string) =>
      params.set({ decision: s.key, option: optionId ?? null, open: null }, true),
    [params],
  );
  const message = useCallback((clientId: string) => onNavigate(chatRoute(clientId)), [onNavigate]);
  const record = useCallback(
    (s: Signal, o: Option) => {
      const c = world ? clientOf(world, s.clientId) : undefined;
      const draft = c && c.mode !== 'program' ? t.opMessageDraft(firstName(c.name), s.kind) : '';
      api.recordDecision(s, o, draft);
      params.set({ decision: s.key, option: o.id, open: null }, true);
    },
    [api, params, t, world],
  );

  // Nothing to show and the load failed: the lab shows the header and the error card only.
  const loadFailed = (!world || !model) && (api.status === 'error' || api.status === 'offline');
  const [mountedAt] = useState(() => Date.now());
  const subtitle = !model
    ? loadFailed
      ? ''
      : t.queueLoading
    : [
        t.needDecision(model.needCount),
        model.requestCount ? t.requestsToAnswer(model.requestCount) : '',
      ]
        .filter(Boolean)
        .join(', ');
  const now = world?.now ?? mountedAt;
  const eyebrow = coachEyebrow(now, locale);

  return (
    <Page className="td">
      <WorldNotices api={api} />
      <Header eyebrow={eyebrow} title={t.queueTitle} subtitle={subtitle} />
      <HubSlot surface="coachAgenda" />
      {!loadFailed && (
        <Toolbar className="td-toolbar">
          <Segmented
            label={t.viewLabel}
            value={params.view}
            onChange={(v) => params.set({ view: v, open: null })}
            options={[
              { value: 'priority', label: t.byPriority },
              { value: 'stage', label: t.byStage },
            ]}
            hug={desktop}
            fill={!desktop}
          />
          <div className="td-pills">
            <Button
              variant="secondary"
              icon="pulse"
              onClick={() => onNavigate({ screen: 'signals' })}
            >
              {t.allSignals}
            </Button>
            <Button
              variant="secondary"
              icon="list-checks"
              onClick={() => onNavigate({ screen: 'decisions' })}
            >
              {t.allDecisions}
            </Button>
          </div>
        </Toolbar>
      )}

      {!world || !model ? (
        api.status === 'error' || api.status === 'offline' ? (
          <WorldFailed api={api} />
        ) : (
          <TodayLoading desktop={desktop} />
        )
      ) : model.mode === 'week-briefs' && model.requests.length === 0 ? (
        <Card pad="lg">
          <EmptyState
            titleAs="h2"
            icon="calendar-dots"
            title={t.weekBriefsTitle}
            body={t.weekBriefsBody}
          >
            <Button variant="secondary" onClick={() => onNavigate({ screen: 'week' })}>
              {c.navWeek}
            </Button>
          </EmptyState>
        </Card>
      ) : params.view === 'stage' ? (
        <StageView
          world={world}
          openKey={params.open}
          onOpenKey={(k) => params.set({ open: k })}
          onNavigate={onNavigate}
          onRecord={record}
          onOpenDecision={goDecision}
          onMessage={message}
          desktop={desktop}
        />
      ) : (
        <Split ratio="5-7">
          <div className="td-list">
            <TeamRequestsSection />
            <RequestsSection requests={model.requests} port={requestPort} locale={locale} />
            {model.allClear ? (
              <Card pad="lg" className="td-clear">
                <EmptyState
                  titleAs="h2"
                  icon="check-circle"
                  title={t.allClearTitle}
                  body={t.allClearBody(model.requestCount, model.measuring, 14)}
                >
                  <div className="td-clear-acts">
                    <Button variant="secondary" onClick={() => params.set({ view: 'stage' })}>
                      {t.seeBoard}
                    </Button>
                    <Button
                      variant="link"
                      iconTrailing="arrow-right"
                      onClick={() => onNavigate({ screen: 'decisions' })}
                    >
                      {t.allDecisions}
                    </Button>
                  </div>
                </EmptyState>
              </Card>
            ) : (
              <>
                {model.needs.length > 0 && (
                  <CardsSection
                    id="needs"
                    label={t.sectionNeeds}
                    cards={model.needs}
                    world={world}
                    openKey={openKey}
                    inline={!desktop}
                    onSelect={(k) => params.set({ open: k })}
                    onRecord={record}
                    onOpenDecision={goDecision}
                    onMessage={message}
                  />
                )}
                {model.watch.length > 0 && (
                  <CardsSection
                    id="watch"
                    label={t.sectionWatch}
                    cards={model.watch}
                    world={world}
                    openKey={openKey}
                    inline={!desktop}
                    onSelect={(k) => params.set({ open: k })}
                    onRecord={record}
                    onOpenDecision={goDecision}
                    onMessage={message}
                  />
                )}
              </>
            )}
            {model.digest.length > 0 && (
              <div className="td-digest">
                <Button
                  variant="link"
                  iconTrailing={digestOpen ? 'caret-up' : 'caret-down'}
                  aria-expanded={digestOpen}
                  onClick={() => setDigestOpen((o) => !o)}
                >
                  {t.moreInDigest(model.digest.length)}
                </Button>
                <p className="td-note">{t.digestNote}</p>
                {digestOpen && (
                  <ul className="td-rows">
                    {model.digest.map((s) => {
                      const c = clientOf(world, s.clientId);
                      return (
                        <li key={s.key}>
                          <ClientRow
                            name={c?.name ?? ''}
                            avatar={
                              <ClientAvatar
                                id={c?.id}
                                name={c?.name ?? ''}
                                hasPhoto={c?.hasPhoto}
                                size={40}
                              />
                            }
                            program={signalText(t, s).title}
                            selected={desktop && openKey === s.key}
                            status={s.severity}
                            statusLabel={severityWord(t, s.severity)}
                            onClick={() => (desktop ? params.set({ open: s.key }) : goDecision(s))}
                          />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
          {desktop && selected && !model.allClear && (
            <div className="td-detail">
              <SignalPreview
                world={world}
                signal={selected}
                onRecord={record}
                onOpenDecision={goDecision}
                onMessage={message}
              />
            </div>
          )}
        </Split>
      )}
    </Page>
  );
}
