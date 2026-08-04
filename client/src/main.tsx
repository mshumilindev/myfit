import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import './styles.css';
import { App } from './App';
import { getLocale } from './i18n';
import { ServerBusyOverlay } from './ui';

document.documentElement.lang = getLocale();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <ServerBusyOverlay />
  </StrictMode>,
);
