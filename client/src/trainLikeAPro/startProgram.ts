/**
 * Train like a pro: "Start this program". Idempotent (deterministic id, upsert), never overwrites an existing doc (R18),
 * seals the planned activities in the same create (R22) and activates through the server (the only place that knows
 * about a trainer's assignment). The catalog program is not editable afterwards (rules: `keepsOrigin`).
 */
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { callFn, currentUid, HttpError, trackMutation } from '../api';
import { sealActivitiesInDoc } from '../views/programs/activitiesVault';
import type { CatalogEntry } from './catalog/types';
import { entryToProgram, programIdFor } from './entryToProgram';

export type StartOutcome =
  /** The program is the active one. */
  | { kind: 'started'; id: string }
  /** Created on this device, activation needs the network (retry later; the doc is a harmless draft). */
  | { kind: 'queued'; id: string }
  /** A trainer's active program holds the slot; nothing was changed. */
  | { kind: 'held' }
  | { kind: 'failed' };

/** Everything the flow touches, injectable so the order of steps is testable without Firestore. */
export interface StartDeps {
  uid: () => string | null;
  now: () => number;
  exists: (id: string) => Promise<boolean>;
  create: (id: string, data: Record<string, unknown>) => Promise<void>;
  activate: (id: string) => Promise<void>;
}

const realDeps: StartDeps = {
  uid: currentUid,
  now: Date.now,
  exists: async (id) => {
    try {
      return (await getDoc(doc(db, 'programs', id))).exists();
    } catch {
      return false; // not cached and offline: the create below is rejected by the rules if it would overwrite
    }
  },
  create: (id, data) => trackMutation(setDoc(doc(db, 'programs', id), data)),
  activate: async (id) => {
    await callFn('setProgramStatus', { id, status: 'active' });
  },
};

const isHeld = (e: unknown): boolean =>
  e instanceof HttpError &&
  /trainer-program/.test(`${e.message} ${JSON.stringify(e.details ?? '')}`);
const isOffline = (e: unknown): boolean => e instanceof HttpError && e.status === 503;

export async function startCatalogProgram(
  entry: CatalogEntry,
  deps: StartDeps = realDeps,
): Promise<StartOutcome> {
  const uid = deps.uid();
  if (!uid) return { kind: 'failed' };
  const id = programIdFor(uid, entry.id);
  try {
    if (!(await deps.exists(id))) {
      // Created as a draft: the server's transaction is what makes it the active program.
      const program = { ...entryToProgram(entry, uid, deps.now()), status: 'draft' as const };
      const stored = await sealActivitiesInDoc(program);
      await deps.create(id, { ...stored, origin: { v: 1, id: entry.id } });
    }
  } catch {
    return { kind: 'failed' };
  }
  try {
    await deps.activate(id);
    return { kind: 'started', id };
  } catch (e) {
    if (isHeld(e)) return { kind: 'held' };
    if (isOffline(e)) return { kind: 'queued', id };
    return { kind: 'failed' };
  }
}
