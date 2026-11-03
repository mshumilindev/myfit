/**
 * SPO-22 / SPO-445 / SPO-434: the line a finished call leaves in the chat (written by the caller's device), "Call back",
 * and the calls that leave nothing. The chat of the OTHER person is a separate sample world on the fixtures build, so
 * what the callee's chat shows ("Missed call") is covered by the unit tests of CallLogLine, not here.
 */
import { expect, test } from '@playwright/test';
import {
  answerBtn,
  connect,
  endBtn,
  expectActive,
  expectEndedAndClose,
  failMedia,
  gotoApp,
  incoming,
  logRows,
  openChats,
  openPair,
  openThreadWithClient,
  startCall,
  closeBtn,
  callSurface,
} from './calls-helpers';

// Real WebRTC between two pages on a small runner: more room than the 30 s default.
test.beforeEach(() => test.setTimeout(60_000));

test('finished calls leave "Video call · N min" / "Voice call · N min" in the caller\'s chat, whoever hangs up', async ({
  context,
  baseURL,
}) => {
  const pair = await openPair(context, baseURL!);
  const { trainer, client } = pair;
  await openChats(pair);
  await expect(logRows(trainer)).toHaveCount(0);

  await connect(trainer, client, 'video');
  await endBtn(trainer).click();
  await expectEndedAndClose(client, /Call ended/);
  await expect(logRows(trainer)).toHaveCount(1);
  await expect(logRows(trainer).first()).toContainText('Video call · 1 min');
  await expect(logRows(trainer).first().getByRole('button', { name: 'Call back' })).toHaveCount(0);

  await closeBtn(trainer)
    .click({ timeout: 1_500 })
    .catch(() => undefined);
  await connect(trainer, client, 'voice');
  await endBtn(client).click(); // the callee hangs up: the caller's device still writes the line
  await expectEndedAndClose(client, /Call ended/).catch(() => undefined);
  await expect(logRows(trainer)).toHaveCount(2);
  await expect(logRows(trainer).nth(1)).toContainText('Voice call · 1 min');
  expect(pair.errors.trainer).toEqual([]);
});

test('no answer leaves "No answer" with a Call back that really calls again', async ({
  context,
  baseURL,
}) => {
  const pair = await openPair(context, baseURL!);
  const { trainer, client, server } = pair;
  await trainer.clock.install();
  await openChats(pair);
  await startCall(trainer, 'video');
  await expect(incoming(client)).toBeVisible();
  await trainer.clock.fastForward(46_000);
  await expectEndedAndClose(trainer, 'No answer');
  await expectEndedAndClose(client, 'No answer');
  const row = logRows(trainer).first();
  await expect(row).toContainText('No answer');
  await row.getByRole('button', { name: 'Call back' }).click();
  // it is a new call of the same kind (video), and it rings the client again
  await expect(incoming(client)).toContainText('Incoming video call');
  expect(server.startedBy('e2e-trainer')).toHaveLength(2);
  expect(new Set(server.startedBy('e2e-trainer').map((d) => d.id)).size).toBe(2);
  expect(server.startedBy('e2e-trainer')[1].kind).toBe('video');
  await answerBtn(client).click();
  await expectActive(trainer, client);
  await endBtn(trainer).click();
  await expectEndedAndClose(client, /Call ended/);
});

test('a declined call leaves "Call declined" (with Call back); a dropped one "Call dropped — connection lost"', async ({
  context,
  baseURL,
}) => {
  const pair = await openPair(context, baseURL!);
  const { trainer, client } = pair;
  await openChats(pair);
  await startCall(trainer, 'voice');
  await expect(incoming(client)).toBeVisible();
  await client.getByRole('button', { name: 'Decline', exact: true }).click();
  await expectEndedAndClose(client, 'Call declined');
  await expectEndedAndClose(trainer, 'Call declined');
  await expect(logRows(trainer).first()).toContainText('Call declined');
  await expect(logRows(trainer).first().getByRole('button', { name: 'Call back' })).toBeVisible();

  await connect(trainer, client, 'voice');
  await trainer.evaluate(() => window.__callsE2E?.dropLink('failed'));
  await expectEndedAndClose(trainer, 'Connection lost');
  await expectEndedAndClose(client, 'Connection lost');
  await expect(logRows(trainer)).toHaveCount(2);
  await expect(logRows(trainer).nth(1)).toContainText('Call dropped — connection lost');
  await expect(logRows(trainer).nth(1).getByRole('button', { name: 'Call back' })).toBeVisible();
});

test('unavailable, busy and a blocked microphone leave nothing in the chat (the other side never learns of the attempt)', async ({
  context,
  baseURL,
}) => {
  const pair = await openPair(context, baseURL!, { prepare: (s) => s.quiet.add('e2e-member') });
  const { trainer, server } = pair;
  await openChats(pair);
  await startCall(trainer, 'voice');
  await expectEndedAndClose(trainer, 'Unavailable');
  server.quiet.clear();
  server.injectLive('e2e-member', 'callee');
  await startCall(trainer, 'voice');
  await expectEndedAndClose(trainer, 'Busy');
  await failMedia(trainer, 'NotAllowedError');
  await startCall(trainer, 'voice');
  await expectEndedAndClose(trainer, 'The microphone is blocked');
  await trainer.waitForTimeout(500);
  await expect(logRows(trainer)).toHaveCount(0);
});

test('a call that ends while the chat is not open is written when that chat is opened', async ({
  context,
  baseURL,
}) => {
  const pair = await openPair(context, baseURL!);
  const { trainer, client } = pair;
  await openChats(pair);
  await connect(trainer, client, 'voice');
  // leave the chat during the call (in the app, no reload: the queue lives in the page), then hang up
  await trainer.evaluate(() => {
    window.location.hash = '#/c/today';
  });
  await expect(
    trainer.getByRole('button', { name: 'End call', exact: true }).first(),
  ).toBeVisible();
  await endBtn(trainer).click();
  await expectEndedAndClose(client, /Call ended/);
  await trainer
    .getByRole('button', { name: 'Close', exact: true })
    .click({ timeout: 1_500 })
    .catch(() => undefined);
  await expect(callSurface(trainer)).toHaveCount(0, { timeout: 8_000 });
  await trainer.evaluate(() => {
    window.location.hash = '#/c/chat';
  });
  await expect(trainer).toHaveURL(/\/c\/chat/);
  await trainer
    .getByRole('button', { name: /Oleh Bondar/ })
    .first()
    .click();
  await expect(logRows(trainer)).toHaveCount(1);
  await expect(logRows(trainer).first()).toContainText('Voice call · 1 min');
});

test("the client's own chat gets the line of a call the client made", async ({
  context,
  baseURL,
}) => {
  const pair = await openPair(context, baseURL!);
  const { trainer, client } = pair;
  await openThreadWithClient(trainer, pair.trainerUrl('c/chat'));
  await gotoApp(client, pair.clientUrl('trainer/chat'));
  await client
    .getByRole('button', { name: /^Call / })
    .first()
    .click();
  await client.getByRole('menuitem', { name: 'Voice', exact: true }).click();
  await expect(incoming(trainer)).toBeVisible();
  await answerBtn(trainer).click();
  await expectActive(client, trainer);
  await endBtn(client).click();
  await expectEndedAndClose(trainer, /Call ended/);
  await expect(logRows(client)).toHaveCount(1);
  await expect(logRows(client).first()).toContainText('Voice call · 1 min');
});
