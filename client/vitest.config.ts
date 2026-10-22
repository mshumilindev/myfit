import { defineConfig } from 'vitest/config';
import WeightedShardSequencer from './vitest.sequencer';
import type { Plugin } from 'vite';

/**
 * Atlas answers synchronously in tests: the knowledge base is handed to the retriever and the facet store up front (the app
 * gets it from a worker). It is attached to the two modules themselves, so only test files that actually load them pay for
 * the KB import (~45% of files do not) - no list to keep in sync. Only the first copy of a module in a test file is loaded,
 * as before (a test that resets modules gets a fresh, empty retriever).
 */
const atlasTestKb = (): Plugin => ({
  name: 'atlas-test-kb',
  enforce: 'post',
  transform(code, id) {
    const file = id.split('?')[0].replace(/\\/g, '/');
    if (file.endsWith('/src/atlas/retrieve.ts'))
      return `${code}\nimport { KB as __testKb } from './kb';\nif (!globalThis.__testKbLoaded) {\n  globalThis.__testKbLoaded = true;\n  loadKb(__testKb);\n}\n`;
    if (file.endsWith('/src/atlas/facetStore.ts'))
      return `${code}\nimport { KB as __testKb, facetsTable as __testFacets } from './kb';\nif (!globalThis.__testFacetsLoaded) {\n  globalThis.__testFacetsLoaded = true;\n  setFacets(__testFacets(__testKb));\n}\n`;
    if (file.endsWith('/src/coach/data/testHooks.ts'))
      return `${code}\nif (typeof localStorage !== 'undefined') await import('../__fixtures__/register');\n`;
    return null;
  },
});

export default defineConfig({
  plugins: [atlasTestKb()],
  test: {
    environment: 'jsdom',
    // Same calendar everywhere: the CI runner is UTC, developer machines are not (a DST/midnight-dependent label made a test
    // pass locally and fail in CI). Tests that need another zone set process.env.TZ themselves.
    env: { TZ: 'UTC' },
    // Atlas builds its knowledge base on the first test of a file (the app does it in a worker): ~5-9 s on a loaded CI core.
    testTimeout: 30_000,
    include: ['src/**/*.test.{ts,tsx}'],
    // `--shard i/N` splits by measured weight, not by file count (see vitest.sequencer.ts).
    sequence: { sequencer: WeightedShardSequencer },
    setupFiles: ['src/coach/__fixtures__/setup.ts', 'src/legal/testSetup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // Чесний гейт: поріг тримаємо на модулях, які реально покриті тестами
      // (i18n — словники, плюрали, форматери). Розширюємо include разом з
      // новими тестами; знижувати пороги заборонено (.claude/rules/tests.md).
      include: ['src/i18n/**', 'src/data/**'],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
