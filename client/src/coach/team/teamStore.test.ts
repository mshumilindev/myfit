// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createFixturesTeamPort } from './__fixtures__/fixtures';
import { TeamPortError, type TeamPort } from './port';
import { createTeamStore } from './teamStore';

const NOW = Date.UTC(2026, 9, 20, 9, 0);
const mk = (o = {}) => createFixturesTeamPort({ now: () => NOW, ...o });

describe('team store', () => {
  it('starts from the cached snapshot and never blocks; a cold start is loading until the first load', async () => {
    const warm = createTeamStore(mk());
    expect(warm.getState()).toMatchObject({ status: 'ready' }); // the cached snapshot is there at once
    expect(warm.getState().data?.members).toHaveLength(3);
    const cold = createTeamStore(mk({ cold: true }));
    expect(cold.getState()).toMatchObject({ status: 'loading', data: null });
    await cold.load();
    expect(cold.getState().status).toBe('ready');
  });

  it('a failed first load is `failed`; a failed refresh keeps the stale snapshot visible', async () => {
    let fail = true;
    const port = mk({ cold: true, failWith: () => (fail ? 'unavailable' : null) });
    const s = createTeamStore(port);
    await s.load();
    expect(s.getState()).toMatchObject({ status: 'failed', error: 'unavailable', data: null });
    fail = false;
    await s.load();
    expect(s.getState().status).toBe('ready');
    fail = true;
    await s.load();
    expect(s.getState()).toMatchObject({ status: 'ready', error: 'unavailable' });
    expect(s.getState().data).not.toBeNull();
  });

  it('invite: validates locally, refuses a duplicate, returns the link and shows the invite at once', async () => {
    const s = createTeamStore(mk());
    await s.load();
    expect(await s.invite('nope')).toEqual({ ok: false, error: 'invalid-email' });
    expect(await s.invite('Kateryna@Example.com')).toEqual({ ok: false, error: 'exists' });
    const r = await s.invite('new@example.com');
    expect(r.ok && r.url).toContain('#/team-invite/');
    expect(s.getState().data?.invites.map((i) => i.email)).toContain('new@example.com');
  });

  it('invite: a server refusal is reported and nothing is added', async () => {
    const port: TeamPort = {
      ...mk(),
      invite: () => Promise.reject(new TeamPortError('offline')),
    };
    const s = createTeamStore(port);
    await s.load();
    const before = s.getState().data?.invites.length;
    expect(await s.invite('x@example.com')).toEqual({ ok: false, error: 'offline' });
    expect(s.getState().data?.invites.length).toBe(before);
    expect(s.getState().busy).toBe(false);
  });

  it('remove / revoke / scope apply optimistically and match the server after the reload', async () => {
    const s = createTeamStore(mk());
    await s.load();
    await s.setActivityScope('manager-irina', 'all');
    expect(s.getState().data?.members.find((m) => m.uid === 'manager-irina')?.activityScope).toBe(
      'all',
    );
    await s.revokeInvite('inv-kateryna');
    expect(s.getState().data?.invites).toEqual([]);
    await s.removeMember('manager-irina');
    expect(s.getState().data?.members.map((m) => m.uid)).toEqual([
      'trainer-olena',
      'trainer-andriy',
    ]);
  });
});
