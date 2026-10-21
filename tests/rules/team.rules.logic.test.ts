/**
 * SPO-198 / ADR 005 — team + manager rules, without the emulator (the interpreter in `engine/`).
 * Contract: a manager reaches ONLY the schedule (read/write) and reply requests (read) of clients of their team, and
 * only their own delegation; nothing else about a client; nothing changes team membership, roles or the activity scope.
 */
import { describe, expect, it } from 'vitest';
import { decide, parseRules, type Ctx, type Doc, type Op } from './engine/rulesEngine';
import { RULES_SOURCE } from './engine/rulesSource';

const rules = parseRules(RULES_SOURCE);

const CID = 'abcdefghijklmnopqrstuvwxyz';
const CID2 = 'bcdefghijklmnopqrstuvwxyza';
const enc = (len = 120) => ({ v: 1, iv: 'A'.repeat(16), ct: 'A'.repeat(len) });
const wrap = (epoch = 1, fp = 'f'.repeat(16)) => ({
  v: 1,
  epoch,
  epk: { kty: 'EC', crv: 'P-256', x: 'x', y: 'y', ext: true, key_ops: [] },
  iv: 'A'.repeat(16),
  ct: 'A'.repeat(64),
  fp,
});

const as = (uid: string, role: string) => ({ uid, token: { role } });
const mgr = as('m1', 'manager');
const mgrOther = as('m9', 'manager');
const owner = as('t1', 'trainer');
const trainer2 = as('t2', 'trainer');
const client = as('c1', 'member');
const stranger = as('x', 'member');

/** t1 owns the team; t2 is a member trainer; m1 is an active manager; m2 another manager; m9 manages elsewhere */
const world = (): Record<string, Doc> => ({
  'users/m1': { role: 'manager', status: 'active' },
  'users/m2': { role: 'manager', status: 'active' },
  'users/m9': { role: 'manager', status: 'active' },
  'users/t1': { role: 'trainer', status: 'active' },
  'users/t2': { role: 'trainer', status: 'active', teamId: 't1' },
  'users/t9': { role: 'trainer', status: 'active' },
  'users/c1': { role: 'member', status: 'active' },
  'users/c2': { role: 'member', status: 'active' },
  'users/c9': { role: 'member', status: 'active' },
  'coaching/c1': { trainerId: 't1', status: 'active' },
  'coaching/c2': { trainerId: 't2', status: 'active' },
  'coaching/c9': { trainerId: 't9', status: 'active' },
  'teams/t1': { ownerId: 't1' },
  'teams/t1/members/t1': { role: 'trainer', status: 'active' },
  'teams/t1/members/t2': { role: 'trainer', status: 'active' },
  'teams/t1/members/m1': { role: 'manager', status: 'active' },
  'teams/t1/members/m2': { role: 'manager', status: 'active' },
  'teams/t1/acl/m1': { activityScope: 'own' },
  'teams/t1/acl/m2': { activityScope: 'all' },
  'teams/t1/activity/a1': { actorUid: 'm1', kind: 'mark-done' },
  'teams/t1/activity/a2': { actorUid: 't1', kind: 'team-add' },
  'teams/t9': { ownerId: 't9' },
  'teams/t9/members/m9': { role: 'manager', status: 'active' },
  [`conversations/${CID}`]: { clientId: 'c1', trainerId: 't1', keyEpoch: 1, active: true },
  [`conversations/${CID2}`]: { clientId: 'c2', trainerId: 't2', keyEpoch: 1, active: true },
  [`conversations/${CID}/requests/r1`]: { status: 'pending' },
  'schedules/c1': {
    clientId: 'c1',
    trainerId: 't1',
    rev: 3,
    updatedAt: 1,
    keyEpoch: 1,
    enc: enc(),
  },
  'schedules/c2': {
    clientId: 'c2',
    trainerId: 't2',
    rev: 1,
    updatedAt: 1,
    keyEpoch: 1,
    enc: enc(),
  },
  'schedules/c9': {
    clientId: 'c9',
    trainerId: 't9',
    rev: 1,
    updatedAt: 1,
    keyEpoch: 1,
    enc: enc(),
  },
});

const NOW = 1_699_900_000_000; // request.time: just before the sample timing moments
const ok = (
  op: Op,
  path: string,
  auth: Ctx['auth'],
  o: { data?: Doc; db?: Record<string, Doc> } = {},
) => decide(rules, op, path, { auth, db: o.db ?? world(), data: o.data, time: NOW }).allowed;

const ms = (o: Doc = {}): Doc => sched({ updatedBy: 'm1', ...o });
const sched = (over: Doc = {}): Doc => ({
  clientId: 'c1',
  trainerId: 't1',
  rev: 4,
  updatedAt: 2,
  keyEpoch: 1,
  enc: enc(),
  ...over,
});
const deleg = (over: Doc = {}): Doc => ({
  epoch: 1,
  fp: 'f'.repeat(16),
  schedule: wrap(),
  requests: wrap(),
  at: 5,
  ...over,
});

describe('manager: schedule (read/write) for the team, nothing else', () => {
  it('reads the schedule of clients of ANY trainer of the team; not of another team', () => {
    expect(ok('get', 'schedules/c1', mgr)).toBe(true);
    expect(ok('get', 'schedules/c2', mgr)).toBe(true); // c2 coaches with t2, a member trainer of team t1
    expect(ok('get', 'schedules/c9', mgr)).toBe(false);
    expect(ok('get', 'schedules/c1', mgrOther)).toBe(false);
  });

  it('loses access when the coaching ends, the membership is removed or the live role changes', () => {
    const ended = world();
    ended['coaching/c1'] = { trainerId: 't1', status: 'ended' };
    expect(ok('get', 'schedules/c1', mgr, { db: ended })).toBe(false);
    const removed = world();
    removed['teams/t1/members/m1'] = { role: 'manager', status: 'removed' };
    expect(ok('get', 'schedules/c1', mgr, { db: removed })).toBe(false);
    const noMember = world();
    delete noMember['teams/t1/members/m1'];
    expect(ok('get', 'schedules/c1', mgr, { db: noMember })).toBe(false);
    const stale = world(); // token still says manager, the live document does not
    stale['users/m1'] = { role: 'member', status: 'active' };
    expect(ok('get', 'schedules/c1', mgr, { db: stale })).toBe(false);
    const suspended = world();
    suspended['users/m1'] = { role: 'manager', status: 'suspended' };
    expect(ok('get', 'schedules/c1', mgr, { db: suspended })).toBe(false);
  });

  it('writes the schedule only with the client trainer as trainerId and rev + 1', () => {
    expect(ok('update', 'schedules/c1', mgr, { data: ms() })).toBe(true);
    expect(ok('update', 'schedules/c1', mgr, { data: ms({ trainerId: 'm1' }) })).toBe(false);
    expect(ok('update', 'schedules/c1', mgr, { data: ms({ rev: 3 }) })).toBe(false);
    expect(ok('update', 'schedules/c1', mgr, { data: ms({ rev: 9 }) })).toBe(false);
    expect(
      ok('update', 'schedules/c9', mgr, { data: ms({ clientId: 'c9', trainerId: 't9' }) }),
    ).toBe(false);
    expect(ok('update', 'schedules/c1', mgrOther, { data: ms() })).toBe(false);
    expect(
      ok('update', 'schedules/c2', mgr, {
        data: ms({ clientId: 'c2', trainerId: 't2', rev: 2 }),
      }),
    ).toBe(true);
    expect(ok('delete', 'schedules/c1', mgr)).toBe(false);
  });

  it('the trainer path is unchanged', () => {
    expect(ok('update', 'schedules/c1', owner, { data: sched() })).toBe(true);
    expect(ok('update', 'schedules/c1', owner, { data: sched({ trainerId: 't9' }) })).toBe(false);
    expect(ok('update', 'schedules/c1', trainer2, { data: sched() })).toBe(false);
  });
});

describe('manager: everything else about a client stays closed', () => {
  const closed = [
    `conversations/${CID}`,
    `conversations/${CID}/messages/m1`,
    `conversations/${CID}/notes/n1`,
    `conversations/${CID}/keyring/1`,
    'plans/c1',
    'plans/c1/versions/1',
    'coaching/c1',
    'coaching/c1/summary/x',
    'liveSessions/c1',
    'users/c1',
    'users/c1/workouts/w1',
    'users/c1/meta/nutritionLog',
    'users/c1/meta/bodyMetrics',
    'users/c1/conditions/x',
    'users/c1/injuries/x',
    'users/c1/audit/e1',
    'users/c1/notices/n1',
    'users/c1/trainerNotes/n1',
    'assignments/c1',
  ];
  it('cannot read any of it', () => {
    for (const p of closed) expect(ok('get', p, mgr), `get ${p}`).toBe(false);
  });
  it('cannot write any of it, nor teams, requests, coaching or roles', () => {
    for (const p of [
      ...closed,
      `conversations/${CID}/requests/r1`,
      'teams/t1',
      'teams/t1/members/m1',
      'teams/t1/acl/m1',
      'teams/t1/activity/a1',
      'teamInvites/i1',
      'teamRequests/q1',
    ])
      for (const op of ['create', 'update', 'delete'] as const)
        expect(ok(op, p, mgr, { data: { role: 'trainer', status: 'active' } }), `${op} ${p}`).toBe(
          false,
        );
  });
  it('is not a coach: no trainer/admin privileges', () => {
    expect(ok('get', 'assignments/c1', mgr)).toBe(false);
    expect(ok('get', 'liveSessions/c1', mgr)).toBe(false);
  });
  it('reads reply requests of team clients only', () => {
    expect(ok('get', `conversations/${CID}/requests/r1`, mgr)).toBe(true);
    expect(ok('get', `conversations/${CID}/requests/r1`, mgrOther)).toBe(false);
    expect(ok('get', `conversations/${CID}/requests/r1`, stranger)).toBe(false);
  });
});

describe('schedule writes: attribution, epoch, timing (SPO-267)', () => {
  const t = (o: Doc = {}) => ({
    starts: [1_700_000_000_000],
    unmarked: [],
    dueAt: 1_699_000_000_000,
    ...o,
  });
  it('a manager must sign the write with their own uid and the current epoch', () => {
    expect(ok('update', 'schedules/c1', mgr, { data: sched() })).toBe(false); // no updatedBy
    expect(ok('update', 'schedules/c1', mgr, { data: sched({ updatedBy: 'm1' }) })).toBe(true);
    expect(ok('update', 'schedules/c1', mgr, { data: sched({ updatedBy: 't1' }) })).toBe(false);
    expect(
      ok('update', 'schedules/c1', mgr, { data: sched({ updatedBy: 'm1', keyEpoch: 2 }) }),
    ).toBe(false);
    const db = world();
    db['coaching/c1'] = { trainerId: 't1', status: 'active', keyEpoch: 2 };
    expect(ok('update', 'schedules/c1', mgr, { db, data: sched({ updatedBy: 'm1' }) })).toBe(false);
    expect(
      ok('update', 'schedules/c1', mgr, { db, data: sched({ updatedBy: 'm1', keyEpoch: 2 }) }),
    ).toBe(true);
  });
  it('the trainer may omit updatedBy but not forge it', () => {
    expect(ok('update', 'schedules/c1', owner, { data: sched() })).toBe(true);
    expect(ok('update', 'schedules/c1', owner, { data: sched({ updatedBy: 't1' }) })).toBe(true);
    expect(ok('update', 'schedules/c1', owner, { data: sched({ updatedBy: 'm1' }) })).toBe(false);
  });
  it('timing holds integers only, bounded', () => {
    const w = (timing: unknown) => ok('update', 'schedules/c1', owner, { data: sched({ timing }) });
    expect(w(t())).toBe(true);
    expect(w(t({ starts: ['Upper B'] }))).toBe(false);
    expect(w(t({ starts: [{ gym: 'x' }] }))).toBe(false);
    expect(w(t({ unmarked: [1.5e12, 'x'] }))).toBe(false);
    expect(w(t({ starts: Array.from({ length: 13 }, (_, i) => 1 + i) }))).toBe(false);
    expect(w(t({ dueAt: 'soon' }))).toBe(false);
    expect(w(t({ dueAt: -1 }))).toBe(false);
    expect(w(t({ gym: 'iron-yard' }))).toBe(false);
  });
});

describe('delegations: the client publishes, the manager reads their own', () => {
  const P = (m: string) => `conversations/${CID}/delegations/${m}`;
  it('the client writes for an active manager of the trainer team, current epoch only', () => {
    expect(ok('create', P('m1'), client, { data: deleg() })).toBe(true);
    expect(
      ok('update', P('m1'), client, { data: deleg(), db: { ...world(), [P('m1')]: deleg() } }),
    ).toBe(true);
    expect(ok('create', P('m9'), client, { data: deleg() })).toBe(false); // manager of another team
    expect(ok('create', P('x'), client, { data: deleg() })).toBe(false); // not a member at all
    expect(ok('create', P('m1'), client, { data: deleg({ epoch: 2 }) })).toBe(false);
    expect(ok('create', P('m1'), client, { data: deleg({ schedule: wrap(2) }) })).toBe(false);
    expect(
      ok('create', P('m1'), client, { data: deleg({ requests: wrap(1, 'e'.repeat(16)) }) }),
    ).toBe(false);
    expect(ok('create', P('m1'), client, { data: deleg({ chat: wrap() }) })).toBe(false); // no extra purpose
    const noRing = deleg();
    delete (noRing as Record<string, unknown>).requests;
    expect(ok('create', P('m1'), client, { data: noRing })).toBe(false);
  });
  it('nobody but the client writes; the trainer cannot delegate', () => {
    for (const a of [owner, mgr, trainer2, stranger])
      expect(ok('create', P('m1'), a, { data: deleg() })).toBe(false);
  });
  it('removed manager cannot be delegated to; the client may delete', () => {
    const removed = world();
    removed['teams/t1/members/m1'] = { role: 'manager', status: 'removed' };
    expect(ok('create', P('m1'), client, { data: deleg(), db: removed })).toBe(false);
    const withDoc = { ...world(), [P('m1')]: deleg() };
    expect(ok('delete', P('m1'), client, { db: withDoc })).toBe(true);
    expect(ok('delete', P('m1'), mgr, { db: withDoc })).toBe(false);
  });
  it('reads: the manager their own document, the client any; not another manager or the trainer', () => {
    const w = { ...world(), [P('m1')]: deleg(), [P('m2')]: deleg() };
    expect(ok('get', P('m1'), mgr, { db: w })).toBe(true);
    expect(ok('get', P('m2'), mgr, { db: w })).toBe(false);
    expect(ok('get', P('m1'), client, { db: w })).toBe(true);
    expect(ok('get', P('m1'), mgrOther, { db: w })).toBe(false);
    expect(ok('get', P('m1'), owner, { db: w })).toBe(false);
  });
});

describe('teams: membership, acl and activity visibility', () => {
  it('members list: owner, active members and the owner clients read; strangers and other teams do not', () => {
    expect(ok('get', 'teams/t1/members/m1', owner)).toBe(true);
    expect(ok('get', 'teams/t1/members/m1', mgr)).toBe(true);
    expect(ok('get', 'teams/t1/members/m2', mgr)).toBe(true);
    expect(ok('get', 'teams/t1/members/m1', client)).toBe(true); // client of t1
    expect(ok('get', 'teams/t1/members/m1', as('c2', 'member'))).toBe(true); // client of t2, member trainer of t1
    expect(ok('get', 'teams/t1/members/m1', as('c9', 'member'))).toBe(false);
    expect(ok('get', 'teams/t1/members/m1', mgrOther)).toBe(false);
    expect(ok('get', 'teams/t1/members/m1', stranger)).toBe(false);
  });
  it('acl: only the owner and that member', () => {
    expect(ok('get', 'teams/t1/acl/m1', owner)).toBe(true);
    expect(ok('get', 'teams/t1/acl/m1', mgr)).toBe(true);
    expect(ok('get', 'teams/t1/acl/m2', mgr)).toBe(false);
    expect(ok('get', 'teams/t1/acl/m1', client)).toBe(false);
  });
  it('activity: owner all; manager own, or all with activityScope == all; clients never', () => {
    expect(ok('get', 'teams/t1/activity/a1', owner)).toBe(true);
    expect(ok('get', 'teams/t1/activity/a2', owner)).toBe(true);
    expect(ok('get', 'teams/t1/activity/a1', mgr)).toBe(true); // own entry
    expect(ok('get', 'teams/t1/activity/a2', mgr)).toBe(false); // somebody else's, scope own
    expect(ok('get', 'teams/t1/activity/a2', as('m2', 'manager'))).toBe(true); // scope all
    expect(ok('get', 'teams/t1/activity/a1', mgrOther)).toBe(false);
    expect(ok('get', 'teams/t1/activity/a1', client)).toBe(false);
    // a manager cannot raise their own scope: acl is not client-writable (the owner changes it through a function)
    expect(ok('update', 'teams/t1/acl/m1', mgr, { data: { activityScope: 'all' } })).toBe(false);
    expect(ok('update', 'teams/t1/acl/m1', owner, { data: { activityScope: 'all' } })).toBe(false);
  });
  it('nothing in teams is client-writable by anyone', () => {
    for (const a of [mgr, owner, trainer2, client, stranger])
      for (const p of [
        'teams/t1',
        'teams/t1/members/m1',
        'teams/t1/acl/m1',
        'teams/t1/activity/a1',
      ])
        for (const op of ['create', 'update', 'delete'] as const)
          expect(ok(op, p, a, { data: { role: 'manager' } }), `${a?.uid} ${op} ${p}`).toBe(false);
  });
  it('invites and removal requests: only the parties read, nobody writes', () => {
    const w = {
      ...world(),
      'teamInvites/i1': { invitedBy: 't1', teamId: 't1', role: 'manager' },
      'teamRequests/q1': { requestedBy: 'm1', trainerId: 't1', type: 'client-removal' },
    };
    expect(ok('get', 'teamInvites/i1', owner, { db: w })).toBe(true);
    expect(ok('get', 'teamInvites/i1', mgr, { db: w })).toBe(false);
    expect(ok('get', 'teamRequests/q1', owner, { db: w })).toBe(true);
    expect(ok('get', 'teamRequests/q1', mgr, { db: w })).toBe(true);
    expect(ok('get', 'teamRequests/q1', client, { db: w })).toBe(false);
    for (const a of [mgr, owner])
      for (const p of ['teamInvites/i1', 'teamRequests/q1'])
        expect(ok('update', p, a, { data: { status: 'approved' }, db: w })).toBe(false);
  });
});

describe('manager role plumbing', () => {
  it('a manager may publish their own coach key (signed by a function), a member may not', () => {
    const key = {
      pub: { kty: 'EC', crv: 'P-256', x: 'x', y: 'y', ext: true, key_ops: [] },
      updatedAt: 1,
    };
    expect(ok('create', 'coachKeys/m1', mgr, { data: key })).toBe(true);
    expect(ok('create', 'coachKeys/c1', client, { data: key })).toBe(false);
    expect(ok('create', 'coachKeys/t1', mgr, { data: key })).toBe(false); // not their own
  });
  it('the user document role cannot be self-edited into manager', () => {
    expect(ok('update', 'users/c1', client, { data: { role: 'manager', firstName: 'x' } })).toBe(
      false,
    );
  });
});

describe('security review fixes (M3 M5 M6 L1 L5 L9)', () => {
  const OLD = 'oldconvidabcdefghijklmnopqr';
  const withOld = (): Record<string, Doc> => ({
    ...world(),
    [`conversations/${OLD}`]: { clientId: 'c1', trainerId: 't0', keyEpoch: 1, active: false },
    [`conversations/${OLD}/requests/r1`]: { status: 'pending' },
    [`conversations/${OLD}/delegations/m1`]: deleg(),
  });

  it('M5: after a rotation (conversation epoch 2, relationship epoch 1) the manager writes the CURRENT epoch only', () => {
    const rotated = world();
    rotated['coaching/c1'] = { trainerId: 't1', status: 'active', keyEpoch: 1, convEpoch: 2 };
    rotated[`conversations/${CID}`] = {
      clientId: 'c1',
      trainerId: 't1',
      keyEpoch: 2,
      active: true,
    };
    expect(ok('update', 'schedules/c1', mgr, { db: rotated, data: ms({ keyEpoch: 2 }) })).toBe(
      true,
    );
    expect(ok('update', 'schedules/c1', mgr, { db: rotated, data: ms({ keyEpoch: 1 }) })).toBe(
      false,
    );
    // before the mirror exists the relationship epoch decides (old behaviour)
    expect(ok('update', 'schedules/c1', mgr, { data: ms({ keyEpoch: 1 }) })).toBe(true);
    // and a manager whose delegation is of epoch 1 cannot read it any more
    const d = { ...rotated, [`conversations/${CID}/delegations/m1`]: deleg({ epoch: 1 }) };
    expect(ok('get', `conversations/${CID}/delegations/m1`, mgr, { db: d })).toBe(false);
    const d2 = { ...rotated, [`conversations/${CID}/delegations/m1`]: deleg({ epoch: 2 }) };
    expect(ok('get', `conversations/${CID}/delegations/m1`, mgr, { db: d2 })).toBe(true);
  });

  it('M6: a manager of the NEW trainer team cannot read requests or delegations of an old conversation', () => {
    const w = withOld();
    expect(ok('get', `conversations/${OLD}/requests/r1`, mgr, { db: w })).toBe(false);
    expect(ok('get', `conversations/${OLD}/delegations/m1`, mgr, { db: w })).toBe(false);
    // the live conversation is unchanged, and the client still reads its own old one
    expect(ok('get', `conversations/${CID}/requests/r1`, mgr, { db: w })).toBe(true);
    expect(ok('get', `conversations/${OLD}/delegations/m1`, client, { db: w })).toBe(true);
  });

  it('L9: a client does not see removed members; active ones stay readable', () => {
    const w = world();
    w['teams/t1/members/m2'] = { role: 'manager', status: 'removed' };
    expect(ok('get', 'teams/t1/members/m2', client, { db: w })).toBe(false);
    expect(ok('get', 'teams/t1/members/m1', client, { db: w })).toBe(true);
    expect(ok('get', 'teams/t1/members/m2', owner, { db: w })).toBe(true);
  });

  it('L1: a suspended member or client reads nothing of the team', () => {
    const w = world();
    w['users/m1'] = { role: 'manager', status: 'suspended' };
    w['users/c1'] = { role: 'member', status: 'suspended' };
    expect(ok('get', 'teams/t1', mgr, { db: w })).toBe(false);
    expect(ok('get', 'teams/t1/members/m2', mgr, { db: w })).toBe(false);
    expect(ok('get', 'teams/t1/members/m1', client, { db: w })).toBe(false);
  });

  it('L5: the only client write to a notice is readAt, as an integer', () => {
    const w = { ...world(), 'users/c1/notices/n1': { kind: 'team', readAt: null, createdAt: 1 } };
    const upd = (readAt: unknown) =>
      ok('update', 'users/c1/notices/n1', client, {
        db: w,
        data: { kind: 'team', readAt, createdAt: 1 },
      });
    expect(upd(5)).toBe(true);
    expect(upd(null)).toBe(false);
    expect(upd('now')).toBe(false);
    expect(upd(1.5)).toBe(false);
  });

  it('M3: timing moments must be near now (starts now-1d..now+15d, unmarked now-31d..now+1d)', () => {
    const w = (timing: unknown) => ok('update', 'schedules/c1', owner, { data: sched({ timing }) });
    const D = 86_400_000;
    const t = (o: Doc) => ({ starts: [], unmarked: [], dueAt: 1, ...o });
    expect(w(t({ starts: [NOW + 14 * D], unmarked: [NOW - 30 * D] }))).toBe(true);
    expect(w(t({ starts: [NOW + 400 * D] }))).toBe(false);
    expect(w(t({ starts: [NOW - 5 * D] }))).toBe(false);
    expect(w(t({ starts: [1] }))).toBe(false);
    expect(w(t({ unmarked: [NOW - 90 * D] }))).toBe(false);
    expect(w(t({ unmarked: [NOW + 5 * D] }))).toBe(false);
    expect(w(t({ starts: [], unmarked: [] }))).toBe(true);
  });
});

describe('L4: display names written by their owner are bounded', () => {
  const upd = (d: Doc) =>
    ok('update', 'users/c1', client, {
      data: { role: 'member', status: 'active', ...d, updatedAt: 5 },
    });
  it('a normal, empty or null name passes; a huge or non-text one does not', () => {
    expect(upd({ firstName: 'Oleh', lastName: 'K' })).toBe(true);
    expect(upd({ firstName: null })).toBe(true);
    expect(upd({ firstName: 'x'.repeat(60) })).toBe(true);
    expect(upd({ firstName: 'x'.repeat(61) })).toBe(false);
    expect(upd({ lastName: 'y'.repeat(5000) })).toBe(false);
    expect(upd({ firstName: 5 })).toBe(false);
  });
});
