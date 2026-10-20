/**
 * Coach shell (M0): rail 88 / 60, phone tab bar, frame, mode switch.
 *
 *   >= 1280  labelled rail (88)      768..1279  icon rail (60)      < 768  tab bar
 *
 * Runs behind the `coach` flag for role trainer or admin (App.tsx decides; see
 * access.ts). Screens are placeholders until their milestones. The shell is
 * pure UI: it renders from props and local state and never waits on the server.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { SpotterMark } from '../brand/SpotterMark';
import { SuiteRailFoot } from '../components/suite/SuiteRailFoot';
import { SUITE_TONE } from '../components/suite/suiteTone';
import { useSuiteAccount, type SuiteMode } from '../components/suite/useSuiteAccount';
import { MoreMenu, type MoreMenuItem } from '../components/ui/MoreMenu';
import { Rail } from '../components/ui/Rail';
import type { RailEntry } from '../components/ui/railOverflow';
import { SkeletonRows } from '../components/ui/Skeleton';
import { TabBar } from '../components/ui/TabBar';
import { COACH_BREAKPOINT, COACH_WIDE_BREAKPOINT, useMinWidth } from '../components/ui/breakpoints';
import { useT } from '../i18n';
import { useCoachT } from '../i18n/coach';
import { useRosterT } from '../i18n/coachRoster';
import { BrandBar, BellButton } from '../components/ui/BrandBar';
import { OPEN_MORE_EVENT } from '../components/suite/openMore';
import { BrandAccount } from '../components/suite/BrandAccount';
import { CoachChromeProvider, type CoachChrome } from './layout/chrome';
import { Page } from './layout/Layout';
import { CoachScreen, CoachScreenBoundary } from './CoachScreens';
import { SCREEN_ICON, screenLabel } from './nav';
import { teamEnabled } from './team/useTeam';
import {
  MORE_SCREENS,
  RAIL_SCREENS,
  TAB_SCREENS,
  navScreenOf,
  type CoachRoute,
  type CoachScreen as ScreenId,
} from './routes';
import { currentUid } from '../api';
import { coachIsUnconfigured, useCoachBackendStatus } from './data/backend';
import { CoachBackendFailed, NotConfigured } from './BackendNotice';
import { ChatDock } from './chat/ChatDock';
import { useLiveWidget } from './screens/live/useLiveWidget';
import { useCoachRoute } from './useCoachRoute';
import { useCoachUnread } from './unread';
import './CoachApp.css';

export interface CoachShellProps {
  role: 'trainer' | 'admin';
  /** Display name for the account block. */
  name: string;
  /** Signed-in user id: the real avatar (photo from storage, initials fallback) is looked up by it. */
  userId?: string;
  route: CoachRoute;
  onNavigate: (route: CoachRoute) => void;
  /** "My workouts": leave the dashboard for the person's own athlete app. */
  onExitToWorkouts: () => void;
  onOpenProfile?: () => void;
  /** Opens the suite launcher (Gym / Apex / People / Nutrition / Learn / Coach). */
  onOpenShell: () => void;
}

type TabId = ScreenId | 'more';

/** The shell with the route passed in (stories, tests). */
export function CoachShell({
  role,
  name,
  userId,
  route,
  onNavigate,
  onExitToWorkouts,
  onOpenProfile,
  onOpenShell,
}: CoachShellProps) {
  const { c } = useCoachT();
  const { t } = useT();
  const desktop = useMinWidth(COACH_BREAKPOINT);
  const wide = useMinWidth(COACH_WIDE_BREAKPOINT);
  const unread = useCoachUnread();
  const active = navScreenOf(route);
  // A phone thread is the whole screen (like every other chat): the app header stays (like every app), no page title, no bottom navigation.
  const threadOpen = !desktop && route.screen === 'chat' && 'with' in route && !!route.with;
  const mainRef = useRef<HTMLElement>(null);
  // Phone: the More tab opens a bottom sheet. Desktop: the rail collapses its trailing entries
  // into its own More item when too short (Rail `overflow`); the avatar opens ONLY the account.
  const [moreOpen, setMoreOpen] = useState(false);
  const { account, dialog } = useSuiteAccount({
    app: 'coach',
    identity: { name, userId, role },
    onOpenGym: onExitToWorkouts,
    onOpenProfile,
  });

  useEffect(() => {
    const on = () => setMoreOpen(true);
    window.addEventListener(OPEN_MORE_EVENT, on);
    return () => window.removeEventListener(OPEN_MORE_EVENT, on);
  }, []);

  // Tourmaline accent on the document root while Coach is open, so portaled sheets, popovers
  // and the app launcher re-skin with the shell (same as .theme-apex / .theme-nutrition).
  useEffect(() => {
    const el = document.documentElement;
    el.classList.add('theme-coach');
    return () => el.classList.remove('theme-coach');
  }, []);

  // Header slots (live pill, search, bell, avatar): what sits at the right edge of every page header.
  const { r } = useRosterT();
  const liveWidget = useLiveWidget(onNavigate);
  const chrome = useMemo<CoachChrome>(
    () => ({
      desktop,
      searchLabel: r.roSearch,
      onSearch: () => {
        onNavigate({ screen: 'clients' });
        window.setTimeout(() => {
          document
            .querySelector<HTMLInputElement>(
              '.co-main input[type="search"], .co-main input[role="searchbox"]',
            )
            ?.focus();
        }, 60);
      },
      bellLabel: c.railNotifications,
      bellCount: unread,
      onBell: () => onNavigate({ screen: 'chat' }),
      live: liveWidget,
    }),
    // onNavigate identity changes with the route hook; the chrome only needs the latest
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [desktop, r, c, unread, liveWidget],
  );

  const go = (screen: ScreenId) => {
    setMoreOpen(false);
    onNavigate({ screen });
  };

  const entryOf = (s: ScreenId): MoreMenuItem => ({
    id: s,
    label: screenLabel(c, s),
    icon: SCREEN_ICON[s],
    active: active === s,
    onSelect: () => go(s),
  });
  // Phone More sheet: every secondary destination, then Apps (last, via the `apps` row).
  const teamOn = teamEnabled();
  const moreScreens: readonly ScreenId[] = teamOn
    ? [...(MORE_SCREENS as readonly ScreenId[]), 'team']
    : (MORE_SCREENS as readonly ScreenId[]);
  const moreItems: MoreMenuItem[] = moreScreens.map(entryOf);
  // Desktop rail nav: exactly the seven design items. When the rail is too short the trailing
  // ones collapse into More (Rail `overflow`); Apps is NOT among them: it is pinned in the foot.
  // Live and Signals are not rail items (phone More sheet only until the foot widgets land).
  const railScreens: readonly ScreenId[] = teamOn
    ? [...(RAIL_SCREENS as readonly ScreenId[]), 'team']
    : (RAIL_SCREENS as readonly ScreenId[]);
  const railEntries: RailEntry[] = railScreens.map((s) => ({
    ...entryOf(s),
    ...(s === 'chat' ? { count: unread, countLabel: c.unread(unread) } : {}),
  }));
  const chatLabel = unread > 0 ? c.navWithUnread(c.navChat, unread) : undefined;
  const tabs = [
    ...TAB_SCREENS.map((s) => ({
      id: s as TabId,
      label: screenLabel(c, s),
      icon: SCREEN_ICON[s],
      active: active === s,
      ...(s === 'chat' ? { badge: unread, ariaLabel: chatLabel } : {}),
    })),
    {
      id: 'more' as TabId,
      label: c.navMore,
      icon: 'dots-three',
      active: moreOpen || (moreScreens as readonly string[]).includes(active),
    },
  ];

  return (
    <div className={`app-coach co-shell apex-app`}>
      <nav className="co-skip-nav" aria-label={c.skipToContent}>
        <a
          className="co-skip"
          href="#co-main"
          onClick={(e) => {
            e.preventDefault();
            mainRef.current?.focus();
          }}
        >
          {c.skipToContent}
        </a>
      </nav>

      {desktop && (
        <Rail
          brand={<SpotterMark size={40} variant="sidebar" />}
          labelled={wide}
          compact={!wide}
          breakpoint="coach"
          ariaLabel={c.navLandmark}
          overflow={{
            entries: railEntries,
            moreLabel: c.navMore,
            renderMenu: ({ hidden, open, onClose, anchorRef }) => (
              <MoreMenu
                presentation="popover"
                open={open}
                onClose={onClose}
                anchorRef={anchorRef}
                title={c.navMore}
                items={hidden}
              />
            ),
          }}
          foot={
            <SuiteRailFoot
              app="coach"
              identity={{ name, userId, role }}
              onOpenGym={onExitToWorkouts}
              onOpenProfile={onOpenProfile}
              onOpenShell={onOpenShell}
            />
          }
        />
      )}

      {!desktop && (
        <BrandBar
          header
          app={c.modeCoach}
          onApp={onOpenShell}
          appLabel={t.shellSwitch}
          actions={
            <BellButton
              label={c.railNotifications}
              count={unread}
              onClick={() => onNavigate({ screen: 'chat' })}
            />
          }
          avatar={<BrandAccount app="coach" identity={{ name, userId, role }} />}
        />
      )}

      <main id="co-main" ref={mainRef} tabIndex={-1} className="co-main">
        <CoachChromeProvider value={chrome}>
          <CoachScreenBoundary route={route}>
            <CoachScreen route={route} onNavigate={onNavigate} />
          </CoachScreenBoundary>
        </CoachChromeProvider>
      </main>

      {wide && route.screen !== 'chat' && <ChatDock unread={unread} onNavigate={onNavigate} />}

      {!desktop && !threadOpen && (
        <TabBar<TabId>
          breakpoint="coach"
          items={tabs}
          onSelect={(id) => (id === 'more' ? setMoreOpen(true) : go(id))}
        />
      )}

      {!desktop && (
        <MoreMenu<SuiteMode>
          presentation="sheet"
          tone={SUITE_TONE.coach}
          open={moreOpen}
          onClose={() => setMoreOpen(false)}
          title={c.navMore}
          items={moreItems}
          apps={{ label: c.navApps, onOpen: onOpenShell }}
          account={account}
        />
      )}
      {!desktop && dialog}
    </div>
  );
}

/** The shell wired to the URL hash (`#/c/...`), as App.tsx mounts it. */
export function CoachApp(props: Omit<CoachShellProps, 'route' | 'onNavigate'>) {
  const [route, navigate] = useCoachRoute();
  // Real backend (production, or VITE_COACH_BACKEND=firestore in dev): the adapters are installed before any screen reads a port.
  const { status, retry, problem } = useCoachBackendStatus('trainer', true, {
    id: props.userId ?? currentUid(),
    name: props.name,
  });
  const ready = status === 'ready';
  // A production build with no backend configured: say so, render no client data (never the sample fixtures).
  if (coachIsUnconfigured())
    return (
      <div className="app-coach co-shell apex-app">
        <main className="co-main" id="co-main">
          <NotConfigured onBack={props.onExitToWorkouts} />
        </main>
      </div>
    );
  // The real backend could not be installed: an error with Retry, never the sample clients.
  if (status === 'failed')
    return (
      <div className="app-coach co-shell apex-app">
        <main className="co-main" id="co-main">
          <CoachBackendFailed
            onRetry={retry}
            onBack={props.onExitToWorkouts}
            problem={problem ?? 'unknown'}
          />
        </main>
      </div>
    );
  // Never a blank page while the real backend installs its adapters (milliseconds, no network): a quiet skeleton.
  if (!ready)
    return (
      <div className="app-coach co-shell apex-app">
        <main className="co-main" aria-busy="true">
          <Page>
            <SkeletonRows rows={6} />
          </Page>
        </main>
      </div>
    );
  return <CoachShell {...props} route={route} onNavigate={navigate} />;
}
