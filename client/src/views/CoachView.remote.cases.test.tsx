import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { setLocale } from '../i18n';
import { en } from '../i18n/en';
import {
  ask,
  bubbles,
  coach,
  coachState,
  m,
  openThread,
  resetCoachMocks,
  send,
  warmAtlas,
} from './__fixtures__/coachMocks';
import { freezeClock, NOW, richState } from './__fixtures__/viewKit';

vi.setConfig({ testTimeout: 40_000 });
const UNKNOWN = 'asdf qwerty zzz';
const last = () => bubbles()[bubbles().length - 1];
const chip = (label: string) =>
  [...document.querySelectorAll('.atl-suggest .uichip')].find((c) => c.textContent === label) as
    HTMLElement | undefined;
const sleepMs = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeAll(() => warmAtlas(), 60_000);
beforeEach(() => {
  freezeClock(NOW);
  setLocale('en');
  resetCoachMocks();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
});

describe('CoachView remote: no AI access', () => {
  it('an unknown question gets the local fallback with starter chips', async () => {
    m.canChat = false;
    await openThread(coachState());
    await ask(UNKNOWN);
    expect(m.ask).not.toHaveBeenCalled();
    expect(last()).toBe(en.atlasLocalUnknown);
    expect(
      [en.atlasSuggestToday, en.atlasSuggestProgress, en.atlasSuggestRest].every((c) => chip(c)),
    ).toBe(true);
  });

  it('a close-but-unclear wording offers topics and remembers the pending pick', async () => {
    m.canChat = false;
    await openThread(coachState());
    await ask('bench');
    expect(m.ask).not.toHaveBeenCalled();
    expect(last().length).toBeGreaterThan(0);
  });
});

describe('CoachView remote: consent sheet', () => {
  const sheet = () => document.querySelector('.atl-sheet') as HTMLElement;

  it('asks before the first question leaves the device; Not now sends nothing', async () => {
    await openThread(coachState({ chatConsent: false }));
    send(UNKNOWN);
    await vi.waitFor(() => expect(sheet()).not.toBeNull(), { timeout: 20000 });
    expect(sheet().textContent).toContain(en.atlasConsentBody);
    fireEvent.click(screen.getByRole('button', { name: en.atlasNotNow }));
    expect(m.ask).not.toHaveBeenCalled();
    expect(coach().chatConsent).toBeFalsy();
  });

  it('agreeing stores the consent and sends that question to Gemini', async () => {
    await openThread(coachState({ chatConsent: false }));
    send(UNKNOWN);
    await vi.waitFor(() => expect(sheet()).not.toBeNull(), { timeout: 20000 });
    fireEvent.click(screen.getByRole('button', { name: en.atlasConsentOk }));
    expect(coach().chatConsent).toBe(true);
    await screen.findByText('Gemini says hi', {}, { timeout: 10000 });
    expect(m.ask).toHaveBeenCalledTimes(1);
    expect(m.ask.mock.calls[0][0].question).toBe(UNKNOWN);
  });
});

describe('CoachView remote: Gemini', () => {
  it('sends the question with the conversation, the temper and the consent flag; streams partial text', async () => {
    m.ask.mockImplementation(async (a: { onText: (t: string) => void }) => {
      a.onText('Gemini says');
      return { ok: true, text: 'Gemini says hi' };
    });
    await openThread(coachState({}, { ...richState(), injuries: [], sleeps: [], restPeriods: [] }));
    await ask(UNKNOWN);
    const arg = m.ask.mock.calls[0][0];
    expect(arg.question).toBe(UNKNOWN);
    expect(arg.temper).toBe(3);
    expect(arg.locale).toBe('en');
    expect(arg.coach.chatConsent).toBe(true);
    expect(typeof arg.factsJson).toBe('string');
    expect(arg.history.every((h: { from: string }) => h.from === 'me' || h.from === 'atlas')).toBe(
      true,
    );
    expect(last()).toBe('Gemini says hi');
  });

  it.each([
    ['offline', en.atlasChatOffline],
    ['cap', en.atlasChatCap],
    ['blocked', en.atlasChatBlocked],
    ['error', en.atlasChatError],
  ])('a %s failure shows the matching line', async (reason, line) => {
    m.ask.mockResolvedValue({ ok: false, reason });
    await openThread(coachState());
    await ask(UNKNOWN);
    expect(last()).toBe(line);
  });

  it('an unsure local answer goes to Gemini; when Gemini fails Atlas answers from its own base', async () => {
    m.ask.mockResolvedValue({ ok: false, reason: 'error' });
    await openThread(coachState());
    await ask('squat');
    expect(m.ask).toHaveBeenCalledTimes(1);
    expect(last()).toMatch(/bail/i);
    expect(last()).not.toBe(en.atlasChatError);
  });

  it('an unsure local answer uses the Gemini reply when it works', async () => {
    await openThread(coachState());
    await ask('squat');
    expect(last()).toBe('Gemini says hi');
  });

  it('without consent an unsure answer stays local', async () => {
    await openThread(coachState({ chatConsent: false }));
    await ask('squat');
    expect(m.ask).not.toHaveBeenCalled();
    expect(last()).toMatch(/bail/i);
  });

  it('a reply that arrives while the app is hidden is also pushed, when notifications are on', async () => {
    m.push = 'on';
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    await openThread(coachState());
    await ask(UNKNOWN);
    expect(m.pushReply).toHaveBeenCalledWith(en.atlasName, 'Gemini says hi', expect.any(Number));
  });

  it('a failing push is logged, never thrown at the user', async () => {
    m.push = 'on';
    m.pushReply.mockRejectedValue(new Error('x'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    await openThread(coachState());
    await ask(UNKNOWN);
    await sleepMs(50);
    expect(warn).toHaveBeenCalledWith('atlas: reply push failed', expect.any(Error));
    warn.mockRestore();
  });

  it('no push while the app is in the foreground', async () => {
    m.push = 'on';
    await openThread(coachState());
    await ask(UNKNOWN);
    expect(m.pushReply).not.toHaveBeenCalled();
  });
});

describe('CoachView remote: out of quota -> Puter', () => {
  const quota = () =>
    m.ask.mockResolvedValue({ ok: false, reason: 'quota', until: NOW + 3_600_000 });

  it('offers Puter with a quota notice when Puter is not signed in', async () => {
    quota();
    await openThread(coachState());
    await ask(UNKNOWN);
    const until = new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit' }).format(
      NOW + 3_600_000,
    );
    expect(bubbles()).toContain(en.atlasQuotaNotice(until));
    expect(bubbles()).toContain(en.atlasPuterOffer);
    expect(chip(en.atlasPuterEnable)).toBeTruthy();
    expect(chip(en.atlasPuterNo)).toBeTruthy();
  });

  it('Enable signs in and answers through Puter in the same bubble', async () => {
    quota();
    await openThread(coachState());
    await ask(UNKNOWN);
    fireEvent.click(chip(en.atlasPuterEnable)!);
    await screen.findByText('Puter says hi', {}, { timeout: 10000 });
    expect(m.signIn).toHaveBeenCalledTimes(1);
    const arg = m.askPuter.mock.calls[0][0];
    expect(arg.question).toBe(UNKNOWN);
    expect(arg.system).toContain('Atlas');
    expect(bubbles()).not.toContain(en.atlasPuterOffer);
  });

  it('a failed sign-in says so and removes the offer', async () => {
    quota();
    m.signIn.mockResolvedValue(false);
    await openThread(coachState());
    await ask(UNKNOWN);
    fireEvent.click(chip(en.atlasPuterEnable)!);
    await screen.findByText(en.atlasPuterFail, {}, { timeout: 10000 });
    expect(m.askPuter).not.toHaveBeenCalled();
    expect(chip(en.atlasPuterEnable)).toBeUndefined();
  });

  it('No thanks falls back to the local line', async () => {
    quota();
    await openThread(coachState());
    await ask(UNKNOWN);
    fireEvent.click(chip(en.atlasPuterNo)!);
    expect(bubbles()).toContain(en.atlasLocalUnknown);
    expect(chip(en.atlasPuterNo)).toBeUndefined();
  });

  it('when Puter is already signed in the quota hand-over is automatic', async () => {
    quota();
    m.puterReady.mockResolvedValue(true);
    await openThread(coachState());
    await ask(UNKNOWN);
    expect(last()).toBe('Puter says hi');
    expect(m.signIn).not.toHaveBeenCalled();
  });

  it.each([
    ['blocked', en.atlasChatBlocked],
    ['error', en.atlasPuterFail],
  ])('Puter failing with %s shows the matching line', async (reason, line) => {
    quota();
    m.puterReady.mockResolvedValue(true);
    m.askPuter.mockResolvedValue({ ok: false, reason });
    await openThread(coachState());
    await ask(UNKNOWN);
    expect(last()).toBe(line);
  });
});
