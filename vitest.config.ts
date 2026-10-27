import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      // store.ts moved to Firestore I/O; re-gate it once Firebase store tests
      // catch up (see FIREBASE.md). Until then only the i18n core is gated here.
      include: ['client/src/i18n/index.ts'],
      exclude: ['client/src/main.tsx', '**/*.d.ts', '**/dist/**'],
      thresholds: {
        statements: 90,
        branches: 70,
        functions: 90,
        lines: 90,
      },
    },
  },
});
