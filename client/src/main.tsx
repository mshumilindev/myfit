import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import './styles.css';
import './redesign.css';
import './glass.css';
import { App } from './App';
import { getLocale } from './i18n';
import { startAutoUpdate, markUpdateReady } from './pwaUpdate';
import { lockShellHeight } from './viewportFit';
import { SyncStatusHost } from './components/SyncStatusHost';
import { LavaBackground } from './components/LavaBackground';
import { initMotion } from './motion';
import { runPendingWipe } from './deviceWipe';
import { AppCrashBoundary, installCrashRecovery } from './appCrash';

document.documentElement.lang = getLocale();
lockShellHeight();
initMotion();
installCrashRecovery();

if ('serviceWorker' in navigator) {
  void startAutoUpdate({
    container: navigator.serviceWorker,
    doc: document,
    onUpdateReady: markUpdateReady,
    now: () => Date.now(),
  });
}

/* A pending wipe of Firestore's offline cache (sign-out, relationship end) runs before the SDK opens its database. */
void runPendingWipe()
  .catch(() => false)
  .then(() =>
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <AppCrashBoundary>
          <LavaBackground />
          <App />
          <SyncStatusHost />
        </AppCrashBoundary>
      </StrictMode>,
    ),
  );
