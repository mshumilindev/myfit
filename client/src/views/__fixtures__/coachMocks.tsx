/**
 * Boundary mocks + helpers for the Atlas thread tests (`CoachView.*.cases.test.tsx`): Gemini / Puter / push /
 * the Firestore chat switch are faked; Atlas's own answer engine, the chat log and the store are real.
 * Import this module BEFORE `./CoachView` so its `vi.mock` calls apply.
 */
import { expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { en } from '../../i18n/en';
import { clearChat } from '../../atlas/chatLog';
import { resetAiOverride } from '../../atlas/aiConsent';
import { atlasReady } from '../../atlas/intents';
import { currentVersion, type ConsentRecord } from '../../legal/consents';
import { __getStateForTests } from '../../store';
import type { StoreState } from '../../store';
import { coachOn, installIntersectionObserver, richState, seed } from './viewKit';

const hoisted = vi.hoisted(() => ({
  canChat: true,
  push: 'off' as 'on' | 'off' | 'needs-install',
  ask: vi.fn(),
  classify: vi.fn(),
  paused: 0,
  puterReady: vi.fn(),
  signIn: vi.fn(),
  askPuter: vi.fn(),
  pushReply: vi.fn(),
  /** The consent records the (mocked) consent API returns: what the Atlas AI state is read from. */
  records: [] as ConsentRecord[],
  grant: vi.fn(),
}));
export const m = hoisted;

vi.mock('../../legal/consentApi', () => ({
  useConsentRecords: () => ({
    records: hoisted.records,
    loading: false,
    confirmed: true,
    error: null,
  }),
  grantConsent: (...a: unknown[]) => hoisted.grant(...a),
  withdrawConsent: vi.fn(async () => ({ id: 'w', at: 2 })),
}));
vi.mock('../../atlas/chatAccess', () => ({ useChatAccess: () => hoisted.canChat }));
vi.mock('../../atlas/chat', async (orig) => ({
  ...(await orig<typeof import('../../atlas/chat')>()),
  askAtlas: (...a: unknown[]) => hoisted.ask(...a),
  classifyTopic: (...a: unknown[]) => hoisted.classify(...a),
  geminiPausedUntil: () => hoisted.paused,
}));
vi.mock('../../atlas/puter', () => ({
  puterReady: (...a: unknown[]) => hoisted.puterReady(...a),
  puterSignIn: (...a: unknown[]) => hoisted.signIn(...a),
  askPuter: (...a: unknown[]) => hoisted.askPuter(...a),
}));
vi.mock('../../atlas/schedule', async (orig) => ({
  ...(await orig<typeof import('../../atlas/schedule')>()),
  pushReplyNow: (...a: unknown[]) => hoisted.pushReply(...a),
}));
vi.mock('../../push', async (orig) => ({
  ...(await orig<typeof import('../../push')>()),
  pushState: () => hoisted.push,
}));

/** `prefers-reduced-motion` on, so Atlas's typed-out answers land after one short tick. */
export function stillMotion(): void {
  window.matchMedia = ((q: string) => ({
    matches: q.includes('reduced-motion'),
    media: q,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

/**
 * Atlas AI on/off the way the app reads it (SPO-286): from the consent records, never from the coach settings. On =
 * a current `atlas-ai` grant (plus `atlas-puter` when `puter`); off = no record, so the first question that would leave the device asks first.
 */
export function setAtlasAi(on: boolean, puter = false): void {
  const rec = (kind: 'atlas-ai' | 'atlas-puter', id: string): ConsentRecord => ({
    id,
    kind,
    action: 'grant',
    version: currentVersion(kind),
    at: 1,
  });
  hoisted.records = on ? [rec('atlas-ai', 'r1'), ...(puter ? [rec('atlas-puter', 'r2')] : [])] : [];
}

export function resetCoachMocks(): void {
  m.canChat = true;
  m.push = 'off';
  m.paused = 0;
  for (const f of [m.ask, m.classify, m.puterReady, m.signIn, m.askPuter, m.pushReply])
    f.mockReset();
  m.ask.mockResolvedValue({ ok: true, text: 'Gemini says hi' });
  m.puterReady.mockResolvedValue(false);
  m.signIn.mockResolvedValue(true);
  m.askPuter.mockResolvedValue({ ok: true, text: 'Puter says hi' });
  m.pushReply.mockResolvedValue(undefined);
  m.grant.mockReset().mockResolvedValue({ id: 'x', at: 1 });
  resetAiOverride();
  setAtlasAi(true);
  localStorage.clear();
  clearChat();
  stillMotion();
  installIntersectionObserver();
  Element.prototype.scrollIntoView = vi.fn();
}

export const coach = () => __getStateForTests().coach;

/** A coach that is on (the AI chat is on too unless a test calls `setAtlasAi(false)`). */
export function coachState(
  over: Partial<StoreState['coach']> = {},
  base: StoreState = richState(),
): StoreState {
  return coachOn(base, over);
}

export async function openThread(
  state: StoreState = coachState(),
  onOpenSession?: (id: string) => void,
) {
  const { CoachView } = await import('../CoachView');
  seed(state);
  const onClose = vi.fn();
  const out = render(<CoachView onClose={onClose} onOpenSession={onOpenSession} />);
  return { ...out, onClose };
}

export const composer = () =>
  document.querySelector('.uicomp textarea, textarea') as HTMLTextAreaElement;
export function type(text: string): void {
  fireEvent.change(composer(), { target: { value: text } });
}
/** Each message is stamped with the clock, so the (frozen) clock moves on between messages. */
export function send(text: string): void {
  vi.setSystemTime(Date.now() + 61_000);
  type(text);
  fireEvent.click(screen.getByRole('button', { name: en.atlasSend }));
}
/** The text of every message bubble in the thread, oldest first. */
export const bubbles = () =>
  [...document.querySelectorAll('.ch-list-m .uibub-t')].map((b) => b.textContent ?? '');

/** Build Atlas's understanding index once (the first answer waits for it). */
export const warmAtlas = (): Promise<void> => atlasReady(30_000);

/** Send and wait until Atlas has finished answering (no typing dots or caret left). */
export async function ask(text: string): Promise<void> {
  const before = bubbles().length;
  send(text);
  await vi.waitFor(
    () => {
      expect(bubbles().length).toBeGreaterThanOrEqual(before + 2);
      expect(document.querySelector('.atl-dots, .atl-caret')).toBeNull();
    },
    { timeout: 20_000 },
  );
}
