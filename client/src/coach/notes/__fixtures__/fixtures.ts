/**
 * In-memory notes for tests, stories and the app and the demo build; the real adapter is the sealed port over `data/firestore/notesDocStore.ts` (see port.ts).
 *   createFixturesNotesPort()  a NotesPort holding plain objects (nothing is persisted, nothing leaves the tab)
 *   createMemoryNotesDocStore() a NotesDocStore holding RAW (sealed) documents, for the sealed adapter's tests
 */
import { FIXTURE_NOW } from '../../data/__fixtures__/fixtures';
import type { NoteWrite, NotesDocStore, NotesPort, RawDoc, RawNotes, Unsubscribe } from '../port';
import type { Note, NoteDraft } from '../types';

const H = 3_600_000;
const D = 24 * H;

/** Oleh's notes (c1), newest first. Two are shared, so the client app shows exactly those. */
export function seedNotes(now: number = FIXTURE_NOW): Note[] {
  const n = (
    id: string,
    text: string,
    ago: number,
    vis: Note['vis'],
    anchor: Note['anchor'],
  ): Note => ({
    id,
    clientId: 'c1',
    text,
    vis,
    anchor,
    at: now - ago,
    updatedAt: now - ago,
  });
  return [
    n(
      'n1',
      'Warm up your shoulder blades first. Do 2 x 15 band pull-aparts before pressing and keep the first set light.',
      25 * 60_000,
      'shared',
      { kind: 'day', id: 'upper-lower-4x:0', text: 'Upper A' },
    ),
    n(
      'n2',
      'He pauses for 1 s, not 2 s. Check the count next time we train together on Friday.',
      53 * 60_000,
      'private',
      { kind: 'decision', id: 's1', text: 'Bench stalled 4 weeks' },
    ),
    n(
      'n3',
      'Third time this month he mentions the left shoulder. Ask which movement hurts and how much.',
      13 * H,
      'private',
      { kind: 'message', id: 'cid-c1-m1', at: now - 13 * H - 25 * 60_000 },
    ),
    n(
      'n4',
      'Why we pause the bench: the pause removes the bounce, so the chest does the work. Count 2 seconds with the bar on the chest.',
      2 * D,
      'shared',
      { kind: 'exercise', id: 'paused-bench-press', text: 'Paused bench press' },
    ),
    n(
      'n5',
      'Prefers to train after 18:00. Work trip next week, back on Saturday.',
      4 * D,
      'private',
      { kind: 'none' },
    ),
  ];
}

export interface FixturesNotesOpts {
  /** the app clock; default: the fixture "now" running on from page load */
  now?: () => number;
  delayMs?: number;
  /** Notes per client id; default: Oleh's seed. */
  seed?: Record<string, Note[]>;
  failWith?: () => boolean;
}

export function createFixturesNotesPort(
  o: FixturesNotesOpts = {},
): NotesPort & { all(clientId: string): Note[] } {
  const t0 = Date.now();
  const now = o.now ?? (() => FIXTURE_NOW + (Date.now() - t0));
  const data = new Map<string, Note[]>(Object.entries(o.seed ?? { c1: seedNotes() }));
  const subs = new Map<string, Set<(n: Note[]) => void>>();
  const list = (c: string) => [...(data.get(c) ?? [])].sort((a, b) => b.at - a.at);
  const emit = (c: string) => subs.get(c)?.forEach((f) => f(list(c)));
  const wait = () =>
    o.delayMs ? new Promise<void>((r) => setTimeout(r, o.delayMs)) : Promise.resolve();
  const guard = () => {
    if (o.failWith?.()) throw Object.assign(new Error('unavailable'), { code: 'unavailable' });
  };
  let seq = 0;
  return {
    now,
    all: list,
    subscribe(clientId, on): Unsubscribe {
      let set = subs.get(clientId);
      if (!set) subs.set(clientId, (set = new Set()));
      set.add(on);
      const id = setTimeout(() => on(list(clientId)), o.delayMs ?? 0);
      return () => {
        clearTimeout(id);
        set.delete(on);
      };
    },
    async add(draft: NoteDraft) {
      await wait();
      guard();
      const t = now();
      const note: Note = {
        id: `nx${++seq}`,
        clientId: draft.clientId,
        text: draft.text.trim(),
        vis: draft.vis,
        anchor: draft.anchor,
        at: t,
        updatedAt: t,
      };
      data.set(draft.clientId, [note, ...(data.get(draft.clientId) ?? [])]);
      emit(draft.clientId);
      return note;
    },
    async edit(clientId, id, text) {
      await wait();
      guard();
      data.set(
        clientId,
        (data.get(clientId) ?? []).map((n) =>
          n.id === id ? { ...n, text: text.trim(), updatedAt: now() } : n,
        ),
      );
      emit(clientId);
    },
    async setVis(clientId, id, vis) {
      await wait();
      guard();
      data.set(
        clientId,
        (data.get(clientId) ?? []).map((n) => (n.id === id ? { ...n, vis, updatedAt: now() } : n)),
      );
      emit(clientId);
    },
    async remove(clientId, id) {
      await wait();
      guard();
      data.set(
        clientId,
        (data.get(clientId) ?? []).filter((n) => n.id !== id),
      );
      emit(clientId);
    },
  };
}

/** Raw documents by collection, with the subscription semantics of Firestore (an immediate snapshot, then one per write). */
export function createMemoryNotesDocStore(): NotesDocStore & {
  raw(): { clientNotes: RawDoc[]; notes: RawDoc[] };
} {
  const docs = { clientNotes: new Map<string, RawDoc>(), notes: new Map<string, RawDoc>() };
  const subs = new Set<{ clientId: string; on: (d: RawNotes) => void }>();
  const snap = (clientId: string): RawNotes => ({
    priv: [...docs.clientNotes.values()].filter((d) => d.clientId === clientId),
    shared: [...docs.notes.values()],
  });
  return {
    raw: () => ({ clientNotes: [...docs.clientNotes.values()], notes: [...docs.notes.values()] }),
    subscribe(clientId, on) {
      const s = { clientId, on };
      subs.add(s);
      on(snap(clientId));
      return () => void subs.delete(s);
    },
    async write(ops: readonly NoteWrite[]) {
      for (const op of ops) {
        if ('remove' in op) docs[op.coll].delete(op.id);
        else docs[op.coll].set(op.id, structuredClone(op.set));
      }
      subs.forEach((s) => s.on(snap(s.clientId)));
    },
  };
}
