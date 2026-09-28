import { fileURLToPath } from 'node:url';
import type { StorybookConfig } from '@storybook/react-vite';
import type { Plugin, PluginOption } from 'vite';

const firebaseStub = fileURLToPath(new URL('./firebaseStub.ts', import.meta.url));

/** Stories must never talk to the production Firebase project (analytics,
 *  Firestore listeners): every `…/firebase` import resolves to a demo stub. */
function stubFirebase(): Plugin {
  return {
    name: 'spotter-storybook-firebase-stub',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!importer || importer.includes('node_modules')) return null;
      if (/^(\.{1,2}\/)+firebase$/.test(source)) return firebaseStub;
      return null;
    },
  };
}

/** The PWA plugin (service worker, manifest) has no place in a component catalog. */
function withoutPwa(plugins: PluginOption[] | undefined): PluginOption[] {
  return (plugins ?? []).flat(Infinity as 1).filter((p) => {
    const name = p && typeof p === 'object' && 'name' in p ? String(p.name) : '';
    return !name.startsWith('vite-plugin-pwa');
  });
}

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  framework: { name: '@storybook/react-vite', options: {} },
  core: { disableTelemetry: true },
  staticDirs: ['../public'],
  typescript: { reactDocgen: 'react-docgen-typescript' },
  async viteFinal(cfg) {
    return {
      ...cfg,
      plugins: [stubFirebase(), ...withoutPwa(cfg.plugins)],
      build: { ...cfg.build, rollupOptions: { ...cfg.build?.rollupOptions, output: undefined } },
    };
  },
};

export default config;
