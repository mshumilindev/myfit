/**
 * Offline reading for the chat (Part C.2 no. 9): a decorator over ANY `ChatPort` that keeps the decrypted
 * conversation list and the newest messages of each opened thread in the sealed on-device store, and replays them at
 * once on the next start (before, or without, the network). The cache is sealed with the vault DEK, wiped on
 * sign-out / relationship end / 30 days idle (see sealedLocal.ts) and never holds anything while the vault is locked.
 *
 * The live adapter stays the source of truth: the first live snapshot replaces the replayed one.
 */
import type { ChatPort } from './port';
import type { SealedLocal } from './sealedLocal';
import type { ChatMessage, ChatThread } from './types';

/** Newest messages kept per thread on the device. */
export const CACHE_MESSAGES = 50;
const WRITE_DELAY_MS = 400;

export function withLocalCache(
  port: ChatPort,
  local: SealedLocal | Promise<SealedLocal>,
): ChatPort {
  const L = Promise.resolve(local);
  const debounced = new Map<string, ReturnType<typeof setTimeout>>();
  const later = (key: string, value: unknown) => {
    const prev = debounced.get(key);
    if (prev) clearTimeout(prev);
    debounced.set(
      key,
      setTimeout(() => {
        debounced.delete(key);
        void L.then((l) => l.set(key, value)).catch(() => undefined);
      }, WRITE_DELAY_MS),
    );
  };
  return {
    ...port,
    now: () => port.now(),
    subscribeThreads(uid, onThreads, onError) {
      let live = false;
      let off = false;
      void L.then((l) => l.get<ChatThread[]>(`threads:${uid}`))
        .then((cached) => {
          if (!off && !live && Array.isArray(cached)) onThreads(cached);
        })
        .catch(() => undefined);
      const unsub = port.subscribeThreads(
        uid,
        (threads) => {
          live = true;
          onThreads(threads);
          later(`threads:${uid}`, threads);
        },
        onError,
      );
      return () => {
        off = true;
        unsub();
      };
    },
    subscribeMessages(cid, onMessages, onError, opts) {
      let live = false;
      let off = false;
      void L.then((l) => l.get<ChatMessage[]>(`msgs:${cid}`))
        .then((cached) => {
          if (!off && !live && Array.isArray(cached)) onMessages(cached);
        })
        .catch(() => undefined);
      const unsub = port.subscribeMessages(
        cid,
        (messages, meta) => {
          live = true;
          onMessages(messages, meta);
          later(`msgs:${cid}`, messages.filter((m) => m.state === 'sent').slice(-CACHE_MESSAGES));
        },
        onError,
        opts,
      );
      return () => {
        off = true;
        unsub();
      };
    },
  };
}
