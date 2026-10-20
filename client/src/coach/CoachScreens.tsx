import { Suspense, useRef, type ReactNode } from 'react';
import { SkeletonRows } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { useCoachT } from '../i18n/coach';
import { Header, Page } from './layout/Layout';
import { SCREEN_ICON, routeTitle } from './nav';
import type { CoachRoute } from './routes';
import { isChunkLoadError, lazyScreen, resetLazyScreens } from './lazyScreen';
import { coachHash, isProgramPage, programPageClient } from './routes';
import { writeParams } from './today/useTodayParams';

/** Roster, Signals and Client 360 (M1 UI): loaded on demand so the shell never waits for them. */
/** Today + Decision (M1 UI, TODAY agent). */
const TodayScreen = lazyScreen(() =>
  import('./today/TodayScreen').then((m) => ({ default: m.TodayScreen })),
);
const RosterScreen = lazyScreen(() =>
  import('./screens/RosterScreen').then((m) => ({ default: m.RosterScreen })),
);
const SignalsScreen = lazyScreen(() =>
  import('./screens/SignalsScreen').then((m) => ({ default: m.SignalsScreen })),
);
const DecisionsScreen = lazyScreen(() =>
  import('./screens/DecisionsScreen').then((m) => ({ default: m.DecisionsScreen })),
);
/** Chat (M4): list + thread, loaded on demand. */
const ChatScreen = lazyScreen(() =>
  import('./ChatWithExtras').then((m) => ({ default: m.ChatWithExtras })),
);
/** Program editor and Check before sending (M3): pages of one program, under `#/c/programs/<programId>/`. */
const EditorScreen = lazyScreen(() =>
  import('./program/EditorScreen').then((m) => ({ default: m.EditorScreen })),
);
const CheckScreen = lazyScreen(() =>
  import('./program/CheckScreen').then((m) => ({ default: m.CheckScreen })),
);
/** Schedule and Week (M6). */
const ScheduleScreen = lazyScreen(() =>
  import('./schedule/ScheduleScreen').then((m) => ({ default: m.ScheduleScreen })),
);
const WeekScreen = lazyScreen(() =>
  import('./schedule/WeekScreen').then((m) => ({ default: m.WeekScreen })),
);
/** Live (M8): who is training now, and one client's live page. */
const LiveScreen = lazyScreen(() =>
  import('./screens/live/LiveScreens').then((m) => ({ default: m.LiveScreen })),
);
const LiveClientScreen = lazyScreen(() =>
  import('./screens/live/LiveScreens').then((m) => ({ default: m.LiveClientScreen })),
);
/** Programs list (M8). */
const ProgramsScreen = lazyScreen(() =>
  import('./screens/programs/ProgramsScreen').then((m) => ({ default: m.ProgramsScreen })),
);
/** Team (SPO-196). */
const ManagerClientsScreen = lazyScreen(() =>
  import('./team/ManagerClientsScreen').then((m) => ({ default: m.ManagerClientsScreen })),
);
const TeamScreen = lazyScreen(() =>
  import('./team/TeamScreen').then((m) => ({ default: m.TeamScreen })),
);
const ActivityScreen = lazyScreen(() =>
  import('./team/ActivityScreen').then((m) => ({ default: m.ActivityScreen })),
);
const SpotterScreen = lazyScreen(() =>
  import('./team/SpotterScreen').then((m) => ({ default: m.SpotterScreen })),
);
const RolesScreen = lazyScreen(() =>
  import('./team/RolesScreen').then((m) => ({ default: m.RolesScreen })),
);
const Client360Screen = lazyScreen(() =>
  import('./screens/Client360Screen').then((m) => ({ default: m.Client360Screen })),
);

const Loading = () => (
  <Page>
    <SkeletonRows rows={6} />
  </Page>
);

/**
 * Placeholder pages (M0): title + the kit empty state, no data. Each real screen
 * replaces its branch in later milestones; the route table and the layout kit
 * stay as they are.
 */
export function CoachScreen({
  route,
  onNavigate,
  manager = false,
}: {
  route: CoachRoute;
  onNavigate: (r: CoachRoute) => void;
  /** a team manager: Clients is the team's list with schedule access, not a trainer's roster */
  manager?: boolean;
}) {
  const { c } = useCoachT();
  /** Roster / Signals / Client 360 open the Decision screen: Today's hash query carries the signal key. */
  const openDecision = (key: string) => {
    window.location.hash = writeParams('#/c/agenda', { decision: key });
  };
  if (route.screen === 'agenda')
    return (
      <Suspense fallback={<Loading />}>
        <TodayScreen onNavigate={onNavigate} />
      </Suspense>
    );
  if (route.screen === 'clients' && manager)
    return (
      <Suspense fallback={<Loading />}>
        <ManagerClientsScreen onNavigate={onNavigate} />
      </Suspense>
    );
  if (route.screen === 'clients')
    return (
      <Suspense fallback={<Loading />}>
        <RosterScreen onNavigate={onNavigate} />
      </Suspense>
    );
  if (route.screen === 'signals')
    return (
      <Suspense fallback={<Loading />}>
        <SignalsScreen onNavigate={onNavigate} onOpenDecision={openDecision} />
      </Suspense>
    );
  if (route.screen === 'decisions')
    return (
      <Suspense fallback={<Loading />}>
        <DecisionsScreen onNavigate={onNavigate} onOpenDecision={openDecision} />
      </Suspense>
    );
  if (route.screen === 'team')
    return (
      <Suspense fallback={<Loading />}>
        <TeamScreen onNavigate={onNavigate} />
      </Suspense>
    );
  if (route.screen === 'activity')
    return (
      <Suspense fallback={<Loading />}>
        <ActivityScreen onNavigate={onNavigate} />
      </Suspense>
    );
  if (route.screen === 'spotter')
    return (
      <Suspense fallback={<Loading />}>
        <SpotterScreen onNavigate={onNavigate} />
      </Suspense>
    );
  if (route.screen === 'roles')
    return (
      <Suspense fallback={<Loading />}>
        <RolesScreen onNavigate={onNavigate} />
      </Suspense>
    );
  if (route.screen === 'schedule')
    return (
      <Suspense fallback={<Loading />}>
        <ScheduleScreen onNavigate={onNavigate} />
      </Suspense>
    );
  if (route.screen === 'week')
    return (
      <Suspense fallback={<Loading />}>
        <WeekScreen onNavigate={onNavigate} />
      </Suspense>
    );
  if (route.screen === 'chat')
    return (
      <Suspense fallback={<Loading />}>
        <ChatScreen onNavigate={onNavigate} />
      </Suspense>
    );
  if (isProgramPage(route)) {
    const cid = programPageClient(route);
    const from = route.cid ? 'client' : 'list';
    return (
      <Suspense fallback={<Loading />}>
        {route.sub === 'check' ? (
          <CheckScreen cid={cid} from={from} onNavigate={onNavigate} />
        ) : (
          <EditorScreen cid={cid} from={from} onNavigate={onNavigate} />
        )}
      </Suspense>
    );
  }
  if (route.screen === 'programs')
    return (
      <Suspense fallback={<Loading />}>
        <ProgramsScreen onNavigate={onNavigate} />
      </Suspense>
    );
  if (route.screen === 'live')
    return (
      <Suspense fallback={<Loading />}>
        <LiveScreen onNavigate={onNavigate} />
      </Suspense>
    );
  if (route.screen === 'client' && route.tab === 'live')
    return (
      <Suspense fallback={<Loading />}>
        <LiveClientScreen cid={route.cid} onNavigate={onNavigate} />
      </Suspense>
    );
  if (route.screen === 'client')
    return (
      <Suspense fallback={<Loading />}>
        <Client360Screen
          cid={route.cid}
          tab={route.tab}
          onNavigate={onNavigate}
          onOpenDecision={openDecision}
        />
      </Suspense>
    );
  return (
    <Page>
      <Header eyebrow={c.modeCoach} title={routeTitle(c, route)} />
      <EmptyState
        titleAs="h2"
        centered
        icon={SCREEN_ICON[route.screen]}
        title={c.emptyTitle}
        body={c.emptyBody}
      />
    </Page>
  );
}

/**
 * The routed screen of the shell. A failing screen (a render error, a hook that throws, a code-split chunk that did not
 * load) shows a calm card with Retry INSIDE the page; the rail, tab bar and header stay. The route resets it.
 */
export function CoachScreenBoundary({
  route,
  children,
}: {
  route: CoachRoute;
  children: ReactNode;
}) {
  const { c } = useCoachT();
  const last = useRef<unknown>(null);
  return (
    <ErrorBoundary
      resetKey={coachHash(route)}
      title={c.screenFailedTitle}
      body={c.screenFailedBody}
      retryLabel={c.screenFailedRetry}
      icon="warning-circle"
      onError={(e) => {
        last.current = e;
      }}
      onRetry={() => {
        resetLazyScreens();
        // A chunk the browser already failed to fetch is not fetched again by the module system: a reload is the retry.
        if (isChunkLoadError(last.current)) window.location.reload();
      }}
    >
      <Suspense fallback={<Loading />}>{children}</Suspense>
    </ErrorBoundary>
  );
}
