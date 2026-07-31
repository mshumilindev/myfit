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
}

export interface WorkoutRow {
  id: string;
  user_id: string;
  started_at: number;
  finished_at: number | null;
  auto_finished: number;
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
