import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
// Cyberpunk type (SPO-344, ADR 007): Barlow / Barlow Condensed for latin, Fira Sans / Fira Sans Condensed for
// Cyrillic (Barlow has none). Subsets only, self-hosted.
import '@fontsource/barlow/latin-400.css';
import '@fontsource/barlow/latin-500.css';
import '@fontsource/barlow/latin-600.css';
import '@fontsource/barlow/latin-700.css';
import '@fontsource/barlow/latin-ext-400.css';
import '@fontsource/barlow/latin-ext-500.css';
import '@fontsource/barlow/latin-ext-600.css';
import '@fontsource/barlow/latin-ext-700.css';
import '@fontsource/barlow-condensed/latin-500.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/barlow-condensed/latin-ext-500.css';
import '@fontsource/barlow-condensed/latin-ext-600.css';
import '@fontsource/barlow-condensed/latin-ext-700.css';
import '@fontsource/chakra-petch/latin-500.css';
import '@fontsource/chakra-petch/latin-600.css';
import '@fontsource/chakra-petch/latin-700.css';
import '@fontsource/chakra-petch/latin-ext-500.css';
import '@fontsource/chakra-petch/latin-ext-600.css';
import '@fontsource/chakra-petch/latin-ext-700.css';
import '@fontsource/exo-2/cyrillic-600.css';
import '@fontsource/exo-2/cyrillic-700.css';
import '@fontsource/jetbrains-mono/latin-500.css';
import '@fontsource/jetbrains-mono/latin-700.css';
import '@fontsource/jetbrains-mono/latin-ext-500.css';
import '@fontsource/jetbrains-mono/latin-ext-700.css';
import '@fontsource/jetbrains-mono/cyrillic-500.css';
import '@fontsource/jetbrains-mono/cyrillic-700.css';
import '@fontsource/fira-sans/cyrillic-400.css';
import '@fontsource/fira-sans/cyrillic-500.css';
import '@fontsource/fira-sans/cyrillic-600.css';
import '@fontsource/fira-sans/cyrillic-700.css';
import '@fontsource/fira-sans-condensed/cyrillic-500.css';
import '@fontsource/fira-sans-condensed/cyrillic-600.css';
import '@fontsource/fira-sans-condensed/cyrillic-700.css';
// Brand wordmark (header, nutrition bar, share card). Self-hosted: no request to Google Fonts (SPO-287).
import '@fontsource/kaushan-script/latin-400.css';
import '@fontsource/kaushan-script/latin-ext-400.css';
// Halloween type (SPO-378): IM Fell English for display, Crimson Pro for text (latin); neither has Cyrillic, so
// Cormorant Garamond (display) and Spectral (text) carry Cyrillic. Subsets only, self-hosted.
import '@fontsource/im-fell-english/latin-400.css';
import '@fontsource/crimson-pro/latin-400.css';
import '@fontsource/crimson-pro/latin-600.css';
import '@fontsource/crimson-pro/latin-ext-400.css';
import '@fontsource/crimson-pro/latin-ext-600.css';
import '@fontsource/spectral/cyrillic-400.css';
import '@fontsource/spectral/cyrillic-600.css';
import '@fontsource/cormorant-garamond/cyrillic-500.css';
import '@fontsource/cormorant-garamond/cyrillic-600.css';
import { HalloweenBats } from './components/HalloweenBats';
import './tokens/primitives.css';
import './tokens/primitives.cyberpunk.css';
import './tokens/primitives.halloween.css';
import './styles.css';
import './redesign.css';
import './page-titles.css';
import { initTheme } from './themes';
import { startHolidayWatch } from './themes/holidayWatch';
import './glass.css';
import './glass-shape.css';
import './glass-glitch.css';
import './reduced-transparency.css';
import { App } from './App';
import { getLocale } from './i18n';
import { startAutoUpdate, startBuildWatch, markUpdateReady } from './pwaUpdate';
import { lockShellHeight } from './viewportFit';
import { installHorizontalScrollGuard } from './horizontalScrollGuard';
import { SyncStatusHost } from './components/SyncStatusHost';
import { ThemePreviewHost } from './components/ThemeAnnouncement';
import { LavaBackground } from './components/LavaBackground';
import { initMotion } from './motion';
import { purgeLegacyPlaintext, runPendingWipe } from './deviceWipe';
import { AppCrashBoundary, installCrashRecovery } from './appCrash';
import { installRouteSwitch } from './components/routeSwitch';
import { installCleanUrls } from './route';
import { LegalGate } from './legal/LegalGate';
import { GeoConsentHost } from './legal/GeoConsentHost';
import { AtlasHistoryHost } from './atlas/AtlasHistoryHost';
import { HealthConsentHost } from './legal/HealthConsentHost';

// Clean URLs (no `#`): rewrite a legacy `/#/route` link to `/route` before the app reads its route.
installCleanUrls();
installRouteSwitch();
// the language first: the holiday schedule (Easter) depends on it
document.documentElement.lang = getLocale();
initTheme();
// a holiday theme comes on and goes off with the date, checked on this device (no server): SPO-321
startHolidayWatch();
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
        <HalloweenBats />
        <SyncStatusHost />
        <ThemePreviewHost />
        <LegalGate />
        <GeoConsentHost />
        <AtlasHistoryHost />
        <HealthConsentHost />
      </AppCrashBoundary>
    </StrictMode>,
  ),
);
