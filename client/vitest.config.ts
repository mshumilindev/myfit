import { defineConfig } from 'vitest/config';
import WeightedShardSequencer from './vitest.sequencer';

export default defineConfig({
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
    // Atlas's knowledge base, loaded up front (the app builds it in a worker).
    setupFiles: ['src/atlas/testSetup.ts', 'src/coach/__fixtures__/setup.ts'],
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
