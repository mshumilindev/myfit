import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    // Atlas builds its knowledge base on the first test of a file (the app does it in a worker): ~5-9 s on a loaded CI core.
    testTimeout: 30_000,
    include: ['src/**/*.test.{ts,tsx}'],
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
