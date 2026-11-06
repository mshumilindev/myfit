import { createRoot } from 'react-dom/client';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/barlow/latin-500.css';
import '@fontsource/barlow/latin-700.css';
import '@fontsource/barlow-condensed/latin-700.css';
import './tokens/primitives.css';
import './tokens/primitives.cyberpunk.css';
import './styles.css';
import './redesign.css';
import './page-titles.css';
import './glass.css';
import './glass-shape.css';
import './glass-glitch.css';
import './tokens/primitives.halloween.css';
import './tokens/primitives.christmas.css';
import './themes/cyberpunk.css';
import './themes/halloween.css';
import './themes/christmas.css';
import './themes/glass.css';
import { LavaBackground } from './components/LavaBackground';
import { StoreApp } from './addonStore/StoreApp';
const role = (new URLSearchParams(location.search).get('role') ?? 'member') as 'member';
const theme = new URLSearchParams(location.search).get('theme');
if (theme) document.documentElement.setAttribute('data-theme', theme);
createRoot(document.getElementById('root')!).render(
  <>
    <LavaBackground />
    <div className="app app-apex-root">
      <StoreApp role={role} onOpenProfile={() => {}} />
    </div>
  </>,
);
