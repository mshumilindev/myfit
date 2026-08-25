/**
 * In-product notices (AC-ROLE-10, AC-ASSIGN-05, AC-PLAN-11). A notice is a
 * per-user record generated when someone else acts on them — a program is
 * assigned or replaced, a role or trainer changes. Assigned/replaced notices
 * name the person responsible. No external message round-trip.
 */
import { Router, type Response } from 'express';
import crypto from 'node:crypto';
import { db, type NoticeRow } from './db.js';
import { requireAuth, type AuthedRequest } from './auth.js';
import { apiRateLimit } from './rate-limit.js';

export type NoticeKind =
  | 'program-assigned'
  | 'program-replaced'
  | 'role-changed'
  | 'trainer-assigned'
  | 'trainer-removed'
  | 'client-assigned'
  | 'client-removed';

/** Record a notice for a user. Never notifies someone about their own action. */
export function createNotice(
  userId: string,
  kind: NoticeKind,
  actor: string | null = null,
  detail: string | null = null,
): void {
  db.prepare(
    'INSERT INTO notices (id, user_id, kind, actor, detail, created_at, read_at) VALUES (?, ?, ?, ?, ?, ?, NULL)',
  ).run(crypto.randomUUID(), userId, kind, actor, detail, Date.now());
}

/** Username of an actor id, for naming the person responsible. */
export function actorName(userId: string): string | null {
  const row = db.prepare('SELECT username FROM users WHERE id = ?').get(userId) as
    { username: string } | undefined;
  return row?.username ?? null;
}

function noticeJson(n: NoticeRow) {
  return {
    id: n.id,
    kind: n.kind,
    actor: n.actor,
    detail: n.detail,
    createdAt: n.created_at,
    read: n.read_at !== null,
  };
}

export const noticesRouter = Router();
noticesRouter.use(apiRateLimit);

/** The signed-in user's notices, newest first. */
noticesRouter.get('/', requireAuth, (req: AuthedRequest, res: Response) => {
  const rows = db
    .prepare('SELECT * FROM notices WHERE user_id = ? ORDER BY created_at DESC LIMIT 50')
    .all(req.userId) as NoticeRow[];
  res.json({ notices: rows.map(noticeJson) });
});

noticesRouter.post('/:id/read', requireAuth, (req: AuthedRequest, res: Response) => {
  db.prepare('UPDATE notices SET read_at = ? WHERE id = ? AND user_id = ?').run(
    Date.now(),
    String(req.params.id),
    req.userId,
  );
  res.json({ ok: true });
});

noticesRouter.post('/read-all', requireAuth, (req: AuthedRequest, res: Response) => {
  db.prepare('UPDATE notices SET read_at = ? WHERE user_id = ? AND read_at IS NULL').run(
    Date.now(),
    req.userId,
  );
  res.json({ ok: true });
});
