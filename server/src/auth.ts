import { Router, type Request, type Response, type NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { db, type InviteRow, type UserRow } from './db.js';
import { config } from './config.js';
import { apiRateLimit } from './rate-limit.js';
import { displayName, nameParts, parseNameInput } from './user-names.js';

export interface AuthedRequest extends Request {
  userId?: string;
}

export const authRouter = Router();
authRouter.use(apiRateLimit);

const PASSWORD_MIN = 6;
/** bcrypt uses only the first 72 bytes; longer input is silently truncated, so we reject it. */
const PASSWORD_MAX = 72;
const USERNAME_MAX = 64;

function isValidPassword(password: string): boolean {
  return password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX;
}

function authPayload(user: UserRow) {
  const parts = nameParts(user);
  return {
    token: sign(user.id),
    username: user.username,
    name: displayName(user),
    firstName: parts.firstName,
    lastName: parts.lastName,
    role: user.role,
  };
}

// --- Brute-force limiter (in-memory, per ip+identifier) ------------------
// Особистий додаток: цього достатньо проти перебору пароля через тунель.
const FAIL_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;
const MAX_TRACKED_KEYS = 1000;
const failures = new Map<string, { count: number; windowStart: number }>();

function limiterKey(req: Request, identifier: string): string {
  return `${req.ip}|${identifier.trim().toLowerCase()}`;
}

function isLocked(key: string): boolean {
  const entry = failures.get(key);
  if (!entry) return false;
  if (Date.now() - entry.windowStart > FAIL_WINDOW_MS) {
    failures.delete(key);
    return false;
  }
  return entry.count >= MAX_FAILURES;
}

function recordFailure(key: string): void {
  const now = Date.now();
  const entry = failures.get(key);
  if (!entry || now - entry.windowStart > FAIL_WINDOW_MS) {
    if (failures.size >= MAX_TRACKED_KEYS) {
      const oldest = failures.keys().next().value;
      if (oldest !== undefined) failures.delete(oldest);
    }
    failures.set(key, { count: 1, windowStart: now });
    return;
  }
  entry.count += 1;
}

function sign(userId: string): string {
  return jwt.sign({ sub: userId }, config.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: config.jwtExpiresIn,
  });
}

/** Sign-up is open to anyone (multi-user product). */
authRouter.post('/register', (req: Request, res: Response) => {
  const { username, password } = req.body ?? {};
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'First name, username and password are required.' });
  }
  const names = parseNameInput(req.body ?? {});
  const name = username.trim().slice(0, USERNAME_MAX);
  if (names.firstName.length < 2 || names.firstName.length > USERNAME_MAX) {
    return res.status(400).json({ error: 'First name: 2 to 64 characters.' });
  }
  if (name.length < 2) {
    return res.status(400).json({ error: 'Username: 2 to 64 characters.' });
  }
  if (!isValidPassword(password)) {
    return res
      .status(400)
      .json({ error: `Password: ${PASSWORD_MIN} to ${PASSWORD_MAX} characters.` });
  }
  // Sign-up is open to anyone (design BUILD-SPEC: multi-user product).
  const taken = db.prepare('SELECT id FROM users WHERE username = ?').get(name) as
    { id: string } | undefined;
  if (taken) {
    return res.status(409).json({ error: 'That username is already taken.' });
  }
  // The first account on a fresh instance is the admin (AC-ROLE bootstrap).
  const isFirst = (db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n === 0;
  const user: UserRow = {
    id: crypto.randomUUID(),
    username: name,
    email: null,
    password_hash: bcrypt.hashSync(password, 10),
    created_at: Date.now(),
    role: isFirst ? 'admin' : 'member',
    status: 'active',
    trainer_id: null,
    avatar_ext: null,
    first_name: names.firstName,
    last_name: names.lastName,
  };
  db.prepare(
    `INSERT INTO users (id, username, password_hash, created_at, role, status, first_name, last_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    user.id,
    user.username,
    user.password_hash,
    user.created_at,
    user.role,
    user.status,
    user.first_name,
    user.last_name,
  );
  res.json(authPayload(user));
});

/** Login with username. */
authRouter.post('/login', (req: Request, res: Response) => {
  const body = req.body ?? {};
  const identifierRaw = body.identifier ?? body.username;
  const { password } = body;
  if (typeof identifierRaw !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Username and password are required.' });
  }
  if (password.length > PASSWORD_MAX || identifierRaw.length > USERNAME_MAX) {
    return res.status(400).json({ error: 'Wrong username or password.' });
  }
  const key = limiterKey(req, identifierRaw);
  if (isLocked(key)) {
    return res.status(429).json({ error: 'Too many failed attempts. Try again in 15 minutes.' });
  }
  const identifier = identifierRaw.trim();
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(identifier) as
    UserRow | undefined;
  if (!user || !user.password_hash || !bcrypt.compareSync(password, user.password_hash)) {
    recordFailure(key);
    return res.status(401).json({ error: 'Wrong username or password.' });
  }
  if (user.status === 'suspended') {
    return res.status(403).json({ error: 'This account is suspended. Ask your admin.' });
  }
  failures.delete(key);
  res.json(authPayload(user));
});

// --- Invite links (AC-INVITE, AC-ONB) --------------------------------------

function inviteState(inv: InviteRow): 'valid' | 'expired' | 'claimed' | 'revoked' {
  if (inv.revoked_at) return 'revoked';
  if (inv.claimed_at) return 'claimed';
  if (Date.now() > inv.expires_at) return 'expired';
  return 'valid';
}

/** Public: what an invite link shows before any form (AC-ONB-01, AC-ONB-11). */
authRouter.get('/invite/:token', (req: Request, res: Response) => {
  const inv = db.prepare('SELECT * FROM invites WHERE token = ?').get(req.params.token) as
    InviteRow | undefined;
  if (!inv) return res.status(404).json({ error: 'unknown link' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(inv.user_id) as
    UserRow | undefined;
  const inviter = db.prepare('SELECT * FROM users WHERE id = ?').get(inv.created_by) as
    UserRow | undefined;
  const parts = user ? nameParts(user) : { firstName: '', lastName: null };
  res.json({
    state: inviteState(inv),
    kind: inv.kind,
    inviter: inviter ? displayName(inviter) : null,
    name: user ? displayName(user) : null,
    firstName: parts.firstName || null,
    lastName: parts.lastName,
    expiresAt: inv.expires_at,
    claimedAt: inv.claimed_at,
    revokedAt: inv.revoked_at,
  });
});

/** Claim an invite: set password, bind to the pre-created id (AC-INVITE-08). */
authRouter.post('/claim', (req: Request, res: Response) => {
  const { token, password, username } = req.body ?? {};
  if (typeof token !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'token and password are required' });
  }
  if (!isValidPassword(password)) {
    return res
      .status(400)
      .json({ error: `Password: ${PASSWORD_MIN} to ${PASSWORD_MAX} characters.` });
  }
  const inv = db.prepare('SELECT * FROM invites WHERE token = ?').get(token) as
    InviteRow | undefined;
  if (!inv || inviteState(inv) !== 'valid') {
    return res.status(410).json({ error: 'link no longer valid' });
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(inv.user_id) as
    UserRow | undefined;
  if (!user) return res.status(410).json({ error: 'account gone' });
  const now = Date.now();
  const names = parseNameInput(req.body ?? {});
  const firstName = names.firstName || nameParts(user).firstName;
  const lastName = names.firstName ? names.lastName : nameParts(user).lastName;
  const name =
    typeof username === 'string' && username.trim().length >= 2
      ? username.trim().slice(0, USERNAME_MAX)
      : user.username;
  const dupe = db
    .prepare('SELECT id FROM users WHERE username = ? AND id != ?')
    .get(name, user.id) as { id: string } | undefined;
  if (!firstName || firstName.length < 2) {
    return res.status(400).json({ error: 'First name: 2 to 64 characters.' });
  }
  if (dupe) return res.status(409).json({ error: 'That username is already taken.' });
  db.prepare(
    `UPDATE users
        SET password_hash = ?, status = 'active', username = ?, first_name = ?, last_name = ?
      WHERE id = ?`,
  ).run(bcrypt.hashSync(password, 10), name, firstName, lastName, user.id);
  db.prepare('UPDATE invites SET claimed_at = ? WHERE token = ?').run(now, token);
  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id) as UserRow;
  res.json(authPayload(updated));
});

/** "Request a new link" from a dead invite — notifies the admin in-product. */
authRouter.post('/invite/:token/request-new', (req: Request, res: Response) => {
  const inv = db.prepare('SELECT * FROM invites WHERE token = ?').get(req.params.token) as
    InviteRow | undefined;
  if (!inv) return res.status(404).json({ error: 'unknown link' });
  db.prepare('UPDATE invites SET re_requested_at = ? WHERE token = ?').run(
    Date.now(),
    req.params.token,
  );
  res.json({ ok: true });
});

/** Tells the client whether the one-and-only account exists yet. */
authRouter.get('/status', (_req: Request, res: Response) => {
  const count = db.prepare('SELECT COUNT(*) AS n FROM users').get() as {
    n: number;
  };
  res.json({ registered: count.n > 0 });
});

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: 'missing token' });
    return;
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret, {
      algorithms: ['HS256'],
    }) as { sub?: unknown };
    if (typeof payload.sub !== 'string') {
      res.status(401).json({ error: 'invalid token' });
      return;
    }
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: 'invalid token' });
  }
}

/** Role gate: reads the role from the DB on EVERY request (AC-ROLE-07). */
export function requireRole(...roles: Array<'member' | 'trainer' | 'admin'>) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    requireAuth(req, res, () => {
      const user = db.prepare('SELECT role, status FROM users WHERE id = ?').get(req.userId) as
        { role: 'member' | 'trainer' | 'admin'; status: string } | undefined;
      if (!user || user.status === 'suspended' || !roles.includes(user.role)) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }
      next();
    });
  };
}

/** Audit every read of another person's data (AC-ROLE-08). */
export function auditRead(readerId: string, subjectId: string, resource: string): void {
  if (readerId === subjectId) return;
  db.prepare('INSERT INTO audit_log (reader_id, subject_id, resource, at) VALUES (?, ?, ?, ?)').run(
    readerId,
    subjectId,
    resource,
    Date.now(),
  );
}
