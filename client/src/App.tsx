import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { collection, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import {
  getRole,
  getUsername,
  currentUid,
  onAuthChange,
  watchRoleClaim,
  signOut as apiSignOut,
} from './api';
import { db } from './firebase';
import {
  getOpenWorkout,
  startSyncLoop,
  useStore,
  retrySync,
  discardBlockingChange,
  bodyMetricsComplete,
} from './store';
import { SpotterMark } from './brand/SpotterMark';
import { useT } from './i18n';
import {
  Icon,
  LanguageSelector,
  Snackbar,
  Toast,
  UpdatePlate,
  ScreenSkeleton,
  type SnackState,
  type ToastState,
} from './ui';
import { isUpdateReady, subscribeUpdateReady } from './pwaUpdate';
import { AuthView } from './views/AuthView';
import { Avatar } from './components/Avatar';
import { LiveHero } from './components/LiveHero';
import type { SyncError, Notice } from './types';
import type { MuscleGroup } from './data/exercises';
import type { ProgramsPeer } from './components/ProgramsTabs';

const OnboardingView = lazy(() =>
  import('./views/OnboardingView').then((module) => ({ default: module.OnboardingView })),
);
const ProfileCompletionGate = lazy(() =>
  import('./components/BodyMetrics').then((module) => ({ default: module.ProfileCompletionGate })),
);
const AdminView = lazy(() =>
  import('./views/AdminView').then((module) => ({ default: module.AdminView })),
);
const TrainerView = lazy(() =>
  import('./views/TrainerView').then((module) => ({ default: module.TrainerView })),
);
const TodayView = lazy(() =>
  import('./views/TodayView').then((module) => ({ default: module.TodayView })),
);
const ProgressView = lazy(() =>
  import('./views/ProgressView').then((module) => ({ default: module.ProgressView })),
);
const GymsView = lazy(() =>
  import('./views/GymsView').then((module) => ({ default: module.GymsView })),
);
const SessionView = lazy(() =>
  import('./views/SessionView').then((module) => ({ default: module.SessionView })),
);
const ActivityView = lazy(() =>
  import('./views/ActivityView').then((module) => ({ default: module.ActivityView })),
);
const ExerciseHistoryView = lazy(() =>
  import('./views/ExerciseHistoryView').then((module) => ({
    default: module.ExerciseHistoryView,
  })),
);
const MuscleHistoryView = lazy(() =>
  import('./views/MuscleHistoryView').then((module) => ({
    default: module.MuscleHistoryView,
  })),
);
const ExerciseLibraryView = lazy(() =>
  import('./views/ExerciseLibraryView').then((module) => ({
    default: module.ExerciseLibraryView,
  })),
);
const ExerciseDetailView = lazy(() =>
  import('./views/ExerciseDetailView').then((module) => ({
    default: module.ExerciseDetailView,
  })),
);
const SettingsView = lazy(() =>
  import('./views/SettingsView').then((module) => ({
    default: module.SettingsView,
  })),
);
const PlaybookView = lazy(() =>
  import('./views/PlaybookView').then((module) => ({
    default: module.PlaybookView,
  })),
);
const HistoryListView = lazy(() =>
  import('./views/HistoryListView').then((module) => ({
    default: module.HistoryListView,
  })),
);
const GymDetailView = lazy(() =>
  import('./views/GymDetailView').then((module) => ({ default: module.GymDetailView })),
);
const ProfileView = lazy(() =>
  import('./views/ProfileView').then((module) => ({ default: module.ProfileView })),
);
const ProgramsView = lazy(() =>
  import('./views/ProgramsView').then((module) => ({ default: module.ProgramsView })),
);

export type Tab = 'today' | 'progress' | 'gyms' | 'programs' | 'people' | 'me';

export type Overlay =
  | { screen: 'session'; workoutId: string }
  | { screen: 'activity'; newType?: string }
  | { screen: 'past-workout'; workoutId: string; startAdd?: boolean }
  | { screen: 'exercise-history'; name: string }
  | { screen: 'exercise-detail'; name: string }
  | { screen: 'muscle-history'; muscle: MuscleGroup }
  | { screen: 'settings' }
  | { screen: 'history' }
  | { screen: 'profile'; userId: string }
  | { screen: 'gym'; gymId?: string; name?: string; lat?: number; lng?: number; address?: string }
  | { screen: 'library'; libTab?: 'mine' }
  | null;

export interface Shell {
  openOverlay: (o: Overlay) => void;
  goTab: (t: Tab) => void;
  goPlaybook: () => void;
  toast: (t: ToastState) => void;
  snack: (s: SnackState) => void;
  signOut: () => void;
  queueLength: number;
}

const TABS: Tab[] = ['today', 'progress', 'gyms', 'programs', 'people', 'me'];
type NavRole = ReturnType<typeof getRole>;
type NavLabels = Pick<
  ReturnType<typeof useT>['t'],
  'today' | 'progress' | 'gyms' | 'progTitle' | 'adminPeople' | 'trClientsTab' | 'navMe'
>;
type NavItem = { id: Tab; icon: string; label: string };
const EDGE_BACK_START_PX = 28;
const EDGE_BACK_LOCK_PX = 18;
const EDGE_BACK_TRIGGER_PX = 72;
const EDGE_BACK_MAX_VERTICAL_PX = 52;
const EDGE_BACK_DOMINANCE = 1.8;
const EDGE_BACK_EXCLUDE_SELECTOR = [
  'a',
  'button',
  'input',
  'select',
  'textarea',
  '[contenteditable="true"]',
  '[role="button"]',
  '[data-no-edge-swipe]',
  '.tabbar',
  '.rail',
  '.sheet',
  '.scrim',
  '.dialog-scrim',
  '.exd-lightbox',
  '.toast-holder',
].join(',');

function defaultTab(): Tab {
  return 'today';
}

function tabsForRole(role: NavRole, t: NavLabels): NavItem[] {
  if (role === 'trainer') {
    return [
      { id: 'today', icon: 'house', label: t.today },
      { id: 'progress', icon: 'chart-line-up', label: t.progress },
      { id: 'programs', icon: 'list-checks', label: t.progTitle },
      { id: 'gyms', icon: 'map-pin', label: t.gyms },
      { id: 'people', icon: 'user-focus', label: t.trClientsTab },
    ];
  }

  return [
    { id: 'today', icon: 'house', label: t.today },
    { id: 'progress', icon: 'chart-line-up', label: t.progress },
    { id: 'programs', icon: 'list-checks', label: t.progTitle },
    { id: 'gyms', icon: 'map-pin', label: t.gyms },
    role === 'admin'
      ? { id: 'people', icon: 'shield-check', label: t.adminPeople }
      : { id: 'me', icon: 'user', label: t.navMe },
  ];
}

/** Serialize the current screen to a URL hash so a refresh restores it. */
function toHash(
  tab: Tab,
  overlay: Overlay,
  programsPeer: ProgramsPeer,
  libMine: boolean,
  progressSub: 'progress' | 'trends' | 'feats',
  featSub: 'achievements' | 'standards',
  progressSeg: ProgSeg,
  volumeLens: VolLens,
): string {
  if (!overlay && tab === 'programs') {
    if (programsPeer === 'exercises') return libMine ? '#/exercises/mine' : '#/exercises';
    if (programsPeer === 'playbook') return '#/playbook';
  }
  if (!overlay && tab === 'progress') {
    if (progressSub === 'trends') return '#/trends';
    if (progressSub === 'feats') return featSub === 'standards' ? '#/feats/standards' : '#/feats';
    if (progressSeg === 'muscle') return '#/progress/muscle';
    if (progressSeg === 'records') return '#/progress/records';
    if (progressSeg === 'volume')
      return volumeLens === 'volume' ? '#/progress/volume' : `#/progress/volume/${volumeLens}`;
    return '#/progress';
  }
  if (overlay?.screen === 'session') return '#/session';
  if (overlay?.screen === 'activity') return '#/activity';
  if (overlay?.screen === 'past-workout') return `#/workout/${overlay.workoutId}`;
  if (overlay?.screen === 'exercise-history')
    return `#/exercise/${encodeURIComponent(overlay.name)}`;
  if (overlay?.screen === 'exercise-detail')
    return `#/exercise-detail/${encodeURIComponent(overlay.name)}`;
  if (overlay?.screen === 'muscle-history') return `#/muscle/${encodeURIComponent(overlay.muscle)}`;
  if (overlay?.screen === 'profile') return `#/profile/${encodeURIComponent(overlay.userId)}`;
  if (overlay?.screen === 'gym') return overlay.gymId ? `#/gym/${overlay.gymId}` : '#/gym';
  if (overlay?.screen === 'library')
    return overlay.libTab === 'mine' ? '#/exercises/mine' : '#/exercises';
  if (overlay?.screen === 'settings') return '#/settings';
  if (overlay?.screen === 'history') return '#/history';
  if (tab === 'me') return '#/me';
  return `#/${tab}`;
}

/** Parse a URL hash back into {tab, overlay}. Unknown → Today. */
function fromHash(hash: string): { tab: Tab; overlay: Overlay } {
  const parts = hash.replace(/^#\/?/, '').split('/');
  const head = parts[0] ?? '';
  if (head === 'session') return { tab: 'today', overlay: { screen: 'session', workoutId: '' } };
  if (head === 'activity') return { tab: 'today', overlay: { screen: 'activity' } };
  if (head === 'workout' && parts[1])
    return { tab: 'today', overlay: { screen: 'past-workout', workoutId: parts[1] } };
  if (head === 'exercise' && parts[1])
    return {
      tab: 'today',
      overlay: { screen: 'exercise-history', name: decodeURIComponent(parts[1]) },
    };
  if (head === 'exercise-detail' && parts[1])
    return {
      tab: 'programs',
      overlay: { screen: 'exercise-detail', name: decodeURIComponent(parts[1]) },
    };
  if (head === 'muscle' && parts[1])
    return {
      tab: 'progress',
      overlay: { screen: 'muscle-history', muscle: decodeURIComponent(parts[1]) as MuscleGroup },
    };
  if (head === 'profile' && parts[1])
    return { tab: 'today', overlay: { screen: 'profile', userId: decodeURIComponent(parts[1]) } };
  if (head === 'me') return { tab: 'me', overlay: null };
  // Playbook and Exercises are peer tabs of Programs, not overlays (AC-LIBTAB):
  // route them to the programs tab; which peer is active is read separately via
  // `peerFromHash` so a refresh on #/playbook or #/exercises lands there.
  if (head === 'exercises' || head === 'playbook' || head === 'templates')
    return { tab: 'programs', overlay: null };
  // Progress sub-tabs are peer URLs of #/progress (read separately below).
  if (head === 'trends' || head === 'feats') return { tab: 'progress', overlay: null };
  if (head === 'settings') return { tab: 'today', overlay: { screen: 'settings' } };
  if (head === 'history') return { tab: 'today', overlay: { screen: 'history' } };
  if (head === 'gym' && parts[1])
    return { tab: 'gyms', overlay: { screen: 'gym', gymId: parts[1] } };
  if (head === 'gym') return { tab: 'gyms', overlay: { screen: 'gym' } };
  if ((TABS as string[]).includes(head)) return { tab: head as Tab, overlay: null };
  return { tab: 'today', overlay: null };
}

/** Read the Exercises peer-tab state from the hash (#/exercises[/mine]). Kept
 *  separate from fromHash so it can be applied without threading it through the
 *  overlay stack. */
function peerFromHash(hash: string): { peer: ProgramsPeer; mine: boolean } {
  const parts = hash.replace(/^#\/?/, '').split('/');
  if (parts[0] === 'exercises') return { peer: 'exercises', mine: parts[1] === 'mine' };
  if (parts[0] === 'playbook' || parts[0] === 'templates') return { peer: 'playbook', mine: false };
  return { peer: 'programs', mine: false };
}

export type ProgSeg = 'total' | 'muscle' | 'volume' | 'records';
export type VolLens = 'volume' | 'fatigue' | 'readiness';

/** Read the Progress sub-tab + volume seg/lens from the hash:
 *  #/trends, #/feats[/standards], #/progress[/muscle|/volume[/fatigue|/readiness]|/records]. */
function progressFromHash(hash: string): {
  sub: 'progress' | 'trends' | 'feats';
  featSub: 'achievements' | 'standards';
  seg: ProgSeg;
  lens: VolLens;
} {
  const parts = hash.replace(/^#\/?/, '').split('/');
  const base = { seg: 'total' as ProgSeg, lens: 'volume' as VolLens };
  if (parts[0] === 'trends') return { sub: 'trends', featSub: 'achievements', ...base };
  if (parts[0] === 'feats')
    return {
      sub: 'feats',
      featSub: parts[1] === 'standards' ? 'standards' : 'achievements',
      ...base,
    };
  if (parts[0] === 'progress') {
    const seg: ProgSeg = (['muscle', 'volume', 'records'] as string[]).includes(parts[1])
      ? (parts[1] as ProgSeg)
      : 'total';
    const lens: VolLens =
      seg === 'volume' && (parts[2] === 'fatigue' || parts[2] === 'readiness')
        ? (parts[2] as VolLens)
        : 'volume';
    return { sub: 'progress', featSub: 'achievements', seg, lens };
  }
  return { sub: 'progress', featSub: 'achievements', ...base };
}

export function App() {
  const { t } = useT();
  const store = useStore();
  const [authed, setAuthed] = useState<boolean>(() => !!currentUid());
  const [notices, setNotices] = useState<Notice[]>([]);

  // Firebase restores the session asynchronously; track it and keep the cached
  // role claim fresh.
  useEffect(() => {
    const unsubRole = watchRoleClaim();
    const unsub = onAuthChange((user) => setAuthed(!!user));
    return () => {
      unsub();
      unsubRole();
    };
  }, []);

  // Notices: a live listener on the user's own notices subcollection.
  useEffect(() => {
    if (!authed) return;
    const uid = currentUid();
    if (!uid) return;
    return onSnapshot(
      collection(db, 'users', uid, 'notices'),
      (snap) => {
        const list = snap.docs
          .map((d) => {
            const n = d.data() as {
              kind: string;
              actor: string | null;
              detail: string | null;
              createdAt: number;
              readAt: number | null;
            };
            return {
              id: d.id,
              kind: n.kind,
              actor: n.actor ?? null,
              detail: n.detail ?? null,
              createdAt: n.createdAt,
              read: n.readAt != null,
            };
          })
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(0, 50);
        setNotices(list);
      },
      () => {},
    );
  }, [authed]);

  function dismissNotice(id: string) {
    setNotices((ns) => ns.map((n) => (n.id === id ? { ...n, read: true } : n)));
    const uid = currentUid();
    if (uid)
      updateDoc(doc(db, 'users', uid, 'notices', id), { readAt: Date.now() }).catch(() => {});
  }
  // Invite links (#/join/<token>) open onboarding before any auth gate.
  const [joinToken, setJoinToken] = useState<string | null>(() => {
    const m = /^#\/join\/([A-Za-z0-9-]+)/.exec(window.location.hash);
    return m ? m[1] : null;
  });
  const [tab, setTab] = useState<Tab>(() => fromHash(window.location.hash).tab);
  // Programs ↔ Exercises peer-tab lives in App (not ProgramsView) so it survives
  // opening an exercise-detail overlay, which unmounts the tab content.
  const [programsPeer, setProgramsPeer] = useState<ProgramsPeer>(
    () => peerFromHash(window.location.hash).peer,
  );
  const [libMine, setLibMine] = useState<boolean>(() => peerFromHash(window.location.hash).mine);
  // Progress sub-tabs (Progress · Trends · Feats) + the Feats sub-tab, kept in
  // App so each has its own URL (#/trends, #/feats, #/feats/standards).
  const [progressSub, setProgressSub] = useState<'progress' | 'trends' | 'feats'>(
    () => progressFromHash(window.location.hash).sub,
  );
  const [featSub, setFeatSub] = useState<'achievements' | 'standards'>(
    () => progressFromHash(window.location.hash).featSub,
  );
  // Progress volume seg + lens live here too, so #/progress/volume/readiness
  // survives a refresh and deep links land on the right lens.
  const [progressSeg, setProgressSeg] = useState<ProgSeg>(
    () => progressFromHash(window.location.hash).seg,
  );
  const [volumeLens, setVolumeLens] = useState<VolLens>(
    () => progressFromHash(window.location.hash).lens,
  );
  // Overlay navigation keeps a stack of parents: the back button on an overlay
  // returns to the screen it was opened from (session → exercise history →
  // back lands on the session again), never blindly through browser history.
  const [overlayNav, setOverlayNav] = useState<{ cur: Overlay; stack: Overlay[] }>(() => {
    const o = fromHash(window.location.hash).overlay;
    if (o?.screen === 'session' && !o.workoutId) {
      const w = getOpenWorkout();
      return { cur: w ? { screen: 'session', workoutId: w.id } : null, stack: [] };
    }
    return { cur: o, stack: [] };
  });
  const overlay = overlayNav.cur;
  /** Open an overlay, remembering the current one as its logical parent.
   * Passing null resets the whole overlay stack (used when switching tabs). */
  const setOverlay = useCallback((o: Overlay) => {
    setOverlayNav((n) => {
      if (o === null) return { cur: null, stack: [] };
      // Navigating within the same screen (e.g. switching the library's tab)
      // replaces the current overlay instead of stacking a new parent.
      if (n.cur && n.cur.screen === o.screen) return { cur: o, stack: n.stack };
      return { cur: o, stack: n.cur === null ? n.stack : [...n.stack, n.cur] };
    });
  }, []);
  const [toasts, setToasts] = useState<Array<ToastState & { id: number }>>([]);
  const [snack, setSnack] = useState<SnackState | null>(null);
  // A fresh build took control → show the reload plate until the user reloads.
  const updateReady = useSyncExternalStore(subscribeUpdateReady, isUpdateReady);
  const desktopRail = useDesktopRail();
  const snackSeq = useRef(0);
  const toastSeq = useRef(0);

  // One-shot sign-out via #/logout (local testing / support links).
  useEffect(() => {
    if (!/^#\/logout\/?$/i.test(window.location.hash)) return;
    let cancelled = false;
    void (async () => {
      await apiSignOut();
      if (cancelled) return;
      setAuthed(false);
      setOverlay(null);
      setJoinToken(null);
      window.history.replaceState(null, '', '#/');
    })();
    return () => {
      cancelled = true;
    };
  }, [setOverlay]);

  useEffect(() => {
    if (!authed) return;
    return startSyncLoop();
  }, [authed]);

  const shell: Shell = {
    openOverlay: setOverlay,
    goTab: (x) => {
      setOverlay(null);
      setTab(x);
      // Tapping Progress lands on its default view (#/progress), never a
      // remembered Trends/Feats sub, muscle/records segment or volume lens.
      if (x === 'progress') {
        setProgressSub('progress');
        setProgressSeg('total');
        setVolumeLens('volume');
      }
    },
    goPlaybook: () => {
      setOverlay(null);
      setProgramsPeer('playbook');
      setTab('programs');
    },
    toast: (tst) => {
      toastSeq.current += 1;
      const id = toastSeq.current;
      setToasts((list) => [...list, { ...tst, id }]);
    },
    snack: (s) => {
      snackSeq.current += 1;
      setSnack({ ...s, id: snackSeq.current });
    },
    signOut: () => {
      setOverlay(null);
      setTab(defaultTab());
      void apiSignOut();
      setAuthed(false);
      window.history.replaceState(null, '', '#/today');
    },
    queueLength: store.queue.length,
  };

  /** Back from an overlay: pop to the logical parent screen, not history. When
   *  there's no remembered parent (deep link / refreshed URL), fall back to the
   *  tab behind the overlay. An exercise detail opened from the Exercises tab
   *  returns there because that peer-tab state lives in App and is preserved
   *  while the overlay is open. */
  const closeOverlay = useCallback(() => {
    setOverlayNav((n) => {
      if (n.stack.length > 0) {
        return { cur: n.stack[n.stack.length - 1], stack: n.stack.slice(0, -1) };
      }
      return { cur: null, stack: [] };
    });
  }, []);
  const removeToast = useCallback((id: number) => {
    setToasts((list) => list.filter((x) => x.id !== id));
  }, []);
  const open = store.workouts.find((w) => w.finishedAt === null);
  const role = getRole();
  const tabs = tabsForRole(role, t);
  const tabAllowed = tabs.some((x) => x.id === tab);
  const effectiveTab = tabAllowed ? tab : defaultTab();
  // Role guards, applied in render (no setState-in-effect): an overlay the
  // current user may not open is treated as absent, so the tab behind shows
  // through instead of a blank screen. Settings requires admin. The exercise
  // library and detail are always available (no longer flag-gated).
  const overlayBlocked = overlay?.screen === 'settings' && role !== 'admin';
  const activeOverlay = overlayBlocked ? null : overlay;
  const showTabbar = !activeOverlay || activeOverlay.screen === 'session';
  const canEdgeSwipeBack =
    authed &&
    !joinToken &&
    !desktopRail &&
    (activeOverlay !== null || (effectiveTab === 'programs' && programsPeer !== 'programs'));
  const edgeSwipeBack = () => {
    if (activeOverlay !== null) {
      closeOverlay();
      return;
    }
    if (effectiveTab === 'programs' && programsPeer !== 'programs') setProgramsPeer('programs');
  };

  useEdgeSwipeBack(canEdgeSwipeBack, edgeSwipeBack);

  // State → URL hash, so a refresh lands on the same screen.
  useEffect(() => {
    if (!authed || joinToken) return;
    const next = toHash(
      effectiveTab,
      activeOverlay,
      programsPeer,
      libMine,
      progressSub,
      featSub,
      progressSeg,
      volumeLens,
    );
    if (window.location.hash !== next) window.history.replaceState(null, '', next);
  }, [
    authed,
    joinToken,
    effectiveTab,
    activeOverlay,
    programsPeer,
    libMine,
    progressSub,
    featSub,
    progressSeg,
    volumeLens,
  ]);

  // URL hash → state (browser back/forward).
  useEffect(() => {
    if (!authed || joinToken) return;
    const onPop = () => {
      const { tab: ht, overlay: ho } = fromHash(window.location.hash);
      const pk = peerFromHash(window.location.hash);
      const ps = progressFromHash(window.location.hash);
      setTab(ht);
      setProgramsPeer(pk.peer);
      setLibMine(pk.mine);
      setProgressSub(ps.sub);
      setFeatSub(ps.featSub);
      setProgressSeg(ps.seg);
      setVolumeLens(ps.lens);
      setOverlayNav({
        cur:
          ho?.screen === 'session' && !ho.workoutId
            ? open
              ? { screen: 'session', workoutId: open.id }
              : null
            : ho,
        stack: [],
      });
    };
    window.addEventListener('hashchange', onPop);
    return () => window.removeEventListener('hashchange', onPop);
  }, [authed, open, joinToken]);

  if (joinToken) {
    return (
      <div className="app">
        <Suspense fallback={<ScreenFallback />}>
          <OnboardingView
            token={joinToken}
            onDone={(workoutId) => {
              setJoinToken(null);
              window.location.hash = '#/today';
              if (currentUid()) setAuthed(true);
              if (workoutId) setOverlay({ screen: 'session', workoutId });
            }}
          />
        </Suspense>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="app">
        <AuthView onLoggedIn={() => setAuthed(true)} />
      </div>
    );
  }

  // Blocking profile-completion gate (Body v1 §3.2): a returning member whose
  // required metrics (height + a current weight) are missing must finish them
  // before the app opens. Only after the first sync resolves, so users who do
  // have metrics never see it flash; members only (staff accounts pass through).
  const needsBodySetup =
    role === 'member' && store.lastSyncAt !== null && !bodyMetricsComplete(store.bodyMetrics);
  if (needsBodySetup) {
    return (
      <div className="app">
        <Suspense fallback={<ScreenFallback />}>
          <ProfileCompletionGate />
        </Suspense>
      </div>
    );
  }

  const goTab = (x: Tab) => {
    setOverlay(null);
    // Landing on a top-level tab always shows that tab's primary content, so a
    // stale peer tab (Playbook/Exercises) never leaks across a Programs re-entry.
    setProgramsPeer('programs');
    // …and Progress opens on its default view, not a remembered sub/segment/lens.
    if (x === 'progress') {
      setProgressSub('progress');
      setProgressSeg('total');
      setVolumeLens('volume');
    }
    setTab(x);
  };
  /** Switch the Programs · Playbook · Exercises peer tab in place (no overlay). */
  const goProgramsPeer = (peer: ProgramsPeer) => {
    setOverlay(null);
    setProgramsPeer(peer);
    setTab('programs');
  };

  return (
    <div className="app">
      {desktopRail && (
        <Rail
          tab={effectiveTab}
          overlayOpen={activeOverlay !== null}
          goTab={goTab}
          openWorkoutStartedAt={open?.startedAt}
          syncStatus={store.syncStatus}
          onOpenProfile={() => setOverlay({ screen: 'profile', userId: 'me' })}
          onOpenSettings={() => setOverlay({ screen: 'settings' })}
        />
      )}
      <div className="main-col">
        {store.syncStatus === 'failed' && (
          <SyncBlockedCard
            error={store.syncError}
            onRetry={retrySync}
            onDiscard={discardBlockingChange}
          />
        )}
        {open && activeOverlay?.screen !== 'session' && (
          <LiveHero
            workout={open}
            gym={store.gyms.find((g) => g.id === open.gymId) ?? null}
            gyms={store.gyms}
            offline={store.syncStatus === 'offline'}
            queued={store.queue.length}
            onResume={() => setOverlay({ screen: 'session', workoutId: open.id })}
            mode={effectiveTab === 'today' ? 'today' : 'compact'}
          />
        )}
        <Suspense fallback={<ScreenFallback />}>
          {activeOverlay?.screen === 'session' && (
            <SessionView workoutId={activeOverlay.workoutId} shell={shell} onClose={closeOverlay} />
          )}
          {activeOverlay?.screen === 'activity' && (
            <ActivityView newType={activeOverlay.newType} onClose={closeOverlay} />
          )}
          {activeOverlay?.screen === 'past-workout' && (
            <SessionView
              workoutId={activeOverlay.workoutId}
              past
              startAdd={activeOverlay.startAdd}
              shell={shell}
              onClose={closeOverlay}
            />
          )}
          {activeOverlay?.screen === 'exercise-history' && (
            <ExerciseHistoryView name={activeOverlay.name} shell={shell} onClose={closeOverlay} />
          )}
          {activeOverlay?.screen === 'exercise-detail' && (
            <ExerciseDetailView name={activeOverlay.name} shell={shell} onClose={closeOverlay} />
          )}
          {activeOverlay?.screen === 'muscle-history' && (
            <MuscleHistoryView muscle={activeOverlay.muscle} shell={shell} onClose={closeOverlay} />
          )}
          {activeOverlay?.screen === 'settings' && role === 'admin' && (
            <SettingsView onClose={closeOverlay} />
          )}
          {activeOverlay?.screen === 'history' && (
            <HistoryListView shell={shell} onClose={closeOverlay} />
          )}
          {activeOverlay?.screen === 'gym' && (
            <GymDetailView
              gymId={activeOverlay.gymId}
              candName={activeOverlay.name}
              candLat={activeOverlay.lat}
              candLng={activeOverlay.lng}
              candAddress={activeOverlay.address}
              shell={shell}
              onClose={closeOverlay}
            />
          )}
          {activeOverlay?.screen === 'profile' && (
            <ProfileView userId={activeOverlay.userId} shell={shell} onClose={closeOverlay} />
          )}
        </Suspense>
        {!activeOverlay && (
          <>
            <Suspense fallback={<ScreenFallback />}>
              {effectiveTab === 'today' && <TodayView shell={shell} store={store} />}
              {effectiveTab === 'progress' && (
                <ProgressView
                  store={store}
                  shell={shell}
                  sub={progressSub}
                  onSub={setProgressSub}
                  featSub={featSub}
                  onFeatSub={setFeatSub}
                  seg={progressSeg}
                  onSeg={setProgressSeg}
                  lens={volumeLens}
                  onLens={setVolumeLens}
                />
              )}
              {effectiveTab === 'gyms' && <GymsView shell={shell} store={store} />}
              {effectiveTab === 'people' &&
                (role === 'trainer' ? (
                  <TrainerView
                    onOpenProfile={(id) => setOverlay({ screen: 'profile', userId: id })}
                    onOpenMe={() => setOverlay({ screen: 'profile', userId: 'me' })}
                  />
                ) : (
                  <AdminView
                    onOpenProfile={(id) => setOverlay({ screen: 'profile', userId: id })}
                  />
                ))}
              {effectiveTab === 'programs' &&
                (programsPeer === 'exercises' ? (
                  <ExerciseLibraryView
                    shell={shell}
                    libTab={libMine ? 'mine' : 'library'}
                    onLibTab={(next) => setLibMine(next === 'mine')}
                    onProgramsTab={goProgramsPeer}
                  />
                ) : programsPeer === 'playbook' ? (
                  <PlaybookView shell={shell} onProgramsTab={goProgramsPeer} />
                ) : (
                  <ProgramsView shell={shell} onProgramsTab={goProgramsPeer} />
                ))}
              {effectiveTab === 'me' && (
                <ProfileView
                  userId="me"
                  shell={shell}
                  embedded
                  onClose={() => setTab(defaultTab())}
                />
              )}
            </Suspense>
          </>
        )}
        {showTabbar && (
          <nav className="tabbar">
            {tabs.map((x) => (
              <button
                key={x.id}
                className={effectiveTab === x.id ? 'active' : ''}
                onClick={() => goTab(x.id)}
              >
                <Icon name={x.icon} />
                <span>{x.label}</span>
              </button>
            ))}
          </nav>
        )}
        <div className="toast-holder">
          {authed && notices.some((n) => !n.read) && (
            <NoticeStrip notices={notices.filter((n) => !n.read)} onDismiss={dismissNotice} />
          )}
          {updateReady && <UpdatePlate />}
          {snack && <Snackbar key={snack.id} snack={snack} onDone={() => setSnack(null)} />}
          {toasts.map((tst) => (
            <Toast key={tst.id} toast={tst} id={tst.id} onExpire={removeToast} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Page-load placeholder: a skeleton of a typical screen, never a spinner. */
function ScreenFallback() {
  const { t } = useT();
  return <ScreenSkeleton label={t.syncing} />;
}

function getDesktopRailMatch(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia &&
    window.matchMedia('(min-width: 720px)').matches
  );
}

function useDesktopRail(): boolean {
  const [matches, setMatches] = useState(getDesktopRailMatch);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia('(min-width: 720px)');
    const onChange = () => setMatches(query.matches);
    onChange();
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return matches;
}

function isEdgeSwipeExcluded(target: EventTarget | null): boolean {
  if (typeof Element === 'undefined' || !(target instanceof Element)) return false;
  return target.closest(EDGE_BACK_EXCLUDE_SELECTOR) !== null;
}

function useEdgeSwipeBack(enabled: boolean, onBack: () => void): void {
  const onBackRef = useRef(onBack);

  useEffect(() => {
    onBackRef.current = onBack;
  }, [onBack]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let tracking = false;
    let locked = false;
    let cancelled = false;

    const reset = () => {
      tracking = false;
      locked = false;
      cancelled = false;
    };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1 || isEdgeSwipeExcluded(event.target)) return;
      const touch = event.touches[0];
      if (!touch || touch.clientX > EDGE_BACK_START_PX) return;
      startX = touch.clientX;
      startY = touch.clientY;
      startTime = Date.now();
      tracking = true;
      locked = false;
      cancelled = false;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!tracking || cancelled || event.touches.length !== 1) return;
      const touch = event.touches[0];
      if (!touch) return;
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      if (dx < -8) {
        reset();
        return;
      }
      if (!locked) {
        if (absY > 10 && absY > absX) {
          cancelled = true;
          tracking = false;
          return;
        }
        if (dx > EDGE_BACK_LOCK_PX && absX > absY * EDGE_BACK_DOMINANCE) locked = true;
      }
      if (locked && event.cancelable) event.preventDefault();
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (!tracking || cancelled) {
        reset();
        return;
      }
      const touch = event.changedTouches[0];
      if (!touch) {
        reset();
        return;
      }
      const dx = touch.clientX - startX;
      const absY = Math.abs(touch.clientY - startY);
      const elapsed = Date.now() - startTime;
      const intentional =
        locked &&
        dx >= EDGE_BACK_TRIGGER_PX &&
        absY <= EDGE_BACK_MAX_VERTICAL_PX &&
        dx > absY * EDGE_BACK_DOMINANCE;
      const fastIntentional = dx >= 52 && elapsed < 280 && dx > absY * 2;

      if (intentional || fastIntentional) onBackRef.current();
      reset();
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', reset, { passive: true });

    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', reset);
    };
  }, [enabled]);
}

/**
 * Desktop rail (W-04): 206px, brand, labeled nav, and an account chip at the
 * foot. During a live session the foot also carries the in-session chip (W-06).
 * Hidden under 720px.
 */
function Rail(props: {
  tab: Tab;
  overlayOpen: boolean;
  goTab: (t: Tab) => void;
  openWorkoutStartedAt?: number;
  syncStatus: ReturnType<typeof useStore>['syncStatus'];
  onOpenProfile: () => void;
  onOpenSettings: () => void;
}) {
  const { t } = useT();
  const live = props.openWorkoutStartedAt !== undefined;

  const role = getRole();
  const nav = tabsForRole(role, t);

  const dotColor =
    props.syncStatus === 'synced'
      ? 'var(--color-ok)'
      : props.syncStatus === 'offline' || props.syncStatus === 'failed'
        ? 'var(--color-danger)'
        : 'var(--color-neutral-600)';
  const username = getUsername() ?? '';

  return (
    <aside className="rail">
      <div className="rail-brand">
        <SpotterMark size={40} variant="sidebar" />
        <span>{t.appName}</span>
      </div>
      {nav.map((x) => (
        <button
          key={x.id}
          className={`rail-item${props.tab === x.id && !props.overlayOpen ? ' active' : ''}`}
          aria-label={x.label}
          title={x.label}
          onClick={() => props.goTab(x.id)}
        >
          <Icon name={x.icon} />
          <span className="rail-label">{x.label}</span>
          {x.id === 'today' && live && <span className="rail-live-dot" aria-hidden />}
        </button>
      ))}
      {role === 'admin' && (
        <button
          className="rail-item"
          aria-label={t.settingsTitle}
          title={t.settingsTitle}
          onClick={props.onOpenSettings}
        >
          <Icon name="gear" />
          <span className="rail-label">{t.settingsTitle}</span>
        </button>
      )}
      <div className="rail-foot">
        <div className="rail-lang">
          <LanguageSelector />
        </div>
        <button
          className="account-chip"
          onClick={props.onOpenProfile}
          aria-label={username}
          title={username}
        >
          <span className="account-avatar">
            <Avatar userId={currentUid() ?? undefined} name={username} hasPhoto size={34} />
            <span className="dot" style={{ background: dotColor }} />
          </span>
        </button>
      </div>
    </aside>
  );
}

/** Persistent blocked-queue card: plain reason, raw status line, Retry + Discard (AC-SYNC-05). */
function SyncBlockedCard(props: {
  error: SyncError | null;
  onRetry: () => void;
  onDiscard: () => void;
}) {
  const { t } = useT();
  return (
    <div className="sync-blocked" role="alert">
      <div className="sync-blocked-head">
        <Icon name="cloud-slash" />
        <div>
          <h4 className="t">{t.syncBlockedTitle}</h4>
          <p className="s">{t.syncBlockedBody}</p>
        </div>
      </div>
      {props.error && <code className="sync-blocked-line">{props.error.statusLine}</code>}
      <div className="sync-blocked-actions">
        <button className="btn btn-secondary btn-sm" onClick={props.onDiscard}>
          {t.syncDiscard}
        </button>
        <button className="btn btn-primary btn-sm" onClick={props.onRetry}>
          {t.retry}
        </button>
      </div>
    </div>
  );
}

function noticeIcon(kind: string): string {
  if (kind.startsWith('program')) return 'copy';
  if (kind.startsWith('role')) return 'shield-check';
  return 'barbell';
}

/** In-product notices strip: assignment, role and trainer changes (AC-ROLE-10, AC-PLAN-11). */
function NoticeStrip(props: { notices: Notice[]; onDismiss: (id: string) => void }) {
  const { t } = useT();
  return (
    <>
      {props.notices.map((n) => (
        <div key={n.id} className="notice" role="status">
          <Icon name={noticeIcon(n.kind)} />
          <span className="notice-text">{t.noticeText(n.kind, n.actor, n.detail)}</span>
          <button className="notice-x" aria-label={t.dismiss} onClick={() => props.onDismiss(n.id)}>
            <Icon name="x" />
          </button>
        </div>
      ))}
    </>
  );
}
