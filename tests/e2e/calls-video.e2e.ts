/**
 * SPO-22 / SPO-434: video calls, voice-only answer, call layouts (mini, bar, full screen) and a lost link.
 * Real WebRTC between two pages of one context; the camera and microphone are Chromium's fake devices.
 */
import { expect, test, type Page } from '@playwright/test';
import {
  answerBtn,
  callScreen,
  callSurface,
  connect,
  endBtn,
  expectActive,
  expectEndedAndClose,
  expectMediaFlowing,
  incoming,
  isCompact,
  openChats,
  openPair,
  sending,
  startCall,
  statusLine,
  endTitle,
} from './calls-helpers';

const remoteVideo = (p: Page) => p.locator('video.uicall-video:not(.uicall-video--mirror)');
const selfVideo = (p: Page) => p.locator('video.uicall-video--mirror');

/** A <video> that has decoded frames of the other person. */
async function expectPicture(p: Page): Promise<void> {
  await expect
    .poll(() => remoteVideo(p).evaluate((v: HTMLVideoElement) => v.videoWidth * v.videoHeight), {
      timeout: 15_000,
      message: 'remote video shows frames',
    })
    .toBeGreaterThan(0);
}

// Real WebRTC between two pages on a small runner: more room than the 30 s default.
test.beforeEach(() => test.setTimeout(60_000));

test('video call: remote pictures on both sides, own preview, camera off/on, hang up', async ({
  context,
  baseURL,
}) => {
  const pair = await openPair(context, baseURL!);
  await openChats(pair);
  const { trainer, client, server } = pair;
  await startCall(trainer, 'video');
  // incoming video: kind line, and the voice-only choice
  await expect(incoming(client)).toContainText('Incoming video call');
  await expect(client.getByRole('button', { name: 'Answer with voice only' })).toBeVisible();
  await answerBtn(client).click();
  await expectActive(trainer, client);
  await expectMediaFlowing(trainer, ['audio', 'video']);
  await expectMediaFlowing(client, ['audio', 'video']);
  await expectPicture(trainer);
  await expectPicture(client);
  await expect(selfVideo(trainer)).toBeVisible();
  expect(server.calls.get(server.startedBy('e2e-trainer')[0].id)?.kind).toBe('video');

  // camera off on the client: label flips, the camera stops sending, own preview goes, the trainer still has audio
  await client.getByRole('button', { name: 'Turn camera off', exact: true }).click();
  const camOn = client.getByRole('button', { name: 'Turn camera on', exact: true });
  await expect(camOn).toHaveAttribute('aria-pressed', 'true');
  expect(await sending(client, 'video')).toBe(false);
  expect(await sending(client, 'audio')).toBe(true);
  await expect(selfVideo(client)).toHaveCount(0);
  await camOn.click();
  expect(await sending(client, 'video')).toBe(true);
  await expect(selfVideo(client)).toBeVisible();
  await expect(client.getByRole('button', { name: 'Turn camera off', exact: true })).toBeVisible();

  await endBtn(trainer).click();
  await expect(callSurface(trainer).first()).toBeVisible();
  await expectEndedAndClose(client, /Call ended/);
  expect(pair.errors.trainer).toEqual([]);
  expect(pair.errors.client).toEqual([]);
});

test('"Answer with voice only": the callee sends no camera, the call runs with audio', async ({
  context,
  baseURL,
}) => {
  const pair = await openPair(context, baseURL!);
  await openChats(pair);
  const { trainer, client } = pair;
  await connect(trainer, client, 'video', { voiceOnly: true });
  await expectMediaFlowing(trainer, ['audio']);
  await expectMediaFlowing(client, ['audio']);
  expect(await sending(client, 'video')).toBeNull();
  await expect(client.getByRole('button', { name: /camera/i })).toHaveCount(0);
  await expect(remoteVideo(client)).toHaveCount(0);
  await expect(selfVideo(client)).toHaveCount(0);
  // the caller keeps sending video, but has no picture back: the avatar and the voice bars are drawn
  await expect(remoteVideo(trainer)).toHaveCount(0);
  await expect(trainer.locator('.uicall-wave')).toBeVisible();
  await endBtn(client).click();
  await expectEndedAndClose(trainer, /Call ended/);
});

test('layouts: minimise to the floating tile / strip, back to the call, full screen on desktop', async ({
  context,
  baseURL,
}) => {
  const pair = await openPair(context, baseURL!);
  await openChats(pair);
  const { trainer, client } = pair;
  await connect(trainer, client, 'video');
  await expectPicture(trainer);
  const mini = isCompact(trainer);

  await trainer.getByRole('button', { name: 'Minimise', exact: true }).click();
  await expect(callScreen(trainer)).toHaveCount(0);
  if (mini) {
    // phone: a strip under the header with the title, timer, mic and hang-up
    const bar = trainer.locator('.uicall-bar');
    await expect(bar).toContainText('Call with Oleh Bondar');
    await expect(bar).toContainText(/\d\d:\d\d/);
    await bar.getByRole('button', { name: 'Mute', exact: true }).click();
    expect(await sending(trainer, 'audio')).toBe(false);
    await bar.getByRole('button', { name: 'Unmute', exact: true }).click();
    await bar.getByRole('button', { name: 'Back to the call' }).click();
  } else {
    // desktop: a small floating tile with the picture and the timer
    const tile = trainer.locator('.uicall-mini');
    await expect(tile).toBeVisible();
    await expect(tile.locator('video')).toBeVisible();
    await expect(tile).toContainText(/\d\d:\d\d/);
    await tile.getByRole('button', { name: /^Back to the call/ }).click();
  }
  await expect(callScreen(trainer)).toBeVisible();
  await expect(statusLine(trainer)).toHaveText(/^\d\d:\d\d$/);

  if (!mini) {
    const full = trainer.getByRole('button', { name: 'Full screen', exact: true });
    await full.click();
    await expect(callScreen(trainer)).toHaveClass(/uicall--full/);
    const box = await callScreen(trainer).boundingBox();
    const vp = trainer.viewportSize()!;
    expect(box!.width).toBeGreaterThanOrEqual(vp.width - 2);
    await trainer.getByRole('button', { name: 'Exit full screen', exact: true }).click();
    await expect(callScreen(trainer)).not.toHaveClass(/uicall--full/);
    // minimised, the hang-up still works from the tile
    await trainer.getByRole('button', { name: 'Minimise', exact: true }).click();
    await trainer
      .locator('.uicall-mini')
      .getByRole('button', { name: 'End call', exact: true })
      .click();
  } else {
    await trainer.getByRole('button', { name: 'Minimise', exact: true }).click();
    await trainer
      .locator('.uicall-bar')
      .getByRole('button', { name: 'End call', exact: true })
      .click();
  }
  await expectEndedAndClose(trainer, /Call ended/);
  await expectEndedAndClose(client, /Call ended/);
});

test('link lost: "Reconnecting…", then back to the call; at 20 s the call is dropped for both', async ({
  context,
  baseURL,
}) => {
  const pair = await openPair(context, baseURL!);
  const { trainer, client, server } = pair;
  await trainer.clock.install();
  await openChats(pair);
  await connect(trainer, client, 'voice');

  expect(await trainer.evaluate(() => window.__callsE2E?.dropLink('disconnected'))).toBe(true);
  await expect(statusLine(trainer)).toHaveText('Reconnecting…');
  await expect(trainer.locator('.uicall-notice')).toContainText('Reconnecting…');
  // no minimise while reconnecting
  await expect(trainer.getByRole('button', { name: 'Minimise', exact: true })).toHaveCount(0);
  expect(await trainer.evaluate(() => window.__callsE2E?.restoreLink())).toBe(true);
  await expect(statusLine(trainer)).toHaveText(/^\d\d:\d\d$/);
  await expect(trainer.locator('.uicall-notice')).toHaveCount(0);

  // lost for good
  await trainer.evaluate(() => window.__callsE2E?.dropLink('disconnected'));
  await expect(statusLine(trainer)).toHaveText('Reconnecting…');
  await trainer.clock.fastForward(21_000);
  await expect(endTitle(trainer)).toHaveText('Connection lost');
  await expect(trainer.locator('.uicall-end')).toContainText('Check your connection and try again');
  await expect(endTitle(client)).toHaveText('Connection lost');
  expect(server.calls.get(server.startedBy('e2e-trainer')[0].id)?.endReason).toBe('failed');
  await expectEndedAndClose(trainer, 'Connection lost');
  await expectEndedAndClose(client, 'Connection lost');
});

test('weak link on a video call drops the video and keeps the voice', async ({
  context,
  baseURL,
}) => {
  const pair = await openPair(context, baseURL!);
  const { trainer, client } = pair;
  await trainer.clock.install();
  await openChats(pair);
  await connect(trainer, client, 'video');
  await expectPicture(trainer);
  await trainer.evaluate(() => window.__callsE2E?.dropLink('disconnected'));
  await expect(statusLine(trainer)).toHaveText('Reconnecting…');
  await trainer.clock.fastForward(7_000);
  await trainer.evaluate(() => window.__callsE2E?.restoreLink());
  await expect(trainer.locator('.uicall-notice')).toContainText('Weak connection — voice only');
  await expect(selfVideo(trainer)).toHaveCount(0);
  await expect(trainer.getByRole('button', { name: /camera/i })).toHaveCount(0);
  expect(await sending(trainer, 'audio')).toBe(true);
  await endBtn(trainer).click();
  await expectEndedAndClose(client, /Call ended/);
});

test('a connection that fails outright ends the call as dropped on both sides', async ({
  context,
  baseURL,
}) => {
  const pair = await openPair(context, baseURL!);
  const { trainer, client } = pair;
  await openChats(pair);
  await connect(trainer, client, 'voice');
  await trainer.evaluate(() => window.__callsE2E?.dropLink('failed'));
  await expectEndedAndClose(trainer, 'Connection lost');
  await expectEndedAndClose(client, 'Connection lost');
});
