import Database from 'better-sqlite3';
import { config } from './config.js';

export const db = new Database(config.dbFile);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  email         TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS workouts (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at    INTEGER NOT NULL,
  finished_at   INTEGER,
  auto_finished INTEGER NOT NULL DEFAULT 0,
  updated_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS exercises (
  id         TEXT PRIMARY KEY,
  workout_id TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sets (
  id          TEXT PRIMARY KEY,
  exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  reps        INTEGER NOT NULL,
  weight      REAL,
  is_warmup   INTEGER NOT NULL DEFAULT 0,
  position    INTEGER NOT NULL DEFAULT 0,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS gyms (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  lat        REAL NOT NULL,
  lng        REAL NOT NULL,
  radius_m   INTEGER NOT NULL DEFAULT 150,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS presence_pings (
  id      TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gym_id  TEXT NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS reminder_dismissals (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gym_id      TEXT NOT NULL,
  visit_start INTEGER NOT NULL,
  PRIMARY KEY (user_id, gym_id, visit_start)
);

CREATE INDEX IF NOT EXISTS idx_pings_user ON presence_pings(user_id, at);
CREATE INDEX IF NOT EXISTS idx_gyms_user  ON gyms(user_id);
CREATE INDEX IF NOT EXISTS idx_workouts_user   ON workouts(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_exercises_workout ON exercises(workout_id, position);
CREATE INDEX IF NOT EXISTS idx_sets_exercise   ON sets(exercise_id, position);
`);

// Idempotent column migrations (CREATE TABLE IF NOT EXISTS can't add columns to
// an existing DB). Each ALTER throws if the column already exists — ignore that.
for (const stmt of [
  'ALTER TABLE workouts ADD COLUMN gym_id TEXT',
  'ALTER TABLE gyms ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0',
  // Roles & onboarding (AC-ROLE, AC-INVITE, AC-AVATAR)
  "ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'member'",
  "ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'",
  'ALTER TABLE users ADD COLUMN trainer_id TEXT',
  'ALTER TABLE users ADD COLUMN avatar_ext TEXT',
]) {
  try {
    db.exec(stmt);
  } catch {
    /* column already present */
  }
}

db.exec(`
CREATE TABLE IF NOT EXISTS invites (
  token          TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_by     TEXT NOT NULL,
  kind           TEXT NOT NULL DEFAULT 'invite',
  created_at     INTEGER NOT NULL,
  expires_at     INTEGER NOT NULL,
  claimed_at     INTEGER,
  revoked_at     INTEGER,
  re_requested_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_invites_user ON invites(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  reader_id  TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  resource   TEXT NOT NULL,
  at         INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_subject ON audit_log(subject_id, at DESC);

CREATE TABLE IF NOT EXISTS trainer_notes (
  id         TEXT PRIMARY KEY,
  trainer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notes_member ON trainer_notes(member_id, created_at DESC);
`);

// Bootstrap: if the instance has no admin yet, the oldest account (the
// instance owner) becomes one — pre-roles installs get exactly one admin.
db.exec(
  `UPDATE users SET role = 'admin'
    WHERE NOT EXISTS (SELECT 1 FROM users WHERE role = 'admin')
      AND id = (SELECT id FROM users ORDER BY created_at LIMIT 1)`,
);

// --- Migrations for existing databases -----------------------------------
// users.email додано пізніше; легасі-акаунти можуть мати NULL (вхід за іменем,
// email додається через POST /api/auth/email).
const userCols = db.prepare('PRAGMA table_info(users)').all() as {
  name: string;
}[];
if (!userCols.some((c) => c.name === 'email')) {
  db.exec('ALTER TABLE users ADD COLUMN email TEXT');
}
db.exec(
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL',
);

export interface UserRow {
  id: string;
  username: string;
  email: string | null;
  password_hash: string;
  created_at: number;
  role: 'member' | 'trainer' | 'admin';
  status: 'active' | 'invited' | 'suspended';
  trainer_id: string | null;
  avatar_ext: string | null;
}

export interface InviteRow {
  token: string;
  user_id: string;
  created_by: string;
  kind: 'invite' | 'reset';
  created_at: number;
  expires_at: number;
  claimed_at: number | null;
  revoked_at: number | null;
  re_requested_at: number | null;
}

export interface WorkoutRow {
  id: string;
  user_id: string;
  started_at: number;
  finished_at: number | null;
  auto_finished: number;
  gym_id: string | null;
  updated_at: number;
}

export interface ExerciseRow {
  id: string;
  workout_id: string;
  name: string;
  position: number;
  updated_at: number;
}

export interface GymRow {
  id: string;
  user_id: string;
  name: string;
  lat: number;
  lng: number;
  radius_m: number;
  favorite: number;
  updated_at: number;
}

export interface PingRow {
  id: string;
  user_id: string;
  gym_id: string;
  at: number;
}

export interface SetRow {
  id: string;
  exercise_id: string;
  reps: number;
  weight: number | null;
  is_warmup: number;
  position: number;
  updated_at: number;
}
