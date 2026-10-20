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
  it('load: reads the snapshot, derives the invite link from the id and keeps it for peek()', async () => {
    const { fs, calls } = fsWith(() => snap);
    const p = createFirestoreTeamPort(fs);
    expect(p.peek()).toBeNull();
    const d = await p.load();
    expect(calls[0][0]).toBe('teamRead');
    expect(d.invites[0].url).toMatch(/#\/team-invite\/tok1$/);
    expect(p.peek()).toBe(d);
  });

  it('maps every action to its callable with only the ids it needs', async () => {
    const { fs, calls } = fsWith((n) =>
      n === 'teamInvite' ? { inviteId: 'tok2', url: 'https://x/#/team-invite/tok2' } : { ok: true },
    );
    const p = createFirestoreTeamPort(fs);
    expect(await p.invite('b@example.com')).toEqual({ url: 'https://x/#/team-invite/tok2' });
    await p.revokeInvite('tok2');
    await p.removeMember('m1');
    await p.leave();
    await p.setActivityScope('m1', 'all');
    expect(calls).toEqual([
      ['teamInvite', { email: 'b@example.com' }],
      ['teamInviteRevoke', { inviteId: 'tok2' }],
      ['teamRemoveMember', { uid: 'm1' }],
      ['teamLeave', {}],
      ['teamSetActivityScope', { uid: 'm1', scope: 'all' }],
    ]);
  });

  it('maps server reasons and codes to port errors, never copying text', async () => {
    const err = (e: unknown) => createFirestoreTeamPort(fsWith(() => Promise.reject(e)).fs);
    await expect(
      err({ code: 'functions/invalid-argument', details: { reason: 'invalid-email' } }).invite('x'),
    ).rejects.toMatchObject({ code: 'invalid-email' });
    await expect(
      err({ code: 'functions/already-exists', details: { reason: 'invite-exists' } }).invite('x'),
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
});
