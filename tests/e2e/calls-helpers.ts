/**
 * Helpers of the calls e2e (SPO-434). Not a spec (no `.e2e.ts` suffix).
 *
 * Two pages of ONE browser context are the trainer and the client. They sit on two origins (127.0.0.1 and localhost) so each
 * has its own localStorage (own sign-in, role, call prefs), exactly like two devices. Calls between them are REAL WebRTC
 * (Chromium fake camera/microphone, host candidates only); only the Cloud Functions + `calls/*` documents are replaced by
 * the in-process `CallsServer` (calls-server.ts) behind the `__callsRpc` binding. Needs the fixtures build made with
 * `client/vite.config.qa.ts` (sample world) and `VITE_COACH_BACKEND=fixtures`; see playwright.config.ts.
 */
import { expect, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { collectConsoleErrors, seedTrainer } from './coach-helpers';
import { CallsServer } from './calls-server';
import { REQUIRED_KINDS, currentVersion } from '../../client/src/legal/consents';
import { GATE_VERIFIED_KEY } from '../../client/src/legal/gateVerified';

export const CALL_PREFS_KEY = 'gym.callPrefs';
export const CLOCK_OPEN = /^\d\d:\d\d$/;

export interface Pair {
  server: CallsServer;
  trainer: Page;
  client: Page;
  trainerUrl: (hash: string) => string;
  clientUrl: (hash: string) => string;
  errors: { trainer: string[]; client: string[] };
}

function otherOrigin(base: string): string {
  const u = new URL(base);
  u.hostname = u.hostname === '127.0.0.1' ? 'localhost' : '127.0.0.1';
  return u.origin;
}

export interface PairOptions {
  locale?: string;
  /** The device has done the first-call check already (default). false = the check shows before the first call. */
  seen?: boolean;
  /** Set up before the pages load (the server, the context). */
  prepare?: (server: CallsServer) => void;
}

/** Trainer on `baseURL`, client on the other origin, both signed in, both talking to one `CallsServer`. */
export async function openPair(
  context: BrowserContext,
  baseURL: string,
  o: PairOptions = {},
): Promise<Pair> {
  await context.grantPermissions(['microphone', 'camera']);
  const server = new CallsServer();
  o.prepare?.(server);
  await server.attach(context);
  const tOrigin = new URL(baseURL).origin;
  const cOrigin = otherOrigin(baseURL);
  const trainer = await context.newPage();
  const client = await context.newPage();
  const errors = { trainer: collectConsoleErrors(trainer), client: collectConsoleErrors(client) };
  await seedTrainer(trainer, tOrigin, { role: 'trainer', name: 'Iryna Melnyk', locale: o.locale });
  await seedTrainer(client, cOrigin, {
    role: 'member',
    scenario: 'active',
    name: 'Anna Member',
    locale: o.locale,
  });
  // Firebase is unreachable here, so the legal gate would cover the app ("Checking your agreement") unless this device
  // already saw the server confirm the consents of these accounts (the offline rule of gateVerified.ts).
  const sig = (coach: boolean) =>
    [...REQUIRED_KINDS, ...(coach ? (['trainer-terms'] as const) : [])]
      .map((k) => `${k}@${currentVersion(k)}`)
      .join(',');
  await trainer.addInitScript(
    ([k, uid, v]) => localStorage.setItem(k, JSON.stringify({ [uid]: v })),
    [GATE_VERIFIED_KEY, 'e2e-trainer', sig(true)] as const,
  );
  await client.addInitScript(
    ([k, uid, v]) => localStorage.setItem(k, JSON.stringify({ [uid]: v })),
    [GATE_VERIFIED_KEY, 'e2e-member', sig(false)] as const,
  );
  if (o.seen !== false) {
    for (const p of [trainer, client]) {
      await p.addInitScript(
        (k) => localStorage.setItem(k, JSON.stringify({ seen: true, camOn: true })),
        CALL_PREFS_KEY,
      );
    }
  }
  return {
    server,
    trainer,
    client,
    errors,
    trainerUrl: (h) => `${tOrigin}/${h}`,
    clientUrl: (h) => `${cOrigin}/${h}`,
  };
}

/**
 * Open a screen. A member whose body metrics are not on the device first meets the profile-completion gate ("Let's finish
 * your profile", App.tsx): it is filled in once, like a person would, so the app opens behind it.
 */
export async function gotoApp(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await page.waitForSelector('#root *', { state: 'attached', timeout: 30_000 });
  const gate = page.locator('.body-gate');
  // only the member page (the second origin, `localhost`) ever meets the gate; the trainer page must not wait for it
  const isMember = new URL(url).hostname === 'localhost';
  if (
    isMember &&
    (await gate.waitFor({ state: 'visible', timeout: 15_000 }).then(
      () => true,
      () => false,
    ))
  ) {
    await gate.locator('input[placeholder="178"]').fill('178');
    await gate.locator('input[placeholder="84.0"]').fill('84');
    await page.locator('.body-gate-foot button').click();
    await expect(gate).toHaveCount(0);
  }
}

/** The call screen / incoming card / mini / bar that is on this page now (any of them). */
export const callSurface = (p: Page): Locator =>
  p.locator('.uicall, .uicall-in, .uicall-mini, .uicall-bar');
export const callScreen = (p: Page): Locator => p.locator('section.uicall');
export const statusLine = (p: Page): Locator => p.locator('.uicall-who small');

/** Wait until the call buttons of a screen are there (calls on, session published). */
export async function expectCallButtons(p: Page, compact: boolean): Promise<void> {
  if (compact) await expect(p.getByRole('button', { name: /^Call / }).first()).toBeVisible();
  else await expect(p.getByRole('button', { name: 'Voice', exact: true }).first()).toBeVisible();
}

/** Press "Voice" or "Video" wherever the entry is: two buttons, or the phone menu of a narrow header. */
export async function startCall(p: Page, kind: 'voice' | 'video'): Promise<void> {
  const label = kind === 'voice' ? 'Voice' : 'Video';
  const direct = p.getByRole('button', { name: label, exact: true }).first();
  if (await direct.isVisible().catch(() => false)) {
    await direct.click();
    return;
  }
  await p
    .getByRole('button', { name: /^Call / })
    .first()
    .click();
  await p.getByRole('menuitem', { name: label, exact: true }).click();
}

export const answerBtn = (p: Page): Locator =>
  p.getByRole('button', { name: 'Answer', exact: true });
export const declineBtn = (p: Page): Locator =>
  p.getByRole('button', { name: 'Decline', exact: true });
export const endBtn = (p: Page): Locator =>
  p.getByRole('button', { name: 'End call', exact: true });

/** Both sides show the running timer. */
export async function expectActive(a: Page, b: Page): Promise<void> {
  for (const p of [a, b]) await expect(statusLine(p)).toHaveText(CLOCK_OPEN, { timeout: 20_000 });
}

/** Real media: bytes of the given kinds have arrived on this page's peer connection. */
export async function expectMediaFlowing(p: Page, kinds: ('audio' | 'video')[]): Promise<void> {
  await expect
    .poll(
      async () => {
        const m = await p.evaluate(() => window.__callsE2E?.media());
        if (!m) return 'no hook';
        const missing = kinds.filter((k) =>
          k === 'audio'
            ? m.audioBytes <= 0 || m.audioTracks < 1
            : m.videoBytes <= 0 || m.videoTracks < 1,
        );
        return missing.join(',') || 'ok';
      },
      { timeout: 20_000, message: `inbound ${kinds.join('+')} on ${p.url()}` },
    )
    .toBe('ok');
}

/** Trainer opens the chat with the client and the client the "My trainer" page. */
export async function openChats(pair: Pair): Promise<void> {
  // both devices boot at the same time, like two people opening the app
  await Promise.all([
    openThreadWithClient(pair.trainer, pair.trainerUrl('c/chat')),
    gotoApp(pair.client, pair.clientUrl('trainer')),
  ]);
}

/** Trainer: the chat list, then the thread with the sample client Oleh Bondar (the member page plays him). */
export async function openThreadWithClient(page: Page, chatUrl: string): Promise<void> {
  await gotoApp(page, chatUrl);
  await page
    .getByRole('button', { name: /Oleh Bondar/ })
    .first()
    .click();
}

export function isCompact(p: Page): boolean {
  const w = p.viewportSize()?.width ?? 1440;
  return w < 720;
}

declare global {
  interface Window {
    __callsE2E?: {
      dropLink(state?: 'disconnected' | 'failed'): boolean;
      restoreLink(): boolean;
      peerState(): string | null;
      senders(): { kind: string; enabled: boolean; live: boolean }[];
      media(): Promise<{
        audioBytes: number;
        videoBytes: number;
        audioTracks: number;
        videoTracks: number;
      }>;
    };
  }
}

/** What this page sends, per kind: the microphone / camera track exists, is live, and is on (`enabled`). */
export async function sending(p: Page, kind: 'audio' | 'video'): Promise<boolean | null> {
  const s = await p.evaluate(() => window.__callsE2E?.senders() ?? []);
  const t = s.find((x) => x.kind === kind);
  return t ? t.enabled && t.live : null;
}

/** An element is playing the other person's voice out loud (an unmuted audio/video element on the remote stream). */
export async function remoteAudioPlaying(p: Page): Promise<boolean> {
  return p.evaluate(() =>
    [...document.querySelectorAll('audio, video')].some((el) => {
      const m = el as HTMLMediaElement;
      const st = m.srcObject as MediaStream | null;
      return !!st && st.getAudioTracks().length > 0 && !m.paused && !m.muted;
    }),
  );
}

export const closeBtn = (p: Page): Locator => p.getByRole('button', { name: 'Close', exact: true });
/** The end-of-call heading ("Call declined", "No answer", "Busy"...). */
export const endTitle = (p: Page): Locator => p.locator('.uicall-end h2');
export const incoming = (p: Page): Locator => p.locator('.uicall-in');
/** Rows the calls leave in a chat thread. */
export const logRows = (p: Page): Locator => p.locator('.uicall-log');

/** Wait for the end screen, check its title, then dismiss it. */
export async function expectEndedAndClose(p: Page, title: string | RegExp): Promise<void> {
  await expect(endTitle(p)).toHaveText(title, { timeout: 15_000 });
  await closeBtn(p).click();
  await expect(callSurface(p)).toHaveCount(0);
}

/** Ring the other page and answer, so both are in a call. */
export async function connect(
  from: Page,
  to: Page,
  kind: 'voice' | 'video',
  opts: { voiceOnly?: boolean } = {},
): Promise<void> {
  await startCall(from, kind);
  if (opts.voiceOnly) {
    await to.getByRole('button', { name: 'Answer with voice only' }).click();
  } else {
    await answerBtn(to).click();
  }
  await expectActive(from, to);
}

/** Overrides the camera/microphone request of a page: it fails with this DOMException name. */
export async function failMedia(p: Page, name: 'NotAllowedError' | 'NotFoundError'): Promise<void> {
  await p.evaluate((n) => {
    const md = navigator.mediaDevices as MediaDevices & { __real?: MediaDevices['getUserMedia'] };
    md.__real ??= md.getUserMedia.bind(md);
    md.getUserMedia = () => Promise.reject(new DOMException('e2e', n));
  }, name);
}
export async function restoreMedia(p: Page): Promise<void> {
  await p.evaluate(() => {
    const md = navigator.mediaDevices as MediaDevices & { __real?: MediaDevices['getUserMedia'] };
    if (md.__real) md.getUserMedia = md.__real;
  });
}

/**
 * A plain hang-up shows "Call ended" and closes itself after 3 s (CallLayer). On a loaded runner a test can look late, so
 * this accepts either the end screen (then closes it) or an already closed one, and requires the server to say `hangup`.
 */
export async function expectHungUp(
  p: Page,
  server: CallsServer,
  title: string | RegExp,
): Promise<void> {
  await expect
    .poll(async () => (await endTitle(p).count()) > 0 || (await callSurface(p).count()) === 0, {
      timeout: 15_000,
    })
    .toBe(true);
  if ((await endTitle(p).count()) > 0) {
    await expect(endTitle(p)).toHaveText(title);
    await closeBtn(p)
      .click({ timeout: 2_000 })
      .catch(() => {});
  }
  await expect(callSurface(p)).toHaveCount(0, { timeout: 5_000 });
  const last = [...server.calls.values()].sort((x, y) => y.createdAt - x.createdAt)[0];
  expect([last?.state, last?.endReason]).toEqual(['ended', 'hangup']);
}
