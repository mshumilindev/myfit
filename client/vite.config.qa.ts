/**
 * QA / screenshot build ONLY (never shipped, never used by `npm run build`): the normal app config plus the sample Coach
 * world, so a browser can show every screen without a deployed backend. It turns the test hooks on
 * (`import.meta.env.VITE_COACH_TEST_HOOKS`) and loads `src/coach/__fixtures__/qaEntry.ts` before the app.
 *   npx vite build --config vite.config.qa.ts --outDir ../_shots/iter25/qa --emptyOutDir
 */
import { defineConfig, mergeConfig, type Plugin } from 'vite';
import base from './vite.config';

const qaEntry = (): Plugin => ({
  name: 'spotter-qa-entry',
  // order 'pre': the tag is added BEFORE Vite bundles the page's module scripts, so it becomes part of the build
  transformIndexHtml: {
    order: 'pre',
    handler: () => [
      {
        tag: 'script',
        attrs: { type: 'module', src: '/src/coach/__fixtures__/qaEntry.ts' },
        injectTo: 'head-prepend',
      },
    ],
  },
});

export default mergeConfig(
  base,
  defineConfig({
    define: { 'import.meta.env.VITE_COACH_TEST_HOOKS': JSON.stringify('1') },
    plugins: [qaEntry()],
  }),
);
