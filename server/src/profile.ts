/**
 * Own-profile API (O-10, AC-AVATAR, AC-ROLE-08/09): who can see my data, my
 * audit log, and avatar upload/serve. Avatars live on the hub filesystem and
 * are readable only by the owner, an admin, or the assigned trainer.
 */
import { Router, type Response } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import bcrypt from 'bcryptjs';
import { db, type UserRow, type WorkoutRow } from './db.js';
import { auditRead, requireAuth, type AuthedRequest } from './auth.js';
import { apiRateLimit } from './rate-limit.js';
import { config } from './config.js';
import { displayName, nameParts, parseNameInput } from './user-names.js';

export const profileRouter = Router();
profileRouter.use(apiRateLimit);
profileRouter.use(requireAuth);

const AVATAR_DIR = path.join(config.dataDir, 'media', 'avatars');
fs.mkdirSync(AVATAR_DIR, { recursive: true });

const USERNAME_MAX = 64;
const PASSWORD_MIN = 6;
const PASSWORD_MAX = 72;

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function me(req: AuthedRequest): UserRow {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId) as UserRow;
}

const DAY = 24 * 60 * 60 * 1000;

function cleanUsername(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, USERNAME_MAX) : '';
}

function isValidPassword(password: string): boolean {
  return password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX;
}

function roleLabel(role: UserRow['role']): 'member' | 'trainer' | 'admin' {
  return role;
}

function canReadProfile(viewer: UserRow, target: UserRow): 'self' | 'admin' | 'trainer' | null {
  if (viewer.status === 'suspended') return null;
  if (viewer.id === target.id) return 'self';
  if (viewer.role === 'admin') return 'admin';
  if (viewer.role === 'trainer' && target.trainer_id === viewer.id) return 'trainer';
  return null;
}

function personJson(u: UserRow) {
  const trainer = u.trainer_id
    ? (db.prepare('SELECT * FROM users WHERE id = ?').get(u.trainer_id) as UserRow | undefined)
    : undefined;
  const clientCount =
    u.role === 'trainer'
      ? (
          db.prepare('SELECT COUNT(*) AS n FROM users WHERE trainer_id = ?').get(u.id) as {
            n: number;
          }
        ).n
      : 0;
  return {
    id: u.id,
    name: displayName(u),
    username: u.username,
    ...nameParts(u),
    role: roleLabel(u.role),
    status: u.status,
    joinedAt: u.created_at,
    trainerId: u.trainer_id,
    trainerName: trainer ? displayName(trainer) : null,
    clientCount,
    avatar: !!u.avatar_ext,
  };
}

function accessList(u: UserRow) {
  const admins = db
    .prepare("SELECT * FROM users WHERE role = 'admin' AND id != ?")
    .all(u.id) as UserRow[];
  const trainer = u.trainer_id
    ? (db.prepare('SELECT * FROM users WHERE id = ?').get(u.trainer_id) as UserRow | undefined)
    : undefined;
  return [
    ...admins.map((a) => ({ id: a.id, name: displayName(a), role: 'admin' as const })),
    ...(trainer ? [{ id: trainer.id, name: displayName(trainer), role: 'trainer' as const }] : []),
  ];
}

function volumeSince(userId: string, since: number): number {
  return (
    db
      .prepare(
        `SELECT COALESCE(SUM(s.reps * COALESCE(s.weight, 0)), 0) AS v
          FROM sets s
           JOIN exercises e ON e.id = s.exercise_id
           JOIN workouts w ON w.id = e.workout_id
          WHERE w.user_id = ? AND w.started_at >= ? AND COALESCE(e.kind, 'strength') = 'strength'`,
      )
      .get(userId, since) as { v: number }
  ).v;
}

function trainingSummary(userId: string, now = Date.now()) {
  const row = db
    .prepare(
      `SELECT COUNT(DISTINCT w.id) AS sessions,
              SUM(CASE WHEN w.finished_at IS NULL THEN 1 ELSE 0 END) AS liveSessions,
              MIN(w.started_at) AS firstSessionAt,
              MAX(w.started_at) AS lastSessionAt,
              COALESCE(SUM(CASE WHEN w.finished_at IS NOT NULL THEN w.finished_at - w.started_at ELSE 0 END), 0) AS durationMs,
              COUNT(CASE WHEN COALESCE(e.kind, 'strength') = 'strength' THEN s.id END) AS sets,
              COUNT(DISTINCT CASE WHEN COALESCE(e.kind, 'strength') = 'strength' THEN LOWER(e.name) END) AS exercises,
              COALESCE(SUM(CASE WHEN COALESCE(e.kind, 'strength') = 'strength' THEN s.reps * COALESCE(s.weight, 0) ELSE 0 END), 0) AS volumeKg,
              COALESCE(SUM(CASE WHEN COALESCE(e.kind, 'strength') != 'strength' THEN COALESCE(s.duration_min, 0) ELSE 0 END), 0) AS cardioMinutes
         FROM workouts w
         LEFT JOIN exercises e ON e.workout_id = w.id
         LEFT JOIN sets s ON s.exercise_id = e.id
        WHERE w.user_id = ?`,
    )
    .get(userId) as {
    sessions: number;
    liveSessions: number | null;
    firstSessionAt: number | null;
    lastSessionAt: number | null;
    durationMs: number;
    sets: number;
    exercises: number;
    volumeKg: number;
    cardioMinutes: number;
  };
  const sessions30 = (
    db
      .prepare('SELECT COUNT(*) AS n FROM workouts WHERE user_id = ? AND started_at >= ?')
      .get(userId, now - 30 * DAY) as { n: number }
  ).n;
  return {
    sessions: row.sessions,
    sessions30,
    perWeek30: Math.round((sessions30 / 30) * 7 * 10) / 10,
    liveSessions: row.liveSessions ?? 0,
    firstSessionAt: row.firstSessionAt,
    lastSessionAt: row.lastSessionAt,
    durationMs: row.durationMs,
    sets: row.sets,
    exercises: row.exercises,
    volumeKg: row.volumeKg,
    cardioMinutes: row.cardioMinutes,
    volume30: volumeSince(userId, now - 30 * DAY),
    volume7: volumeSince(userId, now - 7 * DAY),
  };
}

function recentSessions(userId: string) {
  const workouts = db
    .prepare('SELECT * FROM workouts WHERE user_id = ? ORDER BY started_at DESC LIMIT 30')
    .all(userId) as WorkoutRow[];
  return workouts.map((w) => {
    const stats = db
      .prepare(
        `SELECT COUNT(CASE WHEN COALESCE(e.kind, 'strength') = 'strength' THEN s.id END) AS sets,
                COUNT(DISTINCT CASE WHEN COALESCE(e.kind, 'strength') = 'strength' THEN e.id END) AS exercises,
                COALESCE(SUM(CASE WHEN COALESCE(e.kind, 'strength') = 'strength' THEN s.reps * COALESCE(s.weight, 0) ELSE 0 END), 0) AS volumeKg
           FROM exercises e
           LEFT JOIN sets s ON s.exercise_id = e.id
          WHERE e.workout_id = ?`,
      )
      .get(w.id) as { sets: number; exercises: number; volumeKg: number };
    const names = (
      db
        .prepare('SELECT name FROM exercises WHERE workout_id = ? ORDER BY position LIMIT 4')
        .all(w.id) as Array<{ name: string }>
    ).map((e) => e.name);
    const gym = w.gym_id
      ? (db.prepare('SELECT id, name FROM gyms WHERE id = ?').get(w.gym_id) as
          { id: string; name: string } | undefined)
      : undefined;
    return {
      id: w.id,
      startedAt: w.started_at,
      finishedAt: w.finished_at,
      autoFinished: !!w.auto_finished,
      live: w.finished_at === null,
      durationMs: w.finished_at ? w.finished_at - w.started_at : null,
      gymId: gym?.id ?? null,
      gymName: gym?.name ?? null,
      sets: stats.sets,
      exercises: stats.exercises,
      volumeKg: stats.volumeKg,
      exerciseNames: names,
    };
  });
}

function gymStats(userId: string) {
  return db
    .prepare(
      `SELECT g.id,
              g.name,
              g.favorite,
              g.lat,
              g.lng,
              g.radius_m AS radiusM,
              COUNT(DISTINCT w.id) AS sessions,
              MAX(w.started_at) AS lastSessionAt,
              COALESCE(SUM(CASE WHEN COALESCE(e.kind, 'strength') = 'strength' THEN s.reps * COALESCE(s.weight, 0) ELSE 0 END), 0) AS volumeKg
         FROM gyms g
         LEFT JOIN workouts w ON w.gym_id = g.id
         LEFT JOIN exercises e ON e.workout_id = w.id
         LEFT JOIN sets s ON s.exercise_id = e.id
        WHERE g.user_id = ?
        GROUP BY g.id
        ORDER BY sessions DESC, g.favorite DESC, g.name
        LIMIT 20`,
    )
    .all(userId) as Array<{
    id: string;
    name: string;
    favorite: number;
    lat: number;
    lng: number;
    radiusM: number;
    sessions: number;
    lastSessionAt: number | null;
    volumeKg: number;
  }>;
}

function topExercises(userId: string) {
  return db
    .prepare(
      `SELECT e.name,
              COUNT(CASE WHEN COALESCE(e.kind, 'strength') = 'strength' THEN s.id END) AS sets,
              COUNT(DISTINCT w.id) AS sessions,
              MAX(w.started_at) AS lastAt,
              COALESCE(SUM(CASE WHEN COALESCE(e.kind, 'strength') = 'strength' THEN s.reps * COALESCE(s.weight, 0) ELSE 0 END), 0) AS volumeKg,
              MAX(CASE
                    WHEN COALESCE(e.kind, 'strength') = 'strength'
                     AND COALESCE(s.is_warmup, 0) <> 1
                     AND COALESCE(s.type, 'working') <> 'warmup'
                     AND COALESCE(s.weight, 0) > 0
                     AND s.reps BETWEEN 1 AND 10
                    THEN COALESCE(s.weight, 0) * (1 + s.reps / 30.0)
                    ELSE NULL
                  END) AS bestE1rm
         FROM exercises e
         JOIN workouts w ON w.id = e.workout_id
         LEFT JOIN sets s ON s.exercise_id = e.id
        WHERE w.user_id = ? AND COALESCE(e.kind, 'strength') = 'strength'
        GROUP BY LOWER(e.name)
        HAVING sets > 0
        ORDER BY volumeKg DESC, sets DESC
        LIMIT 8`,
    )
    .all(userId) as Array<{
    name: string;
    sets: number;
    sessions: number;
    lastAt: number;
    volumeKg: number;
    bestE1rm: number | null;
  }>;
}

function notesFor(userId: string) {
  const rows = db
    .prepare(
      `SELECT n.id, n.text, n.created_at AS createdAt,
              u.username, u.first_name AS firstName, u.last_name AS lastName
         FROM trainer_notes n JOIN users u ON u.id = n.trainer_id
        WHERE n.member_id = ? ORDER BY n.created_at DESC LIMIT 30`,
    )
    .all(userId) as Array<{
    id: string;
    text: string;
    createdAt: number;
    username: string;
    firstName: string | null;
    lastName: string | null;
  }>;
  return rows.map((r) => ({
    id: r.id,
    text: r.text,
    createdAt: r.createdAt,
    trainerName: displayName({
      username: r.username,
      first_name: r.firstName,
      last_name: r.lastName,
    }),
  }));
}

function auditFor(userId: string) {
  const rows = db
    .prepare(
      `SELECT a.at, a.resource,
              u.username, u.first_name AS firstName, u.last_name AS lastName,
              COALESCE(u.role, 'admin') AS readerRole
         FROM audit_log a LEFT JOIN users u ON u.id = a.reader_id
        WHERE a.subject_id = ? ORDER BY a.at DESC LIMIT 200`,
    )
    .all(userId) as Array<{
    at: number;
    resource: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    readerRole: string;
  }>;
  return rows.map((r) => ({
    at: r.at,
    resource: r.resource,
    readerName: r.username
      ? displayName({ username: r.username, first_name: r.firstName, last_name: r.lastName })
      : null,
    readerRole: r.readerRole,
  }));
}

function fullProfilePayload(
  viewer: UserRow,
  target: UserRow,
  relation: 'self' | 'admin' | 'trainer',
) {
  return {
    viewer: { id: viewer.id, relation, role: viewer.role },
    person: personJson(target),
    access: accessList(target),
    summary: trainingSummary(target.id),
    sessions: recentSessions(target.id),
    gyms: gymStats(target.id),
    topExercises: topExercises(target.id),
    notes: notesFor(target.id),
    audit: relation === 'self' ? auditFor(target.id) : [],
  };
}

/** O-10: my role + exactly who can read my data (AC-ROLE-09). */
profileRouter.get('/me', (req: AuthedRequest, res: Response) => {
  const u = me(req);
  res.json({
    id: u.id,
    name: displayName(u),
    username: u.username,
    ...nameParts(u),
    role: u.role,
    avatar: !!u.avatar_ext,
    access: accessList(u),
  });
});

/** Self-service profile editing: the owner can update their name and username. */
profileRouter.put('/me', (req: AuthedRequest, res: Response) => {
  const u = me(req);
  if (u.status === 'suspended') return res.status(403).json({ error: 'forbidden' });
  const username = cleanUsername((req.body ?? {}).username);
  const names = parseNameInput(req.body ?? {});
  if (names.firstName.length < 2 || names.firstName.length > USERNAME_MAX) {
    return res.status(400).json({ error: 'First name must be 2-64 characters.' });
  }
  if (username.length < 2) {
    return res.status(400).json({ error: 'Username must be 2-64 characters.' });
  }
  const dupe = db
    .prepare('SELECT id FROM users WHERE username = ? AND id != ?')
    .get(username, u.id);
  if (dupe) return res.status(409).json({ error: 'That username is already taken.' });

  db.prepare('UPDATE users SET first_name = ?, last_name = ?, username = ? WHERE id = ?').run(
    names.firstName,
    names.lastName,
    username,
    u.id,
  );
  const updated = me(req);
  res.json(fullProfilePayload(updated, updated, 'self'));
});

/** Self-service password change: only the signed-in owner, with current password proof. */
profileRouter.put('/me/password', (req: AuthedRequest, res: Response) => {
  const u = me(req);
  if (u.status === 'suspended') return res.status(403).json({ error: 'forbidden' });
  const { currentPassword, newPassword } = req.body ?? {};
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
    return res.status(400).json({ error: 'Current and new password are required.' });
  }
  if (!u.password_hash || !bcrypt.compareSync(currentPassword, u.password_hash)) {
    return res.status(401).json({ error: 'Current password is wrong.' });
  }
  if (!isValidPassword(newPassword)) {
    return res
      .status(400)
      .json({ error: `Password: ${PASSWORD_MIN} to ${PASSWORD_MAX} characters.` });
  }
  if (currentPassword === newPassword) {
    return res.status(400).json({ error: 'New password must be different.' });
  }
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
    bcrypt.hashSync(newPassword, 10),
    u.id,
  );
  res.json({ ok: true });
});

/** AC-ROLE-08: the audit log of reads of my data, openable from my profile. */
profileRouter.get('/me/audit', (req: AuthedRequest, res: Response) => {
  res.json({ reads: auditFor(req.userId!) });
});

/**
 * Full profile page data. Direct-link safe: owner, admins and the assigned
 * trainer only. This is the route behind #/profile/:id, so the URL can be
 * shared without leaking anything to someone without the right role.
 */
profileRouter.get('/users/:id', (req: AuthedRequest, res: Response) => {
  const viewer = me(req);
  const targetId = req.params.id === 'me' ? viewer.id : req.params.id;
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId) as
    UserRow | undefined;
  if (!target) return res.status(404).json({ error: 'not found' });

  const relation = canReadProfile(viewer, target);
  if (!relation) return res.status(403).json({ error: 'forbidden' });
  auditRead(viewer.id, target.id, 'profile');

  res.json(fullProfilePayload(viewer, target, relation));
});

/** AC-AVATAR-03/05/06: client sends an already-downscaled square ≤10 MB. */
profileRouter.put(
  '/me/avatar',
  express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '10mb' }),
  (req: AuthedRequest, res: Response) => {
    const ext = EXT_BY_MIME[req.headers['content-type'] ?? ''];
    if (!ext || !Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(415).json({ error: 'JPEG, PNG or WebP required' });
    }
    const u = me(req);
    // AC-AVATAR-10: replacing deletes the previous file.
    if (u.avatar_ext && u.avatar_ext !== ext) {
      fs.rmSync(path.join(AVATAR_DIR, `${u.id}.${u.avatar_ext}`), { force: true });
    }
    fs.writeFileSync(path.join(AVATAR_DIR, `${u.id}.${ext}`), req.body);
    db.prepare('UPDATE users SET avatar_ext = ? WHERE id = ?').run(ext, u.id);
    res.json({ ok: true });
  },
);

profileRouter.delete('/me/avatar', (req: AuthedRequest, res: Response) => {
  const u = me(req);
  if (u.avatar_ext) fs.rmSync(path.join(AVATAR_DIR, `${u.id}.${u.avatar_ext}`), { force: true });
  db.prepare('UPDATE users SET avatar_ext = NULL WHERE id = ?').run(u.id);
  res.json({ ok: true });
});

/** AC-AVATAR-09: owner, any admin, or the assigned trainer only. */
profileRouter.get('/avatars/:userId', (req: AuthedRequest, res: Response) => {
  const viewer = me(req);
  const targetId = req.params.userId === 'me' ? viewer.id : req.params.userId;
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId) as
    UserRow | undefined;
  if (!target || !target.avatar_ext) return res.status(404).end();
  const allowed =
    viewer.id === target.id || viewer.role === 'admin' || target.trainer_id === viewer.id;
  if (!allowed) return res.status(403).end();
  const file = path.join(AVATAR_DIR, `${target.id}.${target.avatar_ext}`);
  // Self-heal: if the DB says there's an avatar but the file is gone (moved
  // data dir, manual delete), clear the flag so the client stops asking and
  // shows initials cleanly instead of a broken image.
  if (!fs.existsSync(file)) {
    db.prepare('UPDATE users SET avatar_ext = NULL WHERE id = ?').run(target.id);
    return res.status(404).end();
  }
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(file);
});
