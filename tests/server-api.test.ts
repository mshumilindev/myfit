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

    const named = await req<{
      username: string;
      name: string;
      firstName: string;
      lastName: string | null;
      email: string;
    }>('POST', '/api/auth/register', {
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      password: 'secret123',
    });
    expect(named.status).toBe(200);
    expect(named.data).toMatchObject({
      name: 'Ada Lovelace',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
    });
    expect(named.data.username).toBe('ada');
  });

  it('logs in by email or username and rate-limits repeated failures', async () => {
    const { token } = await register('mykola', 'me@example.com');

    expect((await req('POST', '/api/auth/login', { identifier: 'me@example.com' })).status).toBe(
      400,
    );
    expect(
      (
        await req('POST', '/api/auth/login', {
          identifier: 'x'.repeat(255),
          password: 'secret123',
        })
      ).status,
    ).toBe(400);

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
    db.prepare("UPDATE users SET status = 'suspended' WHERE email = ?").run('new@example.com');
    expect(
      (await req('POST', '/api/auth/login', { identifier: 'mykola', password: 'secret123' }))
        .status,
    ).toBe(403);
    db.prepare("UPDATE users SET status = 'active' WHERE email = ?").run('new@example.com');
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

  it('lets admins create invited admins from the role field', async () => {
    const admin = await register('owner', 'owner@example.com');
    const created = await req<{
      person: { id: string; role: string; status: string; trainerId: string | null };
      invite: { token: string };
    }>(
      'POST',
      '/api/admin/users',
      {
        firstName: 'Sofia',
        lastName: 'Kravets',
        username: 'sofia',
        email: 'sofia@example.com',
        role: 'admin',
        trainerId: 'ignored-for-admin',
      },
      admin.token,
    );

    expect(created.status).toBe(200);
    expect(created.data.person).toMatchObject({
      role: 'admin',
      status: 'invited',
      trainerId: null,
    });
    expect(created.data.invite.token).toEqual(expect.any(String));
    expect(
      db.prepare('SELECT role, trainer_id FROM users WHERE id = ?').get(created.data.person.id) as {
        role: string;
        trainer_id: string | null;
      },
    ).toEqual({ role: 'admin', trainer_id: null });
  });

  it('serves direct profile links only to the owner, an admin or the assigned trainer', async () => {
    const admin = await register('owner', 'owner@example.com');
    const member = await register('member', 'member@example.com');
    const trainer = await register('coach', 'coach@example.com');
    const stranger = await register('stranger', 'stranger@example.com');
    const ids = Object.fromEntries(
      (
        db.prepare('SELECT id, email FROM users').all() as Array<{
          id: string;
          email: string;
        }>
      ).map((u) => [u.email, u.id]),
    );
    const memberId = ids['member@example.com'];
    const trainerId = ids['coach@example.com'];
    const strangerId = ids['stranger@example.com'];
    const now = Date.now();
    db.prepare("UPDATE users SET role = 'trainer' WHERE id = ?").run(trainerId);
    db.prepare('UPDATE users SET trainer_id = ? WHERE id = ?').run(trainerId, memberId);
    db.prepare(
      'INSERT INTO gyms (id, user_id, name, lat, lng, radius_m, favorite, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).run('gym-profile', memberId, 'Smartfit', 50.45, 30.52, 150, 1, now);
    db.prepare(
      'INSERT INTO workouts (id, user_id, started_at, finished_at, auto_finished, gym_id, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run('workout-profile', memberId, now - 3600_000, now, 0, 'gym-profile', now);
    db.prepare(
      'INSERT INTO exercises (id, workout_id, name, position, updated_at) VALUES (?, ?, ?, ?, ?)',
    ).run('exercise-profile', 'workout-profile', 'Squat', 0, now);
    db.prepare(
      'INSERT INTO sets (id, exercise_id, reps, weight, is_warmup, position, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run('set-profile', 'exercise-profile', 8, 100, 0, 0, now);
    db.prepare(
      'INSERT INTO exercises (id, workout_id, name, kind, position, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run('cardio-profile', 'workout-profile', 'Bike', 'cardio', 1, now);
    db.prepare(
      'INSERT INTO sets (id, exercise_id, reps, weight, is_warmup, duration_min, distance_km, calories, rpe, position, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).run('cardio-set-profile', 'cardio-profile', 0, null, 0, 18, 5.1, 120, 5, 0, now);
    db.prepare(
      'INSERT INTO trainer_notes (id, trainer_id, member_id, text, created_at) VALUES (?, ?, ?, ?, ?)',
    ).run('note-profile', trainerId, memberId, 'Keep depth consistent.', now);

    const own = await req<{
      person: { id: string; name: string; email: string };
      summary: { volumeKg: number; cardioMinutes: number };
      gyms: Array<{ name: string; lat: number; lng: number; radiusM: number; sessions: number }>;
      topExercises: Array<{ name: string }>;
      notes: Array<{ text: string }>;
    }>('GET', '/api/profile/users/me', undefined, member.token);
    expect(own.status).toBe(200);
    expect(own.data.person.id).toBe(memberId);
    expect(own.data.summary.volumeKg).toBe(800);
    expect(own.data.summary.cardioMinutes).toBe(18);
    expect(own.data.gyms[0].name).toBe('Smartfit');
    expect(own.data.gyms[0]).toMatchObject({
      lat: 50.45,
      lng: 30.52,
      radiusM: 150,
      sessions: 1,
    });
    expect(own.data.topExercises[0].name).toBe('Squat');
    expect(own.data.notes[0].text).toBe('Keep depth consistent.');

    const edited = await req<{
      person: { name: string; username: string; email: string };
    }>(
      'PUT',
      '/api/profile/me',
      { firstName: 'Member', lastName: 'Edited', username: 'member-edited' },
      member.token,
    );
    expect(edited.status).toBe(200);
    expect(edited.data.person).toMatchObject({
      name: 'Member Edited',
      username: 'member-edited',
      email: 'member@example.com',
    });
    expect(
      (
        await req(
          'PUT',
          '/api/profile/me',
          { firstName: 'Owner', username: 'member-edited' },
          member.token,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await req(
          'PUT',
          '/api/profile/me',
          { firstName: 'Member', lastName: 'Edited', username: 'owner' },
          member.token,
        )
      ).status,
    ).toBe(409);

    expect(
      (
        await req(
          'PUT',
          '/api/profile/me/password',
          { currentPassword: 'wrong', newPassword: 'newsecret123' },
          member.token,
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await req(
          'PUT',
          '/api/profile/me/password',
          { currentPassword: 'secret123', newPassword: 'short' },
          member.token,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await req(
          'PUT',
          '/api/profile/me/password',
          { currentPassword: 'secret123', newPassword: 'newsecret123' },
          member.token,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await req('POST', '/api/auth/login', {
          identifier: 'member-edited',
          password: 'secret123',
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await req('POST', '/api/auth/login', {
          identifier: 'member-edited',
          password: 'newsecret123',
        })
      ).status,
    ).toBe(200);

    expect(
      (await req('GET', `/api/profile/users/${memberId}`, undefined, admin.token)).status,
    ).toBe(200);
    expect(
      (await req('GET', `/api/profile/users/${memberId}`, undefined, trainer.token)).status,
    ).toBe(200);
    expect(
      (await req('GET', `/api/profile/users/${memberId}`, undefined, stranger.token)).status,
    ).toBe(403);
    expect(
      (await req('GET', `/api/profile/users/${strangerId}`, undefined, trainer.token)).status,
    ).toBe(403);

    const audited = await req<{ audit: Array<{ readerName: string }> }>(
      'GET',
      '/api/profile/users/me',
      undefined,
      member.token,
    );
    expect(audited.data.audit.map((a) => a.readerName)).toEqual(
      expect.arrayContaining(['owner', 'coach']),
    );
  });
});

describe('F-03/F-05 Tracker API', () => {
  it('keeps workout mutations idempotent and enforces one open workout plus 8h auto-close', async () => {
    const { token } = await register();
    const t0 = Date.now();
    const w1 = crypto.randomUUID();
    const ex = crypto.randomUUID();
    const cardio = crypto.randomUUID();
    const set = crypto.randomUUID();
    const cardioSet = crypto.randomUUID();

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
          `/api/tracker/workouts/${w1}/exercises/${cardio}`,
          { name: 'Bike', kind: 'cardio', position: 1 },
          token,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await req(
          'PUT',
          `/api/tracker/workouts/${w1}/exercises/${crypto.randomUUID()}`,
          { name: 'Mystery', kind: 'bad-kind' },
          token,
        )
      ).status,
    ).toBe(400);
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
    await req(
      'PUT',
      `/api/tracker/exercises/${cardio}/sets/${cardioSet}`,
      {
        reps: 0,
        weight: null,
        isWarmup: false,
        durationMin: 22,
        distanceKm: 7.5,
        calories: 180,
        rpe: 6,
        position: 0,
      },
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
          `/api/tracker/exercises/${ex}/sets/${crypto.randomUUID()}`,
          { reps: 5, durationMin: -1 },
          token,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await req(
          'PUT',
          `/api/tracker/workouts/${w1}/exercises/${crypto.randomUUID()}`,
          { name: 'Grouped', groupId: 12 },
          token,
        )
      ).status,
    ).toBe(400);
    const dropEx = crypto.randomUUID();
    const dropSet = crypto.randomUUID();
    const groupId = crypto.randomUUID();
    expect(
      (
        await req(
          'PUT',
          `/api/tracker/workouts/${w1}/exercises/${dropEx}`,
          {
            name: 'Curl',
            position: 2,
            groupId,
            groupOrder: 0,
            equipment: ['dumbbell', 12, null],
            secondaryMuscles: ['forearms', 7, null],
            primaryMuscle: 'biceps',
          },
          token,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await req(
          'PUT',
          `/api/tracker/exercises/${dropEx}/sets/${dropSet}`,
          {
            reps: 10,
            weight: 20,
            type: 'drop',
            drops: [{ reps: 8, weight: 15 }, { reps: 'x', weight: null }, null, 'skip'],
            position: 0,
          },
          token,
        )
      ).status,
    ).toBe(200);
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
        exercises: Array<{
          id: string;
          kind: string;
          sets: Array<{ durationMin: number | null; distanceKm: number | null }>;
        }>;
      }>;
    }>('GET', '/api/tracker/state', undefined, token);
    expect(state1.data.workouts.find((w) => w.id === w1)?.exercises[0].sets).toHaveLength(1);
    const stateCardio = state1.data.workouts
      .find((w) => w.id === w1)
      ?.exercises.find((e) => e.id === cardio);
    expect(stateCardio).toMatchObject({
      kind: 'cardio',
      sets: [expect.objectContaining({ durationMin: 22, distanceKm: 7.5 })],
    });

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
          `/api/tracker/gyms/${gym}`,
          {
            name: 'Smartfit',
            lat: 50.45,
            lng: 30.52,
            radiusM: 150,
            inventory: ['barbell', 42, null],
          },
          token,
        )
      ).status,
    ).toBe(200);
    const other = await register('olena', 'olena@example.com');
    expect(
      (
        await req(
          'PUT',
          `/api/tracker/gyms/${gym}`,
          { name: 'Stolen', lat: 1, lng: 2 },
          other.token,
        )
      ).status,
    ).toBe(403);
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

describe('F-09 Programs API', () => {
  it('lets a trainer author, order and assign a program to their own client', async () => {
    await register('owner', 'owner@example.com');
    const trainer = await register('coach', 'coach@example.com');
    const member = await register('member', 'member@example.com');
    const ids = Object.fromEntries(
      (
        db.prepare('SELECT id, email FROM users').all() as Array<{
          id: string;
          email: string;
        }>
      ).map((u) => [u.email, u.id]),
    );
    const trainerId = ids['coach@example.com'];
    const memberId = ids['member@example.com'];
    db.prepare("UPDATE users SET role = 'trainer' WHERE id = ?").run(trainerId);
    db.prepare('UPDATE users SET trainer_id = ? WHERE id = ?').run(trainerId, memberId);

    const saved = await req<{
      program: {
        id: string;
        items: Array<{
          name: string;
          day: number;
          position: number;
          kind: string;
          equipment: string[];
          weight?: number;
        }>;
      };
    }>(
      'PUT',
      '/api/programs/push-program',
      {
        name: 'Push day',
        weeks: 6,
        daysPerWeek: 2,
        items: [
          {
            name: 'Bench',
            day: 1,
            position: 1,
            kind: 'strength',
            sets: 3,
            reps: 8,
            weight: 80,
            equipment: ['barbell', 'machine', 'unknown'],
          },
          { name: 'Warm-up', day: 1, position: 0, kind: 'warmup', durationMin: 8 },
          { name: 'Bike', day: 2, position: 0, kind: 'cardio', durationMin: 20 },
        ],
      },
      trainer.token,
    );
    expect(saved.status).toBe(200);
    expect(saved.data.program.items.map((i) => [i.name, i.day, i.position])).toEqual([
      ['Warm-up', 1, 0],
      ['Bench', 1, 1],
      ['Bike', 2, 0],
    ]);
    expect(saved.data.program.items.find((i) => i.name === 'Bench')).toMatchObject({
      equipment: ['barbell', 'machine'],
    });
    expect(saved.data.program.items.find((i) => i.name === 'Bench')).not.toHaveProperty('weight');
    expect(
      (await req('POST', '/api/programs/push-program/assign', { memberId }, trainer.token)).status,
    ).toBe(200);

    const mine = await req<{
      assignment: {
        program: {
          name: string;
          items: Array<{ kind: string; durationMin: number | null; equipment: string[] }>;
        };
        total: number;
        adherence: number | null;
      };
    }>('GET', '/api/programs/mine', undefined, member.token);
    expect(mine.status).toBe(200);
    expect(mine.data.assignment.program.name).toBe('Push day');
    expect(mine.data.assignment.program.items[0]).toMatchObject({
      kind: 'warmup',
      durationMin: 8,
    });
    expect(mine.data.assignment.total).toBe(12);
  });
});
