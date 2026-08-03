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
  kind       TEXT NOT NULL DEFAULT 'strength',
  planned_sets INTEGER,
  planned_reps INTEGER,
  planned_duration_min REAL,
  equipment  TEXT,
  position   INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sets (
  id          TEXT PRIMARY KEY,
  exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  reps        INTEGER NOT NULL,
  weight      REAL,
  is_warmup   INTEGER NOT NULL DEFAULT 0,
  duration_min REAL,
  distance_km  REAL,
  calories     INTEGER,
  rpe          REAL,
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
  'ALTER TABLE users ADD COLUMN first_name TEXT',
  'ALTER TABLE users ADD COLUMN last_name TEXT',
  "ALTER TABLE exercises ADD COLUMN kind TEXT NOT NULL DEFAULT 'strength'",
  'ALTER TABLE exercises ADD COLUMN planned_sets INTEGER',
  'ALTER TABLE exercises ADD COLUMN planned_reps INTEGER',
  'ALTER TABLE exercises ADD COLUMN planned_duration_min REAL',
  'ALTER TABLE exercises ADD COLUMN equipment TEXT',
  'ALTER TABLE sets ADD COLUMN duration_min REAL',
  'ALTER TABLE sets ADD COLUMN distance_km REAL',
  'ALTER TABLE sets ADD COLUMN calories INTEGER',
  'ALTER TABLE sets ADD COLUMN rpe REAL',
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

CREATE TABLE IF NOT EXISTS programs (
  id            TEXT PRIMARY KEY,
  author_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  weeks         INTEGER NOT NULL DEFAULT 8,
  days_per_week INTEGER NOT NULL DEFAULT 3,
  status        TEXT NOT NULL DEFAULT 'draft',
  day_names     TEXT,
  updated_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS program_items (
  id           TEXT PRIMARY KEY,
  program_id   TEXT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  day          INTEGER NOT NULL DEFAULT 1,
  position     INTEGER NOT NULL DEFAULT 0,
  name         TEXT NOT NULL,
  kind         TEXT NOT NULL DEFAULT 'strength',
  sets         INTEGER NOT NULL DEFAULT 3,
  reps         INTEGER NOT NULL DEFAULT 8,
  weight       REAL,
  duration_min REAL,
  equipment    TEXT
);
CREATE INDEX IF NOT EXISTS idx_program_items ON program_items(program_id, day, position);

CREATE TABLE IF NOT EXISTS program_assignments (
  member_id   TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  program_id  TEXT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  assigned_by TEXT NOT NULL,
  started_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS notices (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,
  actor      TEXT,
  detail     TEXT,
  created_at INTEGER NOT NULL,
  read_at    INTEGER
);
CREATE INDEX IF NOT EXISTS idx_notices_user ON notices(user_id, created_at DESC);
`);

for (const stmt of [
  'ALTER TABLE program_items ADD COLUMN equipment TEXT',
  "ALTER TABLE programs ADD COLUMN status TEXT NOT NULL DEFAULT 'active'",
  'ALTER TABLE programs ADD COLUMN day_names TEXT',
]) {
  try {
    db.exec(stmt);
  } catch {
    /* column already present */
  }
}

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

db.exec(`
UPDATE users
   SET first_name = CASE
     WHEN INSTR(TRIM(username), ' ') > 0
       THEN SUBSTR(TRIM(username), 1, INSTR(TRIM(username), ' ') - 1)
     ELSE TRIM(username)
   END
 WHERE first_name IS NULL OR TRIM(first_name) = '';

UPDATE users
   SET last_name = NULLIF(TRIM(SUBSTR(TRIM(username), INSTR(TRIM(username), ' ') + 1)), '')
 WHERE (last_name IS NULL OR TRIM(last_name) = '')
   AND INSTR(TRIM(username), ' ') > 0;
`);

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
  first_name: string | null;
  last_name: string | null;
}

export interface ProgramRow {
  id: string;
  author_id: string;
  name: string;
  weeks: number;
  days_per_week: number;
  status: 'draft' | 'active' | 'archived';
  day_names: string | null;
  updated_at: number;
}

export interface NoticeRow {
  id: string;
  user_id: string;
  kind: string;
  actor: string | null;
  detail: string | null;
  created_at: number;
  read_at: number | null;
}

export interface ProgramItemRow {
  id: string;
  program_id: string;
  day: number;
  position: number;
  name: string;
  kind: 'strength' | 'cardio' | 'warmup' | 'cooldown';
  sets: number;
  reps: number;
  weight: number | null;
  duration_min: number | null;
  equipment: string | null;
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
  kind: 'strength' | 'cardio' | 'warmup' | 'cooldown';
  planned_sets: number | null;
  planned_reps: number | null;
  planned_duration_min: number | null;
  equipment: string | null;
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
  duration_min: number | null;
  distance_km: number | null;
  calories: number | null;
  rpe: number | null;
  position: number;
  updated_at: number;
}
