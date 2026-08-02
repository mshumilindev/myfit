/**
 * Admin API (AC-ADMIN, AC-INVITE, AC-ROLE). Guarded by requireRole('admin') on
 * every route; role is re-read from the DB per request, so a revoked admin
 * loses access on the next call, not at the next login (AC-ROLE-07).
 */
import { Router, type Response } from 'express';
import crypto from 'node:crypto';
import { db, type InviteRow, type UserRow, type WorkoutRow } from './db.js';
import { requireRole, auditRead, type AuthedRequest } from './auth.js';
import { apiRateLimit } from './rate-limit.js';

export const adminRouter = Router();
adminRouter.use(apiRateLimit);
adminRouter.use(requireRole('admin'));

const DAY = 24 * 60 * 60 * 1000;
const INVITE_TTL = 7 * DAY;

const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 64;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function newToken(): string {
  // 128 bits, hex — AC-INVITE-02.
  return crypto.randomBytes(16).toString('hex');
}

function latestInvite(userId: string): InviteRow | undefined {
  return db
    .prepare(
      "SELECT * FROM invites WHERE user_id = ? AND kind = 'invite' ORDER BY created_at DESC LIMIT 1",
    )
    .get(userId) as InviteRow | undefined;
}

function issueInvite(userId: string, createdBy: string, kind: 'invite' | 'reset'): InviteRow {
  const now = Date.now();
  // A new link invalidates any outstanding one (AC-INVITE-07).
  db.prepare(
    'UPDATE invites SET revoked_at = ? WHERE user_id = ? AND kind = ? AND claimed_at IS NULL AND revoked_at IS NULL',
  ).run(now, userId, kind);
  const inv: InviteRow = {
    token: newToken(),
    user_id: userId,
    created_by: createdBy,
    kind,
    created_at: now,
    expires_at: now + INVITE_TTL,
    claimed_at: null,
    revoked_at: null,
    re_requested_at: null,
  };
  db.prepare(
    `INSERT INTO invites (token, user_id, created_by, kind, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(inv.token, inv.user_id, inv.created_by, inv.kind, inv.created_at, inv.expires_at);
  return inv;
}

function volume30d(userId: string, now = Date.now()): number {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(s.reps * COALESCE(s.weight, 0)), 0) AS v
         FROM sets s
         JOIN exercises e ON e.id = s.exercise_id
         JOIN workouts w ON w.id = e.workout_id
        WHERE w.user_id = ? AND w.started_at >= ?`,
    )
    .get(userId, now - 30 * DAY) as { v: number };
  return row.v;
}

function lastSession(userId: string): { at: number | null; live: boolean } {
  const w = db
    .prepare(
      'SELECT started_at, finished_at FROM workouts WHERE user_id = ? ORDER BY started_at DESC LIMIT 1',
    )
    .get(userId) as { started_at: number; finished_at: number | null } | undefined;
  if (!w) return { at: null, live: false };
  return { at: w.started_at, live: w.finished_at === null };
}

export interface PersonJson {
  id: string;
  name: string;
  email: string | null;
  role: string;
  status: string;
  trainerId: string | null;
  trainerName: string | null;
  clientCount: number;
  lastSessionAt: number | null;
  live: boolean;
  liveStartedAt: number | null;
  volume30: number;
  avatar: boolean;
  invite: {
    state: 'sent' | 'expired' | 'revoked' | 'claimed';
    expiresAt: number;
    claimedAt: number | null;
    reRequestedAt: number | null;
    token: string;
  } | null;
}

function personJson(u: UserRow): PersonJson {
  const trainer = u.trainer_id
    ? (db.prepare('SELECT username FROM users WHERE id = ?').get(u.trainer_id) as
        { username: string } | undefined)
    : undefined;
  const clientCount =
    u.role === 'trainer'
      ? (
          db.prepare('SELECT COUNT(*) AS n FROM users WHERE trainer_id = ?').get(u.id) as {
            n: number;
          }
        ).n
      : 0;
  const last = lastSession(u.id);
  const liveW = last.live
    ? (db
        .prepare('SELECT started_at FROM workouts WHERE user_id = ? AND finished_at IS NULL')
        .get(u.id) as { started_at: number } | undefined)
    : undefined;
  let invite: PersonJson['invite'] = null;
  const inv = latestInvite(u.id);
  if (inv) {
    const state = inv.revoked_at
      ? 'revoked'
      : inv.claimed_at
        ? 'claimed'
        : Date.now() > inv.expires_at
          ? 'expired'
          : 'sent';
    invite = {
      state,
      expiresAt: inv.expires_at,
      claimedAt: inv.claimed_at,
      reRequestedAt: inv.re_requested_at,
      token: inv.token,
    };
  }
  return {
    id: u.id,
    name: u.username,
    email: u.email,
    role: u.role,
    status: u.status,
    trainerId: u.trainer_id,
    trainerName: trainer?.username ?? null,
    clientCount,
    lastSessionAt: last.at,
    live: last.live,
    liveStartedAt: liveW?.started_at ?? null,
    volume30: volume30d(u.id),
    avatar: !!u.avatar_ext,
    invite,
  };
}

/** AD-01: the people table. */
adminRouter.get('/people', (_req: AuthedRequest, res: Response) => {
  const users = db.prepare('SELECT * FROM users ORDER BY username').all() as UserRow[];
  res.json({ people: users.map(personJson), serverTime: Date.now() });
});

/** AD-02: create a member (or trainer) + invite link in one step. */
adminRouter.post('/users', (req: AuthedRequest, res: Response) => {
  const { name, email, trainerId = null, role = 'member' } = req.body ?? {};
  if (typeof name !== 'string' || name.trim().length < 2) {
    return res.status(400).json({ error: 'name required' });
  }
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim().toLowerCase())) {
    return res.status(400).json({ error: 'valid email required' });
  }
  if (role !== 'member' && role !== 'trainer') {
    return res.status(400).json({ error: 'role must be member or trainer' });
  }
  const mail = email.trim().toLowerCase();
  const existing = db.prepare('SELECT username FROM users WHERE email = ?').get(mail) as
    { username: string } | undefined;
  if (existing) {
    // AC-ADMIN-13: name the existing holder.
    return res.status(409).json({ error: 'email taken', holder: existing.username });
  }
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO users (id, username, email, password_hash, created_at, role, status, trainer_id)
     VALUES (?, ?, ?, '', ?, ?, 'invited', ?)`,
  ).run(id, name.trim(), mail, Date.now(), role, isId(trainerId) ? trainerId : null);
  const inv = issueInvite(id, req.userId!, 'invite');
  res.json({
    person: personJson(db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow),
    invite: inv,
  });
});

/** New link for an existing account (AC-INVITE-07). */
adminRouter.post('/users/:id/invite', (req: AuthedRequest, res: Response) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as
    UserRow | undefined;
  if (!u) return res.status(404).json({ error: 'not found' });
  const inv = issueInvite(u.id, req.userId!, 'invite');
  res.json({ invite: inv });
});

/** Password reset link (AC-ADMIN-09) — admin never sees the password. */
adminRouter.post('/users/:id/reset', (req: AuthedRequest, res: Response) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as
    UserRow | undefined;
  if (!u) return res.status(404).json({ error: 'not found' });
  const inv = issueInvite(u.id, req.userId!, 'reset');
  res.json({ invite: inv });
});

adminRouter.post('/invites/:token/revoke', (req: AuthedRequest, res: Response) => {
  db.prepare('UPDATE invites SET revoked_at = ? WHERE token = ? AND claimed_at IS NULL').run(
    Date.now(),
    req.params.token,
  );
  res.json({ ok: true });
});

/** Edit name & email (AC-ADMIN-09). */
adminRouter.put('/users/:id', (req: AuthedRequest, res: Response) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as
    UserRow | undefined;
  if (!u) return res.status(404).json({ error: 'not found' });
  const { name, email } = req.body ?? {};
  const nextName = typeof name === 'string' && name.trim().length >= 2 ? name.trim() : u.username;
  const nextMail =
    typeof email === 'string' && EMAIL_RE.test(email.trim().toLowerCase())
      ? email.trim().toLowerCase()
      : u.email;
  const dupe = db
    .prepare('SELECT id, username FROM users WHERE (username = ? OR email = ?) AND id != ?')
    .get(nextName, nextMail, u.id) as { id: string; username: string } | undefined;
  if (dupe) return res.status(409).json({ error: 'email taken', holder: dupe.username });
  db.prepare('UPDATE users SET username = ?, email = ? WHERE id = ?').run(nextName, nextMail, u.id);
  res.json({ ok: true });
});

/** Assign / replace / remove a trainer — atomic single write (AC-ROLE-11). */
adminRouter.post('/users/:id/trainer', (req: AuthedRequest, res: Response) => {
  const { trainerId = null } = req.body ?? {};
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as
    UserRow | undefined;
  if (!u) return res.status(404).json({ error: 'not found' });
  if (trainerId !== null) {
    const tr = db.prepare('SELECT role FROM users WHERE id = ?').get(trainerId) as
      { role: string } | undefined;
    if (!tr || tr.role !== 'trainer') return res.status(400).json({ error: 'not a trainer' });
  }
  db.prepare('UPDATE users SET trainer_id = ? WHERE id = ?').run(trainerId, u.id);
  res.json({ ok: true });
});

/** Change role (AD-07: admin-only). */
adminRouter.post('/users/:id/role', (req: AuthedRequest, res: Response) => {
  const { role } = req.body ?? {};
  if (role !== 'member' && role !== 'trainer' && role !== 'admin') {
    return res.status(400).json({ error: 'bad role' });
  }
  if (req.params.id === req.userId)
    return res.status(400).json({ error: 'cannot change own role' });
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  res.json({ ok: true });
});

adminRouter.post('/users/:id/suspend', (req: AuthedRequest, res: Response) => {
  if (req.params.id === req.userId)
    return res.status(400).json({ error: 'cannot suspend yourself' });
  db.prepare("UPDATE users SET status = 'suspended' WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

adminRouter.post('/users/:id/unsuspend', (req: AuthedRequest, res: Response) => {
  db.prepare("UPDATE users SET status = 'active' WHERE id = ? AND status = 'suspended'").run(
    req.params.id,
  );
  res.json({ ok: true });
});

/** Delete a person and all their data (AC-ADMIN-10). */
adminRouter.delete('/users/:id', (req: AuthedRequest, res: Response) => {
  if (req.params.id === req.userId)
    return res.status(400).json({ error: 'cannot delete yourself' });
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as
    UserRow | undefined;
  if (!u) return res.status(404).json({ error: 'not found' });
  db.prepare('UPDATE users SET trainer_id = NULL WHERE trainer_id = ?').run(u.id);
  db.prepare('DELETE FROM users WHERE id = ?').run(u.id);
  res.json({ ok: true });
});

/** Member detail for AD-03 (audited read, AC-ROLE-08). */
adminRouter.get('/users/:id/detail', (req: AuthedRequest, res: Response) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as
    UserRow | undefined;
  if (!u) return res.status(404).json({ error: 'not found' });
  auditRead(req.userId!, u.id, 'detail');
  res.json(memberDetail(u));
});

export function memberDetail(u: UserRow) {
  const workouts = db
    .prepare('SELECT * FROM workouts WHERE user_id = ? ORDER BY started_at DESC LIMIT 40')
    .all(u.id) as WorkoutRow[];
  const sessions = workouts.map((w) => {
    const stats = db
      .prepare(
        `SELECT COUNT(*) AS sets, COALESCE(SUM(s.reps * COALESCE(s.weight, 0)), 0) AS vol
           FROM sets s JOIN exercises e ON e.id = s.exercise_id
          WHERE e.workout_id = ?`,
      )
      .get(w.id) as { sets: number; vol: number };
    const gym = w.gym_id
      ? (db.prepare('SELECT name FROM gyms WHERE id = ?').get(w.gym_id) as
          { name: string } | undefined)
      : undefined;
    return {
      id: w.id,
      startedAt: w.started_at,
      finishedAt: w.finished_at,
      live: w.finished_at === null,
      sets: stats.sets,
      volumeKg: stats.vol,
      gymName: gym?.name ?? null,
    };
  });
  const count30 = sessions.filter((s) => s.startedAt >= Date.now() - 30 * DAY);
  return {
    person: personJson(u),
    volume30: volume30d(u.id),
    sessions30: count30.length,
    perWeek: Math.round((count30.length / 30) * 7 * 10) / 10,
    sessions,
    notes: db
      .prepare(
        `SELECT n.id, n.text, n.created_at AS createdAt, u.username AS trainerName
           FROM trainer_notes n JOIN users u ON u.id = n.trainer_id
          WHERE n.member_id = ? ORDER BY n.created_at DESC`,
      )
      .all(u.id),
  };
}

/** AC-ADMIN-15: machine-readable export of one member's data. */
adminRouter.get('/users/:id/export', (req: AuthedRequest, res: Response) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as
    UserRow | undefined;
  if (!u) return res.status(404).json({ error: 'not found' });
  auditRead(req.userId!, u.id, 'export');
  const workouts = db
    .prepare('SELECT * FROM workouts WHERE user_id = ? ORDER BY started_at')
    .all(u.id) as WorkoutRow[];
  const full = workouts.map((w) => ({
    ...w,
    exercises: (
      db.prepare('SELECT * FROM exercises WHERE workout_id = ?').all(w.id) as { id: string }[]
    ).map((e) => ({
      ...e,
      sets: db.prepare('SELECT * FROM sets WHERE exercise_id = ?').all(e.id),
    })),
  }));
  res.setHeader('Content-Disposition', `attachment; filename="myfit-${u.username}.json"`);
  res.json({
    exportedAt: Date.now(),
    person: { id: u.id, name: u.username, email: u.email },
    workouts: full,
    gyms: db.prepare('SELECT * FROM gyms WHERE user_id = ?').all(u.id),
  });
});
