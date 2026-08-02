import request from 'supertest';
import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../server/src/index';
import { db } from '../server/src/db';
import { auditRead, requireRole } from '../server/src/auth';

const app = createApp();

async function req<T>(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<{ status: number; data: T }> {
  let call = request(app)[method.toLowerCase() as 'get' | 'post' | 'put' | 'delete'](path);
  if (token) call = call.set('Authorization', `Bearer ${token}`);
  if (body !== undefined) call = call.send(body);
  const res = await call;
  return { status: res.status, data: res.body as T };
}

async function register(username = 'mykola', email = 'me@example.com') {
  const r = await req<{ token: string; username: string; email: string }>(
    'POST',
    '/api/auth/register',
    { username, email, password: 'secret123' },
  );
  expect(r.status).toBe(200);
  return r.data;
}

beforeEach(() => {
  db.exec(`
    DELETE FROM trainer_notes;
    DELETE FROM audit_log;
    DELETE FROM invites;
    DELETE FROM reminder_dismissals;
    DELETE FROM presence_pings;
    DELETE FROM sets;
    DELETE FROM exercises;
    DELETE FROM workouts;
    DELETE FROM gyms;
    DELETE FROM users;
  `);
});

describe('F-01 Auth', () => {
  it('registers with normalized email, rejects invalid input and duplicate identities', async () => {
    expect((await req('GET', '/api/auth/status')).data).toEqual({ registered: false });
    expect(
      (await req('POST', '/api/auth/register', { username: 'm', email: 'bad', password: '123' }))
        .status,
    ).toBe(400);

    const auth = await register(' mykola ', 'Me@Example.COM');
    expect(auth).toMatchObject({ username: 'mykola', email: 'me@example.com' });
    expect((await req('GET', '/api/auth/status')).data).toEqual({ registered: true });

    expect(
      (
        await req('POST', '/api/auth/register', {
          username: 'mykola',
          email: 'other@example.com',
          password: 'secret123',
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await req('POST', '/api/auth/register', {
          username: 'olena',
          email: 'me@example.com',
          password: 'secret123',
        })
      ).status,
    ).toBe(409);
  });

  it('logs in by email or username and rate-limits repeated failures', async () => {
    const { token } = await register('mykola', 'me@example.com');

    expect(
      (
        await req('POST', '/api/auth/login', {
          identifier: 'ME@example.com',
          password: 'secret123',
        })
      ).status,
    ).toBe(200);
    expect(
      (await req('POST', '/api/auth/login', { username: 'mykola', password: 'secret123' })).status,
    ).toBe(200);
    expect((await req('POST', '/api/auth/email', { email: 'new@example.com' })).status).toBe(401);
    expect((await req('POST', '/api/auth/email', { email: 'bad' }, token)).status).toBe(400);
    expect((await req('POST', '/api/auth/email', {}, token)).status).toBe(400);
    expect(
      (await req('POST', '/api/auth/email', { email: 'New@Example.com' }, token)).data,
    ).toEqual({ email: 'new@example.com' });
    expect((await req('GET', '/api/tracker/state', undefined, 'bad-token')).status).toBe(401);
    const badSub = jwt.sign({ sub: 42 }, 'test-secret', { algorithm: 'HS256' });
    expect((await req('GET', '/api/tracker/state', undefined, badSub)).status).toBe(401);
    expect(
      (await req('POST', '/api/auth/login', { identifier: 'mykola', password: 'wrong' })).status,
    ).toBe(401);

    for (let i = 0; i < 10; i++) {
      await req('POST', '/api/auth/login', { identifier: 'locked', password: 'wrong' });
    }
    expect(
      (await req('POST', '/api/auth/login', { identifier: 'locked', password: 'wrong' })).status,
    ).toBe(429);
  });

  it('exposes invite state, claims valid links and marks re-requested dead links', async () => {
    const admin = await register('owner', 'owner@example.com');
    const adminId = (
      db.prepare('SELECT id FROM users WHERE email = ?').get('owner@example.com') as { id: string }
    ).id;
    const invitedId = crypto.randomUUID();
    const token = 'invite-token';
    const now = Date.now();
    db.prepare(
      `INSERT INTO users (id, username, email, password_hash, created_at, role, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      invitedId,
      'Invited Member',
      'invited@example.com',
      '__pending__',
      now,
      'member',
      'invited',
    );
    db.prepare(
      `INSERT INTO invites (token, user_id, created_by, kind, created_at, expires_at)
       VALUES (?, ?, ?, 'invite', ?, ?)`,
    ).run(token, invitedId, adminId, now, now + 7 * 24 * 3600_000);

    expect((await req('GET', `/api/auth/invite/${token}`)).data).toMatchObject({
      state: 'valid',
      inviter: 'owner',
      name: 'Invited Member',
      email: 'invited@example.com',
    });
    expect((await req('GET', '/api/auth/invite/missing')).status).toBe(404);
    expect((await req('POST', '/api/auth/claim', { token })).status).toBe(400);
    expect((await req('POST', '/api/auth/claim', { token, password: '123' })).status).toBe(400);

    const claimed = await req<{ token: string; username: string; email: string; role: string }>(
      'POST',
      '/api/auth/claim',
      {
        token,
        username: 'Claimed Member',
        email: 'Claimed@Example.com',
        password: 'secret123',
      },
    );
    expect(claimed.status).toBe(200);
    expect(claimed.data).toMatchObject({
      username: 'Claimed Member',
      email: 'claimed@example.com',
      role: 'member',
    });
    expect((await req('POST', '/api/auth/claim', { token, password: 'secret123' })).status).toBe(
      410,
    );
    expect(
      (
        await req('POST', '/api/auth/login', {
          identifier: 'claimed@example.com',
          password: 'secret123',
        })
      ).status,
    ).toBe(200);
    expect((await req('POST', `/api/auth/invite/${token}/request-new`)).status).toBe(200);
    expect(
      (
        db.prepare('SELECT re_requested_at FROM invites WHERE token = ?').get(token) as {
          re_requested_at: number | null;
        }
      ).re_requested_at,
    ).toEqual(expect.any(Number));
    expect((await req('POST', '/api/auth/invite/missing/request-new')).status).toBe(404);

    const otherId = crypto.randomUUID();
    db.prepare(
      `INSERT INTO users (id, username, email, password_hash, created_at, role, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(otherId, 'Other', 'other@example.com', '__pending__', now, 'member', 'invited');
    for (const [suffix, patch, expectedState] of [
      ['expired', { expires_at: now - 1 }, 'expired'],
      ['revoked', { revoked_at: now }, 'revoked'],
    ] as const) {
      const t = `invite-${suffix}`;
      db.prepare(
        `INSERT INTO invites (token, user_id, created_by, kind, created_at, expires_at, revoked_at)
         VALUES (?, ?, ?, 'invite', ?, ?, ?)`,
      ).run(t, otherId, adminId, now, patch.expires_at ?? now + 1000, patch.revoked_at ?? null);
      expect((await req('GET', `/api/auth/invite/${t}`)).data).toMatchObject({
        state: expectedState,
      });
      expect(
        (await req('POST', '/api/auth/claim', { token: t, password: 'secret123' })).status,
      ).toBe(410);
    }

    expect(admin.token).toEqual(expect.any(String));
  });

  it('rejects duplicate invite claims and enforces role gates plus audit logging', async () => {
    const admin = await register('owner', 'owner@example.com');
    const member = await register('member', 'member@example.com');
    const adminId = (
      db.prepare('SELECT id FROM users WHERE email = ?').get('owner@example.com') as { id: string }
    ).id;
    const memberId = (
      db.prepare('SELECT id FROM users WHERE email = ?').get('member@example.com') as { id: string }
    ).id;
    const invitedId = crypto.randomUUID();
    const token = 'dupe-token';
    const now = Date.now();
    db.prepare(
      `INSERT INTO users (id, username, email, password_hash, created_at, role, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(invitedId, 'Invited', 'new@example.com', '__pending__', now, 'member', 'invited');
    db.prepare(
      `INSERT INTO invites (token, user_id, created_by, kind, created_at, expires_at)
       VALUES (?, ?, ?, 'invite', ?, ?)`,
    ).run(token, invitedId, adminId, now, now + 1000);

    expect(
      (
        await req('POST', '/api/auth/claim', {
          token,
          username: 'member',
          email: 'new@example.com',
          password: 'secret123',
        })
      ).status,
    ).toBe(409);

    const next = vi.fn();
    const res: { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> } = {
      status: vi.fn(),
      json: vi.fn(),
    };
    res.status.mockReturnValue(res);
    res.json.mockReturnValue(res);
    const adminReq = { headers: { authorization: `Bearer ${admin.token}` } };
    requireRole('admin')(adminReq as never, res as never, next);
    expect(next).toHaveBeenCalledTimes(1);

    const memberReq = { headers: { authorization: `Bearer ${member.token}` } };
    requireRole('admin')(memberReq as never, res as never, vi.fn());
    expect(res.status).toHaveBeenCalledWith(403);

    auditRead(adminId, adminId, 'self');
    auditRead(adminId, memberId, 'profile');
    expect((db.prepare('SELECT COUNT(*) AS n FROM audit_log').get() as { n: number }).n).toBe(1);
  });
});

describe('F-03/F-05 Tracker API', () => {
  it('keeps workout mutations idempotent and enforces one open workout plus 8h auto-close', async () => {
    const { token } = await register();
    const t0 = Date.now();
    const w1 = crypto.randomUUID();
    const ex = crypto.randomUUID();
    const set = crypto.randomUUID();

    expect((await req('GET', '/api/tracker/state')).status).toBe(401);
    expect(
      (
        await req(
          'PUT',
          `/api/tracker/workouts/${w1}`,
          { startedAt: t0, finishedAt: null, autoFinished: false },
          token,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await req(
          'PUT',
          `/api/tracker/workouts/${crypto.randomUUID()}`,
          { startedAt: 'bad' },
          token,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await req(
          'PUT',
          `/api/tracker/workouts/${crypto.randomUUID()}`,
          { startedAt: t0, finishedAt: 'bad' },
          token,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await req(
          'PUT',
          `/api/tracker/workouts/${w1}/exercises/${ex}`,
          { name: 'Squat', position: 0 },
          token,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await req(
          'PUT',
          `/api/tracker/workouts/${w1}/exercises/${crypto.randomUUID()}`,
          { name: '' },
          token,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await req(
          'PUT',
          `/api/tracker/workouts/${crypto.randomUUID()}/exercises/${crypto.randomUUID()}`,
          { name: 'Ghost' },
          token,
        )
      ).status,
    ).toBe(404);
    await req(
      'PUT',
      `/api/tracker/exercises/${ex}/sets/${set}`,
      { reps: 8, weight: 100, isWarmup: false, position: 0 },
      token,
    );
    expect(
      (
        await req(
          'PUT',
          `/api/tracker/exercises/${ex}/sets/${crypto.randomUUID()}`,
          { reps: -1 },
          token,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await req(
          'PUT',
          `/api/tracker/exercises/${ex}/sets/${crypto.randomUUID()}`,
          { reps: 5, weight: 'bad' },
          token,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await req(
          'PUT',
          `/api/tracker/exercises/${crypto.randomUUID()}/sets/${crypto.randomUUID()}`,
          { reps: 5 },
          token,
        )
      ).status,
    ).toBe(404);
    await req(
      'PUT',
      `/api/tracker/exercises/${ex}/sets/${set}`,
      { reps: 8, weight: 100, isWarmup: false, position: 0 },
      token,
    );

    const state1 = await req<{
      workouts: Array<{
        id: string;
        finishedAt: number | null;
        exercises: Array<{ sets: unknown[] }>;
      }>;
    }>('GET', '/api/tracker/state', undefined, token);
    expect(state1.data.workouts.find((w) => w.id === w1)?.exercises[0].sets).toHaveLength(1);

    const w2 = crypto.randomUUID();
    await req(
      'PUT',
      `/api/tracker/workouts/${w2}`,
      { startedAt: t0 + 1000, finishedAt: null, autoFinished: false },
      token,
    );
    const state2 = await req<{
      workouts: Array<{ id: string; finishedAt: number | null; autoFinished: boolean }>;
    }>('GET', '/api/tracker/state', undefined, token);
    expect(state2.data.workouts.find((w) => w.id === w1)?.autoFinished).toBe(true);
    expect(state2.data.workouts.find((w) => w.id === w2)?.finishedAt).toBe(null);

    const stale = crypto.randomUUID();
    const nineHoursAgo = Date.now() - 9 * 3600_000;
    await req(
      'PUT',
      `/api/tracker/workouts/${stale}`,
      { startedAt: nineHoursAgo, finishedAt: null, autoFinished: false },
      token,
    );
    const state3 = await req<{
      workouts: Array<{ id: string; finishedAt: number | null; autoFinished: boolean }>;
    }>('GET', '/api/tracker/state', undefined, token);
    expect(state3.data.workouts.find((w) => w.id === stale)).toMatchObject({
      autoFinished: true,
      finishedAt: nineHoursAgo + 8 * 3600_000,
    });
    expect((await req('DELETE', `/api/tracker/sets/${set}`, undefined, token)).status).toBe(200);
    expect((await req('DELETE', `/api/tracker/exercises/${ex}`, undefined, token)).status).toBe(
      200,
    );
    expect((await req('DELETE', `/api/tracker/workouts/${w1}`, undefined, token)).status).toBe(200);
  });

  it('computes unlogged gym visit reminders and supports idempotent dismiss', async () => {
    const { token } = await register();
    const gym = crypto.randomUUID();
    const visitStart = Date.now() - 2 * 24 * 3600_000;

    expect(
      (
        await req(
          'PUT',
          `/api/tracker/gyms/${gym}`,
          { name: 'Smartfit', lat: 50.45, lng: 30.52, radiusM: 5000 },
          token,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await req(
          'PUT',
          `/api/tracker/gyms/${crypto.randomUUID()}`,
          { name: '', lat: 1, lng: 2 },
          token,
        )
      ).status,
    ).toBe(400);
    expect(
      (await req('PUT', `/api/tracker/gyms/${crypto.randomUUID()}`, { name: 'Bad' }, token)).status,
    ).toBe(400);
    expect(
      (
        await req(
          'PUT',
          `/api/tracker/pings/${crypto.randomUUID()}`,
          { gymId: crypto.randomUUID(), at: Date.now() },
          token,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await req(
          'PUT',
          `/api/tracker/pings/${crypto.randomUUID()}`,
          { gymId: gym, at: 'bad' },
          token,
        )
      ).status,
    ).toBe(400);

    for (let m = 0; m <= 75; m += 5) {
      await req(
        'PUT',
        `/api/tracker/pings/${crypto.randomUUID()}`,
        { gymId: gym, at: visitStart + m * 60_000 },
        token,
      );
    }
    const withReminder = await req<{ reminders: Array<{ gymId: string; visitStart: number }> }>(
      'GET',
      '/api/tracker/state',
      undefined,
      token,
    );
    expect(withReminder.data.reminders).toContainEqual(
      expect.objectContaining({ gymId: gym, visitStart }),
    );

    expect(
      (await req('POST', '/api/tracker/reminders/dismiss', { gymId: gym, visitStart }, token))
        .status,
    ).toBe(200);
    expect(
      (await req('POST', '/api/tracker/reminders/dismiss', { gymId: gym, visitStart }, token))
        .status,
    ).toBe(200);
    const dismissed = await req<{ reminders: Array<{ gymId: string; visitStart: number }> }>(
      'GET',
      '/api/tracker/state',
      undefined,
      token,
    );
    expect(dismissed.data.reminders).not.toContainEqual(
      expect.objectContaining({ gymId: gym, visitStart }),
    );
    expect((await req('POST', '/api/tracker/reminders/dismiss', {}, token)).status).toBe(400);

    const shortStart = Date.now() - 3 * 24 * 3600_000;
    for (let m = 0; m <= 30; m += 5) {
      await req(
        'PUT',
        `/api/tracker/pings/${crypto.randomUUID()}`,
        { gymId: gym, at: shortStart + m * 60_000 },
        token,
      );
    }
    const ovStart = Date.now() - 4 * 24 * 3600_000;
    for (let m = 0; m <= 75; m += 5) {
      await req(
        'PUT',
        `/api/tracker/pings/${crypto.randomUUID()}`,
        { gymId: gym, at: ovStart + m * 60_000 },
        token,
      );
    }
    await req(
      'PUT',
      `/api/tracker/workouts/${crypto.randomUUID()}`,
      {
        startedAt: ovStart + 10 * 60_000,
        finishedAt: ovStart + 50 * 60_000,
        autoFinished: false,
      },
      token,
    );
    const suppressed = await req<{ reminders: Array<{ visitStart: number }> }>(
      'GET',
      '/api/tracker/state',
      undefined,
      token,
    );
    expect(suppressed.data.reminders).not.toContainEqual(
      expect.objectContaining({ visitStart: shortStart }),
    );
    expect(suppressed.data.reminders).not.toContainEqual(
      expect.objectContaining({ visitStart: ovStart }),
    );
    expect((await req('DELETE', `/api/tracker/gyms/${gym}`, undefined, token)).status).toBe(200);
  });
});
