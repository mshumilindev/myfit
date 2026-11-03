/**
 * SPO-22 / SPO-434: voice calls, trainer <-> client, REAL WebRTC between two pages (see calls-helpers.ts).
 * Fixtures build made with client/vite.config.qa.ts:  E2E_COACH_URL=http://127.0.0.1:4174 npx playwright test tests/e2e/calls-*.e2e.ts
 */
import { expect, test } from '@playwright/test';
import {
  answerBtn,
  callSurface,
  connect,
  declineBtn,
  endBtn,
  endTitle,
  expectActive,
  expectCallButtons,
  expectEndedAndClose,
  expectMediaFlowing,
  failMedia,
  incoming,
  isCompact,
  openChats,
  openPair,
  remoteAudioPlaying,
  sending,
  startCall,
  statusLine,
} from './calls-helpers';

// Real WebRTC between two pages on a small runner: more room than the 30 s default.
test.beforeEach(() => test.setTimeout(60_000));

test('voice call both ways: ring, incoming, answer, active with real audio, timer, mute, hang up from either side', async ({
  context,
  baseURL,
}) => {
  const pair = await openPair(context, baseURL!);
  await openChats(pair);
  const { trainer, client, server } = pair;
  await expectCallButtons(trainer, isCompact(trainer));

  // trainer -> client
  await startCall(trainer, 'voice');
  await expect(statusLine(trainer)).toHaveText('Calling…');
  await expect(trainer.locator('.uicall-note')).toHaveText('Not recorded');
  // incoming: a card over the page on desktop, the whole screen on a phone; voice call = no "voice only" choice
  const card = incoming(client);
  await expect(card).toBeVisible();
  await expect(card).toHaveClass(isCompact(client) ? /^(?!.*--card)/ : /uicall-in--card/);
  await expect(card).toContainText('Incoming voice call');
  await expect(card).toContainText('Iryna Melnyk');
  await expect(client.getByRole('button', { name: 'Answer with voice only' })).toHaveCount(0);
  await answerBtn(client).click();
  await expectActive(trainer, client);
  await expect(trainer.locator('.uicall-note')).toHaveText('Not recorded');
  await expectMediaFlowing(trainer, ['audio']);
  await expectMediaFlowing(client, ['audio']);
  expect(server.startedBy('e2e-trainer')).toHaveLength(1);
  expect(server.calls.get(server.startedBy('e2e-trainer')[0].id)?.state).toBe('active');

  // the timer runs
  await expect(statusLine(client)).toHaveText(/^00:0[2-9]$/);

  // mute: the label flips, the microphone really stops sending, the other side is unaffected
  expect(await sending(trainer, 'audio')).toBe(true);
  await trainer.getByRole('button', { name: 'Mute', exact: true }).click();
  await expect(trainer.getByRole('button', { name: 'Unmute', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(await sending(trainer, 'audio')).toBe(false);
  expect(await sending(client, 'audio')).toBe(true);
  await trainer.getByRole('button', { name: 'Unmute', exact: true }).click();
  expect(await sending(trainer, 'audio')).toBe(true);

  // hang up from the callee
  await endBtn(client).click();
  await expect(endTitle(client)).toContainText('Call ended');
  await expectEndedAndClose(trainer, /Call ended/);
  expect(server.calls.get(server.startedBy('e2e-trainer')[0].id)?.endReason).toBe('hangup');
  await expect(callSurface(client)).toHaveCount(0, { timeout: 8_000 }); // a hung-up call closes itself

  // client -> trainer, hung up by the caller
  await expectCallButtons(client, false);
  await startCall(client, 'voice');
  await expect(incoming(trainer)).toBeVisible();
  await answerBtn(trainer).click();
  await expectActive(client, trainer);
  await expectMediaFlowing(client, ['audio']);
  await expectMediaFlowing(trainer, ['audio']);
  await endBtn(client).click();
  await expectEndedAndClose(trainer, /Call ended/);
  expect(server.startedBy('e2e-member')).toHaveLength(1);
  expect(pair.errors.trainer).toEqual([]);
  expect(pair.errors.client).toEqual([]);
});

test('the other person is heard: remote audio plays out loud on both sides of a voice call', async ({
  context,
  baseURL,
}) => {
  const pair = await openPair(context, baseURL!);
  await openChats(pair);
  await connect(pair.trainer, pair.client, 'voice');
  await expectMediaFlowing(pair.trainer, ['audio']);
  await expect.poll(() => remoteAudioPlaying(pair.trainer), { timeout: 5_000 }).toBe(true);
  await expect.poll(() => remoteAudioPlaying(pair.client), { timeout: 5_000 }).toBe(true);
});

test('the voice wave moves with the other person voice', async ({ context, baseURL }) => {
  const pair = await openPair(context, baseURL!);
  await openChats(pair);
  await connect(pair.trainer, pair.client, 'voice');
  await expectMediaFlowing(pair.client, ['audio']);
  const seen = new Set<string>();
  const t0 = Date.now();
  while (Date.now() - t0 < 6_000 && seen.size < 2) {
    seen.add(
      (await pair.client
        .locator('.uicall-wave-b')
        .evaluateAll((els) => els.map((e) => e.getAttribute('data-step')).join(','))) as string,
    );
    await pair.client.waitForTimeout(150);
  }
  expect(seen.size, `wave steps seen: ${[...seen].join(' | ')}`).toBeGreaterThan(1);
});

test('decline: the caller sees it, nothing is left running, buttons work again', async ({
  context,
  baseURL,
}) => {
  const pair = await openPair(context, baseURL!);
  await openChats(pair);
  const { trainer, client, server } = pair;
  await startCall(trainer, 'voice');
  await expect(incoming(client)).toBeVisible();
  await declineBtn(client).click();
  await expect(incoming(client)).toHaveCount(0);
  await expectEndedAndClose(client, 'Call declined'); // the decliner sees the same end screen and closes it
  await expectEndedAndClose(trainer, 'Call declined');
  await expect(trainer.locator('.uicall-end')).toHaveCount(0);
  expect(server.calls.get(server.startedBy('e2e-trainer')[0].id)?.endReason).toBe('declined');
  await expectCallButtons(trainer, isCompact(trainer));
});

test('nobody answers: after 45 s the caller gets "No answer" and the ringing stops on both sides', async ({
  context,
  baseURL,
}) => {
  const pair = await openPair(context, baseURL!);
  const { trainer, client, server } = pair;
  await trainer.clock.install();
  await openChats(pair);
  await startCall(trainer, 'voice');
  await expect(incoming(client)).toBeVisible();
  await trainer.clock.fastForward(46_000);
  await expectEndedAndClose(trainer, 'No answer');
  expect(server.calls.get(server.startedBy('e2e-trainer')[0].id)?.endReason).toBe('missed');
  // the callee's ringing stops and says so
  await expect(incoming(client)).toHaveCount(0);
  await expectEndedAndClose(client, 'No answer');
});

test('busy: the other person is on another call (and the caller already in one) - neutral end screen, nobody rung', async ({
  context,
  baseURL,
}) => {
  const pair = await openPair(context, baseURL!, {
    prepare: (s) => s.injectLive('e2e-member', 'callee'),
  });
  const { trainer, client, server } = pair;
  await openChats(pair);
  await startCall(trainer, 'voice');
  await expect(endTitle(trainer)).toHaveText('Busy');
  await expect(trainer.locator('.uicall-end')).toContainText('on another call');
  await closeAndNothingRang();
  expect(server.startedBy('e2e-trainer')).toHaveLength(0); // busy writes no call document
  await expect(callSurface(client)).toHaveCount(0);

  // the caller is the busy one (another live call of theirs): the server refuses, the UI says busy
  server.injectLive('e2e-trainer', 'caller');
  await startCall(trainer, 'voice');
  await expectEndedAndClose(trainer, 'Busy');
  expect(server.rejected.some((r) => r[2].startsWith('already-in-call'))).toBe(true);

  async function closeAndNothingRang() {
    await expectEndedAndClose(trainer, 'Busy');
    await expect(callSurface(client)).toHaveCount(0);
  }
});

test('unavailable (quiet hours): neutral text that reveals nothing, the callee is never rung or told', async ({
  context,
  baseURL,
}) => {
  const pair = await openPair(context, baseURL!, { prepare: (s) => s.quiet.add('e2e-member') });
  const { trainer, client, server } = pair;
  await openChats(pair);
  await startCall(trainer, 'voice');
  await expect(endTitle(trainer)).toHaveText('Unavailable');
  const text = (await trainer.locator('.uicall-end').innerText()).toLowerCase();
  for (const leak of ['quiet', 'hours', 'sleep', 'night', 'disturb', 'schedule', 'muted'])
    expect(text, `end screen must not mention "${leak}"`).not.toContain(leak);
  await expect(trainer.locator('.uicall-end')).toContainText('Leave a message in the chat');
  await trainer.getByRole('button', { name: 'Close', exact: true }).click();
  expect(server.calls.size).toBe(0);
  await client.waitForTimeout(600);
  await expect(callSurface(client)).toHaveCount(0);
});

test('a second press on Voice does not start a second call (idempotent)', async ({
  context,
  baseURL,
}) => {
  const pair = await openPair(context, baseURL!);
  await openChats(pair);
  const { trainer, client, server } = pair;
  if (isCompact(trainer)) {
    await trainer
      .getByRole('button', { name: /^Call / })
      .first()
      .click();
    await trainer.getByRole('menuitem', { name: 'Voice', exact: true }).dblclick();
  } else {
    await trainer.getByRole('button', { name: 'Voice', exact: true }).first().dblclick();
  }
  await expect(incoming(client)).toBeVisible();
  await trainer.waitForTimeout(800);
  expect(server.log.filter(([u, n]) => u === 'e2e-trainer' && n === 'start')).toHaveLength(1);
  expect(server.startedBy('e2e-trainer')).toHaveLength(1);
  // while it rings the entry buttons are off ("Busy")
  await expect(incoming(client)).toHaveCount(1);
});

test('microphone blocked / missing on the caller: instruction on screen, no call is placed', async ({
  context,
  baseURL,
}) => {
  const pair = await openPair(context, baseURL!);
  await openChats(pair);
  const { trainer, client, server } = pair;
  await failMedia(trainer, 'NotAllowedError');
  await startCall(trainer, 'voice');
  await expect(endTitle(trainer)).toHaveText('The microphone is blocked');
  await expect(trainer.locator('.uicall-end')).toContainText(
    'Allow it in your browser or system settings',
  );
  await expect(trainer.locator('.uicall-foot')).toContainText(
    'Open the site settings next to the address bar',
  );
  await trainer.getByRole('button', { name: 'Close', exact: true }).click();

  await failMedia(trainer, 'NotFoundError');
  await startCall(trainer, 'voice');
  await expect(endTitle(trainer)).toHaveText('No microphone found');
  await expect(trainer.locator('.uicall-end')).toContainText('Connect a microphone or headset');
  await trainer.getByRole('button', { name: 'Close', exact: true }).click();

  expect(server.calls.size).toBe(0);
  expect(server.log.filter(([, n]) => n === 'start')).toHaveLength(0);
  await expect(callSurface(client)).toHaveCount(0);
});

test('microphone blocked on the callee: answering ends the call cleanly for both', async ({
  context,
  baseURL,
}) => {
  const pair = await openPair(context, baseURL!);
  await openChats(pair);
  const { trainer, client, server } = pair;
  await startCall(trainer, 'voice');
  await expect(incoming(client)).toBeVisible();
  await failMedia(client, 'NotAllowedError');
  await answerBtn(client).click();
  await expectEndedAndClose(client, 'The microphone is blocked');
  await expectEndedAndClose(trainer, 'Call declined');
  expect(server.calls.get(server.startedBy('e2e-trainer')[0].id)?.endReason).toBe('declined');
});
