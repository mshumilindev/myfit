import type { Decorator, Preview } from '@storybook/react-vite';
import { CallEntryProvider } from '../src/coach/calls/CallEntry';
import { IncomingCall } from '../src/components/ui/IncomingCall';
import { CallBar } from '../src/components/ui/CallBar';
import { CallMini } from '../src/components/ui/CallMini';
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
import '../src/tokens/primitives.css';
import '../src/tokens/primitives.cyberpunk.css';
import '../src/tokens/primitives.halloween.css';
import '../src/tokens/primitives.christmas.css';
import '@fontsource/jost/latin-400.css';
import '@fontsource/jost/latin-500.css';
import '@fontsource/jost/latin-600.css';
import '@fontsource/jost/cyrillic-400.css';
import '@fontsource/jost/cyrillic-500.css';
import '@fontsource/jost/cyrillic-600.css';
import '../src/styles.css';
import '../src/redesign.css';
import { AXES, DEFAULT_THEME, THEMES, type AxisName } from '../src/themes';
import '../src/glass.css';
import '../src/glass-shape.css';
import '../src/glass-glitch.css';
import '../src/reduced-transparency.css';
import { LOCALE_IDS, setLocale, type LocaleId } from '../src/i18n';
import '../src/coach/__fixtures__/register';

/** Toolbar locale (en/uk/pl/lt/et) → the app's own i18n switch. */
const withLocale: Decorator = (Story, ctx) => {
  const locale = (ctx.globals.locale as LocaleId | undefined) ?? 'en';
  setLocale(locale);
  document.documentElement.lang = locale;
  return <Story />;
};

/** Toolbar theme (SPO-344): every theme in the registry; default = the app's default theme. */
const withTheme: Decorator = (Story, ctx) => {
  const id = (ctx.globals.theme as string | undefined) ?? DEFAULT_THEME;
  document.documentElement.setAttribute('data-theme', id);
  for (const axis of Object.keys(AXES) as AxisName[]) {
    document.documentElement.setAttribute(
      AXES[axis].attr,
      (ctx.globals[axis] as string | undefined) ?? AXES[axis].default,
    );
  }
  return <Story />;
};
document.documentElement.setAttribute('data-theme', DEFAULT_THEME);

/** SPO-433 design review: `?calls=on|offline` in the iframe URL shows the call entry buttons on real screens. */
const withCalls: Decorator = (Story) => {
  const mode =
    typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('calls');
  if (!mode) return <Story />;
  return (
    <CallEntryProvider
      value={{
        voiceLabel: 'Voice call',
        videoLabel: 'Video call',
        callLabel: 'Call',
        disabledReason: mode === 'offline' ? 'Offline' : undefined,
        onVoice: () => undefined,
        onVideo: () => undefined,
        showLog: true,
      }}
    >
      <Story />
      {mode === 'incoming' && (
        <IncomingCall
          name="Anna Kovalenko"
          kind="Video call"
          sub="Your client"
          answerLabel="Answer"
          declineLabel="Decline"
          voiceOnlyLabel="Answer with voice only"
          onAnswer={() => undefined}
          onDecline={() => undefined}
          onVoiceOnly={() => undefined}
        />
      )}
      {mode === 'card' && (
        <IncomingCall
          variant="card"
          name="Anna Kovalenko"
          kind="Video call"
          sub="Your client"
          answerLabel="Answer"
          declineLabel="Decline"
          voiceOnlyLabel="Voice only"
          onAnswer={() => undefined}
          onDecline={() => undefined}
          onVoiceOnly={() => undefined}
        />
      )}
      {mode === 'bar' && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 70 }}>
          <CallBar
            title="Call with Anna"
            time="12:41"
            returnLabel="Back to the call"
            micOn
            micLabel="Mute"
            onMic={() => undefined}
            endLabel="End call"
            onEnd={() => undefined}
            onReturn={() => undefined}
          />
        </div>
      )}
      {mode === 'mini' && (
        <CallMini
          name="Anna Kovalenko"
          time="12:41"
          expandLabel="Expand the call"
          endLabel="End call"
          onExpand={() => undefined}
          onEnd={() => undefined}
        />
      )}
    </CallEntryProvider>
  );
};

const preview: Preview = {
  decorators: [withCalls, withLocale, withTheme],
  globalTypes: {
    theme: {
      description: 'Theme',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        items: THEMES.map((t) => ({ value: t.id, title: t.name })),
        dynamicTitle: true,
      },
    },
    ...Object.fromEntries(
      (Object.keys(AXES) as AxisName[]).map((axis) => [
        axis,
        {
          description: `Look axis: ${axis}`,
          toolbar: {
            title: axis,
            items: AXES[axis].values.map((v) => ({ value: v, title: v })),
            dynamicTitle: true,
          },
        },
      ]),
    ),
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
    theme: DEFAULT_THEME,
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
