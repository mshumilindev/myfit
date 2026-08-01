import { useCallback, useEffect, useRef, useState } from 'react';
import { getToken, getUsername } from './api';
import { startSyncLoop, startWorkout, useStore } from './store';
import { fmtSessionClock, useT } from './i18n';
import { Icon, Snackbar, Toast, type SnackState, type ToastState } from './ui';
import { AuthView } from './views/AuthView';
import { TodayView } from './views/TodayView';
import { ProgressView } from './views/ProgressView';
import { GymsView } from './views/GymsView';
import { ServicesView } from './views/ServicesView';
import { SessionView } from './views/SessionView';
import { ExerciseHistoryView } from './views/ExerciseHistoryView';

export type Tab = 'today' | 'progress' | 'gyms' | 'apps';

export type Overlay =
  | { screen: 'session'; workoutId: string }
  | { screen: 'past-workout'; workoutId: string; startAdd?: boolean }
  | { screen: 'exercise-history'; name: string }
  | null;

export interface Shell {
  openOverlay: (o: Overlay) => void;
  goTab: (t: Tab) => void;
  toast: (t: ToastState) => void;
  snack: (s: SnackState) => void;
}

export function App() {
  const { t } = useT();
  const store = useStore();
  const [authed, setAuthed] = useState<boolean>(() => !!getToken());
  const [tab, setTab] = useState<Tab>('today');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [snack, setSnack] = useState<SnackState | null>(null);
  const desktopRail = useDesktopRail();
  const snackSeq = useRef(0);

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
    toast: setToast,
    snack: (s) => {
      snackSeq.current += 1;
      setSnack({ ...s, id: snackSeq.current });
    },
  };

  const closeOverlay = useCallback(() => setOverlay(null), []);
  const open = store.workouts.find((w) => w.finishedAt === null);

  // Global shortcut: N starts/opens a session. (The board says ⌘N, but browsers
  // reserve it for a new window — single-key like Linear/Gmail instead.)
  useEffect(() => {
    if (!authed) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing =
        el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        const current = open ?? startWorkout();
        setOverlay({ screen: 'session', workoutId: current.id });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [authed, open]);

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

  const tabs: { id: Tab; icon: string; label: string }[] = [
    { id: 'today', icon: 'house', label: t.today },
    { id: 'progress', icon: 'chart-line-up', label: t.progress },
    { id: 'gyms', icon: 'map-pin', label: t.gyms },
    { id: 'apps', icon: 'squares-four', label: t.apps },
  ];

  return (
    <div className="app">
      {desktopRail && (
        <Rail
          tab={tab}
          overlayOpen={overlay !== null}
          goTab={goTab}
          openWorkoutId={open?.id}
          openWorkoutStartedAt={open?.startedAt}
          syncStatus={store.syncStatus}
          onOpenSession={() => open && setOverlay({ screen: 'session', workoutId: open.id })}
        />
      )}
      <div className="main-col">
        {overlay?.screen === 'session' && (
          <SessionView workoutId={overlay.workoutId} shell={shell} onClose={closeOverlay} />
        )}
        {overlay?.screen === 'past-workout' && (
          <SessionView
            workoutId={overlay.workoutId}
            past
            startAdd={overlay.startAdd}
            shell={shell}
            onClose={closeOverlay}
          />
        )}
        {overlay?.screen === 'exercise-history' && (
          <ExerciseHistoryView name={overlay.name} onClose={closeOverlay} />
        )}
        {!overlay && (
          <>
            {tab === 'today' && <TodayView shell={shell} store={store} />}
            {tab === 'progress' && <ProgressView store={store} />}
            {tab === 'gyms' && <GymsView shell={shell} store={store} />}
            {tab === 'apps' && (
              <ServicesView
                store={store}
                onSignedOut={() => {
                  setAuthed(false);
                  setTab('today');
                }}
                onOpenTraining={() => setTab('today')}
              />
            )}
            <nav className="tabbar">
              {tabs.map((x) => (
                <button
                  key={x.id}
                  className={tab === x.id ? 'active' : ''}
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
          {toast && <Toast toast={toast} onDone={() => setToast(null)} />}
        </div>
      </div>
    </div>
  );
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
 * Desktop rail (W-04): 206px, brand, labeled nav, Services section, and an
 * account chip at the foot — it replaces the phone's Apps tab. During a live
 * session the foot also carries the in-session chip (W-06). Hidden under 720px.
 */
function Rail(props: {
  tab: Tab;
  overlayOpen: boolean;
  goTab: (t: Tab) => void;
  openWorkoutId?: string;
  openWorkoutStartedAt?: number;
  syncStatus: ReturnType<typeof useStore>['syncStatus'];
  onOpenSession: () => void;
}) {
  const { t } = useT();
  const [now, setNow] = useState(() => Date.now());
  const live = props.openWorkoutStartedAt !== undefined;

  useEffect(() => {
    if (!live) return;
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [live]);

  const nav: { id: Tab; icon: string; label: string }[] = [
    { id: 'today', icon: 'house', label: t.today },
    { id: 'progress', icon: 'chart-line-up', label: t.progress },
    { id: 'gyms', icon: 'map-pin', label: t.gyms },
  ];

  const dotColor =
    props.syncStatus === 'synced'
      ? 'var(--color-ok)'
      : props.syncStatus === 'offline'
        ? 'var(--color-danger)'
        : 'var(--color-neutral-600)';
  const username = getUsername() ?? '';

  return (
    <aside className="rail">
      <div className="rail-brand">
        <Icon name="barbell" />
        <span>{t.appName}</span>
      </div>
      {nav.map((x) => (
        <button
          key={x.id}
          className={`rail-item${props.tab === x.id && !props.overlayOpen ? ' active' : ''}`}
          onClick={() => props.goTab(x.id)}
        >
          <Icon name={x.icon} />
          {x.label}
        </button>
      ))}
      <div className="rail-divider" />
      <div className="rail-label">{t.services}</div>
      <button className="rail-item" onClick={() => props.goTab('today')}>
        <Icon name="barbell" />
        {t.training}
      </button>
      <div className="rail-item disabled">
        <Icon name="carrot" />
        {t.nutrition}
      </div>
      <div className="rail-item disabled">
        <Icon name="robot" />
        {t.aiBodyScan}
      </div>
      <div className="rail-foot">
        {live && (
          <button className="rail-session-chip" onClick={props.onOpenSession}>
            <span className="dot" />
            <span className="lab">{t.inSession}</span>
            <span className="clock">
              {fmtSessionClock(now - (props.openWorkoutStartedAt ?? now))}
            </span>
          </button>
        )}
        <button className="account-chip" onClick={() => props.goTab('apps')}>
          <span className="avatar">{(username[0] ?? '?').toUpperCase()}</span>
          <span className="name">{username}</span>
          <span className="dot" style={{ background: dotColor }} />
        </button>
      </div>
    </aside>
  );
}
