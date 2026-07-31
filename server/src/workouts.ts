import { Router, type Response } from 'express';
import { db, type WorkoutRow, type ExerciseRow, type SetRow } from './db.js';
import { config } from './config.js';
import { requireAuth, type AuthedRequest } from './auth.js';
import { computeReminders, listGyms } from './gyms.js';

export const workoutsRouter = Router();
workoutsRouter.use(requireAuth);

/**
 * Closes stale workouts: anything still open more than `autoFinishAfterMs`
 * after it started gets finished_at = started_at + 8h and the auto flag.
 */
export function autoCloseStale(userId: string, now = Date.now()): void {
  db.prepare(
    `UPDATE workouts
       SET finished_at = started_at + ?, auto_finished = 1, updated_at = ?
     WHERE user_id = ? AND finished_at IS NULL AND started_at + ? <= ?`,
  ).run(config.autoFinishAfterMs, now, userId, config.autoFinishAfterMs, now);
}

/** Starting a new workout auto-closes any other open one at "now". */
function closeOtherOpen(userId: string, exceptId: string, now = Date.now()): void {
  db.prepare(
    `UPDATE workouts
       SET finished_at = ?, auto_finished = 1, updated_at = ?
     WHERE user_id = ? AND finished_at IS NULL AND id != ?`,
  ).run(now, now, userId, exceptId);
}

interface WorkoutJson {
  id: string;
  startedAt: number;
  finishedAt: number | null;
  autoFinished: boolean;
  updatedAt: number;
  exercises: ExerciseJson[];
}
interface ExerciseJson {
  id: string;
  name: string;
  position: number;
  sets: SetJson[];
}
interface SetJson {
  id: string;
  reps: number;
  weight: number | null;
  isWarmup: boolean;
  position: number;
}

function fullState(userId: string): WorkoutJson[] {
  const workouts = db
    .prepare('SELECT * FROM workouts WHERE user_id = ? ORDER BY started_at DESC')
    .all(userId) as WorkoutRow[];
  const exStmt = db.prepare(
    'SELECT * FROM exercises WHERE workout_id = ? ORDER BY position, updated_at',
  );
  const setStmt = db.prepare(
    'SELECT * FROM sets WHERE exercise_id = ? ORDER BY position, updated_at',
  );
  return workouts.map((w) => ({
    id: w.id,
    startedAt: w.started_at,
    finishedAt: w.finished_at,
    autoFinished: !!w.auto_finished,
    updatedAt: w.updated_at,
    exercises: (exStmt.all(w.id) as ExerciseRow[]).map((e) => ({
      id: e.id,
      name: e.name,
      position: e.position,
      sets: (setStmt.all(e.id) as SetRow[]).map((s) => ({
        id: s.id,
        reps: s.reps,
        weight: s.weight,
        isWarmup: !!s.is_warmup,
        position: s.position,
      })),
    })),
  }));
}

/** Full state: the phone always replaces its local cache with this. */
workoutsRouter.get('/state', (req: AuthedRequest, res: Response) => {
  const userId = req.userId!;
  autoCloseStale(userId);
  res.json({
    workouts: fullState(userId),
    gyms: listGyms(userId),
    reminders: computeReminders(userId),
    serverTime: Date.now(),
  });
});

const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 64;

/** Upsert a workout (client-generated UUID → replay-safe for offline sync). */
workoutsRouter.put('/workouts/:id', (req: AuthedRequest, res: Response) => {
  const userId = req.userId!;
  const { id } = req.params;
  if (!isId(id)) return res.status(400).json({ error: 'bad id' });
  const { startedAt, finishedAt = null, autoFinished = false } = req.body ?? {};
  if (typeof startedAt !== 'number') {
    return res.status(400).json({ error: 'startedAt (number) required' });
  }
  if (finishedAt !== null && typeof finishedAt !== 'number') {
    return res.status(400).json({ error: 'finishedAt must be number or null' });
  }
  const now = Date.now();

  const existing = db.prepare('SELECT * FROM workouts WHERE id = ?').get(id) as
    WorkoutRow | undefined;
  if (existing && existing.user_id !== userId) {
    return res.status(403).json({ error: 'not yours' });
  }

  autoCloseStale(userId, now);
  if (finishedAt === null) {
    // This one is (still) open → close all the others.
    closeOtherOpen(userId, id, now);
  }

  db.prepare(
    `INSERT INTO workouts (id, user_id, started_at, finished_at, auto_finished, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       started_at = excluded.started_at,
       finished_at = excluded.finished_at,
       auto_finished = excluded.auto_finished,
       updated_at = excluded.updated_at`,
  ).run(id, userId, startedAt, finishedAt, autoFinished ? 1 : 0, now);

  // The 8h rule also applies to the workout we just wrote.
  autoCloseStale(userId, now);
  res.json({ ok: true });
});

workoutsRouter.delete('/workouts/:id', (req: AuthedRequest, res: Response) => {
  db.prepare('DELETE FROM workouts WHERE id = ? AND user_id = ?').run(req.params.id, req.userId!);
  res.json({ ok: true });
});

function ownWorkout(userId: string, workoutId: string): WorkoutRow | undefined {
  const w = db.prepare('SELECT * FROM workouts WHERE id = ?').get(workoutId) as
    WorkoutRow | undefined;
  return w && w.user_id === userId ? w : undefined;
}

/** Upsert an exercise inside a workout. */
workoutsRouter.put('/workouts/:wid/exercises/:id', (req: AuthedRequest, res: Response) => {
  const userId = req.userId!;
  const { wid, id } = req.params;
  if (!isId(wid) || !isId(id)) return res.status(400).json({ error: 'bad id' });
  if (!ownWorkout(userId, wid)) {
    return res.status(404).json({ error: 'workout not found' });
  }
  const { name, position = 0 } = req.body ?? {};
  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name required' });
  }
  const now = Date.now();
  db.prepare(
    `INSERT INTO exercises (id, workout_id, name, position, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         position = excluded.position,
         updated_at = excluded.updated_at`,
  ).run(id, wid, name.trim(), Number(position) || 0, now);
  res.json({ ok: true });
});

workoutsRouter.delete('/exercises/:id', (req: AuthedRequest, res: Response) => {
  db.prepare(
    `DELETE FROM exercises WHERE id = ? AND workout_id IN
       (SELECT id FROM workouts WHERE user_id = ?)`,
  ).run(req.params.id, req.userId!);
  res.json({ ok: true });
});

/** Upsert a set inside an exercise. */
workoutsRouter.put('/exercises/:eid/sets/:id', (req: AuthedRequest, res: Response) => {
  const userId = req.userId!;
  const { eid, id } = req.params;
  if (!isId(eid) || !isId(id)) return res.status(400).json({ error: 'bad id' });
  const ex = db
    .prepare(
      `SELECT e.* FROM exercises e
           JOIN workouts w ON w.id = e.workout_id
         WHERE e.id = ? AND w.user_id = ?`,
    )
    .get(eid, userId) as ExerciseRow | undefined;
  if (!ex) return res.status(404).json({ error: 'exercise not found' });

  const { reps, weight = null, isWarmup = false, position = 0 } = req.body ?? {};
  if (typeof reps !== 'number' || reps < 0) {
    return res.status(400).json({ error: 'reps (number) required' });
  }
  if (weight !== null && typeof weight !== 'number') {
    return res.status(400).json({ error: 'weight must be number or null' });
  }
  const now = Date.now();
  db.prepare(
    `INSERT INTO sets (id, exercise_id, reps, weight, is_warmup, position, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         reps = excluded.reps,
         weight = excluded.weight,
         is_warmup = excluded.is_warmup,
         position = excluded.position,
         updated_at = excluded.updated_at`,
  ).run(id, eid, reps, weight, isWarmup ? 1 : 0, Number(position) || 0, now);
  res.json({ ok: true });
});

workoutsRouter.delete('/sets/:id', (req: AuthedRequest, res: Response) => {
  db.prepare(
    `DELETE FROM sets WHERE id = ? AND exercise_id IN
       (SELECT e.id FROM exercises e
          JOIN workouts w ON w.id = e.workout_id
        WHERE w.user_id = ?)`,
  ).run(req.params.id, req.userId!);
  res.json({ ok: true });
});
