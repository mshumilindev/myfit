/**
 * Own-profile API (O-10, AC-AVATAR, AC-ROLE-08/09): who can see my data, my
 * audit log, and avatar upload/serve. Avatars live on the hub filesystem and
 * are readable only by the owner, an admin, or the assigned trainer.
 */
import { Router, type Response } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import { db, type UserRow } from './db.js';
import { requireAuth, type AuthedRequest } from './auth.js';
import { apiRateLimit } from './rate-limit.js';
import { config } from './config.js';

export const profileRouter = Router();
profileRouter.use(apiRateLimit);
profileRouter.use(requireAuth);

const AVATAR_DIR = path.join(config.dataDir, 'media', 'avatars');
fs.mkdirSync(AVATAR_DIR, { recursive: true });

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function me(req: AuthedRequest): UserRow {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId) as UserRow;
}

/** O-10: my role + exactly who can read my data (AC-ROLE-09). */
profileRouter.get('/me', (req: AuthedRequest, res: Response) => {
  const u = me(req);
  const admins = db
    .prepare("SELECT id, username FROM users WHERE role = 'admin' AND id != ?")
    .all(u.id) as Array<{ id: string; username: string }>;
  const trainer = u.trainer_id
    ? (db.prepare('SELECT id, username FROM users WHERE id = ?').get(u.trainer_id) as
        { id: string; username: string } | undefined)
    : undefined;
  res.json({
    id: u.id,
    name: u.username,
    email: u.email,
    role: u.role,
    avatar: !!u.avatar_ext,
    access: [
      ...admins.map((a) => ({ id: a.id, name: a.username, role: 'admin' })),
      ...(trainer ? [{ id: trainer.id, name: trainer.username, role: 'trainer' }] : []),
    ],
  });
});

/** AC-ROLE-08: the audit log of reads of my data, openable from my profile. */
profileRouter.get('/me/audit', (req: AuthedRequest, res: Response) => {
  const rows = db
    .prepare(
      `SELECT a.at, a.resource, u.username AS readerName,
              COALESCE(u.role, 'admin') AS readerRole
         FROM audit_log a LEFT JOIN users u ON u.id = a.reader_id
        WHERE a.subject_id = ? ORDER BY a.at DESC LIMIT 200`,
    )
    .all(req.userId);
  res.json({ reads: rows });
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
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.userId) as
    UserRow | undefined;
  if (!target || !target.avatar_ext) return res.status(404).end();
  const viewer = me(req);
  const allowed =
    viewer.id === target.id || viewer.role === 'admin' || target.trainer_id === viewer.id;
  if (!allowed) return res.status(403).end();
  res.sendFile(path.join(AVATAR_DIR, `${target.id}.${target.avatar_ext}`));
});
