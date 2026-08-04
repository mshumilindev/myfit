import { Router, type Response } from 'express';
import { db, type WorkoutRow, type ExerciseRow, type SetRow } from './db.js';
import { config } from './config.js';
import { requireAuth, type AuthedRequest } from './auth.js';
import { computeReminders, listGyms } from './gyms.js';
import { apiRateLimit } from './rate-limit.js';

export const workoutsRouter = Router();
workoutsRouter.use(apiRateLimit);
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
  gymId: string | null;
  updatedAt: number;
  exercises: ExerciseJson[];
}
interface ExerciseJson {
  id: string;
  name: string;
  kind: ExerciseRow['kind'];
  position: number;
  plannedSets: number | null;
  plannedReps: number | null;
  plannedDurationMin: number | null;
  equipment: string[];
  groupId: string | null;
  groupOrder: number | null;
  primaryMuscle: string | null;
  secondaryMuscles: string[];
  sets: SetJson[];
}
interface DropJson {
  reps: number;
  weight: number | null;
}
interface SetJson {
  id: string;
  reps: number;
  weight: number | null;
  isWarmup: boolean;
  type: string;
  drops: DropJson[];
  durationMin: number | null;
  distanceKm: number | null;
  calories: number | null;
  rpe: number | null;
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
    gymId: w.gym_id ?? null,
    updatedAt: w.updated_at,
    exercises: (exStmt.all(w.id) as ExerciseRow[]).map((e) => ({
      id: e.id,
      name: e.name,
      kind: e.kind ?? 'strength',
      position: e.position,
      plannedSets: e.planned_sets ?? null,
      plannedReps: e.planned_reps ?? null,
      plannedDurationMin: e.planned_duration_min ?? null,
      equipment: parseStringArray(e.equipment),
      groupId: e.group_id ?? null,
      groupOrder: e.group_order ?? null,
      primaryMuscle: e.primary_muscle ?? null,
      secondaryMuscles: parseStringArray(e.secondary_muscles),
      sets: (setStmt.all(e.id) as SetRow[]).map((s) => ({
        id: s.id,
        reps: s.reps,
        weight: s.weight,
        isWarmup: !!s.is_warmup,
        type: s.type ?? (s.is_warmup ? 'warmup' : 'working'),
        drops: parseDrops(s.drops),
        durationMin: s.duration_min ?? null,
        distanceKm: s.distance_km ?? null,
        calories: s.calories ?? null,
        rpe: s.rpe ?? null,
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
const EXERCISE_KINDS = new Set(['strength', 'cardio', 'warmup', 'cooldown']);
const numOr = (value: unknown, fallback: number): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

function parseStringArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

const SET_TYPES = new Set(['working', 'warmup', 'drop', 'reverse-drop']);

function parseDrops(raw: string | null): DropJson[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) return [];
    return value
      .filter((d): d is { reps: unknown; weight: unknown } => !!d && typeof d === 'object')
      .map((d) => ({
        reps: Number(d.reps) || 0,
        weight: d.weight === null ? null : Number(d.weight) || 0,
      }));
  } catch {
    return [];
  }
}

function sanitizeDrops(value: unknown): DropJson[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((d): d is { reps: unknown; weight: unknown } => !!d && typeof d === 'object')
    .slice(0, 20)
    .map((d) => ({
      reps: Math.max(0, Math.round(Number(d.reps) || 0)),
      weight: d.weight === null || d.weight === undefined ? null : Number(d.weight) || 0,
    }));
}

function optionalPositiveNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Upsert a workout (client-generated UUID → replay-safe for offline sync). */
workoutsRouter.put('/workouts/:id', (req: AuthedRequest, res: Response) => {
  const userId = req.userId!;
  const { id } = req.params;
  if (!isId(id)) return res.status(400).json({ error: 'bad id' });
  const { startedAt, finishedAt = null, autoFinished = false, gymId = null } = req.body ?? {};
  if (typeof startedAt !== 'number') {
    return res.status(400).json({ error: 'startedAt (number) required' });
  }
  if (finishedAt !== null && typeof finishedAt !== 'number') {
    return res.status(400).json({ error: 'finishedAt must be number or null' });
  }
  if (gymId !== null && !isId(gymId)) {
    return res.status(400).json({ error: 'gymId must be a string or null' });
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
    `INSERT INTO workouts (id, user_id, started_at, finished_at, auto_finished, gym_id, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       started_at = excluded.started_at,
       finished_at = excluded.finished_at,
       auto_finished = excluded.auto_finished,
       gym_id = excluded.gym_id,
       updated_at = excluded.updated_at`,
  ).run(id, userId, startedAt, finishedAt, autoFinished ? 1 : 0, gymId, now);

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
  const {
    name,
    kind = 'strength',
    position = 0,
    plannedSets = null,
    plannedReps = null,
    plannedDurationMin = null,
    equipment = [],
    groupId = null,
    groupOrder = null,
    primaryMuscle = null,
    secondaryMuscles = [],
  } = req.body ?? {};
  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name required' });
  }
  if (typeof kind !== 'string' || !EXERCISE_KINDS.has(kind)) {
    return res.status(400).json({ error: 'bad exercise kind' });
  }
  if (groupId !== null && !isId(groupId)) {
    return res.status(400).json({ error: 'groupId must be a string or null' });
  }
  const now = Date.now();
  const equipmentJson = JSON.stringify(
    Array.isArray(equipment) ? equipment.filter((x): x is string => typeof x === 'string') : [],
  );
  const secondaryJson = JSON.stringify(
    Array.isArray(secondaryMuscles)
      ? secondaryMuscles.filter((x): x is string => typeof x === 'string')
      : [],
  );
  db.prepare(
    `INSERT INTO exercises
       (id, workout_id, name, kind, planned_sets, planned_reps, planned_duration_min, equipment,
        group_id, group_order, primary_muscle, secondary_muscles, position, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         kind = excluded.kind,
         planned_sets = excluded.planned_sets,
         planned_reps = excluded.planned_reps,
         planned_duration_min = excluded.planned_duration_min,
         equipment = excluded.equipment,
         group_id = excluded.group_id,
         group_order = excluded.group_order,
         primary_muscle = excluded.primary_muscle,
         secondary_muscles = excluded.secondary_muscles,
         position = excluded.position,
         updated_at = excluded.updated_at`,
  ).run(
    id,
    wid,
    name.trim(),
    kind,
    optionalPositiveNumber(plannedSets),
    optionalPositiveNumber(plannedReps),
    optionalPositiveNumber(plannedDurationMin),
    equipmentJson,
    groupId,
    groupOrder === null ? null : numOr(groupOrder, 0),
    typeof primaryMuscle === 'string' && primaryMuscle ? primaryMuscle : null,
    secondaryJson,
    numOr(position, 0),
    now,
  );
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

  const {
    reps,
    weight = null,
    isWarmup = false,
    type = null,
    drops = [],
    durationMin = null,
    distanceKm = null,
    calories = null,
    rpe = null,
    position = 0,
  } = req.body ?? {};
  if (typeof reps !== 'number' || reps < 0) {
    return res.status(400).json({ error: 'reps (number) required' });
  }
  if (weight !== null && typeof weight !== 'number') {
    return res.status(400).json({ error: 'weight must be number or null' });
  }
  for (const [key, value] of [
    ['durationMin', durationMin],
    ['distanceKm', distanceKm],
    ['calories', calories],
    ['rpe', rpe],
  ] as const) {
    if (value !== null && (typeof value !== 'number' || value < 0)) {
      return res.status(400).json({ error: `${key} must be number or null` });
    }
  }
  const setType =
    typeof type === 'string' && SET_TYPES.has(type) ? type : isWarmup ? 'warmup' : 'working';
  const dropsJson = JSON.stringify(
    setType === 'drop' || setType === 'reverse-drop' ? sanitizeDrops(drops) : [],
  );
  const now = Date.now();
  db.prepare(
    `INSERT INTO sets
       (id, exercise_id, reps, weight, is_warmup, type, drops, duration_min, distance_km, calories, rpe, position, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         reps = excluded.reps,
         weight = excluded.weight,
         is_warmup = excluded.is_warmup,
         type = excluded.type,
         drops = excluded.drops,
         duration_min = excluded.duration_min,
         distance_km = excluded.distance_km,
         calories = excluded.calories,
         rpe = excluded.rpe,
         position = excluded.position,
         updated_at = excluded.updated_at`,
  ).run(
    id,
    eid,
    reps,
    weight,
    setType === 'warmup' ? 1 : 0,
    setType,
    dropsJson,
    durationMin,
    distanceKm,
    calories === null ? null : Math.round(calories),
    rpe,
    numOr(position, 0),
    now,
  );
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
