/**
 * Chat with Atlas — kept on this device (last 100 messages). Only with the `atlas-history` consent is it also kept in the
 * account, sealed (SPO-392, atlas/chatSyncService.ts); without it nothing here leaves the device.
 */
import { useSyncExternalStore } from 'react';

export interface ChatMsg {
  id: string;
  at: number;
  from: 'me' | 'atlas';
  text: string;
  pending?: boolean;
  /** A system line (e.g. Gemini's quota ran out), shown as a centred pill. */
  notice?: boolean;
  /** Atlas's opening hello (said once per conversation); not part of the history a reply reads. */
  hello?: boolean;
  /** The hello is the long first introduction (said once, ever), not a short greeting. */
  intro?: boolean;
  /** Follow-up suggestions under this message (tap = send). */
  chips?: string[];
  /** Offer to switch the app to this language (buttons under the message). */
  langOffer?: import('../i18n').LocaleId;
  /** A small chart drawn under the text. */
  chart?: import('./intentKit').Chart;
  /** Something Atlas offers to do — Do it / Cancel under the message. */
  action?: import('./intentKit').AtlasAction;
  /** The topic this answer came from and the question — for 👍 / 👎. */
  intent?: string;
  q?: string;
  /** Your verdict on this answer (hides the buttons). */
  rated?: 'up' | 'down';
  /** The reply was written by an AI model (Gemini or Puter): shown with the AI mark (EU AI Act Art. 50). */
  ai?: 'gemini' | 'puter';
  /** The AI chat is off: the question to send once the person turns it on (a chip under Atlas's answer). */
  aiFor?: string;
  /** Gemini is out for the day: the question to ask again through Puter after a sign-in. */
  puterFor?: string;
}

const KEY = 'spotter.atlasChat';
const MAX = 100;
const listeners = new Set<() => void>();
let log: ChatMsg[] = (() => {
  try {
    return (JSON.parse(localStorage.getItem(KEY) ?? '[]') as ChatMsg[]).filter((m) => !m.pending);
  } catch {
    return [];
  }
})();

const INTRO_KEY = 'spotter.atlasIntroSeen';
/** The long introduction was already shown on this device — also true for chats that began before this flag existed. */
export function introSeen(): boolean {
  try {
    if (localStorage.getItem(INTRO_KEY)) return true;
  } catch {
    /* private mode */
  }
  return log.some((m) => m.hello);
}
export function markIntroSeen(): void {
  try {
    localStorage.setItem(INTRO_KEY, '1');
  } catch {
    /* private mode — remembered for this tab only through the log */
  }
}

function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(log.filter((m) => !m.pending)));
  } catch {
    /* private mode — chat stays in memory */
  }
  listeners.forEach((l) => l());
}

/** What a local edit changed (SPO-392): messages to write, ids to delete, or the whole chat cleared. */
export interface ChatEdit {
  upsert: ChatMsg[];
  removed: string[];
  cleared: boolean;
}
const editListeners = new Set<(e: ChatEdit) => void>();
/** Local edits only: a chat that came from the account (`replaceChatFromAccount`) never fires this. */
export function onChatEdit(fn: (e: ChatEdit) => void): () => void {
  editListeners.add(fn);
  return () => editListeners.delete(fn);
}
const announce = (e: ChatEdit) => {
  if (e.upsert.length || e.removed.length || e.cleared) editListeners.forEach((fn) => fn(e));
};

function commit(next: ChatMsg[], removed: string[] = [], cleared = false): void {
  const before = new Map(log.map((m) => [m.id, m]));
  log = next.slice(-MAX);
  save();
  announce({
    upsert: log.filter((m) => !m.pending && before.get(m.id) !== m),
    removed,
    cleared,
  });
}

/** The chat as the account holds it (SPO-392): shown and cached, not sent back. */
export function replaceChatFromAccount(next: ChatMsg[]): void {
  log = next.slice(-MAX);
  save();
}

export function pushChat(m: ChatMsg): void {
  commit([...log, m]);
}
export function updateChat(id: string, patch: Partial<ChatMsg>): void {
  commit(log.map((m) => (m.id === id ? { ...m, ...patch } : m)));
}
export function removeChat(id: string): void {
  commit(
    log.filter((m) => m.id !== id),
    [id],
  );
}
export function clearChat(): void {
  commit([], [], true);
}
/** The chat on this device right now, outside React (the data export reads it). */
export function getChatLog(): ChatMsg[] {
  return log;
}
export function useChatLog(): ChatMsg[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => log,
  );
}
