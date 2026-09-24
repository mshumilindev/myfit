/** Chat with Atlas — kept on this device only (last 100 messages). */
import { useSyncExternalStore } from 'react';

export interface ChatMsg {
  id: string;
  at: number;
  from: 'me' | 'atlas';
  text: string;
  pending?: boolean;
  /** A system line (e.g. Gemini's quota ran out), shown as a centred pill. */
  notice?: boolean;
  /** Follow-up suggestions under this message (tap = send). */
  chips?: string[];
  /** Offer to switch the app to this language (buttons under the message). */
  langOffer?: import('../i18n').LocaleId;
  /** A small chart drawn under the text. */
  chart?: import('./intentKit').Chart;
  /** Something Atlas offers to do — Do it / Cancel under the message. */
  action?: import('./intentKit').AtlasAction;
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

function commit(next: ChatMsg[]): void {
  log = next.slice(-MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(log.filter((m) => !m.pending)));
  } catch {
    /* private mode — chat stays in memory */
  }
  listeners.forEach((l) => l());
}

export function pushChat(m: ChatMsg): void {
  commit([...log, m]);
}
export function updateChat(id: string, patch: Partial<ChatMsg>): void {
  commit(log.map((m) => (m.id === id ? { ...m, ...patch } : m)));
}
export function clearChat(): void {
  commit([]);
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
