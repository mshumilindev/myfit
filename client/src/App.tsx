import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
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
import { getOpenWorkout, startSyncLoop, useStore, retrySync, discardBlockingChange } from './store';
import { useFlag } from './data/flags';
import { SpotterMark } from './brand/SpotterMark';
import { useT } from './i18n';
import {
  Icon,
  LanguageSelector,
  Snackbar,
  Toast,
  ScreenSkeleton,
  type SnackState,
  type ToastState,
} from './ui';
import { AuthView } from './views/AuthView';
import { Avatar } from './components/Avatar';
import { LiveHero } from './components/LiveHero';
import type { SyncError, Notice } from './types';

const OnboardingView = lazy(() =>
  import('./views/OnboardingView').then((module) => ({ default: module.OnboardingView })),
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
const ExerciseHistoryView = lazy(() =>
  import('./views/ExerciseHistoryView').then((module) => ({
    default: module.ExerciseHistoryView,
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
  | { screen: 'past-workout'; workoutId: string; startAdd?: boolean }
  | { screen: 'exercise-history'; name: string }
  | { screen: 'exercise-detail'; name: string }
  | { screen: 'settings' }
  | { screen: 'history' }
  | { screen: 'profile'; userId: string }
  | { screen: 'gym'; gymId?: string; name?: string; lat?: number; lng?: number; address?: string }
  | { screen: 'library' }
  | null;

export interface Shell {
  openOverlay: (o: Overlay) => void;
  goTab: (t: Tab) => void;
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

function defaultTabForRole(role: NavRole): Tab {
  return role === 'trainer' ? 'people' : 'today';
}

function tabsForRole(role: NavRole, t: NavLabels): NavItem[] {
  if (role === 'trainer') {
    return [
      { id: 'people', icon: 'user-focus', label: t.trClientsTab },
      { id: 'programs', icon: 'cards', label: t.progTitle },
      { id: 'me', icon: 'user', label: t.navMe },
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
function toHash(tab: Tab, overlay: Overlay): string {
  if (overlay?.screen === 'session') return '#/session';
  if (overlay?.screen === 'past-workout') return `#/workout/${overlay.workoutId}`;
  if (overlay?.screen === 'exercise-history')
    return `#/exercise/${encodeURIComponent(overlay.name)}`;
  if (overlay?.screen === 'exercise-detail')
    return `#/exercise-detail/${encodeURIComponent(overlay.name)}`;
  if (overlay?.screen === 'profile') return `#/profile/${encodeURIComponent(overlay.userId)}`;
  if (overlay?.screen === 'gym') return overlay.gymId ? `#/gym/${overlay.gymId}` : '#/gym';
  if (overlay?.screen === 'library') return '#/exercises';
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
  if (head === 'profile' && parts[1])
    return { tab: 'today', overlay: { screen: 'profile', userId: decodeURIComponent(parts[1]) } };
  if (head === 'me') return { tab: 'me', overlay: null };
  if (head === 'exercises') return { tab: 'progress', overlay: { screen: 'library' } };
  if (head === 'settings') return { tab: 'today', overlay: { screen: 'settings' } };
  if (head === 'history') return { tab: 'today', overlay: { screen: 'history' } };
  if (head === 'gym' && parts[1])
    return { tab: 'gyms', overlay: { screen: 'gym', gymId: parts[1] } };
  if (head === 'gym') return { tab: 'gyms', overlay: { screen: 'gym' } };
  if ((TABS as string[]).includes(head)) return { tab: head as Tab, overlay: null };
  return { tab: 'today', overlay: null };
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
    setOverlayNav((n) =>
      o === null
        ? { cur: null, stack: [] }
        : { cur: o, stack: n.cur === null ? n.stack : [...n.stack, n.cur] },
    );
  }, []);
  const [toasts, setToasts] = useState<Array<ToastState & { id: number }>>([]);
  const [snack, setSnack] = useState<SnackState | null>(null);
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
      setTab(defaultTabForRole(getRole()));
      void apiSignOut();
      setAuthed(false);
      window.history.replaceState(null, '', '#/today');
    },
    queueLength: store.queue.length,
  };

  /** Back from an overlay: pop to the logical parent screen, not history. */
  const closeOverlay = useCallback(() => {
    setOverlayNav((n) =>
      n.stack.length > 0
        ? { cur: n.stack[n.stack.length - 1], stack: n.stack.slice(0, -1) }
        : { cur: null, stack: [] },
    );
  }, []);
  const removeToast = useCallback((id: number) => {
    setToasts((list) => list.filter((x) => x.id !== id));
  }, []);
  const open = store.workouts.find((w) => w.finishedAt === null);
  const role = getRole();
  const tabs = tabsForRole(role, t);
  const tabAllowed = tabs.some((x) => x.id === tab);
  const effectiveTab = tabAllowed ? tab : defaultTabForRole(role);
  const exOn = useFlag('exerciseFeature');

  // Feature-flag / role guards, applied in render (no setState-in-effect): an
  // overlay the current user may not open is treated as absent, so the tab
  // behind shows through instead of a blank screen. The Ex-feature library and
  // detail require the flag; Settings requires admin.
  const overlayBlocked =
    (!exOn && (overlay?.screen === 'library' || overlay?.screen === 'exercise-detail')) ||
    (overlay?.screen === 'settings' && role !== 'admin');
  const activeOverlay = overlayBlocked ? null : overlay;

  // State → URL hash, so a refresh lands on the same screen.
  useEffect(() => {
    if (!authed || joinToken) return;
    const next = toHash(effectiveTab, activeOverlay);
    if (window.location.hash !== next) window.history.replaceState(null, '', next);
  }, [authed, joinToken, effectiveTab, activeOverlay]);

  // URL hash → state (browser back/forward).
  useEffect(() => {
    if (!authed || joinToken) return;
    const onPop = () => {
      const { tab: ht, overlay: ho } = fromHash(window.location.hash);
      setTab(ht);
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

  const goTab = (x: Tab) => {
    setOverlay(null);
    setTab(x);
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
        {authed && notices.some((n) => !n.read) && (
          <NoticeStrip notices={notices.filter((n) => !n.read)} onDismiss={dismissNotice} />
        )}
        {open &&
          activeOverlay?.screen !== 'session' &&
          activeOverlay?.screen !== 'past-workout' && (
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
            <ExerciseHistoryView name={activeOverlay.name} onClose={closeOverlay} />
          )}
          {activeOverlay?.screen === 'library' && exOn && (
            <ExerciseLibraryView shell={shell} onClose={closeOverlay} />
          )}
          {activeOverlay?.screen === 'exercise-detail' && exOn && (
            <ExerciseDetailView name={activeOverlay.name} shell={shell} onClose={closeOverlay} />
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
              {effectiveTab === 'progress' && <ProgressView store={store} />}
              {effectiveTab === 'gyms' && <GymsView shell={shell} store={store} />}
              {effectiveTab === 'people' &&
                (role === 'trainer' ? (
                  <TrainerView
                    onOpenProfile={(id) => setOverlay({ screen: 'profile', userId: id })}
                  />
                ) : (
                  <AdminView
                    onOpenProfile={(id) => setOverlay({ screen: 'profile', userId: id })}
                  />
                ))}
              {effectiveTab === 'programs' && <ProgramsView shell={shell} />}
              {effectiveTab === 'me' && (
                <ProfileView
                  userId="me"
                  shell={shell}
                  embedded
                  onClose={() => setTab(defaultTabForRole(role))}
                />
              )}
            </Suspense>
            <nav className="tabbar">
              {tabs.map((x) => (
                <button
                  key={x.id}
                  className={effectiveTab === x.id ? 'active' : ''}
                  onClick={() => setTab(x.id)}
                >
                  <Icon name={x.icon} />
                  <span>{x.label}</span>
                </button>
              ))}
            </nav>
          </>
        )}
        <div className="toast-holder">
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
    <div className="notice-strip">
      {props.notices.map((n) => (
        <div key={n.id} className="notice" role="status">
          <Icon name={noticeIcon(n.kind)} />
          <span className="notice-text">{t.noticeText(n.kind, n.actor, n.detail)}</span>
          <button className="notice-x" aria-label={t.dismiss} onClick={() => props.onDismiss(n.id)}>
            <Icon name="x" />
          </button>
        </div>
      ))}
    </div>
  );
}
