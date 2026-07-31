import { useEffect, useRef, useState, useCallback } from 'react';
import { getToken } from './api';
import { startSyncLoop, useStore } from './store';
import { useT } from './i18n';
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
  | { screen: 'past-workout'; workoutId: string }
  | { screen: 'exercise-history'; name: string }
  | null;

export interface Shell {
  openOverlay: (o: Overlay) => void;
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
  const snackSeq = useRef(0);

  useEffect(() => {
    if (!authed) return;
    return startSyncLoop();
  }, [authed]);

  const shell: Shell = {
    openOverlay: setOverlay,
    toast: setToast,
    snack: (s) => {
      snackSeq.current += 1;
      setSnack({ ...s, id: snackSeq.current });
    },
  };

  const closeOverlay = useCallback(() => setOverlay(null), []);

  if (!authed) {
    return (
      <div className="app">
        <AuthView onLoggedIn={() => setAuthed(true)} />
      </div>
    );
  }

  const tabs: { id: Tab; icon: string; label: string }[] = [
    { id: 'today', icon: 'house', label: t.today },
    { id: 'progress', icon: 'chart-line-up', label: t.progress },
    { id: 'gyms', icon: 'map-pin', label: t.gyms },
    { id: 'apps', icon: 'squares-four', label: t.apps },
  ];

  return (
    <div className="app">
      <div className="main-col">
        {overlay?.screen === 'session' && (
          <SessionView workoutId={overlay.workoutId} shell={shell} onClose={closeOverlay} />
        )}
        {overlay?.screen === 'past-workout' && (
          <SessionView workoutId={overlay.workoutId} past shell={shell} onClose={closeOverlay} />
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
