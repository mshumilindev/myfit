import type { Decorator, Preview } from '@storybook/react-vite';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '../src/styles.css';
import '../src/redesign.css';
import '../src/glass.css';
import { LOCALE_IDS, setLocale, type LocaleId } from '../src/i18n';

/** Toolbar locale (en/uk/pl/lt/et) → the app's own i18n switch. */
const withLocale: Decorator = (Story, ctx) => {
  const locale = (ctx.globals.locale as LocaleId | undefined) ?? 'en';
  setLocale(locale);
  document.documentElement.lang = locale;
  return <Story />;
};

/** Toolbar theme (graphite / brass glass) → the same root class the app sets
 * from the `brassGlass` flag (data/flags.ts + glass.css). */
const withTheme: Decorator = (Story, ctx) => {
  const theme = (ctx.globals.theme as string | undefined) ?? 'graphite';
  document.documentElement.classList.toggle('theme-glass', theme === 'glass');
  return <Story />;
};

const preview: Preview = {
  decorators: [withLocale, withTheme],
  globalTypes: {
    theme: {
      description: 'Skin',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        items: [
          { value: 'graphite', title: 'Graphite (default)' },
          { value: 'glass', title: 'Brass Glass' },
        ],
        dynamicTitle: true,
      },
    },
    locale: {
      description: 'UI locale',
      toolbar: {
        title: 'Locale',
        icon: 'globe',
        items: LOCALE_IDS.map((id) => ({ value: id, title: id.toUpperCase() })),
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    locale: 'en',
    theme: 'graphite',
    backgrounds: { value: 'app' },
    viewport: { value: 'phone', isRotated: false },
  },
  parameters: {
    layout: 'padded',
    controls: { expanded: true },
    backgrounds: {
      options: {
        app: { name: 'App (--color-bg)', value: '#16171a' },
        surface: { name: 'Surface (--color-surface)', value: '#1f2125' },
      },
    },
    viewport: {
      options: {
        phone: {
          name: 'Phone 390×844',
          styles: { width: '390px', height: '844px' },
          type: 'mobile',
        },
        web: {
          name: 'Web 1280×800',
          styles: { width: '1280px', height: '800px' },
          type: 'desktop',
        },
      },
    },
  },
};

export default preview;
