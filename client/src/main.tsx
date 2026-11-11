import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
// Cyberpunk type (SPO-344, ADR 007): Barlow / Barlow Condensed for latin, Fira Sans / Fira Sans Condensed for
// Cyrillic (Barlow has none). Subsets only, self-hosted.
import '@fontsource/jetbrains-mono/latin-500.css';
import '@fontsource/jetbrains-mono/latin-700.css';
import '@fontsource/jetbrains-mono/latin-ext-500.css';
import '@fontsource/jetbrains-mono/latin-ext-700.css';
import '@fontsource/jetbrains-mono/cyrillic-500.css';
import '@fontsource/jetbrains-mono/cyrillic-700.css';
// Brand wordmark (header, nutrition bar, share card). Self-hosted: no request to Google Fonts (SPO-287).
import '@fontsource/kaushan-script/latin-400.css';
import '@fontsource/kaushan-script/latin-ext-400.css';
// Each look's own fonts, tokens and styles load with it (themes/bundles/, themes/lazy.ts).
import '@fontsource/figtree/latin-400.css';
import '@fontsource/figtree/latin-600.css';
import '@fontsource/figtree/latin-700.css';
import '@fontsource/figtree/latin-800.css';
import '@fontsource/onest/cyrillic-400.css';
import '@fontsource/onest/cyrillic-600.css';
import '@fontsource/onest/cyrillic-700.css';
import '@fontsource/onest/cyrillic-800.css';
import { ChristmasSnow } from './components/ChristmasSnow';
import { HalloweenBats } from './components/HalloweenBats';
import './tokens/primitives.css';
import './tokens/primitives.studio.css';
import './styles.css';
import './redesign.css';
import './page-titles.css';
import { initTheme, setAllowedThemes } from './themes';
import { addonsPref, themeIdsOf } from './addons/enabledSet';
import { initModePref } from './themes/modePref';
import { initSwitchLabel } from './components/switchLabel';
import { startHolidayWatch } from './themes/holidayWatch';
import './glass.css';
import './glass-tail.css';
import './glass-shape.css';
import './glass-glitch.css';
import './reduced-transparency.css';
import { App } from './App';
import { getLocale } from './i18n';
import {
  startAutoUpdate,
  startBuildWatch,
  markUpdateReady,
  warmLoadedAssets,
  raiseResourceTimingBuffer,
} from './pwaUpdate';
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
import { EmailGate } from './accounts/EmailGate';
import { GeoConsentHost } from './legal/GeoConsentHost';
import { AtlasHistoryGate } from './atlas/AtlasHistoryGate';
import { HealthConsentHost } from './legal/HealthConsentHost';

// Clean URLs (no `#`): rewrite a legacy `/#/route` link to `/route` before the app reads its route.
installCleanUrls();
installRouteSwitch();
// the language first: the holiday schedule (Easter) depends on it
document.documentElement.lang = getLocale();
// The installed looks are read from the device before the first paint, so a saved or scheduled theme that is not
// installed never flashes.
setAllowedThemes(themeIdsOf(new Set(addonsPref.snapshot().list)));
initTheme();
initModePref();
initSwitchLabel();
// a holiday theme comes on and goes off with the date, checked on this device (no server): SPO-321
startHolidayWatch();
lockShellHeight();
installHorizontalScrollGuard();
initMotion();
installCrashRecovery();

raiseResourceTimingBuffer();
if ('serviceWorker' in navigator) {
  void startAutoUpdate({
    container: navigator.serviceWorker,
    doc: document,
    onUpdateReady: markUpdateReady,
    now: () => Date.now(),
    onFirstClaim: () => void warmLoadedAssets(),
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
        <ChristmasSnow />
        <SyncStatusHost />
        <ThemePreviewHost />
        <LegalGate />
        <EmailGate />
        <GeoConsentHost />
        <AtlasHistoryGate />
        <HealthConsentHost />
      </AppCrashBoundary>
    </StrictMode>,
  ),
);
