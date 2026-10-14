/**
 * The edit pipeline: a pure function from (previous doc, candidate doc) to the doc that is committed. The editor runs
 * every edit through the host's middleware, in order, before it reaches history and `onChange`.
 */
import type { ProgramDoc } from './doc';

export interface OpEvent {
  /** The document before the edit. */
  prev: ProgramDoc;
  /** What the edit produced (or what the previous middleware returned). */
  next: ProgramDoc;
  /** Short name of the edit ("muscles", "swap"...), when the caller gave one. */
  label?: string;
}

/**
 * Return the document to commit. Return `ev.prev` to veto the edit, `ev.next` to let it pass, or a changed copy to
 * normalise (trim names, cap sets, keep a plan inside a limit). Must be pure; may be called again for the same edit.
 */
export type OpMiddleware = (ev: OpEvent) => ProgramDoc;

/** Run `fn` on `prev` and the middleware over the result. Same reference back = nothing to commit. */
export function applyEdit(
  prev: ProgramDoc,
  fn: (doc: ProgramDoc) => ProgramDoc,
  middleware: readonly OpMiddleware[] = [],
  label?: string,
): ProgramDoc {
  let next = fn(prev);
  if (next === prev) return prev;
  for (const mw of middleware) {
    next = mw({ prev, next, label });
    if (next === prev) return prev;
  }
  return next;
}
