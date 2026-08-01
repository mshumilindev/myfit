import { useCallback, useEffect, useRef, useState } from 'react';
import { getToken, getUsername } from './api';
import { getOpenWorkout, startSyncLoop, useStore } from './store';
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

const TABS: Tab[] = ['today', 'progress', 'gyms', 'apps'];

/** Serialize the current screen to a URL hash so a refresh restores it. */
function toHash(tab: Tab, overlay: Overlay): string {
  if (overlay?.screen === 'session') return '#/session';
  if (overlay?.screen === 'past-workout') return `#/workout/${overlay.workoutId}`;
  if (overlay?.screen === 'exercise-history')
    return `#/exercise/${encodeURIComponent(overlay.name)}`;
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
  if ((TABS as string[]).includes(head)) return { tab: head as Tab, overlay: null };
  return { tab: 'today', overlay: null };
}

export function App() {
  const { t } = useT();
  const store = useStore();
  const [authed, setAuthed] = useState<boolean>(() => !!getToken());
  const [tab, setTab] = useState<Tab>(() => fromHash(window.location.hash).tab);
  const [overlay, setOverlay] = useState<Overlay>(() => {
    const o = fromHash(window.location.hash).overlay;
    if (o?.screen === 'session' && !o.workoutId) {
      const w = getOpenWorkout();
      return w ? { screen: 'session', workoutId: w.id } : null;
    }
    return o;
  });
  const [toasts, setToasts] = useState<Array<ToastState & { id: number }>>([]);
  const [snack, setSnack] = useState<SnackState | null>(null);
  const desktopRail = useDesktopRail();
  const snackSeq = useRef(0);
  const toastSeq = useRef(0);

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
  };

  const closeOverlay = useCallback(() => setOverlay(null), []);
  const removeToast = useCallback((id: number) => {
    setToasts((list) => list.filter((x) => x.id !== id));
  }, []);
  const open = store.workouts.find((w) => w.finishedAt === null);

  // State → URL hash, so a refresh lands on the same screen.
  useEffect(() => {
    if (!authed) return;
    const next = toHash(tab, overlay);
    if (window.location.hash !== next) window.history.replaceState(null, '', next);
  }, [authed, tab, overlay]);

  // URL hash → state (browser back/forward).
  useEffect(() => {
    if (!authed) return;
    const onPop = () => {
      const { tab: ht, overlay: ho } = fromHash(window.location.hash);
      setTab(ht);
      setOverlay(
        ho?.screen === 'session' && !ho.workoutId
          ? open
            ? { screen: 'session', workoutId: open.id }
            : null
          : ho,
      );
    };
    window.addEventListener('hashchange', onPop);
    return () => window.removeEventListener('hashchange', onPop);
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
          {toasts.map((tst) => (
            <Toast key={tst.id} toast={tst} id={tst.id} onExpire={removeToast} />
          ))}
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
