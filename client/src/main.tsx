import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
// Brand wordmark (header, nutrition bar, share card). Self-hosted: no request to Google Fonts (SPO-287).
import '@fontsource/kaushan-script/latin-400.css';
import '@fontsource/kaushan-script/latin-ext-400.css';
import './styles.css';
import './redesign.css';
import './glass.css';
import { App } from './App';
import { getLocale } from './i18n';
import { startAutoUpdate, startBuildWatch, markUpdateReady } from './pwaUpdate';
import { lockShellHeight } from './viewportFit';
import { installHorizontalScrollGuard } from './horizontalScrollGuard';
import { SyncStatusHost } from './components/SyncStatusHost';
import { LavaBackground } from './components/LavaBackground';
import { initMotion } from './motion';
import { purgeLegacyPlaintext, runPendingWipe } from './deviceWipe';
import { AppCrashBoundary, installCrashRecovery } from './appCrash';
import { installCleanUrls } from './route';
import { LegalGate } from './legal/LegalGate';
import { GeoConsentHost } from './legal/GeoConsentHost';
import { HealthConsentHost } from './legal/HealthConsentHost';

// Clean URLs (no `#`): rewrite a legacy `/#/route` link to `/route` before the app reads its route.
installCleanUrls();
document.documentElement.lang = getLocale();
lockShellHeight();
installHorizontalScrollGuard();
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

startBuildWatch();

/* Older versions kept readable copies of callable reads in localStorage: remove them on the first run. */
purgeLegacyPlaintext();

/* A pending wipe of Firestore's offline cache (sign-out, relationship end) runs before the SDK opens its database. */
/* The wipe must never keep the app from drawing: a hung IndexedDB call would leave a blank screen for good. */
void Promise.race([
  runPendingWipe().catch(() => false),
  new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 4000)),
]).then(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AppCrashBoundary>
        <LavaBackground />
        <App />
        <SyncStatusHost />
        <LegalGate />
        <GeoConsentHost />
        <HealthConsentHost />
      </AppCrashBoundary>
    </StrictMode>,
  ),
);
