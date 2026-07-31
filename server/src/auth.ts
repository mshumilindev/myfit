import { Router, type Request, type Response, type NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { db, type UserRow } from './db.js';
import { config } from './config.js';
import { apiRateLimit } from './rate-limit.js';

export interface AuthedRequest extends Request {
  userId?: string;
}

export const authRouter = Router();
authRouter.use(apiRateLimit);

const PASSWORD_MIN = 6;
/** bcrypt uses only the first 72 bytes; longer input is silently truncated, so we reject it. */
const PASSWORD_MAX = 72;
const EMAIL_MAX = 254;
const USERNAME_MAX = 64;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return email.length <= EMAIL_MAX && EMAIL_RE.test(email);
}

function isValidPassword(password: string): boolean {
  return password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX;
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
  const { username, email, password } = req.body ?? {};
  if (typeof username !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Username, email and password are required.' });
  }
  const name = username.trim();
  const mail = normEmail(email);
  if (name.length < 2 || name.length > USERNAME_MAX) {
    return res.status(400).json({ error: 'Username: 2 to 64 characters.' });
  }
  if (!isValidEmail(mail)) {
    return res.status(400).json({ error: "That email doesn't look complete." });
  }
  if (!isValidPassword(password)) {
    return res
      .status(400)
      .json({ error: `Password: ${PASSWORD_MIN} to ${PASSWORD_MAX} characters.` });
  }
  // Sign-up is open to anyone (design BUILD-SPEC: multi-user product).
  const taken = db
    .prepare('SELECT id FROM users WHERE username = ? OR email = ?')
    .get(name, mail) as { id: string } | undefined;
  if (taken) {
    return res.status(409).json({ error: 'That username or email is already taken.' });
  }
  const user: UserRow = {
    id: crypto.randomUUID(),
    username: name,
    email: mail,
    password_hash: bcrypt.hashSync(password, 10),
    created_at: Date.now(),
  };
  db.prepare(
    'INSERT INTO users (id, username, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)',
  ).run(user.id, user.username, user.email, user.password_hash, user.created_at);
  res.json({ token: sign(user.id), username: user.username, email: user.email });
});

/** Login with email or username (legacy accounts may have no email yet). */
authRouter.post('/login', (req: Request, res: Response) => {
  const body = req.body ?? {};
  const identifierRaw = body.identifier ?? body.username ?? body.email;
  const { password } = body;
  if (typeof identifierRaw !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email (or username) and password are required.' });
  }
  if (password.length > PASSWORD_MAX || identifierRaw.length > EMAIL_MAX) {
    return res.status(400).json({ error: 'Wrong username or password.' });
  }
  const key = limiterKey(req, identifierRaw);
  if (isLocked(key)) {
    return res.status(429).json({ error: 'Too many failed attempts. Try again in 15 minutes.' });
  }
  const identifier = identifierRaw.trim();
  const user = db
    .prepare('SELECT * FROM users WHERE username = ? OR email = ?')
    .get(identifier, identifier.toLowerCase()) as UserRow | undefined;
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    recordFailure(key);
    return res.status(401).json({ error: 'Wrong username or password.' });
  }
  failures.delete(key);
  res.json({ token: sign(user.id), username: user.username, email: user.email });
});

/** Set or change email on an existing account (legacy accounts created before emails). */
authRouter.post('/email', requireAuth, (req: AuthedRequest, res: Response) => {
  const { email } = req.body ?? {};
  if (typeof email !== 'string') {
    return res.status(400).json({ error: 'Email is required.' });
  }
  const mail = normEmail(email);
  if (!isValidEmail(mail)) {
    return res.status(400).json({ error: "That email doesn't look complete." });
  }
  db.prepare('UPDATE users SET email = ? WHERE id = ?').run(mail, req.userId);
  res.json({ email: mail });
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
