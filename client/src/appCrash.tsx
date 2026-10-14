import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react';
import { resetApp, updateNow, type UpdateResult } from './pwaUpdate';
import './appCrash.css';
import { Button } from './components/ui/Button';

/**
 * The app-wide safety net. It must work when the app itself is broken, so it does not use the i18n store, the kit or
 * the theme: a few lines of its own text and plain markup.
 *
 *  - `AppCrashBoundary` wraps the whole app. A render error becomes a calm screen that first looks for a newer
 *    build and switches to it (the crash is usually an old bundle meeting new data), and only then offers buttons.
 *  - `installCrashRecovery` catches what React never sees: a chunk of an old build that no longer exists on the
 *    server (after a deploy) and unhandled errors that leave a blank page. One automatic recovery per minute.
 */

const TEXT: Record<
  string,
  Record<'title' | 'looking' | 'current' | 'failed' | 'reload' | 'reset', string>
> = {
  en: {
    title: 'Something went wrong',
    looking: 'Looking for a newer version…',
    current: 'You have the latest version.',
    failed: 'Could not check for a new version.',
    reload: 'Reload',
    reset: 'Clear cache and update',
  },
  uk: {
    title: 'Щось пішло не так',
    looking: 'Шукаю нову версію…',
    current: 'У вас остання версія.',
    failed: 'Не вдалося перевірити нову версію.',
    reload: 'Перезавантажити',
    reset: 'Очистити кеш і оновити',
  },
  pl: {
    title: 'Coś poszło nie tak',
    looking: 'Szukam nowszej wersji…',
    current: 'Masz najnowszą wersję.',
    failed: 'Nie udało się sprawdzić nowej wersji.',
    reload: 'Odśwież',
    reset: 'Wyczyść pamięć podręczną i zaktualizuj',
  },
  lt: {
    title: 'Kažkas nepavyko',
    looking: 'Ieškoma naujos versijos…',
    current: 'Turite naujausią versiją.',
    failed: 'Nepavyko patikrinti naujos versijos.',
    reload: 'Įkelti iš naujo',
    reset: 'Išvalyti talpyklą ir atnaujinti',
  },
  et: {
    title: 'Midagi läks valesti',
    looking: 'Otsin uuemat versiooni…',
    current: 'Teil on uusim versioon.',
    failed: 'Uue versiooni kontroll ebaõnnestus.',
    reload: 'Laadi uuesti',
    reset: 'Tühjenda vahemälu ja uuenda',
  },
};

function words() {
  const lang = (document.documentElement.lang || 'en').slice(0, 2);
  return TEXT[lang] ?? TEXT.en;
}

const GUARD_KEY = 'spotter.crashRecovery';
const GUARD_MS = 60_000;

/** True once per minute: an automatic recovery that fails must not turn into a reload loop. */
function mayRecoverNow(): boolean {
  try {
    const last = Number(sessionStorage.getItem(GUARD_KEY) ?? 0);
    if (Date.now() - last < GUARD_MS) return false;
    sessionStorage.setItem(GUARD_KEY, String(Date.now()));
  } catch {
    /* storage blocked: allow, the time check below cannot help */
  }
  return true;
}

const CHUNK_ERROR =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk .* failed|ChunkLoadError/i;

/** Old build, missing chunk, or an error that blanked the page: look for the new build, switch to it, else reload. */
async function recover(): Promise<void> {
  if (!mayRecoverNow()) return;
  const r = await updateNow();
  if (r !== 'updated') window.location.reload();
}

export function installCrashRecovery(): void {
  window.addEventListener('vite:preloadError', (e) => {
    e.preventDefault();
    void recover();
  });
  window.addEventListener('unhandledrejection', (e) => {
    const msg = String((e.reason as Error | undefined)?.message ?? e.reason ?? '');
    if (CHUNK_ERROR.test(msg)) void recover();
  });
  window.addEventListener('error', (e) => {
    if (CHUNK_ERROR.test(e.message ?? '')) void recover();
  });
}

function CrashScreen() {
  const w = words();
  const [state, setState] = useState<UpdateResult | 'looking'>('looking');
  useEffect(() => {
    let live = true;
    void updateNow().then((r) => live && setState(r));
    return () => {
      live = false;
    };
  }, []);
  return (
    <div role="alert" className="app-crash">
      <h1 className="app-crash-title">{w.title}</h1>
      <p className="app-crash-note">
        {state === 'looking' ? w.looking : state === 'current' ? w.current : w.failed}
      </p>
      <div className="app-crash-actions">
        <Button variant="secondary" onClick={() => window.location.reload()}>
          {w.reload}
        </Button>
        <Button variant="secondary" onClick={() => void resetApp()}>
          {w.reset}
        </Button>
      </div>
    </div>
  );
}

export class AppCrashBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('app crashed', error, info.componentStack);
  }
  render() {
    return this.state.error ? <CrashScreen /> : this.props.children;
  }
}
