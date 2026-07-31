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
      include: [
        'client/src/store.ts',
        'client/src/i18n/index.ts',
        'server/src/auth.ts',
        'server/src/gyms.ts',
        'server/src/workouts.ts',
      ],
      exclude: ['client/src/main.tsx', 'server/src/index.ts', '**/*.d.ts', '**/dist/**'],
      thresholds: {
        statements: 90,
        branches: 70,
        functions: 90,
        lines: 90,
      },
    },
  },
});
