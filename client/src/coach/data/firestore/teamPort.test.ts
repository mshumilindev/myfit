// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { FsApi } from './fsApi';
import { createFirestoreTeamPort } from './teamPort';

const snap = {
  me: { uid: 't1', role: 'trainer', isOwner: true },
  ownerName: 'Olena',
  members: [],
  invites: [{ id: 'tok1', email: 'a@example.com', role: 'manager', sentAt: 5 }],
  asOf: 9,
};
function fsWith(handler: (name: string, data: unknown) => unknown): {
  fs: FsApi;
  calls: [string, unknown][];
} {
  const calls: [string, unknown][] = [];
  const fs = {
    call: async (name: string, data: unknown) => {
      calls.push([name, data]);
      return handler(name, data);
    },
  } as unknown as FsApi;
  return { fs, calls };
}

describe('Firestore team port', () => {
  it('accepting a manager invite adopts the fresh session token; a failing swap never fails the accept', async () => {
    const seen: [string, string][] = [];
    const { fs } = fsWith(() => ({ teamId: 't1', role: 'manager', token: 'tok-new' }));
    await createFirestoreTeamPort(fs, async (t, r) => {
      seen.push([t, r]);
    }).acceptInvite('inv');
    expect(seen).toEqual([['tok-new', 'manager']]);
    await expect(
      createFirestoreTeamPort(fs, () => Promise.reject(new Error('offline'))).acceptInvite('inv'),
    ).resolves.toBeUndefined();
    const plain = fsWith(() => ({ teamId: 't1', role: 'trainer' })).fs;
    await createFirestoreTeamPort(plain, async () => {
      throw new Error('must not be called');
    }).acceptInvite('inv');
  });

  it('load: reads the snapshot, derives the invite link from the id and keeps it for peek()', async () => {
    const { fs, calls } = fsWith(() => snap);
    const p = createFirestoreTeamPort(fs);
    expect(p.peek()).toBeNull();
    const d = await p.load();
    expect(calls[0][0]).toBe('teamRead');
    expect(d.invites[0].url).toMatch(/#\/team-invite\/tok1$/);
    expect(p.peek()).toBe(d);
  });

  it("Spotter's team notices and their read mark are server calls, so read state follows the user to every device (SPO-236)", async () => {
    const feed = { items: [], unread: 3 };
    const { fs, calls } = fsWith((n) => (n === 'teamNotices' ? feed : { ok: true }));
    const p = createFirestoreTeamPort(fs);
    expect(await p.notices()).toBe(feed);
    await p.markNoticesRead();
    expect(calls.map((c) => c[0])).toEqual(['teamNotices', 'teamNoticesRead']);
  });

  it('maps every action to its callable with only the ids it needs', async () => {
    const { fs, calls } = fsWith((n) =>
      n === 'teamInvite' ? { inviteId: 'tok2', url: 'https://x/#/team-invite/tok2' } : { ok: true },
    );
    const p = createFirestoreTeamPort(fs);
    expect(await p.invite('b@example.com', 'trainer')).toEqual({
      url: 'https://x/#/team-invite/tok2',
    });
    await p.revokeInvite('tok2');
    await p.removeMember('m1');
    await p.leave();
    await p.setActivityScope('m1', 'all');
    expect(calls).toEqual([
      ['teamInvite', { email: 'b@example.com', role: 'trainer' }],
      ['teamInviteRevoke', { inviteId: 'tok2' }],
      ['teamRemoveMember', { uid: 'm1' }],
      ['teamLeave', {}],
      ['teamSetActivityScope', { uid: 'm1', scope: 'all' }],
    ]);
  });

  it('maps server reasons and codes to port errors, never copying text', async () => {
    const err = (e: unknown) => createFirestoreTeamPort(fsWith(() => Promise.reject(e)).fs);
    await expect(
      err({ code: 'functions/invalid-argument', details: { reason: 'invalid-email' } }).invite(
        'x',
        'manager',
      ),
    ).rejects.toMatchObject({ code: 'invalid-email' });
    await expect(
      err({ code: 'functions/already-exists', details: { reason: 'invite-exists' } }).invite(
        'x',
        'manager',
      ),
    ).rejects.toMatchObject({ code: 'exists' });
    await expect(err({ code: 'functions/permission-denied' }).load()).rejects.toMatchObject({
      code: 'forbidden',
    });
    await expect(err({ code: 'functions/unavailable' }).load()).rejects.toMatchObject({
      code: 'offline',
    });
    await expect(err(new Error('boom <script>')).load()).rejects.toMatchObject({
      code: 'unavailable',
      message: 'unavailable',
    });
  });

  it('invitee side: preview maps the names, accept / decline call their callables, closed and ineligible are told apart', async () => {
    const { fs, calls } = fsWith((n) =>
      n === 'teamInvitePreview'
        ? { role: 'manager', teamOwnerName: 'Olena', invitedByName: 'Olena', expiresAt: 7 }
        : { ok: true },
    );
    const p = createFirestoreTeamPort(fs);
    expect(await p.previewInvite('tok')).toEqual({
      role: 'manager',
      ownerName: 'Olena',
      inviterName: 'Olena',
      expiresAt: 7,
    });
    await p.acceptInvite('tok');
    await p.declineInvite('tok');
    expect(calls.map((c) => c[0])).toEqual(['teamInvitePreview', 'teamAccept', 'teamDecline']);
    const err = (reason: string) =>
      createFirestoreTeamPort(
        fsWith(() => Promise.reject({ code: 'functions/failed-precondition', details: { reason } }))
          .fs,
      );
    await expect(err('invite-closed').previewInvite('t')).rejects.toMatchObject({ code: 'closed' });
    await expect(err('account-not-eligible').acceptInvite('t')).rejects.toMatchObject({
      code: 'not-eligible',
    });
  });
  it('activity: asks for one page with the cursor and derives the next cursor; a server without `before` ends the log', async () => {
    const row = (id: string, ts: number) => ({ id, ts });
    const { fs, calls } = fsWith((_n, d) =>
      (d as { before?: number }).before
        ? { entries: [row('x', 40), row('y', 30)], scope: 'owner' } // ignores the cursor: repeats newer rows
        : { entries: [row('a', 90), row('b', 80), row('c', 70)], scope: 'owner' },
    );
    const p = createFirestoreTeamPort(fs);
    const first = await p.activity({ limit: 3 });
    expect(calls[0]).toEqual(['teamActivity', { limit: 3 }]);
    expect(first.next).toBe(70);
    const second = await p.activity({ before: 70, limit: 3 });
    expect(calls[1]).toEqual(['teamActivity', { limit: 3, before: 70 }]);
    expect(second.entries.map((e) => e.id)).toEqual(['x', 'y']);
    expect(second.next).toBeNull();
    // rows not older than the cursor are dropped
    const stale = await createFirestoreTeamPort(
      fsWith(() => ({ entries: [row('a', 90), row('z', 10)], scope: 'owner' })).fs,
    ).activity({ before: 50 });
    expect(stale.entries.map((e) => e.id)).toEqual(['z']);
  });
  it('activity: a (ts, id) cursor goes to the server as is, and the server page is kept whole', async () => {
    const row = (id: string, ts: number) => ({ id, ts });
    const { fs, calls } = fsWith(() => ({
      entries: [row('b', 50), row('a', 50)], // two rows share the cursor's millisecond: they must stay
      scope: 'owner',
      next: 50,
      nextId: 'a',
    }));
    const page = await createFirestoreTeamPort(fs).activity({
      before: 50,
      beforeId: 'c',
      limit: 2,
    });
    expect(calls[0]).toEqual(['teamActivity', { limit: 2, before: 50, beforeId: 'c' }]);
    expect(page.entries.map((e) => e.id)).toEqual(['b', 'a']);
    expect(page).toMatchObject({ next: 50, nextId: 'a' });
  });
});
