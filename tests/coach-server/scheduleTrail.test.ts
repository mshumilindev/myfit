import { readFileSync } from 'node:fs';
import { acceptWithMail } from './acceptHelper';
import { beforeEach, describe, expect, it } from 'vitest';
import { createMemoryKv, type MemoryKv } from '../../functions/src/coach/memoryKv';
import type { Actor, Ctx } from '../../functions/src/coach/service';
import { afterScheduleWritten, scheduleEntryId } from '../../functions/src/coach/scheduleTrail';
import {
  teamActivity,
  teamForClient,
  teamInvite,
  teamSetActivityScope,
} from '../../functions/src/coach/team';

// SPO-267 M4: a manager cannot change a client's schedule without a trace, whatever their device reports.
const T0 = Date.UTC(2026, 9, 20, 9, 0, 0);
const owner: Actor = { uid: 't1', role: 'trainer' };
const mgr: Actor = { uid: 'm1', role: 'manager' };
const mgr2: Actor = { uid: 'm2', role: 'manager' };
const client: Actor = { uid: 'c1', role: 'member' };
let kv: MemoryKv;
let clock = T0;
const ctx = (): Ctx => ({
  kv,
  now: () => clock,
  pepper: new Uint8Array(32),
  newToken: () => 'tok',
});
const sealed = { v: 1, iv: 'A'.repeat(16), ct: 'SECRET-CIPHERTEXT' };
const doc = (rev: number, over: Record<string, unknown> = {}) => ({
  clientId: 'c1',
  trainerId: 't1',
  rev,
  updatedAt: T0,
  keyEpoch: 1,
  enc: sealed,
  timing: { starts: [], unmarked: [], dueAt: 0 },
  updatedBy: 'm1',
  ...over,
});
const trail = async () =>
  (await kv.list('teams/t1/activity')).filter((r) => r.id.startsWith('sch-'));

beforeEach(async () => {
  kv = createMemoryKv();
  clock = T0;
  await kv.set('users/t1', { role: 'trainer', status: 'active', firstName: 'Olena' });
  await kv.set('users/m1', { role: 'member', status: 'active', firstName: 'Irina' });
  await kv.set('users/m2', { role: 'member', status: 'active', firstName: 'Second' });
  await kv.set('users/c1', {
    role: 'member',
    status: 'active',
    firstName: 'Oleh',
    trainerId: 't1',
  });
  await kv.set('coaching/c1', { clientId: 'c1', trainerId: 't1', status: 'active', keyEpoch: 1 });
  for (const [uid, email] of [
    ['m1', 'irina@example.com'],
    ['m2', 'second@example.com'],
  ] as const) {
    const inv = await teamInvite(ctx(), owner, { email });
    await acceptWithMail(ctx(), { uid, role: 'member' }, { inviteId: inv.inviteId });
  }
});

describe('a manager write of the schedule leaves a server-written trace', () => {
  it('writes a metadata-only journal entry for the new version, with no help from the manager device', async () => {
    expect(await afterScheduleWritten(ctx(), 'c1', doc(1), doc(2))).toBe('logged');
    const rows = await trail();
    expect(rows.map((r) => r.id)).toEqual([scheduleEntryId('c1', 2)]);
    expect(rows[0].data).toMatchObject({
      actorUid: 'm1',
      role: 'manager',
      kind: 'session-edited',
      clientId: 'c1',
      refId: 'rev-2',
      ts: T0,
    });
    // never the sealed content, never the timing moments
    expect(JSON.stringify(rows[0].data)).not.toMatch(/SECRET|ciphertext|starts|unmarked|enc/i);
  });

  it('is idempotent by document version: a redelivered event writes nothing, a new version writes one more', async () => {
    expect(await afterScheduleWritten(ctx(), 'c1', doc(1), doc(2))).toBe('logged');
    clock += 60_000;
    expect(await afterScheduleWritten(ctx(), 'c1', doc(1), doc(2))).toBe('duplicate');
    expect(await trail()).toHaveLength(1);
    expect((await trail())[0].data.ts).toBe(T0); // the first entry was not rewritten
    expect(await afterScheduleWritten(ctx(), 'c1', doc(2), doc(3))).toBe('logged');
    expect((await trail()).map((r) => r.data.refId).sort()).toEqual(['rev-2', 'rev-3']);
  });

  it('a create (no previous version) is a version too', async () => {
    expect(await afterScheduleWritten(ctx(), 'c1', null, doc(1))).toBe('logged');
    expect((await trail())[0].data.refId).toBe('rev-1');
  });

  it('ignores what is not a manager version: the job advancing timing.dueAt, the trainer, the client, a delete', async () => {
    expect(await afterScheduleWritten(ctx(), 'c1', doc(2), doc(2, { timing: { dueAt: 99 } }))).toBe(
      'skipped',
    );
    expect(await afterScheduleWritten(ctx(), 'c1', doc(1), doc(2, { updatedBy: 't1' }))).toBe(
      'skipped',
    );
    const noWriter = doc(2) as Record<string, unknown>;
    delete noWriter.updatedBy;
    expect(await afterScheduleWritten(ctx(), 'c1', doc(1), noWriter)).toBe('skipped');
    expect(await afterScheduleWritten(ctx(), 'c1', doc(1), doc(2, { updatedBy: 'c1' }))).toBe(
      'skipped',
    );
    expect(await afterScheduleWritten(ctx(), 'c1', doc(1), null)).toBe('skipped');
    expect(await afterScheduleWritten(ctx(), 'c1', doc(1), doc(2, { rev: 'x' }))).toBe('skipped');
    expect(await trail()).toEqual([]);
  });

  it('lands in the team of the CLIENT trainer, also for a member trainer of the team', async () => {
    await kv.set('users/t2', { role: 'trainer', status: 'active', teamId: 't1' });
    await kv.set('coaching/c2', { clientId: 'c2', trainerId: 't2', status: 'active', keyEpoch: 1 });
    expect(
      await afterScheduleWritten(ctx(), 'c2', null, doc(1, { clientId: 'c2', trainerId: 't2' })),
    ).toBe('logged');
    expect((await trail())[0].data).toMatchObject({ clientId: 'c2', actorUid: 'm1' });
  });
});

describe('who can see the trace', () => {
  it('the owner sees it, the acting manager sees it, another manager only after the owner widens the scope', async () => {
    await afterScheduleWritten(ctx(), 'c1', doc(1), doc(2));
    const kinds = async (a: Actor) =>
      (await teamActivity(ctx(), a)).entries.filter((e) => e.kind === 'session-edited').length;
    expect(await kinds(owner)).toBe(1);
    expect(await kinds(mgr)).toBe(1);
    expect(await kinds(mgr2)).toBe(0);
    await teamSetActivityScope(ctx(), owner, { uid: 'm2', scope: 'all' });
    expect(await kinds(mgr2)).toBe(1);
  });

  it('the client sees which manager changed their schedule (Who saw your data)', async () => {
    await afterScheduleWritten(ctx(), 'c1', doc(1), doc(2));
    const v = await teamForClient(ctx(), client);
    expect(v.actions).toMatchObject([{ kind: 'session-edited', actorName: 'Irina' }]);
  });
});

describe('wiring', () => {
  it('the Firestore trigger on schedules/{clientId} calls the trail', () => {
    const src = readFileSync('functions/src/coach/handlers.ts', 'utf8');
    expect(src).toMatch(
      /onScheduleWritten = onDocumentWritten\(\s*\{ document: 'schedules\/\{clientId\}'/,
    );
    expect(src).toContain('afterScheduleWritten(ctx(), event.params.clientId, before, after)');
  });
});
