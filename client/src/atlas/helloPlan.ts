/**
 * When Atlas says hello (SPO-6). The greeting is a real message at the top of the conversation, so it is said once
 * per conversation: opening the chat again, on mobile or desktop, never adds a second one, because the thread is no
 * longer empty. A new conversation (first open, or after "Clear chat") greets once. While nothing has been written
 * yet, the greeting follows the temper / language you pick, so the voice can be tried out; after that it is history.
 */
import type { ChatMsg } from './chatLog';

export const HELLO_ID = 'atlas-hello';

export type HelloStep = { kind: 'none' } | { kind: 'push' } | { kind: 'update' };

/** What to do with the greeting, given the stored chat and the greeting text it should currently have. */
export function helloStep(
  chat: readonly ChatMsg[],
  next: { text: string; chips: string[] } | null,
): HelloStep {
  if (!next) return { kind: 'none' };
  if (chat.length === 0) return { kind: 'push' };
  const only = chat.length === 1 && chat[0].id === HELLO_ID ? chat[0] : null;
  if (!only) return { kind: 'none' };
  const same = only.text === next.text && (only.chips ?? []).join('\n') === next.chips.join('\n');
  return same ? { kind: 'none' } : { kind: 'update' };
}

/** The messages a reply may read as conversation: no system lines, no greeting. */
export const inHistory = (m: ChatMsg): boolean => !m.notice && !m.hello;

/**
 * Which hello a new / re-voiced greeting should be: the long introduction the first time ever (and while it is still the
 * only message, so picking a temper re-voices it), a short greeting in the temper's voice in every later conversation.
 */
export const helloIsIntro = (chat: readonly ChatMsg[], seen: boolean): boolean =>
  !seen || (chat.length === 1 && chat[0].id === HELLO_ID && chat[0].intro === true);
