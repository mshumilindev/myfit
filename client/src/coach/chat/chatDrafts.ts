/**
 * Composer drafts, one per conversation, shared by the Chat screen and the dock (so a half-written message follows
 * the user from one to the other). Held in memory; when the vault has a key they are also kept SEALED on the device
 * (`draft:<cid>`, Part C.2 no. 9) so a reload does not lose them. An empty draft deletes the stored copy; a sent
 * message clears it. Never plaintext in storage.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { getSealedLocal, isLocalConfigured, type SealedLocal } from './sealedLocal';

const SAVE_DELAY_MS = 600;

export interface DraftStore {
  get(cid: string): string;
  set(cid: string, text: string): void;
  /** Read the sealed copy into memory unless the user already typed something. */
  load(cid: string): Promise<void>;
  subscribe(f: () => void): () => void;
  /** Same text object until something changes. */
  snapshot(): Readonly<Record<string, string>>;
  attach(local: SealedLocal | null): void;
}

export function createDraftStore(): DraftStore {
  let drafts: Record<string, string> = {};
  let local: SealedLocal | null = null;
  const subs = new Set<() => void>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const emit = () => subs.forEach((f) => f());
  const save = (cid: string) => {
    const l = local;
    if (!l) return;
    const t = timers.get(cid);
    if (t) clearTimeout(t);
    timers.set(
      cid,
      setTimeout(() => {
        timers.delete(cid);
        const text = drafts[cid] ?? '';
        void (text ? l.set(`draft:${cid}`, text) : l.remove(`draft:${cid}`));
      }, SAVE_DELAY_MS),
    );
  };
  return {
    get: (cid) => drafts[cid] ?? '',
    set(cid, text) {
      if ((drafts[cid] ?? '') === text) return;
      drafts = { ...drafts, [cid]: text };
      emit();
      save(cid);
    },
    async load(cid) {
      const l = local;
      if (!l || (drafts[cid] ?? '') !== '') return;
      const saved = await l.get<string>(`draft:${cid}`);
      if (typeof saved === 'string' && saved && (drafts[cid] ?? '') === '') {
        drafts = { ...drafts, [cid]: saved };
        emit();
      }
    },
    subscribe(f) {
      subs.add(f);
      return () => void subs.delete(f);
    },
    snapshot: () => drafts,
    attach(l) {
      local = l;
    },
  };
}

let shared: DraftStore | null = null;
export const draftStore = (): DraftStore => (shared ??= createDraftStore());
/** Tests / stories. */
export function resetDraftStore(): void {
  shared = null;
}

/** `[draft, setDraft]` of one conversation; loads the sealed copy when the conversation opens. */
export function useDraft(cid: string | null, store: DraftStore = draftStore()) {
  const snap = useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);
  useEffect(() => {
    let off = false;
    let unsub: (() => void) | undefined;
    if (typeof indexedDB === 'undefined' && !isLocalConfigured()) return;
    void getSealedLocal()
      .then((l) => {
        if (off) return;
        store.attach(l);
        if (cid) void store.load(cid);
        // a vault that unlocks later: try again then
        unsub = l.subscribe(() => {
          if (cid) void store.load(cid);
        });
      })
      .catch(() => undefined);
    return () => {
      off = true;
      unsub?.();
    };
  }, [store, cid]);
  return [cid ? (snap[cid] ?? '') : '', (v: string) => cid && store.set(cid, v)] as const;
}
