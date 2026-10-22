import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConsentRecord } from '../legal/consents';
import { currentVersion } from '../legal/consents';
import { ATLAS_AI_CATEGORIES } from '../legal/gateChoices';
import { setLocale } from '../i18n';
import { getAiOverride, resetAiOverride } from './aiConsent';

const h = vi.hoisted(() => ({
  state: { records: [] as ConsentRecord[], loading: false, confirmed: true, error: null },
  grant: vi.fn(),
  withdraw: vi.fn(),
  clear: vi.fn(),
}));
vi.mock('../legal/consentApi', () => ({
  useConsentRecords: () => h.state,
  grantConsent: h.grant,
  withdrawConsent: h.withdraw,
}));
vi.mock('../api', async (orig) => ({
  ...(await orig<typeof import('../api')>()),
  currentUid: () => 'u1',
}));
vi.mock('./clearConversation', () => ({ clearAtlasConversation: h.clear }));

import { AtlasConsentPrompt } from './AtlasConsentPrompt';
import { AtlasWithdrawDialog } from './AtlasWithdrawDialog';
import { useAtlasAi } from './useAtlasAi';

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

beforeEach(() => {
  localStorage.clear();
  setLocale('en');
  resetAiOverride();
  h.state = { records: [], loading: false, confirmed: true, error: null };
  h.grant.mockReset().mockResolvedValue({ id: 'x', at: 1 });
  h.withdraw.mockReset().mockResolvedValue({ id: 'y', at: 2 });
  h.clear.mockReset();
});
afterEach(cleanup);

describe('AtlasConsentPrompt (turning the AI chat on)', () => {
  it('states what is sent (from the category list), who gets it, the free-tier warning, no medical advice, how to turn off', () => {
    render(<AtlasConsentPrompt engine="gemini" onDone={() => {}} />);
    expect(screen.getByRole('alertdialog', { name: 'Turn on Atlas AI chat?' })).toBeTruthy();
    const sent = screen.getByText(/^Your question and the last messages of this chat/);
    for (const part of [
      'recent workouts with exercises, weights and reps',
      'your plan',
      'your notes',
      'injured muscles',
      'training limits from long-term conditions',
      'sleep hours',
      'body weight',
    ])
      expect(sent.textContent).toContain(part);
    expect(screen.getByText(/Google \(Gemini API, free tier\).*improve its products/)).toBeTruthy();
    expect(screen.getByText(/can be wrong. They are not medical advice/)).toBeTruthy();
    expect(screen.getByText(/Turn it off any time/)).toBeTruthy();
    expect(screen.getByText(`Version ${currentVersion('atlas-ai')}`)).toBeTruthy();
    // Nothing is recorded just by showing it.
    expect(h.grant).not.toHaveBeenCalled();
  });

  it('"Turn on Atlas AI" records atlas-ai with the categories and engine actually sent, then reports it', async () => {
    const done = vi.fn();
    render(<AtlasConsentPrompt engine="gemini" onDone={done} />);
    fireEvent.click(screen.getByRole('button', { name: 'Turn on Atlas AI' }));
    await waitFor(() => expect(done).toHaveBeenCalledWith(true));
    expect(h.grant).toHaveBeenCalledWith({
      kind: 'atlas-ai',
      categories: [...ATLAS_AI_CATEGORIES],
      engines: ['gemini'],
    });
    // This device sends at once, before the record is read back.
    expect(getAiOverride().gemini).toBe(true);
  });

  it('"Not now" and closing record nothing and turn nothing on', () => {
    const done = vi.fn();
    render(<AtlasConsentPrompt engine="gemini" onDone={done} />);
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(done).toHaveBeenCalledWith(false);
    expect(h.grant).not.toHaveBeenCalled();
    expect(getAiOverride().gemini).toBeUndefined();
  });

  it('a failed save keeps it off and says so', async () => {
    h.grant.mockRejectedValue(new Error('x'));
    const done = vi.fn();
    render(<AtlasConsentPrompt engine="gemini" onDone={done} />);
    fireEvent.click(screen.getByRole('button', { name: 'Turn on Atlas AI' }));
    expect(await screen.findByText('Could not save. Please try again.')).toBeTruthy();
    expect(done).not.toHaveBeenCalled();
    expect(getAiOverride().gemini).toBeUndefined();
  });

  it('Puter is a separate consent: its own words, its own kind and engine', async () => {
    const done = vi.fn();
    render(<AtlasConsentPrompt engine="puter" onDone={done} />);
    expect(screen.getByRole('alertdialog', { name: 'Use Puter as backup?' })).toBeTruthy();
    expect(screen.getByText(/Puter \(puter\.com\), through your own Puter account/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Use Puter' }));
    await waitFor(() => expect(done).toHaveBeenCalledWith(true));
    expect(h.grant).toHaveBeenCalledWith({
      kind: 'atlas-puter',
      categories: [...ATLAS_AI_CATEGORIES],
      engines: ['puter'],
    });
    expect(h.grant).not.toHaveBeenCalledWith(expect.objectContaining({ kind: 'atlas-ai' }));
  });

  it('reads in Ukrainian and Polish, and Lithuanian falls back to English', () => {
    setLocale('uk');
    const { unmount } = render(<AtlasConsentPrompt engine="gemini" onDone={() => {}} />);
    expect(screen.getByRole('alertdialog', { name: 'Увімкнути AI-чат Atlas?' })).toBeTruthy();
    unmount();
    setLocale('pl');
    const second = render(<AtlasConsentPrompt engine="gemini" onDone={() => {}} />);
    expect(screen.getByRole('alertdialog', { name: 'Włączyć czat AI Atlasa?' })).toBeTruthy();
    second.unmount();
    setLocale('lt');
    render(<AtlasConsentPrompt engine="gemini" onDone={() => {}} />);
    expect(screen.getByRole('alertdialog', { name: 'Turn on Atlas AI chat?' })).toBeTruthy();
  });
});

describe('AtlasWithdrawDialog (turning it off)', () => {
  it('stops sending at once, records the withdrawal, and keeps the chat unless asked', async () => {
    const records = [rec('atlas-ai')];
    const done = vi.fn();
    render(<AtlasWithdrawDialog engine="gemini" records={records} onDone={done} />);
    fireEvent.click(screen.getByRole('button', { name: 'Turn off' }));
    expect(getAiOverride().gemini).toBe(false);
    await waitFor(() => expect(done).toHaveBeenCalledWith({ confirmed: true, ok: true }));
    expect(h.withdraw).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'atlas-ai', engines: ['gemini'] }),
    );
    expect(h.clear).not.toHaveBeenCalled();
  });

  it('offers to clear the chat history and does it only when ticked', async () => {
    render(<AtlasWithdrawDialog engine="gemini" records={[rec('atlas-ai')]} onDone={() => {}} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /clear this chat on this device/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Turn off' }));
    await waitFor(() => expect(h.withdraw).toHaveBeenCalled());
    expect(h.clear).toHaveBeenCalledTimes(1);
  });

  it('turning the chat off also withdraws a granted Puter', async () => {
    render(
      <AtlasWithdrawDialog
        engine="gemini"
        records={[rec('atlas-ai'), rec('atlas-puter')]}
        onDone={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Turn off' }));
    await waitFor(() => expect(h.withdraw).toHaveBeenCalledTimes(2));
    expect(h.withdraw.mock.calls.map((c) => (c[0] as { kind: string }).kind)).toEqual([
      'atlas-ai',
      'atlas-puter',
    ]);
  });

  it('"Keep on" changes nothing', () => {
    const done = vi.fn();
    render(<AtlasWithdrawDialog engine="gemini" records={[rec('atlas-ai')]} onDone={done} />);
    fireEvent.click(screen.getByRole('button', { name: 'Keep on' }));
    expect(done).toHaveBeenCalledWith({ confirmed: false, ok: true });
    expect(h.withdraw).not.toHaveBeenCalled();
    expect(getAiOverride().gemini).toBeUndefined();
  });

  it('when the record cannot be saved, sending still stays off on this device', async () => {
    h.withdraw.mockRejectedValue(new Error('offline'));
    const done = vi.fn();
    render(<AtlasWithdrawDialog engine="gemini" records={[rec('atlas-ai')]} onDone={done} />);
    fireEvent.click(screen.getByRole('button', { name: 'Turn off' }));
    await waitFor(() => expect(done).toHaveBeenCalledWith({ confirmed: true, ok: false }));
    expect(getAiOverride().gemini).toBe(false);
  });
});

describe('useAtlasAi', () => {
  it('off with no records, even for a person who had the old flag; on only from a current grant', () => {
    const off = renderHook(() => useAtlasAi());
    expect(off.result.current.state).toEqual({ gemini: false, puter: false });
    expect(off.result.current.grant('gemini')).toBeNull();
    off.unmount();
    h.state = { ...h.state, records: [rec('atlas-ai')] };
    const on = renderHook(() => useAtlasAi());
    expect(on.result.current.state.gemini).toBe(true);
    expect(on.result.current.grant('gemini')).toEqual({ engine: 'gemini' });
    expect(on.result.current.grant('puter')).toBeNull();
  });

  it('withdrawing makes the grant disappear immediately, with no rerender needed', async () => {
    h.state = { ...h.state, records: [rec('atlas-ai')] };
    const { result } = renderHook(() => useAtlasAi());
    expect(result.current.grant('gemini')).not.toBeNull();
    const { setAiOverride } = await import('./aiConsent');
    act(() => setAiOverride('gemini', false));
    expect(result.current.grant('gemini')).toBeNull();
  });
});
