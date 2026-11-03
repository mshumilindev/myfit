/**
 * SPO-22 / SPO-446 / SPO-434: the check before the first call on a device (picture, microphone level, device pickers,
 * camera switch), what it saves, that it does not come back, and how it is closed.
 */
import { expect, test } from '@playwright/test';
import {
  CALL_PREFS_KEY,
  callSurface,
  endBtn,
  failMedia,
  incoming,
  openChats,
  openPair,
  startCall,
} from './calls-helpers';

const dialog = (p: import('@playwright/test').Page) =>
  p.getByRole('alertdialog', { name: 'Check before the call' });
const prefs = (p: import('@playwright/test').Page) =>
  p.evaluate(
    (k) => JSON.parse(localStorage.getItem(k) ?? 'null') as Record<string, unknown> | null,
    CALL_PREFS_KEY,
  );

// Real WebRTC between two pages on a small runner: more room than the 30 s default.
test.beforeEach(() => test.setTimeout(60_000));

test('first call: the check opens with a live picture and microphone level; Start saves it and places the call; the second call skips it', async ({
  context,
  baseURL,
}) => {
  const pair = await openPair(context, baseURL!, { seen: false });
  const { trainer, client, server } = pair;
  await openChats(pair);

  await startCall(trainer, 'video');
  const dlg = dialog(trainer);
  await expect(dlg).toBeVisible();
  expect(server.startedBy('e2e-trainer')).toHaveLength(0); // nothing is placed by merely opening the check
  // own picture, live: frames are decoded
  const preview = dlg.locator('video');
  await expect
    .poll(() => preview.evaluate((v: HTMLVideoElement) => v.videoWidth * v.videoHeight), {
      timeout: 15_000,
    })
    .toBeGreaterThan(0);
  // microphone level meter moves with the (fake, beeping) microphone
  const meter = dlg.getByRole('meter', { name: 'Microphone level' });
  await expect(meter).toBeVisible();
  await expect
    .poll(async () => Number(await meter.getAttribute('aria-valuenow')), {
      timeout: 10_000,
      intervals: [100],
    })
    .toBeGreaterThan(0);
  // device pickers list the (fake) devices
  const mic = dlg.locator('label.uifield', { hasText: 'Microphone' }).locator('select');
  const cam = dlg.locator('label.uifield', { hasText: 'Camera' }).locator('select');
  await expect.poll(() => mic.locator('option').count()).toBeGreaterThan(0);
  await expect.poll(() => cam.locator('option').count()).toBeGreaterThan(0);
  const micOptions = await mic
    .locator('option')
    .evaluateAll((o) => o.map((x) => (x as HTMLOptionElement).value));
  expect(micOptions.every((v) => v !== '' || micOptions.length === 1)).toBe(true);
  if (micOptions.length > 1) {
    await mic.selectOption(micOptions[1]);
    expect((await prefs(trainer))?.mic).toBe(micOptions[1]);
  }
  // the camera switch: off removes the picture and is remembered
  const camSwitch = dlg
    .getByRole('switch', { name: 'Camera' })
    .or(dlg.getByRole('checkbox', { name: 'Camera' }));
  await camSwitch.first().click();
  await expect(preview).toHaveCount(0);
  expect((await prefs(trainer))?.camOn).toBe(false);
  await camSwitch.first().click();
  expect((await prefs(trainer))?.camOn).toBe(true);

  await dlg.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(dlg).toHaveCount(0);
  await expect(incoming(client)).toContainText('Incoming video call');
  expect(server.startedBy('e2e-trainer')).toHaveLength(1);
  expect((await prefs(trainer))?.seen).toBe(true);
  await endBtn(trainer).click();
  await expect(callSurface(trainer))
    .toHaveCount(0, { timeout: 8_000 })
    .catch(() => undefined);
  await trainer
    .getByRole('button', { name: 'Close', exact: true })
    .click({ timeout: 2_000 })
    .catch(() => undefined);

  // second call on this device: straight to the call
  await startCall(trainer, 'voice');
  await expect(dialog(trainer)).toHaveCount(0);
  await expect.poll(() => server.startedBy('e2e-trainer').length).toBe(2);
});

test('closing the check (Close, Escape) places no call and does not mark the device as checked', async ({
  context,
  baseURL,
}) => {
  const pair = await openPair(context, baseURL!, { seen: false });
  const { trainer, server } = pair;
  await openChats(pair);

  await startCall(trainer, 'voice');
  await expect(dialog(trainer)).toBeVisible();
  await dialog(trainer).getByRole('button', { name: 'Close', exact: true }).click();
  await expect(dialog(trainer)).toHaveCount(0);

  await startCall(trainer, 'voice');
  await expect(dialog(trainer)).toBeVisible();
  await trainer.keyboard.press('Escape');
  await expect(dialog(trainer)).toHaveCount(0);

  expect(server.calls.size).toBe(0);
  expect((await prefs(trainer))?.seen ?? false).toBe(false);
  // the camera/microphone of the check are released: no live track is left behind
  await expect
    .poll(() =>
      trainer.evaluate(
        () => [...document.querySelectorAll('video')].filter((v) => v.srcObject).length,
      ),
    )
    .toBe(0);
});

test('the check with the microphone blocked says so instead of showing a dead meter', async ({
  context,
  baseURL,
}) => {
  const pair = await openPair(context, baseURL!, { seen: false });
  const { trainer } = pair;
  await openChats(pair);
  await failMedia(trainer, 'NotAllowedError');
  await startCall(trainer, 'voice');
  await expect(dialog(trainer).getByRole('alert')).toContainText('Calls need the microphone');
  await expect(dialog(trainer).getByRole('meter')).toHaveCount(0);
});
