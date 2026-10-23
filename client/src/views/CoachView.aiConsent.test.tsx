import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConsentRecord } from '../legal/consents';
import { currentVersion } from '../legal/consents';
import { setLocale } from '../i18n';
import { resetAiOverride } from '../atlas/aiConsent';
import { clearChat } from '../atlas/chatLog';
import { __getStateForTests, __replaceStateForTests } from '../store';

const h = vi.hoisted(() => ({
  records: [] as ConsentRecord[],
  grant: vi.fn(),
  withdraw: vi.fn(),
  askAtlas: vi.fn(),
  classify: vi.fn(),
  askPuter: vi.fn(),
  puterReady: vi.fn(),
  puterSignIn: vi.fn(),
}));
vi.mock('../legal/consentApi', () => ({
  useConsentRecords: () => ({ records: h.records, loading: false, confirmed: true, error: null }),
  grantConsent: h.grant,
  withdrawConsent: h.withdraw,
}));
// A withdrawal is recorded for the signed-in account (no account: nothing to record), so the person here is signed in.
vi.mock('../api', async (orig) => ({
  ...(await orig<typeof import('../api')>()),
  currentUid: () => 'u1',
}));
vi.mock('../atlas/chatAccess', () => ({ useChatAccess: () => true }));
vi.mock('../atlas/chat', async (orig) => ({
  ...(await orig<typeof import('../atlas/chat')>()),
  askAtlas: h.askAtlas,
  classifyTopic: h.classify,
}));
vi.mock('../atlas/puter', () => ({
  askPuter: h.askPuter,
  puterReady: h.puterReady,
  puterSignIn: h.puterSignIn,
}));

import { CoachView } from './CoachView';

let n = 0;
const rec = (
  kind: ConsentRecord['kind'],
  action: ConsentRecord['action'] = 'grant',
): ConsentRecord => ({
  id: `r${++n}`,
  kind,
  action,
  version: currentVersion(kind),
  at: 1_700_000_000_000 + n,
});

/** Nothing in Atlas's own library answers this, so the question would go to the AI when it is on. */
const HARD = 'qwertyuiop asdfghjkl';

async function ask(text: string) {
  const box = (await screen.findByPlaceholderText(/Ask Atlas/)) as HTMLTextAreaElement;
  fireEvent.change(box, { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
}

beforeEach(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Element.prototype.scrollIntoView = () => {};
  setLocale('en');
  resetAiOverride();
  clearChat();
  h.records = [];
  for (const f of [
    h.grant,
    h.withdraw,
    h.askAtlas,
    h.classify,
    h.askPuter,
    h.puterReady,
    h.puterSignIn,
  ])
    f.mockReset();
  h.grant.mockResolvedValue({ id: 'x', at: 1 });
  h.withdraw.mockResolvedValue({ id: 'y', at: 2 });
  h.classify.mockResolvedValue(null);
  h.puterReady.mockResolvedValue(false);
  const s = __getStateForTests();
  // The person had agreed under the OLD flow: `chatConsent: true`, but there is no consent record.
  __replaceStateForTests({
    ...s,
    coach: {
      ...s.coach,
      enabled: true,
      temper: 3,
      startedAt: Date.now() - 86_400_000,
      chatConsent: true,
    } as never,
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Atlas AI chat in the chat screen (SPO-286)', () => {
  it('is off by default (also for the legacy flag): nothing is sent, and turning it on is offered', async () => {
    render(<CoachView onClose={() => {}} />);
    await ask(HARD);
    expect(
      await screen.findByRole('button', { name: 'Turn on Atlas AI' }, { timeout: 15_000 }),
    ).toBeTruthy();
    expect(h.askAtlas).not.toHaveBeenCalled();
    expect(h.classify).not.toHaveBeenCalled();
    expect(h.askPuter).not.toHaveBeenCalled();
    expect(h.puterReady).not.toHaveBeenCalled();
  });

  it('the prompt opens on enabling; "Not now" records nothing and still sends nothing', async () => {
    render(<CoachView onClose={() => {}} />);
    await ask(HARD);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Turn on Atlas AI' }, { timeout: 15_000 }),
    );
    expect(screen.getByRole('alertdialog', { name: 'Turn on Atlas AI chat?' })).toBeTruthy();
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Not now' }),
    );
    expect(h.grant).not.toHaveBeenCalled();
    expect(h.askAtlas).not.toHaveBeenCalled();
  });

  it('turning it on from the offer records the consent, then asks the waiting question; the reply carries the AI mark', async () => {
    h.askAtlas.mockResolvedValue({ ok: true, text: 'Model reply here' });
    render(<CoachView onClose={() => {}} />);
    await ask(HARD);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Turn on Atlas AI' }, { timeout: 15_000 }),
    );
    fireEvent.click(screen.getAllByRole('button', { name: 'Turn on Atlas AI' }).at(-1)!);
    await waitFor(() => expect(h.askAtlas).toHaveBeenCalled());
    expect(h.grant).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'atlas-ai', engines: ['gemini'] }),
    );
    expect(h.askAtlas.mock.calls[0][0].grant).toEqual({ engine: 'gemini' });
    expect(await screen.findByText('Model reply here')).toBeTruthy();
    expect(screen.getByText('AI reply')).toBeTruthy();
  });

  it('with a current consent the question goes to the AI; a local answer carries no AI mark', async () => {
    h.records = [rec('atlas-ai')];
    h.askAtlas.mockResolvedValue({ ok: true, text: 'Model reply here' });
    render(<CoachView onClose={() => {}} />);
    await ask(HARD);
    expect(await screen.findByText('Model reply here', {}, { timeout: 15_000 })).toBeTruthy();
    expect(screen.getAllByText('AI reply')).toHaveLength(1);
  });

  it('an error from the AI is not tagged as an AI reply', async () => {
    h.records = [rec('atlas-ai')];
    h.askAtlas.mockResolvedValue({ ok: false, reason: 'error' });
    render(<CoachView onClose={() => {}} />);
    await ask(HARD);
    await waitFor(() => expect(h.askAtlas).toHaveBeenCalled(), { timeout: 15_000 });
    await screen.findByText(/can’t answer that right now/);
    expect(screen.queryByText('AI reply')).toBeNull();
  });

  it('withdrawing in Atlas settings stops sending at once and the chat falls back to the built-in library', async () => {
    h.records = [rec('atlas-ai')];
    render(<CoachView onClose={() => {}} />);
    fireEvent.click(
      await screen
        .findByRole('button', { name: 'Atlas settings' })
        .catch(() => screen.getByLabelText(/settings/i)),
    );
    fireEvent.click(screen.getByRole('switch', { name: 'AI chat' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Turn off' }));
    await waitFor(() => expect(h.withdraw).toHaveBeenCalled());
    await act(async () => {});
    await ask(HARD);
    await screen.findByRole('button', { name: 'Turn on Atlas AI' }, { timeout: 15_000 });
    expect(h.askAtlas).not.toHaveBeenCalled();
  });

  it('Puter is a separate consent: when Gemini is out the chip asks for it, and nothing is loaded before', async () => {
    h.records = [rec('atlas-ai')];
    h.askAtlas.mockResolvedValue({ ok: false, reason: 'quota', until: Date.now() + 3_600_000 });
    render(<CoachView onClose={() => {}} />);
    await ask(HARD);
    fireEvent.click(await screen.findByRole('button', { name: 'Use Puter' }, { timeout: 15_000 }));
    expect(screen.getByRole('alertdialog', { name: 'Use Puter as backup?' })).toBeTruthy();
    expect(h.puterSignIn).not.toHaveBeenCalled();
    expect(h.askPuter).not.toHaveBeenCalled();
    expect(h.puterReady).toHaveBeenCalledWith(null);
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Not now' }),
    );
    expect(h.grant).not.toHaveBeenCalled();
  });
});
