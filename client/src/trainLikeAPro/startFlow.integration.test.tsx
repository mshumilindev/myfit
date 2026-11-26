/**
 * SPO-307: the whole "Start this program" flow, UI to database, over an in-memory Firestore and an in-memory
 * `setProgramStatus`. The real parts: CatalogRoute, CatalogPage/Detail, startCatalogProgram, entryToProgram, the
 * Firestore calls it makes (getDoc/setDoc on `programs/{id}`). The emulated parts: the database (a Map) and the server
 * activation (archive the member's other active programs, activate, write `assignments/{uid}`, refuse over a trainer's
 * program). The server rules themselves are proven in tests/coach-server/setProgramStatus.tx.test.ts; this test proves
 * what the screen writes and how it reacts to each server answer. Nothing real is written anywhere.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CATALOG } from './catalog';
import { addonsPref } from '../addons/enabledSet';

type Doc = Record<string, unknown>;
const h = vi.hoisted(() => ({
  store: new Map<string, Doc>(),
  setDocCalls: 0,
  server: 'ok' as 'ok' | 'offline',
}));

vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, col: string, id: string) => ({ path: `${col}/${id}` }),
  getDoc: async (r: { path: string }) => ({ exists: () => h.store.has(r.path) }),
  setDoc: async (r: { path: string }, data: Doc) => {
    h.setDocCalls += 1;
    h.store.set(r.path, structuredClone(data));
  },
}));
vi.mock('../firebase', () => ({ db: {} }));
vi.mock('../views/programs/activitiesVault', () => ({
  sealActivitiesInDoc: async (d: Doc) => {
    const { activities, ...rest } = d;
    return activities ? { ...rest, activitiesEnc: { sealed: true } } : rest;
  },
}));

/** The emulated `setProgramStatus` (member, status active) over the in-memory store. */
async function setProgramStatus(uid: string, id: string): Promise<void> {
  if (h.server === 'offline') throw new HttpError(503, 'offline');
  const asg = h.store.get(`assignments/${uid}`) as
    { programId: string; assignedBy: string } | undefined;
  const assigned = asg && (h.store.get(`programs/${asg.programId}`) as Doc | undefined);
  if (asg && asg.programId === id && h.store.get(`programs/${id}`)?.status === 'active') return;
  if (id.startsWith('tl-') && asg && asg.assignedBy !== uid && assigned?.status === 'active')
    throw new HttpError(409, 'trainer-program');
  for (const [path, d] of h.store)
    if (
      path.startsWith('programs/') &&
      d.authorId === uid &&
      d.status === 'active' &&
      path !== `programs/${id}`
    )
      h.store.set(path, { ...d, status: 'archived' });
  h.store.set(`programs/${id}`, { ...h.store.get(`programs/${id}`), status: 'active' });
  h.store.set(`assignments/${uid}`, {
    memberId: uid,
    programId: id,
    assignedBy: uid,
    startedAt: 1,
  });
}

vi.mock('../api', async (orig) => ({
  ...(await orig<typeof import('../api')>()),
  currentUid: () => 'u1',
  callFn: async (name: string, body: { id: string }) => {
    if (name === 'setProgramStatus') await setProgramStatus('u1', body.id);
    return {};
  },
}));
vi.mock('../data/programMine', () => ({
  // what the screen would read back: the program the assignment points at (re-read on every render)
  useProgramMine: () => {
    const a = h.store.get('assignments/u1') as { programId: string } | undefined;
    const p = a && (h.store.get(`programs/${a.programId}`) as Doc | undefined);
    return {
      assignment: p
        ? { program: { id: a.programId, name: String(p.name), authorId: p.authorId } }
        : null,
    };
  },
  refreshProgramMine: () => undefined,
}));

import { HttpError } from '../api';
import { CatalogRoute } from './CatalogRoute';

const entry = CATALOG.find((e) => e.id === 'linear-5x5-ab')!;
const other = CATALOG.find((e) => e.id !== entry.id && e.needs.length === 0)!;
const pid = (e: { id: string }) => `tl-u1-${e.id}`;
const openCard = (e: { who: string; title: string }) =>
  fireEvent.click(screen.getByRole('button', { name: `${e.who}. ${e.title}` }));
const start = () => fireEvent.click(screen.getByRole('button', { name: 'Start this program' }));
const prog = (id: string, authorId: string, status: string): Doc => ({
  id,
  authorId,
  name: id,
  status,
});

beforeEach(() => {
  addonsPref.reset();
  h.store.clear();
  h.setDocCalls = 0;
  h.server = 'ok';
});
afterEach(cleanup);

describe('Start this program, UI to database (emulated)', () => {
  it('creates the sealed catalog program, activates it, takes the assignment and closes', async () => {
    const onClose = vi.fn();
    render(<CatalogRoute onClose={onClose} />);
    openCard(entry);
    start();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(h.store.get(`programs/${pid(entry)}`)).toMatchObject({
      authorId: 'u1',
      status: 'active',
      origin: { v: 1, id: entry.id },
    });
    expect(h.store.get(`programs/${pid(entry)}`)?.activities).toBeUndefined();
    expect(h.store.get('assignments/u1')).toMatchObject({
      programId: pid(entry),
      assignedBy: 'u1',
    });
  });

  it('starting it again writes nothing new and keeps the progress', async () => {
    const onClose = vi.fn();
    render(<CatalogRoute onClose={onClose} />);
    openCard(entry);
    start();
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    const writes = h.setDocCalls;
    const asg = structuredClone(h.store.get('assignments/u1'));
    cleanup();
    render(<CatalogRoute onClose={onClose} />);
    openCard(entry);
    start();
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(2));
    expect(h.setDocCalls).toBe(writes);
    expect(h.store.get('assignments/u1')).toEqual(asg);
  });

  it("replacing the member's own program archives it, only after the confirmation", async () => {
    h.store.set('programs/mine', prog('mine', 'u1', 'active'));
    h.store.set('assignments/u1', {
      memberId: 'u1',
      programId: 'mine',
      assignedBy: 'u1',
      startedAt: 5,
    });
    const onClose = vi.fn();
    render(<CatalogRoute onClose={onClose} />);
    openCard(other);
    start();
    expect(h.store.get('programs/mine')?.status).toBe('active');
    expect(h.store.has(`programs/${pid(other)}`)).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Replace and start' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(h.store.get('programs/mine')?.status).toBe('archived');
    expect(h.store.get(`programs/${pid(other)}`)?.status).toBe('active');
    expect(h.store.get('assignments/u1')).toMatchObject({ programId: pid(other) });
  });

  it("a trainer's active program is never replaced: Start is off and nothing is written", () => {
    h.store.set('programs/coach', prog('coach', 't1', 'active'));
    h.store.set('assignments/u1', {
      memberId: 'u1',
      programId: 'coach',
      assignedBy: 't1',
      startedAt: 5,
    });
    render(<CatalogRoute onClose={() => {}} />);
    openCard(entry);
    expect(
      (screen.getByRole('button', { name: 'Start this program' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(h.setDocCalls).toBe(0);
    expect(h.store.get('assignments/u1')).toMatchObject({ programId: 'coach', assignedBy: 't1' });
  });

  it('when the server refuses over a trainer program (the screen did not know yet) nothing is activated', async () => {
    // the screen reads "no assignment" through a stale view: emulate by assigning only after the first render
    render(<CatalogRoute onClose={() => {}} />);
    openCard(entry);
    h.store.set('programs/coach', prog('coach', 't1', 'active'));
    h.store.set('assignments/u1', {
      memberId: 'u1',
      programId: 'coach',
      assignedBy: 't1',
      startedAt: 5,
    });
    start();
    await screen.findByText(/can't be replaced here/);
    expect(h.store.get(`programs/${pid(entry)}`)?.status).toBe('draft');
    expect(h.store.get('assignments/u1')).toMatchObject({ programId: 'coach' });
  });

  it('offline: the draft is created, the page says it starts when online, nothing is active', async () => {
    h.server = 'offline';
    const onClose = vi.fn();
    render(<CatalogRoute onClose={onClose} />);
    openCard(entry);
    start();
    await screen.findByText(/It starts when you are online/);
    expect(onClose).not.toHaveBeenCalled();
    expect(h.store.get(`programs/${pid(entry)}`)?.status).toBe('draft');
    expect(h.store.has('assignments/u1')).toBe(false);
  });
});
