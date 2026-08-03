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
import { createNotice, actorName } from './notices.js';

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

function parseDayNames(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw) as unknown;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        const day = Number(k);
        if (day >= 1 && day <= 7 && typeof v === 'string' && v.trim()) {
          out[String(day)] = v.trim().slice(0, 40);
        }
      }
      return out;
    }
  } catch {
    /* malformed */
  }
  return {};
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
  status: 'draft' | 'active' | 'archived';
  authorId: string;
  dayNames: Record<string, string>;
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
    status: p.status,
    authorId: p.author_id,
    dayNames: parseDayNames(p.day_names),
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
  const openEnded = p.weeks === 0;
  const elapsedDays = Math.max(0, Math.floor((Date.now() - asg.started_at) / DAY_MS));
  const week = openEnded
    ? Math.floor(elapsedDays / 7) + 1
    : Math.min(p.weeks, Math.floor(elapsedDays / 7) + 1);
  const total = openEnded ? 0 : p.weeks * p.days_per_week;
  const expectedSoFar = openEnded
    ? Math.max(1, week * p.days_per_week)
    : Math.min(total, Math.max(1, week * p.days_per_week));
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

programsRouter.put('/:id', requireAuth, (req: AuthedRequest, res: Response) => {
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
  const rawW = Number(weeks);
  const w = rawW === 0 ? 0 : Math.max(1, Math.min(52, rawW || 8));
  const d = Math.max(1, Math.min(7, Number(daysPerWeek) || 3));
  const rawNames = (req.body ?? {}).dayNames;
  const cleanNames: Record<string, string> = {};
  if (rawNames && typeof rawNames === 'object' && !Array.isArray(rawNames)) {
    for (const [k, v] of Object.entries(rawNames as Record<string, unknown>)) {
      const day = Number(k);
      if (day >= 1 && day <= 7 && typeof v === 'string' && v.trim()) {
        cleanNames[String(day)] = v.trim().slice(0, 40);
      }
    }
  }
  const dayNamesJson = Object.keys(cleanNames).length ? JSON.stringify(cleanNames) : null;
  db.prepare(
    `INSERT INTO programs (id, author_id, name, weeks, days_per_week, status, day_names, updated_at)
     VALUES (?, ?, ?, ?, ?, 'draft', ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name, weeks = excluded.weeks,
       days_per_week = excluded.days_per_week, day_names = excluded.day_names,
       updated_at = excluded.updated_at`,
  ).run(id, req.userId, name.trim(), w, d, dayNamesJson, Date.now());
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

programsRouter.delete('/:id', requireAuth, (req: AuthedRequest, res: Response) => {
  const id = String(req.params.id);
  db.prepare('DELETE FROM programs WHERE id = ? AND author_id = ?').run(id, req.userId);
  // A member deleting their own plan drops the self-assignment too (AC-PROG-12
  // keeps logged sessions; only the plan link goes).
  db.prepare('DELETE FROM program_assignments WHERE member_id = ? AND program_id = ?').run(
    req.userId,
    id,
  );
  res.json({ ok: true });
});

/** Set program status; activating requires every day to hold >=1 item (AC-PROG-06). */
programsRouter.post('/:id/status', requireAuth, (req: AuthedRequest, res: Response) => {
  const id = String(req.params.id);
  const { status } = req.body ?? {};
  if (status !== 'draft' && status !== 'active' && status !== 'archived') {
    return res.status(400).json({ error: 'bad status' });
  }
  const p = db.prepare('SELECT * FROM programs WHERE id = ?').get(id) as ProgramRow | undefined;
  if (!p || p.author_id !== req.userId) return res.status(403).json({ error: 'not yours' });
  if (status === 'active') {
    for (let day = 1; day <= p.days_per_week; day++) {
      const n = (
        db
          .prepare('SELECT COUNT(*) AS n FROM program_items WHERE program_id = ? AND day = ?')
          .get(id, day) as { n: number }
      ).n;
      if (n === 0) return res.status(400).json({ error: 'incomplete', day });
    }
  }
  const me = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId) as {
    role: 'member' | 'trainer' | 'admin';
  };
  const now = Date.now();
  if (me.role === 'member' && status === 'active') {
    // A member holds at most one Active program (AC-PROG-05): demote any other
    // active self-authored program, then make this one their current plan.
    db.prepare(
      "UPDATE programs SET status = 'archived', updated_at = ? WHERE author_id = ? AND status = 'active' AND id != ?",
    ).run(now, req.userId, id);
    db.prepare(
      `INSERT INTO program_assignments (member_id, program_id, assigned_by, started_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(member_id) DO UPDATE SET
           program_id = excluded.program_id, assigned_by = excluded.assigned_by,
           started_at = excluded.started_at`,
    ).run(req.userId, id, req.userId, now);
  } else if (me.role === 'member') {
    // Leaving Active (draft/archived) ends the self-plan if it was the current one.
    db.prepare('DELETE FROM program_assignments WHERE member_id = ? AND program_id = ?').run(
      req.userId,
      id,
    );
  }
  db.prepare('UPDATE programs SET status = ?, updated_at = ? WHERE id = ?').run(status, now, id);
  res.json({ ok: true });
});

/** Assign to a member: trainer → own client only; admin → anyone (AD-07). */
programsRouter.post(
  '/:id/assign',
  requireRole('trainer', 'admin'),
  (req: AuthedRequest, res: Response) => {
    const { memberId, startWeek } = req.body ?? {};
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
    const sw = Math.max(1, Math.min(p.weeks === 0 ? 52 : p.weeks, Number(startWeek) || 1));
    const startedAt = Date.now() - (sw - 1) * 7 * DAY_MS;
    const prior = db
      .prepare('SELECT program_id FROM program_assignments WHERE member_id = ?')
      .get(memberId) as { program_id: string } | undefined;
    db.prepare(
      `INSERT INTO program_assignments (member_id, program_id, assigned_by, started_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(member_id) DO UPDATE SET
         program_id = excluded.program_id, assigned_by = excluded.assigned_by,
         started_at = excluded.started_at`,
    ).run(memberId, p.id, req.userId, startedAt);
    // Notify the member and name who did it (AC-ASSIGN-05, AC-PLAN-11) — never
    // for a member self-assigning their own plan.
    if (memberId !== req.userId) {
      createNotice(
        memberId,
        prior ? 'program-replaced' : 'program-assigned',
        actorName(req.userId!),
        p.name,
      );
    }
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
