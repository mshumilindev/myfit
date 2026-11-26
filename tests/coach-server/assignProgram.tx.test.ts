/** SPO-307 (R24, R25): `assignProgram` and `programAssignments` over an in-memory Firestore. */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Doc = Record<string, unknown>;
const h = vi.hoisted(() => ({ store: new Map<string, Doc>() }));

vi.mock('../../functions/src/aggregates', () => ({ listUserWorkouts: async () => [] }));
vi.mock('../../functions/src/programCycle', () => ({ plannedFor: () => [] }));
vi.mock('../../functions/src/lib', () => {
  class HttpsError extends Error {
    constructor(
      public code: string,
      message: string,
    ) {
      super(message);
    }
  }
  const snapOf = (path: string) => {
    const d = h.store.get(path);
    return {
      id: path.split('/')[1],
      exists: d !== undefined,
      data: () => d && structuredClone(d),
      ref: refOf(path),
    };
  };
  const refOf = (path: string) => ({
    path,
    get: async () => snapOf(path),
    set: async (v: Doc) => void h.store.set(path, structuredClone(v)),
    update: async (v: Doc) =>
      void h.store.set(path, { ...(h.store.get(path) ?? {}), ...structuredClone(v) }),
  });
  const query = (c: string, conds: Array<[string, unknown]>) => ({
    where: (f: string, _op: string, v: unknown) => query(c, [...conds, [f, v]]),
    kind: 'query' as const,
    get: async () => ({
      docs: [...h.store.keys()]
        .filter((p) => p.startsWith(`${c}/`))
        .filter((p) => conds.every(([f, v]) => (h.store.get(p) as Doc)[f] === v))
        .map(snapOf),
    }),
  });
  const db = {
    collection: (c: string) => ({ doc: (id: string) => refOf(`${c}/${id}`), ...query(c, []) }),
    batch: () => {
      const ops: Array<() => Promise<void>> = [];
      return {
        update: (r: ReturnType<typeof refOf>, v: Doc) => void ops.push(() => r.update(v)),
        delete: (r: ReturnType<typeof refOf>) =>
          void ops.push(async () => void h.store.delete(r.path)),
        commit: async () => {
          for (const o of ops) await o();
        },
      };
    },
    runTransaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const before = new Map([...h.store].map(([k, v]) => [k, structuredClone(v)]));
      const writes: Array<() => Promise<void>> = [];
      const tx = {
        get: (x: { get: () => Promise<unknown> }) => x.get(),
        set: (r: ReturnType<typeof refOf>, v: Doc) => void writes.push(() => r.set(v)),
        update: (r: ReturnType<typeof refOf>, v: Doc) => void writes.push(() => r.update(v)),
      };
      try {
        const out = await fn(tx);
        for (const w of writes) await w();
        return out;
      } catch (e) {
        h.store.clear();
        for (const [k, v] of before) h.store.set(k, v);
        throw e;
      }
    },
  };
  return {
    db,
    HttpsError,
    requireAuth: (req: { auth?: { uid: string } }) => req.auth!.uid,
    requireRole: async (req: { auth: { uid: string } }) => ({
      uid: req.auth.uid,
      user: { id: req.auth.uid, ...(h.store.get(`users/${req.auth.uid}`) as Doc) },
    }),
    loadUser: async (uid: string) => ({ id: uid, ...(h.store.get(`users/${uid}`) as Doc) }),
    displayName: () => '',
    createNotice: async () => undefined,
  };
});

import { assignProgram, programAssignments } from '../../functions/src/programs';

const run = (fn: unknown, uid: string, data: Doc) =>
  (fn as { run: (r: unknown) => Promise<unknown> }).run({ auth: { uid }, data });
const assign = (uid: string, id: string, memberId: string) =>
  run(assignProgram, uid, { id, memberId, startWeek: 1 });
const prog = (id: string, authorId: string, status: string): Doc => ({
  id,
  authorId,
  name: id,
  weeks: 4,
  daysPerWeek: 1,
  status,
  items: [{ day: 1, name: 'Squat' }],
});
const get = (p: string) => h.store.get(p);
const put = (p: string, d: Doc) => void h.store.set(p, d);

beforeEach(() => {
  h.store.clear();
  put('users/t1', { role: 'trainer' });
  put('users/t2', { role: 'trainer' });
  put('users/a1', { role: 'admin' });
  put('users/m1', { role: 'member', trainerId: 't1' });
  put('users/m2', { role: 'member', trainerId: 't1' });
  put('users/m3', { role: 'member', trainerId: 't2' });
  put('programs/prg-t', prog('prg-t', 't1', 'draft'));
});

describe('assignProgram (R25: the assigned program is the one active program)', () => {
  it("archives the member's own active programs and takes the assignment", async () => {
    put('programs/own', prog('own', 'm1', 'active'));
    put('programs/tl-m1-x', prog('tl-m1-x', 'm1', 'active'));
    await assign('t1', 'prg-t', 'm1');
    expect(get('programs/own')?.status).toBe('archived');
    expect(get('programs/tl-m1-x')?.status).toBe('archived');
    expect(get('programs/prg-t')?.status).toBe('active');
    expect(get('assignments/m1')).toMatchObject({ programId: 'prg-t', assignedBy: 't1' });
  });

  it("never touches the trainer's programs or other clients' programs", async () => {
    put('programs/prg-old', prog('prg-old', 't1', 'active'));
    put('assignments/m1', { memberId: 'm1', programId: 'prg-old', assignedBy: 't1', startedAt: 1 });
    put('assignments/m2', { memberId: 'm2', programId: 'prg-old', assignedBy: 't1', startedAt: 1 });
    put('programs/other', prog('other', 'm2', 'active'));
    await assign('t1', 'prg-t', 'm1');
    expect(get('programs/prg-old')?.status).toBe('active');
    expect(get('programs/other')?.status).toBe('active');
    expect(get('assignments/m2')).toMatchObject({ programId: 'prg-old' });
    expect(get('assignments/m1')).toMatchObject({ programId: 'prg-t' });
  });

  it('a trainer assigning to themselves keeps their own library as it is', async () => {
    put('programs/lib', prog('lib', 't1', 'active'));
    await assign('t1', 'prg-t', 't1').catch(() => undefined);
    expect(get('programs/lib')?.status).toBe('active');
  });

  it("another trainer's client and someone else's program are refused", async () => {
    await expect(assign('t1', 'prg-t', 'm3')).rejects.toMatchObject({ code: 'permission-denied' });
    put('programs/prg-t2', prog('prg-t2', 't2', 'draft'));
    await expect(assign('t1', 'prg-t2', 'm1')).rejects.toMatchObject({ code: 'permission-denied' });
    expect(get('assignments/m1')).toBeUndefined();
  });

  it('assigning the same program again is idempotent', async () => {
    put('programs/own', prog('own', 'm1', 'active'));
    await assign('t1', 'prg-t', 'm1');
    await assign('t1', 'prg-t', 'm1');
    expect(get('programs/own')?.status).toBe('archived');
    expect(get('programs/prg-t')?.status).toBe('active');
  });
});

describe('programAssignments (R24: scoped list for the Programs screen)', () => {
  beforeEach(() => {
    put('assignments/m1', {
      memberId: 'm1',
      programId: 'p1',
      assignedBy: 't1',
      startedAt: 1,
      x: 'no',
    });
    put('assignments/m3', { memberId: 'm3', programId: 'p3', assignedBy: 't2', startedAt: 3 });
  });
  const list = async (uid: string) =>
    ((await run(programAssignments, uid, {})) as { assignments: Doc[] }).assignments;

  it("a trainer gets only their clients' assignments, three fields each", async () => {
    expect(await list('t1')).toEqual([{ memberId: 'm1', programId: 'p1', startedAt: 1 }]);
  });
  it('an admin gets all', async () => {
    expect((await list('a1')).map((a) => a.memberId).sort()).toEqual(['m1', 'm3']);
  });
  it('a trainer with no clients gets none', async () => {
    put('users/t9', { role: 'trainer' });
    expect(await list('t9')).toEqual([]);
  });
});
