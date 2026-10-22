import { defineConfig, devices } from '@playwright/test';

/**
 * Two families of projects:
 *  - `mobile-chromium`: the legacy flows (tests/e2e/my-fit + offline-startup), unchanged.
 *  - `coach-390 / 768 / 1024 / 1440`: the Coach dashboard (tests/e2e/coach-*.e2e.ts) against a production build with the
 *    FIXTURES backend served by `vite preview` on :4174. `npm run e2e:coach` (see docs/COACH-STATUS.md).
 *
 * E2E_COACH_URL=<url> skips the built-in web server (serve client/dist-e2e yourself, e.g. in CI or the cloud sandbox).
 * PLAYWRIGHT_BROWSERS_PATH points at the Chromium install when it is not in the default cache.
 */
const COACH_PORT = 4174;
const coachUrl = process.env.E2E_COACH_URL ?? `http://127.0.0.1:${COACH_PORT}`;
// privacy-sharing (SPO-107/108) runs on the same fixtures build: the member-side sample trainer
const coachFiles = ['**/coach-*.e2e.ts', '**/privacy-sharing.e2e.ts'];

const coachProject = (width: number, height: number) => ({
  name: `coach-${width}`,
  testMatch: coachFiles,
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width, height },
    baseURL: coachUrl,
    // Phone widths behave like a phone: touch + mobile UA bits the app keys off.
    ...(width < 768 ? { isMobile: true, hasTouch: true } : {}),
  },
});

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'mobile-chromium',
      testIgnore: coachFiles,
      use: { ...devices['Pixel 5'] },
    },
    coachProject(390, 844),
    coachProject(768, 1024),
    coachProject(1024, 768),
    coachProject(1440, 900),
  ],
  webServer:
    process.env.E2E_COACH_URL || process.env.E2E_COACH !== '1'
      ? undefined
      : {
          // Build once (fixtures backend, own outDir so `client/dist` is untouched), then serve it.
          command:
            `bash -c "cd client && ([ -f dist-e2e/index.html ] || VITE_COACH_BACKEND=fixtures npx vite build --outDir dist-e2e --emptyOutDir) ` +
            `&& npx vite preview --outDir dist-e2e --host 127.0.0.1 --port ${COACH_PORT} --strictPort"`,
          url: coachUrl,
          reuseExistingServer: true,
          timeout: 300_000,
        },
});
