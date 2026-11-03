/**
 * SPO-22 / SPO-434: how the calls UI holds up: four themes, five locales, accessibility and a clean console.
 */
import { expect, test, type Page } from '@playwright/test';
import { callsEn } from '../../client/src/i18n/calls.en';
import { callsEt } from '../../client/src/i18n/calls.et';
import { callsLt } from '../../client/src/i18n/calls.lt';
import { callsPl } from '../../client/src/i18n/calls.pl';
import { callsUk } from '../../client/src/i18n/calls.uk';
import { horizontalOverflow, unnamedControls } from './coach-helpers';
import {
  answerBtn,
  closeBtn,
  connect,
  endBtn,
  endTitle,
  expectActive,
  expectEndedAndClose,
  expectHungUp,
  incoming,
  isCompact,
  openChats,
  openPair,
  startCall,
} from './calls-helpers';

/** Nothing of the call UI sticks out of the viewport, nothing scrolls sideways, every control has a name. */
async function expectSound(p: Page, what: string): Promise<void> {
  expect(await horizontalOverflow(p), `horizontal overflow: ${what}`).toBe(0);
  expect(await unnamedControls(p), `unnamed controls: ${what}`).toEqual([]);
  const out = await p.evaluate(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return [...document.querySelectorAll('.uicall, .uicall-in, .uicall-mini, .uicall-bar')]
      .map((el) => el.getBoundingClientRect())
      .filter(
        (r) => r.width > 0 && (r.left < -1 || r.right > vw + 1 || r.top < -1 || r.bottom > vh + 1),
      )
      .map(
        (r) =>
          `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)} in ${vw}x${vh}`,
      );
  });
  expect(out, `call surface outside the viewport: ${what}`).toEqual([]);
}

const THEMES = ['glass', 'cyberpunk', 'halloween', 'christmas'];
const wear = (p: Page, theme: string) =>
  p.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);

// Real WebRTC between two pages on a small runner: more room than the 30 s default.
test.beforeEach(() => test.setTimeout(60_000));

test('four themes: incoming, calling, end screens and a live video call fit the screen and every control is named', async ({
  context,
  baseURL,
}) => {
  test.setTimeout(90_000);
  const pair = await openPair(context, baseURL!);
  const { trainer, client } = pair;
  await openChats(pair);

  // ringing and the end screen, in every theme
  for (const theme of THEMES) {
    await Promise.all([wear(trainer, theme), wear(client, theme)]);
    await startCall(trainer, 'video');
    await expect(incoming(client)).toBeVisible();
    await expectSound(client, `incoming @${theme}`);
    await expectSound(trainer, `calling @${theme}`);
    await client.getByRole('button', { name: 'Decline', exact: true }).click();
    await expect(endTitle(trainer)).toHaveText('Call declined');
    await expectSound(trainer, `ended @${theme}`);
    await expectSound(client, `ended @${theme}`);
    await closeBtn(trainer).click();
    await closeBtn(client).click();
  }

  // one live video call, the theme changing under it
  await connect(trainer, client, 'video');
  for (const theme of THEMES) {
    await Promise.all([wear(trainer, theme), wear(client, theme)]);
    await expectSound(trainer, `live @${theme}`);
    await expectSound(client, `live @${theme}`);
  }
  await endBtn(trainer).click();
  await expectHungUp(client, pair.server, /Call ended/);
  expect(pair.errors.trainer).toEqual([]);
  expect(pair.errors.client).toEqual([]);
});

const DICTS = { en: callsEn, uk: callsUk, pl: callsPl, lt: callsLt, et: callsEt } as const;
const LOCALES = (process.env.E2E_LOCALES ?? 'en,uk,pl,lt,et')
  .split(',')
  .map((l) => l.trim())
  .filter((l): l is keyof typeof DICTS => l in DICTS);

for (const locale of LOCALES) {
  test(`locale ${locale}: entry buttons, calling, incoming and decline are in that language`, async ({
    context,
    baseURL,
  }) => {
    const pair = await openPair(context, baseURL!, { locale });
    const { trainer, client } = pair;
    const d = DICTS[locale];
    await openChats(pair);

    // entry
    if (isCompact(trainer)) {
      await expect(
        trainer.getByRole('button', { name: d.callTo('Oleh Bondar'), exact: true }),
      ).toBeVisible();
    } else {
      await expect(
        trainer.getByRole('button', { name: d.callVoice, exact: true }).first(),
      ).toBeVisible();
      await expect(
        trainer.getByRole('button', { name: d.callVideo, exact: true }).first(),
      ).toBeVisible();
    }
    // the call words are not empty and (except English) not the English ones
    for (const key of [
      'callVoice',
      'callVideo',
      'callAnswer',
      'callDecline',
      'callCalling',
      'callIncomingVoice',
      'callDeclinedT',
      'callNotRecorded',
      'callEnd',
      'callMute',
    ] as const) {
      const v = d[key] as string;
      expect(v.trim(), `${locale}.${key}`).not.toBe('');
      // Estonian writes "Video" like English
      const cognate = locale === 'et' && key === 'callVideo';
      if (locale !== 'en' && !cognate)
        expect(v, `${locale}.${key} must be translated`).not.toBe(callsEn[key]);
    }

    // calling + incoming
    if (isCompact(trainer)) {
      await trainer.getByRole('button', { name: d.callTo('Oleh Bondar'), exact: true }).click();
      await trainer.getByRole('menuitem', { name: d.callVoice, exact: true }).click();
    } else {
      await trainer.getByRole('button', { name: d.callVoice, exact: true }).first().click();
    }
    await expect(trainer.locator('.uicall-who small')).toHaveText(d.callCalling);
    await expect(trainer.locator('.uicall-note')).toHaveText(d.callNotRecorded);
    await expect(incoming(client)).toContainText(d.callIncomingVoice);
    await expect(client.getByRole('button', { name: d.callAnswer, exact: true })).toBeVisible();
    if (locale !== 'en') {
      const shown = await client.locator('.uicall-in').innerText();
      expect(shown).not.toContain(callsEn.callIncomingVoice);
      expect(shown).not.toContain('Iryna Melnyk' + ' ' + callsEn.callAnswer);
    }
    await client.getByRole('button', { name: d.callDecline, exact: true }).click();
    await expect(trainer.locator('.uicall-end h2')).toHaveText(d.callDeclinedT);
    await expect(client.locator('.uicall-end h2')).toHaveText(d.callDeclinedT);
    expect(await horizontalOverflow(trainer)).toBe(0);
    expect(await horizontalOverflow(client)).toBe(0);
    expect(await unnamedControls(trainer)).toEqual([]);
    expect(await unnamedControls(client)).toEqual([]);
  });
}

test('a11y: an incoming call moves keyboard focus to Answer', async ({ context, baseURL }) => {
  const pair = await openPair(context, baseURL!);
  await openChats(pair);
  await startCall(pair.trainer, 'voice');
  await expect(incoming(pair.client)).toBeVisible();
  await expect(answerBtn(pair.client)).toBeFocused();
});

test('a11y: the incoming call is an alert dialog named after the caller; the keyboard can answer, and end the call', async ({
  context,
  baseURL,
}) => {
  const pair = await openPair(context, baseURL!);
  await openChats(pair);
  const { trainer, client } = pair;
  await startCall(trainer, 'voice');
  const card = incoming(client);
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute('role', 'alertdialog');
  await expect(card).toHaveAttribute('aria-label', 'Iryna Melnyk: Incoming voice call');
  await answerBtn(client).focus();
  await client.keyboard.press('Enter');
  await expectActive(trainer, client);
  for (const p of [trainer, client]) {
    expect(await unnamedControls(p)).toEqual([]);
    await expect(p.locator('.uicall-who small')).toHaveAttribute('aria-live', 'polite');
    await expect(p.getByRole('button', { name: 'Mute', exact: true })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  }
  await endBtn(client).focus();
  await client.keyboard.press('Enter');
  await expectEndedAndClose(trainer, /Call ended/);
  expect(pair.errors.trainer).toEqual([]);
  expect(pair.errors.client).toEqual([]);
});

test('calls code does not touch the network: no request leaves localhost during a call', async ({
  context,
  baseURL,
}) => {
  const pair = await openPair(context, baseURL!);
  await openChats(pair);
  const { trainer, client } = pair;
  const outside: string[] = [];
  for (const p of [trainer, client])
    p.on('request', (r) => {
      const u = new URL(r.url());
      if (!['127.0.0.1', 'localhost'].includes(u.hostname) && !/^(data|blob):/.test(r.url()))
        outside.push(r.url());
    });
  await connect(trainer, client, 'voice');
  await endBtn(trainer).click();
  await expectEndedAndClose(client, /Call ended/);
  // Firebase is aborted by the harness on purpose; nothing else (no STUN/TURN host, no CDN) may be asked for by the call
  const unexpected = outside.filter(
    (u) => !/googleapis|gstatic|firebase|google\.com|cloudfunctions|googletagmanager/.test(u),
  );
  expect(unexpected).toEqual([]);
});
