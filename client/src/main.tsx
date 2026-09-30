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
import { ServerBusyOverlay } from './ui';
import { LavaBackground } from './components/LavaBackground';
import { initMotion } from './motion';

document.documentElement.lang = getLocale();
lockShellHeight();
initMotion();

if ('serviceWorker' in navigator) {
  void startAutoUpdate({
    container: navigator.serviceWorker,
    doc: document,
    onUpdateReady: markUpdateReady,
    now: () => Date.now(),
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LavaBackground />
    <App />
    <ServerBusyOverlay />
  </StrictMode>,
);
