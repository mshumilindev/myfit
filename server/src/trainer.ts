/**
 * Trainer API (AC-TRAINER). Read-only over assigned clients only: an
 * unassigned member is a 403 with who/when context (AC-TRAINER-08), and no
 * set-writing route exists here at all (AC-ROLE-05).
 */
import { Router, type Response } from 'express';
import crypto from 'node:crypto';
import { db, type UserRow } from './db.js';
import { requireRole, auditRead, type AuthedRequest } from './auth.js';
import { apiRateLimit } from './rate-limit.js';
import { memberDetail } from './admin.js';

export const trainerRouter = Router();
trainerRouter.use(apiRateLimit);
trainerRouter.use(requireRole('trainer', 'admin'));

const DAY = 24 * 60 * 60 * 1000;

function myClient(req: AuthedRequest, id: string): UserRow | null {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
  if (!u || u.trainer_id !== req.userId) return null;
  return u;
}

/** TR-01: assigned clients with last-seen + weekly volume. */
trainerRouter.get('/clients', (req: AuthedRequest, res: Response) => {
  const clients = db
    .prepare('SELECT * FROM users WHERE trainer_id = ? ORDER BY username')
    .all(req.userId) as UserRow[];
  const now = Date.now();
  res.json({
    clients: clients.map((u) => {
      const last = db
        .prepare(
          'SELECT id, started_at, finished_at FROM workouts WHERE user_id = ? ORDER BY started_at DESC LIMIT 1',
        )
        .get(u.id) as { id: string; started_at: number; finished_at: number | null } | undefined;
      const week = db
        .prepare(
          `SELECT COUNT(DISTINCT w.id) AS sessions, COALESCE(SUM(s.reps * COALESCE(s.weight,0)),0) AS vol
             FROM workouts w
             LEFT JOIN exercises e ON e.workout_id = w.id
             LEFT JOIN sets s ON s.exercise_id = e.id
            WHERE w.user_id = ? AND w.started_at >= ?`,
        )
        .get(u.id, now - 7 * DAY) as { sessions: number; vol: number };
      const liveStats =
        last?.finished_at === null
          ? (db
              .prepare(
                `SELECT COUNT(*) AS sets, COALESCE(SUM(s.reps * COALESCE(s.weight,0)),0) AS vol
                 FROM sets s JOIN exercises e ON e.id = s.exercise_id WHERE e.workout_id = ?`,
              )
              .get(last.id) as { sets: number; vol: number })
          : null;
      return {
        id: u.id,
        name: u.username,
        avatar: !!u.avatar_ext,
        lastSessionAt: last?.started_at ?? null,
        live: last?.finished_at === null,
        liveStartedAt: last?.finished_at === null ? last.started_at : null,
        liveSets: liveStats?.sets ?? 0,
        liveVolumeKg: liveStats?.vol ?? 0,
        weekSessions: week.sessions,
        weekVolumeKg: week.vol,
        dormantDays:
          last && now - last.started_at > 30 * DAY
            ? Math.floor((now - last.started_at) / DAY)
            : null,
      };
    }),
    serverTime: now,
  });
});

/** TR-02: read-only client detail; 403 names who changed what (AC-TRAINER-08). */
trainerRouter.get('/clients/:id', (req: AuthedRequest, res: Response) => {
  const u = myClient(req, String(req.params.id));
  if (!u) {
    const ex = db
      .prepare('SELECT username, trainer_id FROM users WHERE id = ?')
      .get(req.params.id) as { username: string; trainer_id: string | null } | undefined;
    return res.status(403).json({
      error: 'not your client',
      name: ex?.username ?? null,
    });
  }
  auditRead(req.userId!, u.id, 'trainer-detail');
  res.json(memberDetail(u));
});

/** AC-TRAINER-07: notes, visible to trainer + client (+ admin). */
trainerRouter.post('/clients/:id/notes', (req: AuthedRequest, res: Response) => {
  const u = myClient(req, String(req.params.id));
  if (!u) return res.status(403).json({ error: 'not your client' });
  const { text } = req.body ?? {};
  if (typeof text !== 'string' || !text.trim())
    return res.status(400).json({ error: 'text required' });
  const id = crypto.randomUUID();
  db.prepare(
    'INSERT INTO trainer_notes (id, trainer_id, member_id, text, created_at) VALUES (?, ?, ?, ?, ?)',
  ).run(id, req.userId, u.id, text.trim().slice(0, 2000), Date.now());
  res.json({ ok: true, id });
});
