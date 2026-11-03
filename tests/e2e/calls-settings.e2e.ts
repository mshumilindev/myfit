/**
 * SPO-446 / SPO-434: Profile → Settings → Calls. The row is there when calls are on; the drawer shows the live picture,
 * the microphone level and the pickers, keeps "Direct connection" off by default and remembers every choice on the device.
 */
import { expect, test, type Page } from '@playwright/test';
import { CALL_PREFS_KEY, gotoApp, openPair } from './calls-helpers';

const prefs = (p: Page) =>
  p.evaluate(
    (k) => JSON.parse(localStorage.getItem(k) ?? 'null') as Record<string, unknown> | null,
    CALL_PREFS_KEY,
  );

test.beforeEach(() => test.setTimeout(60_000));

/** The fixtures build has no backend: the member's own profile (synthetic) is answered here, as the callable would. */
async function serveOwnProfile(p: Page): Promise<void> {
  const now = Date.now();
  const profile = {
    viewer: { id: 'e2e-member', relation: 'self', role: 'member' },
    person: {
      id: 'e2e-member',
      name: 'Anna Member',
      username: 'anna',
      firstName: 'Anna',
      lastName: 'Member',
      role: 'member',
      status: 'active',
      joinedAt: now - 200 * 86_400_000,
      trainerId: null,
      trainerName: null,
      clientCount: 0,
      avatar: false,
    },
    access: [],
    summary: {
      sessions: 0,
      sessions30: 0,
      perWeek30: 0,
      liveSessions: 0,
      firstSessionAt: null,
      lastSessionAt: null,
      durationMs: 0,
      sets: 0,
      exercises: 0,
      volumeKg: 0,
      cardioMinutes: 0,
      volume30: 0,
      volume7: 0,
    },
    sessions: [],
    gyms: [],
    topExercises: [],
    audit: [],
    bodyMetrics: null,
  };
  await p.route('**/profileUser', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ result: profile }),
    }),
  );
}

test('the Calls row opens the settings drawer; choices are saved on this device', async ({
  context,
  baseURL,
}, info) => {
  const pair = await openPair(context, baseURL!);
  const { client } = pair;
  await serveOwnProfile(client);
  await gotoApp(client, pair.clientUrl('#/profile/me'));
  await client.getByRole('button', { name: 'Settings', exact: true }).click();

  const row = client.getByRole('button', { name: /^Calls/ });
  await row.scrollIntoViewIfNeeded();
  await expect(row).toBeVisible();
  await row.click();

  const sheet = client.getByRole('dialog', { name: 'Call settings' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText('Calls are not recorded.')).toBeVisible();
  // live picture + microphone level from the fake devices
  const preview = sheet.locator('video');
  await expect
    .poll(() => preview.evaluate((v: HTMLVideoElement) => v.videoWidth * v.videoHeight), {
      timeout: 15_000,
    })
    .toBeGreaterThan(0);
  const meter = sheet.getByRole('meter', { name: 'Microphone level' });
  await expect
    .poll(async () => Number(await meter.getAttribute('aria-valuenow')), { timeout: 10_000 })
    .toBeGreaterThan(0);

  // safe default: relay (direct off)
  const direct = sheet.getByRole('switch', { name: 'Direct connection' });
  await expect(direct).toHaveAttribute('aria-checked', 'false');
  // the FIRST tap must count (a focused switch used to push the sheet into keyboard mode and the tap was lost)
  await direct.click();
  await expect(direct).toHaveAttribute('aria-checked', 'true');
  expect((await prefs(client))?.direct).toBe(true);

  const cam = sheet.getByRole('switch', { name: 'Camera starts on' });
  await cam.click();
  expect((await prefs(client))?.camOn).toBe(false);
  await expect(preview).toHaveCount(0);

  await client.screenshot({ path: `test-results/calls-settings-${info.project.name}.png` });
});

test('the row is not offered to someone who cannot call', async ({ context, baseURL }) => {
  const pair = await openPair(context, baseURL!, { prepare: (s) => s.off.add('e2e-member') });
  await serveOwnProfile(pair.client);
  await gotoApp(pair.client, pair.clientUrl('#/profile/me'));
  await pair.client.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(pair.client.getByRole('button', { name: /^Calls/ })).toHaveCount(0);
});
