/**
 * SPO-22 / SPO-434: where a call can be started (chat of the trainer, Client360, roster, My trainer, chat of the client),
 * when the buttons are off (offline) or absent (server switch off, manager), and the first-call device check.
 */
import { expect, test, type Page } from '@playwright/test';
import {
  callSurface,
  endBtn,
  expectCallButtons,
  gotoApp,
  incoming,
  isCompact,
  openChats,
  openPair,
  openThreadWithClient,
  startCall,
} from './calls-helpers';
import { unnamedControls } from './coach-helpers';
import { CallsServer } from './calls-server';

/** Press Voice / Video on this screen and check the other page rang with that kind, then hang up from the caller. */
async function dialFrom(
  caller: Page,
  callee: Page,
  kind: 'voice' | 'video',
  server: CallsServer,
  who: string,
): Promise<void> {
  const before = server.startedBy(who).length;
  await startCall(caller, kind);
  await expect(incoming(callee)).toContainText(
    kind === 'voice' ? 'Incoming voice call' : 'Incoming video call',
  );
  expect(server.startedBy(who)).toHaveLength(before + 1);
  expect(server.startedBy(who).at(-1)?.kind).toBe(kind);
  await endBtn(caller)
    .click()
    .catch(() => undefined);
  await caller
    .getByRole('button', { name: 'End call', exact: true })
    .click({ timeout: 1_000 })
    .catch(() => undefined);
}

// Real WebRTC between two pages on a small runner: more room than the 30 s default.
test.beforeEach(() => test.setTimeout(60_000));

test.describe('entry points', () => {
  test('chat of the trainer: Voice and Video (icons on desktop, one Call menu on a phone)', async ({
    context,
    baseURL,
  }) => {
    const pair = await openPair(context, baseURL!);
    await openChats(pair);
    const compact = isCompact(pair.trainer);
    await expectCallButtons(pair.trainer, compact);
    if (compact) {
      await expect(pair.trainer.getByRole('button', { name: 'Voice', exact: true })).toHaveCount(0);
      await expect(pair.trainer.getByRole('button', { name: /^Call Oleh Bondar$/ })).toBeVisible();
    } else {
      await expect(pair.trainer.getByRole('button', { name: 'Video', exact: true })).toBeEnabled();
    }
    await dialFrom(pair.trainer, pair.client, 'video', pair.server, 'e2e-trainer');
  });

  test('Client360: labelled Voice / Video buttons that call the client', async ({
    context,
    baseURL,
  }) => {
    const pair = await openPair(context, baseURL!);
    const { trainer, client, server } = pair;
    await gotoApp(client, pair.clientUrl('trainer'));
    await gotoApp(trainer, pair.trainerUrl('c/clients/c1'));
    await expect(trainer.getByRole('heading', { name: /Oleh Bondar/ }).first()).toBeVisible();
    // desktop: the labelled pair in the card; a phone: the one Call menu of the header
    if (isCompact(trainer)) {
      await expect(
        trainer.getByRole('button', { name: 'Call Oleh Bondar', exact: true }),
      ).toBeVisible();
    } else {
      await expect(
        trainer.locator('.uicall-act').getByRole('button', { name: 'Voice', exact: true }).first(),
      ).toBeVisible();
      await expect(
        trainer.locator('.uicall-act').getByRole('button', { name: 'Video', exact: true }).first(),
      ).toBeEnabled();
    }
    await dialFrom(trainer, client, 'voice', server, 'e2e-trainer');
  });

  test('roster: the client card has Voice / Video', async ({ context, baseURL }) => {
    const pair = await openPair(context, baseURL!);
    const { trainer, client, server } = pair;
    await gotoApp(client, pair.clientUrl('trainer'));
    await gotoApp(trainer, pair.trainerUrl('c/clients'));
    await trainer
      .getByRole('button', { name: /Oleh Bondar/ })
      .first()
      .click();
    // desktop: the detail card beside the list has Voice / Video; a phone opens the client page with the Call menu
    if (isCompact(trainer)) {
      await expect(
        trainer.getByRole('button', { name: 'Call Oleh Bondar', exact: true }),
      ).toBeVisible();
    } else {
      await expect(
        trainer.locator('.uicall-act').getByRole('button', { name: 'Voice', exact: true }).first(),
      ).toBeVisible();
    }
    await dialFrom(trainer, client, 'voice', server, 'e2e-trainer');
  });

  test('My trainer and the client chat: the client can call the trainer', async ({
    context,
    baseURL,
  }) => {
    const pair = await openPair(context, baseURL!);
    const { trainer, client, server } = pair;
    await openThreadWithClient(trainer, pair.trainerUrl('c/chat'));
    await gotoApp(client, pair.clientUrl('trainer'));
    // My trainer page: labelled buttons
    await expect(
      client.locator('.uicall-act').getByRole('button', { name: 'Voice', exact: true }),
    ).toBeVisible();
    await expect(
      client.locator('.uicall-act').getByRole('button', { name: 'Video', exact: true }),
    ).toBeEnabled();
    await dialFrom(client, trainer, 'voice', server, 'e2e-member');
    await expect(callSurface(client))
      .toHaveCount(0, { timeout: 15_000 })
      .catch(() => undefined);
  });

  test('client chat header: the Call menu has Voice and Video', async ({ context, baseURL }) => {
    const pair = await openPair(context, baseURL!);
    const { trainer, client, server } = pair;
    await openThreadWithClient(trainer, pair.trainerUrl('c/chat'));
    await gotoApp(client, pair.clientUrl('trainer/chat'));
    await client
      .getByRole('button', { name: /^Call / })
      .first()
      .click();
    await expect(client.getByRole('menuitem', { name: 'Voice', exact: true })).toBeVisible();
    await expect(client.getByRole('menuitem', { name: 'Video', exact: true })).toBeVisible();
    await client.getByRole('menuitem', { name: 'Video', exact: true }).click();
    await expect(incoming(trainer)).toContainText('Incoming video call');
    expect(server.startedBy('e2e-member')).toHaveLength(1);
    await endBtn(client).click();
  });
});

test.describe('when the buttons are off or absent', () => {
  test('offline: the buttons are disabled with the reason "Offline", and back on when the network returns', async ({
    context,
    baseURL,
  }) => {
    const pair = await openPair(context, baseURL!);
    const { trainer } = pair;
    await openChats(pair);
    const compact = isCompact(trainer);
    await expectCallButtons(trainer, compact);
    await context.setOffline(true);
    if (compact) {
      await trainer
        .getByRole('button', { name: /^Call / })
        .first()
        .click();
      await expect(trainer.getByRole('menuitem', { name: 'Voice', exact: true })).toBeDisabled();
      await expect(trainer.getByRole('menuitem', { name: 'Video', exact: true })).toBeDisabled();
      await expect(trainer.getByText('Offline', { exact: true }).first()).toBeVisible();
      await trainer.keyboard.press('Escape');
    } else {
      for (const n of ['Voice', 'Video']) {
        const b = trainer.getByRole('button', { name: n, exact: true }).first();
        await expect(b).toBeDisabled();
        await expect(b).toHaveAttribute('title', 'Offline');
      }
    }
    expect(pair.server.log.filter(([, n]) => n === 'start')).toHaveLength(0);
    await context.setOffline(false);
    if (compact) {
      await trainer
        .getByRole('button', { name: /^Call / })
        .first()
        .click();
      await expect(trainer.getByRole('menuitem', { name: 'Voice', exact: true })).toBeEnabled();
      await trainer.keyboard.press('Escape');
    } else {
      await expect(
        trainer.getByRole('button', { name: 'Voice', exact: true }).first(),
      ).toBeEnabled();
    }
  });

  test('manager: no call buttons and the calls code never listens', async ({
    context,
    baseURL,
  }) => {
    const pair = await openPair(context, baseURL!);
    const { server } = pair;
    // control: the same account as a trainer is listening (this is what proves the manager check below is not vacuous)
    await openChats(pair);
    await expectCallButtons(pair.trainer, isCompact(pair.trainer));
    expect(server.polled.has('e2e-trainer')).toBe(true);

    // the same sign-in, now with the manager role (a promotion arrives with the token; the app reads the cached role at start)
    const mgr = pair.trainer;
    await mgr.addInitScript(() => {
      if (sessionStorage.getItem('e2e.manager')) localStorage.setItem('spotter.role', 'manager');
    });
    await mgr.evaluate(() => sessionStorage.setItem('e2e.manager', '1'));
    await gotoApp(mgr, pair.trainerUrl('c/clients/c1'));
    server.polled.clear(); // the page before the reload was still polling until it unloaded
    await mgr.waitForTimeout(1500);
    expect(await mgr.evaluate(() => localStorage.getItem('spotter.role'))).toBe('manager');
    await expect(mgr.getByRole('button', { name: 'Voice', exact: true })).toHaveCount(0);
    await expect(mgr.getByRole('button', { name: /^Call / })).toHaveCount(0);
    await expect(mgr.locator('.uicall-act')).toHaveCount(0);
    expect(
      server.polled.has('e2e-trainer'),
      'a manager session must not even watch for calls',
    ).toBe(false);
    expect(await unnamedControls(mgr)).toEqual([]);
  });
});
