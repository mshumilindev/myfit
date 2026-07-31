import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // Чесний гейт: поріг тримаємо на модулях, які реально покриті тестами
      // (i18n — словники, плюрали, форматери). Розширюємо include разом з
      // новими тестами; знижувати пороги заборонено (test-integrity.mdc).
      include: ['src/i18n/**'],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
