/** SPO-307 (R15, R16, R25): `setProgramStatus` end to end over an in-memory Firestore (the transaction, not only `planActivation`). */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Doc = Record<string, unknown>;
const h = vi.hoisted(() => ({
  store: new Map<string, Doc>(),
  /** A program path deleted right as the transaction starts (a race with the pre-read). */
  vanishInTx: null as string | null,
}));

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
      if (h.vanishInTx) h.store.delete(h.vanishInTx);
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
    requireRole: async () => ({}),
    loadUser: async (uid: string) => ({ id: uid, ...(h.store.get(`users/${uid}`) as Doc) }),
    displayName: () => '',
    createNotice: async () => undefined,
  };
});

import { setProgramStatus } from '../../functions/src/programs';

const call = (uid: string, id: string, status = 'active') =>
  (setProgramStatus as unknown as { run: (r: unknown) => Promise<unknown> }).run({
    auth: { uid },
    data: { id, status },
  });
const prog = (id: string, authorId: string, status: string): Doc => ({
  id,
  authorId,
  name: id,
  weeks: 4,
  daysPerWeek: 1,
  status,
  dayNames: {},
  items: [{ day: 1, name: 'Squat' }],
  updatedAt: 1,
});
const put = (path: string, d: Doc) => void h.store.set(path, d);
const get = (path: string) => h.store.get(path);

beforeEach(() => {
  h.store.clear();
  h.vanishInTx = null;
  put('users/m1', { role: 'member', trainerId: 't1' });
  put('users/t1', { role: 'trainer' });
});

describe('setProgramStatus (member, active)', () => {
  it("a catalog start keeps the member's own active program active (owner 27.11) and takes the assignment", async () => {
    put('programs/prg-old', prog('prg-old', 'm1', 'active'));
    put('assignments/m1', { memberId: 'm1', programId: 'prg-old', assignedBy: 'm1', startedAt: 5 });
    put('programs/tl-m1-x', prog('tl-m1-x', 'm1', 'draft'));
    await call('m1', 'tl-m1-x');
    expect(get('programs/prg-old')?.status).toBe('active');
    expect(get('programs/tl-m1-x')?.status).toBe('active');
    expect(get('assignments/m1')).toMatchObject({ programId: 'tl-m1-x', assignedBy: 'm1' });
  });

  it('a member activating their own program keeps the other own program active and archives only a replaced catalog one', async () => {
    put('programs/prg-a', prog('prg-a', 'm1', 'active'));
    put('programs/tl-m1-x', prog('tl-m1-x', 'm1', 'active'));
    put('assignments/m1', { memberId: 'm1', programId: 'tl-m1-x', assignedBy: 'm1', startedAt: 5 });
    put('programs/prg-b', prog('prg-b', 'm1', 'draft'));
    await call('m1', 'prg-b');
    expect(get('programs/prg-a')?.status).toBe('active');
    expect(get('programs/tl-m1-x')?.status).toBe('archived');
    expect(get('programs/prg-b')?.status).toBe('active');
    expect(get('assignments/m1')).toMatchObject({ programId: 'prg-b' });
  });

  it("a catalog start never replaces the trainer's active program and changes nothing", async () => {
    put('programs/prg-t', prog('prg-t', 't1', 'active'));
    put('assignments/m1', { memberId: 'm1', programId: 'prg-t', assignedBy: 't1', startedAt: 5 });
    put('programs/tl-m1-x', prog('tl-m1-x', 'm1', 'draft'));
    await expect(call('m1', 'tl-m1-x')).rejects.toMatchObject({
      code: 'failed-precondition',
      message: 'trainer-program',
    });
    expect(get('programs/tl-m1-x')?.status).toBe('draft');
    expect(get('assignments/m1')).toMatchObject({ programId: 'prg-t', assignedBy: 't1' });
    expect(get('programs/prg-t')?.status).toBe('active');
  });

  it('an ordinary program keeps the old behaviour over a trainer assignment', async () => {
    put('programs/prg-t', prog('prg-t', 't1', 'active'));
    put('assignments/m1', { memberId: 'm1', programId: 'prg-t', assignedBy: 't1', startedAt: 5 });
    put('programs/prg-own', prog('prg-own', 'm1', 'draft'));
    await call('m1', 'prg-own');
    expect(get('assignments/m1')).toMatchObject({ programId: 'prg-own' });
  });

  it('a repeated start of the active program keeps startedAt (progress is not reset)', async () => {
    put('programs/tl-m1-x', prog('tl-m1-x', 'm1', 'active'));
    put('assignments/m1', { memberId: 'm1', programId: 'tl-m1-x', assignedBy: 'm1', startedAt: 5 });
    await call('m1', 'tl-m1-x');
    expect(get('assignments/m1')?.startedAt).toBe(5);
  });

  it('an active program with no assignment is made the assignment (not a false noop)', async () => {
    put('programs/tl-m1-x', prog('tl-m1-x', 'm1', 'active'));
    await call('m1', 'tl-m1-x');
    expect(get('assignments/m1')).toMatchObject({ programId: 'tl-m1-x', assignedBy: 'm1' });
  });

  it('a malformed old assignment does not lock the member out', async () => {
    put('assignments/m1', { memberId: 'm1' });
    put('programs/tl-m1-x', prog('tl-m1-x', 'm1', 'draft'));
    await call('m1', 'tl-m1-x');
    expect(get('assignments/m1')).toMatchObject({ programId: 'tl-m1-x' });
  });

  it("someone else's program is refused", async () => {
    put('programs/tl-m2-x', prog('tl-m2-x', 'm2', 'draft'));
    await expect(call('m1', 'tl-m2-x')).rejects.toMatchObject({ code: 'permission-denied' });
  });
});

describe('setProgramStatus (trainer and admin, catalog start)', () => {
  it.each(['trainer', 'admin'])(
    'a %s starting a catalog program takes their own assignment and keeps their other active program active',
    async (role) => {
      put('users/x1', { role });
      put('programs/prg-old', prog('prg-old', 'x1', 'active'));
      put('programs/tl-x1-y', prog('tl-x1-y', 'x1', 'draft'));
      await call('x1', 'tl-x1-y');
      expect(get('programs/prg-old')?.status).toBe('active');
      expect(get('programs/tl-x1-y')?.status).toBe('active');
      expect(get('assignments/x1')).toMatchObject({ programId: 'tl-x1-y', assignedBy: 'x1' });
    },
  );

  it("a trainer's ordinary program (no tl- id) still only changes its status", async () => {
    put('users/x1', { role: 'trainer' });
    put('programs/prg-own', prog('prg-own', 'x1', 'draft'));
    await call('x1', 'prg-own');
    expect(get('programs/prg-own')?.status).toBe('active');
    expect(get('assignments/x1')).toBeUndefined();
  });

  it.each(['trainer', 'admin'])(
    'a %s activating their own ordinary program after a catalog start takes the assignment back and leaves the rest of the library alone',
    async (role) => {
      put('users/x1', { role });
      put('programs/tl-x1-y', prog('tl-x1-y', 'x1', 'active'));
      put('assignments/x1', {
        memberId: 'x1',
        programId: 'tl-x1-y',
        assignedBy: 'x1',
        startedAt: 5,
      });
      put('programs/prg-own', prog('prg-own', 'x1', 'draft'));
      put('programs/prg-lib', prog('prg-lib', 'x1', 'active'));
      await call('x1', 'prg-own');
      expect(get('programs/prg-own')?.status).toBe('active');
      expect(get('programs/tl-x1-y')?.status).toBe('archived');
      expect(get('programs/prg-lib')?.status).toBe('active');
      expect(get('assignments/x1')).toMatchObject({ programId: 'prg-own', assignedBy: 'x1' });
    },
  );

  it("an admin's assignment of someone else's catalog program is never archived", async () => {
    put('users/x1', { role: 'admin' });
    put('programs/tl-t9-x', prog('tl-t9-x', 't9', 'active'));
    put('assignments/x1', { memberId: 'x1', programId: 'tl-t9-x', assignedBy: 'x1', startedAt: 5 });
    put('programs/prg-own', prog('prg-own', 'x1', 'draft'));
    await call('x1', 'prg-own');
    expect(get('programs/tl-t9-x')?.status).toBe('active');
    expect(get('programs/prg-own')?.status).toBe('active');
  });

  it('an orphan assignment (the catalog program is gone) does not lock the trainer out', async () => {
    put('users/x1', { role: 'trainer' });
    put('assignments/x1', {
      memberId: 'x1',
      programId: 'tl-x1-gone',
      assignedBy: 'x1',
      startedAt: 5,
    });
    put('programs/prg-own', prog('prg-own', 'x1', 'draft'));
    await call('x1', 'prg-own');
    expect(get('programs/prg-own')?.status).toBe('active');
    expect(get('assignments/x1')).toMatchObject({ programId: 'prg-own' });
    // the gone catalog program is not re-created by an update of a missing document
    expect(get('programs/tl-x1-gone')).toBeUndefined();
  });

  it('a program deleted between the pre-read and the transaction moves nothing (the catalog start is not archived)', async () => {
    put('users/x1', { role: 'trainer' });
    put('programs/tl-x1-y', prog('tl-x1-y', 'x1', 'active'));
    put('assignments/x1', { memberId: 'x1', programId: 'tl-x1-y', assignedBy: 'x1', startedAt: 5 });
    put('programs/prg-own', prog('prg-own', 'x1', 'draft'));
    h.vanishInTx = 'programs/prg-own';
    await expect(call('x1', 'prg-own')).resolves.toBeDefined();
    expect(get('programs/tl-x1-y')?.status).toBe('active');
    expect(get('assignments/x1')).toMatchObject({
      programId: 'tl-x1-y',
      assignedBy: 'x1',
      startedAt: 5,
    });
  });

  it('a malformed assignment does not lock the trainer out', async () => {
    put('users/x1', { role: 'trainer' });
    put('assignments/x1', { memberId: 'x1' });
    put('programs/prg-own', prog('prg-own', 'x1', 'draft'));
    await call('x1', 'prg-own');
    expect(get('programs/prg-own')?.status).toBe('active');
  });

  it("a trainer's assignment that is not their own catalog start is left as it is", async () => {
    put('users/x1', { role: 'trainer' });
    put('programs/prg-a', prog('prg-a', 'x1', 'active'));
    put('assignments/x1', { memberId: 'x1', programId: 'prg-a', assignedBy: 'x1', startedAt: 5 });
    put('programs/prg-own', prog('prg-own', 'x1', 'draft'));
    await call('x1', 'prg-own');
    expect(get('programs/prg-own')?.status).toBe('active');
    expect(get('assignments/x1')).toMatchObject({ programId: 'prg-a' });
  });

  it("archiving the started catalog program drops the trainer's own assignment", async () => {
    put('users/x1', { role: 'trainer' });
    put('programs/tl-x1-y', prog('tl-x1-y', 'x1', 'active'));
    put('assignments/x1', { memberId: 'x1', programId: 'tl-x1-y', assignedBy: 'x1', startedAt: 5 });
    await call('x1', 'tl-x1-y', 'archived');
    expect(get('programs/tl-x1-y')?.status).toBe('archived');
    expect(get('assignments/x1')).toBeUndefined();
  });
});
