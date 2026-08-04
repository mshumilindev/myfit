/**
 * Shared exercise catalog (custom exercises created by admins/trainers).
 * When an admin or trainer logs an exercise the app doesn't know, it is also
 * written here — with muscle groups and equipment — so every member's picker,
 * chips and muscle math know it immediately.
 *
 * GET /api/exercises        — full catalog, any signed-in user.
 * PUT /api/exercises        — upsert by name, admin/trainer only.
 * DELETE /api/exercises/:id — remove an entry, admin only.
 */
import { Router, type Response } from 'express';
import crypto from 'node:crypto';
import { db } from './db.js';
import { requireAuth, requireRole, type AuthedRequest } from './auth.js';
import { apiRateLimit } from './rate-limit.js';

export const exercisesRouter = Router();
exercisesRouter.use(apiRateLimit);
exercisesRouter.use(requireAuth);

interface CatalogRow {
  id: string;
  name: string;
  name_lower: string;
  kind: string;
  primary_muscle: string | null;
  secondary_muscles: string | null;
  equipment: string | null;
  created_by: string;
  updated_at: number;
}

const MUSCLES = new Set([
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'core',
  'fullbody',
]);

function parseArr(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function toJson(row: CatalogRow) {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    primaryMuscle: row.primary_muscle,
    secondaryMuscles: parseArr(row.secondary_muscles),
    equipment: parseArr(row.equipment),
    updatedAt: row.updated_at,
  };
}

exercisesRouter.get('/', (_req: AuthedRequest, res: Response) => {
  const rows = db
    .prepare('SELECT * FROM exercise_catalog ORDER BY name COLLATE NOCASE')
    .all() as CatalogRow[];
  res.json({ exercises: rows.map(toJson) });
});

exercisesRouter.put('/', requireRole('trainer', 'admin'), (req: AuthedRequest, res: Response) => {
  const body = (req.body ?? {}) as {
    name?: unknown;
    kind?: unknown;
    primaryMuscle?: unknown;
    secondaryMuscles?: unknown;
    equipment?: unknown;
  };
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (name.length < 2 || name.length > 80) {
    return res.status(400).json({ error: 'Name must be 2-80 characters.' });
  }
  const primary =
    typeof body.primaryMuscle === 'string' && MUSCLES.has(body.primaryMuscle)
      ? body.primaryMuscle
      : null;
  const secondary = Array.isArray(body.secondaryMuscles)
    ? body.secondaryMuscles.filter(
        (x): x is string => typeof x === 'string' && MUSCLES.has(x) && x !== primary,
      )
    : [];
  const equipment = Array.isArray(body.equipment)
    ? body.equipment.filter((x): x is string => typeof x === 'string').slice(0, 6)
    : [];
  const kind = typeof body.kind === 'string' ? body.kind : 'strength';
  const now = Date.now();
  const existing = db
    .prepare('SELECT * FROM exercise_catalog WHERE name_lower = ?')
    .get(name.toLowerCase()) as CatalogRow | undefined;
  const id = existing?.id ?? crypto.randomUUID();
  db.prepare(
    `INSERT INTO exercise_catalog
         (id, name, name_lower, kind, primary_muscle, secondary_muscles, equipment, created_by, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(name_lower) DO UPDATE SET
         name = excluded.name,
         kind = excluded.kind,
         primary_muscle = excluded.primary_muscle,
         secondary_muscles = excluded.secondary_muscles,
         equipment = excluded.equipment,
         updated_at = excluded.updated_at`,
  ).run(
    id,
    name,
    name.toLowerCase(),
    kind,
    primary,
    JSON.stringify(secondary),
    JSON.stringify(equipment),
    req.userId,
    now,
  );
  const row = db.prepare('SELECT * FROM exercise_catalog WHERE id = ?').get(id) as CatalogRow;
  res.json({ exercise: toJson(row) });
});

exercisesRouter.delete('/:id', requireRole('admin'), (req: AuthedRequest, res: Response) => {
  db.prepare('DELETE FROM exercise_catalog WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});
