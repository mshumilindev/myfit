import { acceptWithMail } from './acceptHelper';
import { beforeEach, describe, expect, it } from 'vitest';
import { createMemoryKv, type MemoryKv } from '../../functions/src/coach/memoryKv';
import { CoachError, type Actor, type Ctx } from '../../functions/src/coach/service';
import {
  clientRemovalCancel,
  clientRemovalCreate,
  clientRemovalRespond,
  teamInvite,
  teamRequests,
} from '../../functions/src/coach/team';

const T0 = Date.UTC(2026, 9, 20, 9, 0, 0);
const owner: Actor = { uid: 't1', role: 'trainer' };
const other: Actor = { uid: 't2', role: 'trainer' };
const mgrNow: Actor = { uid: 'm1', role: 'manager' };

let kv: MemoryKv;
let t = T0;
const pushes: [string, string][] = [];
const ctx = (): Ctx => ({
  kv,
  now: () => t,
  pepper: new Uint8Array(32),
  newToken: () => 'tok',
  notify: async (uid, kind) => void pushes.push([uid, kind]),
});
async function code(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    if (e instanceof CoachError) return `${e.code}:${e.reason}`;
    throw e;
  }
  return 'ok';
}

beforeEach(async () => {
  kv = createMemoryKv();
  pushes.length = 0;
  t = T0;
  await kv.set('users/t1', { role: 'trainer', status: 'active', firstName: 'Olena' });
  await kv.set('users/t2', { role: 'trainer', status: 'active', firstName: 'Andriy' });
  await kv.set('users/m1', { role: 'member', status: 'active', firstName: 'Irina' });
  await kv.set('users/c1', {
    role: 'member',
    status: 'active',
    firstName: 'Sofiia',
    trainerId: 't1',
  });
  await kv.set('coaching/c1', {
    clientId: 'c1',
    trainerId: 't1',
    status: 'active',
    keyEpoch: 1,
    mode: 'full',
  });
  const inv = await teamInvite(ctx(), owner, { email: 'irina@example.com' });
  await acceptWithMail(ctx(), { uid: 'm1', role: 'member' }, { inviteId: inv.inviteId });
});

describe('client removal requests', () => {
  it('a manager asks; nothing changes and the client is not told; the trainer sees it and gets a notice', async () => {
    pushes.length = 0; // the join pushes of the setup are not under test
    const r = await clientRemovalCreate(ctx(), mgrNow, {
      clientId: 'c1',
      reason: '  Moved away  ',
    });
    expect(r.id).toBe('rm-c1');
    expect(await kv.get('coaching/c1')).toMatchObject({ status: 'active' });
    // the removal request tells the client nothing; the only notice is the earlier "a manager joined" (SPO-236 client Spotter)
    const mine = (await kv.list('users/c1/notices')).filter((n) => n.data.kind !== 'team');
    expect(mine).toHaveLength(0);
    const list = await teamRequests(ctx(), owner);
    expect(list.requests).toEqual([
      {
        id: 'rm-c1',
        kind: 'client-removal',
        clientId: 'c1',
        clientName: 'Sofiia',
        managerName: 'Irina',
        reason: 'Moved away',
        createdAt: T0,
      },
    ]);
    const notices = await kv.list('users/t1/notices');
    expect(notices.map((n) => n.data.kind)).toContain('removal-request');
    // a content-free push to the trainer only
    expect(pushes.filter(([, k]) => k === 'team')).toEqual([['t1', 'team']]);
    // another trainer sees nothing
    expect((await teamRequests(ctx(), other)).requests).toEqual([]);
  });

  it("is idempotent while open; only a manager of the client's team may ask", async () => {
    await clientRemovalCreate(ctx(), mgrNow, { clientId: 'c1' });
    await clientRemovalCreate(ctx(), mgrNow, { clientId: 'c1' });
    expect(
      (await kv.list('users/t1/notices')).filter((n) => n.data.kind === 'removal-request'),
    ).toHaveLength(1);
    expect(await code(clientRemovalCreate(ctx(), owner, { clientId: 'c1' }))).toBe(
      'permission-denied:managers-only',
    );
    await kv.set('coaching/c9', { clientId: 'c9', trainerId: 'zz', status: 'active', keyEpoch: 1 });
    expect(await code(clientRemovalCreate(ctx(), mgrNow, { clientId: 'c9' }))).toBe(
      'permission-denied:not-your-team',
    );
  });

  // a trainer outside the team does not even learn that the request exists
  it('approve ends the relationship the usual way and tells the manager; decline only closes the request', async () => {
    await clientRemovalCreate(ctx(), mgrNow, { clientId: 'c1' });
    expect(await code(clientRemovalRespond(ctx(), other, { id: 'rm-c1', approve: true }))).toBe(
      'not-found:no-request',
    );
    t += 1000;
    expect(await clientRemovalRespond(ctx(), owner, { id: 'rm-c1', approve: true })).toEqual({
      status: 'approved',
    });
    expect(await kv.get('coaching/c1')).toMatchObject({ status: 'ended', endedBy: 'trainer' });
    const answer = (await kv.list('users/m1/notices')).find(
      (n) => n.data.kind === 'removal-answer',
    );
    expect(answer?.data).toMatchObject({ status: 'approved', detail: 'Sofiia', refId: 'rm-c1' });
    expect(pushes).toContainEqual(['m1', 'team']);
    expect((await teamRequests(ctx(), owner)).requests).toEqual([]);
  });

  it('decline leaves the client in place; a new request is possible afterwards', async () => {
    await clientRemovalCreate(ctx(), mgrNow, { clientId: 'c1' });
    await clientRemovalRespond(ctx(), owner, { id: 'rm-c1', approve: false });
    expect(await kv.get('coaching/c1')).toMatchObject({ status: 'active' });
    t += 1000;
    await clientRemovalCreate(ctx(), mgrNow, { clientId: 'c1' });
    expect((await teamRequests(ctx(), owner)).requests).toHaveLength(1);
  });

  it('the manager can withdraw their own pending request; nobody else can', async () => {
    await clientRemovalCreate(ctx(), mgrNow, { clientId: 'c1' });
    expect(await code(clientRemovalCancel(ctx(), owner, { id: 'rm-c1' }))).toBe(
      'permission-denied:not-yours',
    );
    await clientRemovalCancel(ctx(), mgrNow, { id: 'rm-c1' });
    expect((await teamRequests(ctx(), owner)).requests).toEqual([]);
    expect(await clientRemovalRespond(ctx(), owner, { id: 'rm-c1', approve: true })).toEqual({
      status: 'cancelled',
    });
    expect(await kv.get('coaching/c1')).toMatchObject({ status: 'active' });
  });
});
