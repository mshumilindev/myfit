import { useCallback, useEffect, useRef, useState } from 'react';
import { UNDO_MS } from '../domain/signalConfig';
import type { NotesPort } from '../notes/port';
import type { Note } from '../notes/types';
import { useClientNotes } from '../notes/useNotes';

export interface DecisionShareToast {
  kind: 'shared' | 'unshared';
  note: Note;
}

/**
 * Sharing one Decision with the client (S-19). It is a real write through the notes port: a SHARED note anchored
 * to the decision (sealed with the conversation key, so the client reads it and nobody else does; the Firestore
 * adapter is the same sealed one the notes already use). The state is read back from the notes list, never kept
 * in the view. Sharing and un-sharing both offer an 8 s Undo.
 */
export function useDecisionShare(
  clientId: string,
  decisionId: string,
  text: () => { text: string; label: string },
  port?: NotesPort,
) {
  const { notes, store, state } = useClientNotes(clientId, port);
  const shared =
    notes.find(
      (n) => n.vis === 'shared' && n.anchor.kind === 'decision' && n.anchor.id === decisionId,
    ) ?? null;
  const [toast, setToast] = useState<DecisionShareToast | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const show = useCallback((t: DecisionShareToast) => {
    clearTimeout(timer.current);
    setToast(t);
    timer.current = setTimeout(() => setToast(null), UNDO_MS);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  const toggle = useCallback(async () => {
    if (busy) return;
    setFailed(false);
    if (shared) {
      store.remove(shared);
      show({ kind: 'unshared', note: shared });
      return;
    }
    setBusy(true);
    const { text: body, label } = text();
    const n = await store.add({
      clientId,
      text: body,
      vis: 'shared',
      anchor: { kind: 'decision', id: decisionId, text: label },
    });
    setBusy(false);
    if (n) show({ kind: 'shared', note: n });
    else setFailed(true);
  }, [busy, shared, store, show, text, clientId, decisionId]);

  const undo = useCallback(async () => {
    const t = toast;
    if (!t) return;
    clearTimeout(timer.current);
    setToast(null);
    if (t.kind === 'unshared') {
      if (state.pending?.note.id === t.note.id) store.undo();
      return;
    }
    try {
      await store.port.remove(t.note.clientId, t.note.id);
    } catch {
      setFailed(true);
    }
  }, [toast, state.pending, store]);

  return {
    shared: !!shared,
    busy,
    failed: failed || state.failed === 'remove',
    toast,
    toggle,
    undo,
  };
}
