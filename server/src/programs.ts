/**
 * Programs (AD-03/TR-02/O-07): a trainer or admin authors a program — weeks ×
 * days, each day an ordered list of items with an exercise kind (strength /
 * cardio / warm-up / cool-down) — and assigns it to a member. One active
 * assignment per member (assigning replaces, AC-ROLE-11 style). Members read
 * their own program; only the author edits theirs (AC-ROLE-06).
 */
import { Router, type Response } from 'express';
import crypto from 'node:crypto';
import { db, type ProgramItemRow, type ProgramRow, type UserRow } from './db.js';
import { requireAuth, requireRole, type AuthedRequest } from './auth.js';
import { apiRateLimit } from './rate-limit.js';

export const programsRouter = Router();
programsRouter.use(apiRateLimit);

const DAY_MS = 24 * 60 * 60 * 1000;
const KINDS = new Set(['strength', 'cardio', 'warmup', 'cooldown']);
const EQUIPMENT = new Set([
  'barbell',
  'dumbbell',
  'kettlebell',
  'cable',
  'machine',
  'body',
  'bands',
  'medicineBall',
  'exerciseBall',
  'ezBar',
  'foamRoll',
  'other',
]);

function numOr(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

interface ItemJson {
  id: string;
  day: number;
  position: number;
  name: string;
  kind: ProgramItemRow['kind'];
  sets: number;
  reps: number;
  durationMin: number | null;
  equipment: string[];
}

function parseEquipment(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value)
      ? value.filter((x): x is string => typeof x === 'string' && EQUIPMENT.has(x))
      : [];
  } catch {
    return [];
  }
}

function cleanEquipment(raw: unknown): string[] {
  return Array.isArray(raw)
    ? [...new Set(raw.filter((x): x is string => typeof x === 'string' && EQUIPMENT.has(x)))]
    : [];
}

function programJson(p: ProgramRow): {
  id: string;
  name: string;
  weeks: number;
  daysPerWeek: number;
  authorId: string;
  items: ItemJson[];
} {
  const items = (
    db
      .prepare('SELECT * FROM program_items WHERE program_id = ? ORDER BY day, position')
      .all(p.id) as ProgramItemRow[]
  ).map((i) => ({
    id: i.id,
    day: i.day,
    position: i.position,
    name: i.name,
    kind: i.kind,
    sets: i.sets,
    reps: i.reps,
    durationMin: i.duration_min,
    equipment: parseEquipment(i.equipment),
  }));
  return {
    id: p.id,
    name: p.name,
    weeks: p.weeks,
    daysPerWeek: p.days_per_week,
    authorId: p.author_id,
    items,
  };
}

/** Progress of a member inside their assigned program. */
export function programProgress(memberId: string): {
  program: ReturnType<typeof programJson>;
  assignedBy: string | null;
  startedAt: number;
  week: number;
  done: number;
  total: number;
  expectedSoFar: number;
  adherence: number | null;
} | null {
  const asg = db.prepare('SELECT * FROM program_assignments WHERE member_id = ?').get(memberId) as
    { program_id: string; assigned_by: string; started_at: number } | undefined;
  if (!asg) return null;
  const p = db.prepare('SELECT * FROM programs WHERE id = ?').get(asg.program_id) as
    ProgramRow | undefined;
  if (!p) return null;
  const by = db.prepare('SELECT username FROM users WHERE id = ?').get(asg.assigned_by) as
    { username: string } | undefined;
  const done = (
    db
      .prepare(
        'SELECT COUNT(*) AS n FROM workouts WHERE user_id = ? AND started_at >= ? AND finished_at IS NOT NULL',
      )
      .get(memberId, asg.started_at) as { n: number }
  ).n;
  const total = p.weeks * p.days_per_week;
  const elapsedDays = Math.max(0, Math.floor((Date.now() - asg.started_at) / DAY_MS));
  const week = Math.min(p.weeks, Math.floor(elapsedDays / 7) + 1);
  const expectedSoFar = Math.min(total, Math.max(1, week * p.days_per_week));
  return {
    program: programJson(p),
    assignedBy: by?.username ?? null,
    startedAt: asg.started_at,
    week,
    done,
    total,
    expectedSoFar,
    adherence: expectedSoFar > 0 ? Math.min(1, done / expectedSoFar) : null,
  };
}

// --- Authoring (trainer/admin, own programs only) ---------------------------

programsRouter.get('/', requireRole('trainer', 'admin'), (req: AuthedRequest, res: Response) => {
  const rows = db
    .prepare('SELECT * FROM programs WHERE author_id = ? ORDER BY updated_at DESC')
    .all(req.userId) as ProgramRow[];
  res.json({ programs: rows.map(programJson) });
});

programsRouter.put('/:id', requireRole('trainer', 'admin'), (req: AuthedRequest, res: Response) => {
  const id = String(req.params.id);
  const { name, weeks = 8, daysPerWeek = 3, items = [] } = req.body ?? {};
  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name required' });
  }
  const existing = db.prepare('SELECT author_id FROM programs WHERE id = ?').get(id) as
    { author_id: string } | undefined;
  if (existing && existing.author_id !== req.userId) {
    return res.status(403).json({ error: 'not yours' });
  }
  const w = Math.max(1, Math.min(52, Number(weeks) || 8));
  const d = Math.max(1, Math.min(7, Number(daysPerWeek) || 3));
  db.prepare(
    `INSERT INTO programs (id, author_id, name, weeks, days_per_week, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name, weeks = excluded.weeks,
       days_per_week = excluded.days_per_week, updated_at = excluded.updated_at`,
  ).run(id, req.userId, name.trim(), w, d, Date.now());
  db.prepare('DELETE FROM program_items WHERE program_id = ?').run(id);
  const ins = db.prepare(
    `INSERT INTO program_items
       (id, program_id, day, position, name, kind, sets, reps, weight, duration_min, equipment)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  if (Array.isArray(items)) {
    for (const [idx, raw] of (items as Array<Record<string, unknown>>).entries()) {
      const iname = typeof raw.name === 'string' ? raw.name.trim() : '';
      if (!iname) continue;
      const kind = KINDS.has(String(raw.kind)) ? String(raw.kind) : 'strength';
      ins.run(
        crypto.randomUUID(),
        id,
        Math.max(1, Math.min(7, Number(raw.day) || 1)),
        numOr(raw.position, idx),
        iname.slice(0, 120),
        kind,
        Math.max(1, Math.min(12, Number(raw.sets) || 3)),
        Math.max(1, Math.min(100, Number(raw.reps) || 8)),
        null,
        raw.durationMin === null || raw.durationMin === undefined ? null : Number(raw.durationMin),
        JSON.stringify(cleanEquipment(raw.equipment)),
      );
    }
  }
  const p = db.prepare('SELECT * FROM programs WHERE id = ?').get(id) as ProgramRow;
  res.json({ program: programJson(p) });
});

programsRouter.delete(
  '/:id',
  requireRole('trainer', 'admin'),
  (req: AuthedRequest, res: Response) => {
    db.prepare('DELETE FROM programs WHERE id = ? AND author_id = ?').run(
      String(req.params.id),
      req.userId,
    );
    res.json({ ok: true });
  },
);

/** Assign to a member: trainer → own client only; admin → anyone (AD-07). */
programsRouter.post(
  '/:id/assign',
  requireRole('trainer', 'admin'),
  (req: AuthedRequest, res: Response) => {
    const { memberId } = req.body ?? {};
    if (typeof memberId !== 'string') return res.status(400).json({ error: 'memberId required' });
    const p = db.prepare('SELECT * FROM programs WHERE id = ?').get(String(req.params.id)) as
      ProgramRow | undefined;
    const me = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId) as {
      role: string;
    };
    if (!p || (me.role !== 'admin' && p.author_id !== req.userId)) {
      return res.status(403).json({ error: 'not yours' });
    }
    const member = db.prepare('SELECT * FROM users WHERE id = ?').get(memberId) as
      UserRow | undefined;
    if (!member) return res.status(404).json({ error: 'member not found' });
    if (me.role !== 'admin' && member.trainer_id !== req.userId) {
      return res.status(403).json({ error: 'not your client' });
    }
    db.prepare(
      `INSERT INTO program_assignments (member_id, program_id, assigned_by, started_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(member_id) DO UPDATE SET
         program_id = excluded.program_id, assigned_by = excluded.assigned_by,
         started_at = excluded.started_at`,
    ).run(memberId, p.id, req.userId, Date.now());
    res.json({ ok: true });
  },
);

programsRouter.delete(
  '/assign/:memberId',
  requireRole('trainer', 'admin'),
  (req: AuthedRequest, res: Response) => {
    db.prepare('DELETE FROM program_assignments WHERE member_id = ?').run(
      String(req.params.memberId),
    );
    res.json({ ok: true });
  },
);

/** The member's own active program + progress (Today card, O-07). */
programsRouter.get('/mine', requireAuth, (req: AuthedRequest, res: Response) => {
  res.json({ assignment: programProgress(req.userId!) });
});
