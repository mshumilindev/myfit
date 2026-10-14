/**
 * Undo / redo as plain data: a past and a future of whole documents (documents are small and immutable, so snapshots
 * are cheaper than inverse operations and cannot drift). Pure; the editor keeps one `History` in state.
 */
import type { ProgramDoc } from './doc';

export interface HistoryEntry {
  doc: ProgramDoc;
  /** The edit that left this document ("muscles"...), for a "Muscles set . Undo" toast. */
  label?: string;
}

export interface History {
  past: readonly HistoryEntry[];
  future: readonly HistoryEntry[];
}

export const HISTORY_LIMIT = 100;
export const emptyHistory = (): History => ({ past: [], future: [] });

/** The current doc is about to change: remember it. A new edit ends the redo branch. */
export function record(h: History, current: ProgramDoc, label?: string): History {
  return { past: [...h.past, { doc: current, label }].slice(-HISTORY_LIMIT), future: [] };
}

export const canUndo = (h: History): boolean => h.past.length > 0;
export const canRedo = (h: History): boolean => h.future.length > 0;

export function undo(
  h: History,
  current: ProgramDoc,
): { history: History; doc: ProgramDoc } | null {
  const last = h.past[h.past.length - 1];
  if (!last) return null;
  return {
    doc: last.doc,
    history: {
      past: h.past.slice(0, -1),
      future: [{ doc: current, label: last.label }, ...h.future].slice(0, HISTORY_LIMIT),
    },
  };
}

export function redo(
  h: History,
  current: ProgramDoc,
): { history: History; doc: ProgramDoc } | null {
  const next = h.future[0];
  if (!next) return null;
  return {
    doc: next.doc,
    history: {
      past: [...h.past, { doc: current, label: next.label }].slice(-HISTORY_LIMIT),
      future: h.future.slice(1),
    },
  };
}
