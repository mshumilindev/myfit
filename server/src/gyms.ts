import { Router, type Response } from 'express';
import { db, type GymRow, type PingRow, type WorkoutRow } from './db.js';
import { requireAuth, type AuthedRequest } from './auth.js';
import { apiRateLimit } from './rate-limit.js';

export const gymsRouter = Router();
gymsRouter.use(apiRateLimit);
gymsRouter.use(requireAuth);

const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 64;

// --- Gyms CRUD -------------------------------------------------------------

export function listGyms(userId: string) {
  return (
    db.prepare('SELECT * FROM gyms WHERE user_id = ? ORDER BY name').all(userId) as GymRow[]
  ).map((g) => ({
    id: g.id,
    name: g.name,
    lat: g.lat,
    lng: g.lng,
    radiusM: g.radius_m,
    favorite: !!g.favorite,
    inventory: parseInventory(g.inventory),
  }));
}

function parseInventory(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

gymsRouter.put('/gyms/:id', (req: AuthedRequest, res: Response) => {
  const userId = req.userId!;
  const { id } = req.params;
  if (!isId(id)) return res.status(400).json({ error: 'bad id' });
  const { name, lat, lng, radiusM = 50, favorite = false, inventory = [] } = req.body ?? {};
  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name required' });
  }
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({ error: 'lat/lng required' });
  }
  const existing = db.prepare('SELECT user_id FROM gyms WHERE id = ?').get(id) as
    { user_id: string } | undefined;
  if (existing && existing.user_id !== userId) {
    return res.status(403).json({ error: 'not yours' });
  }
  db.prepare(
    `INSERT INTO gyms (id, user_id, name, lat, lng, radius_m, favorite, inventory, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name, lat = excluded.lat, lng = excluded.lng,
       radius_m = excluded.radius_m, favorite = excluded.favorite,
       inventory = excluded.inventory,
       updated_at = excluded.updated_at`,
  ).run(
    id,
    userId,
    name.trim(),
    lat,
    lng,
    Math.max(30, Math.min(2000, Number(radiusM) || 50)),
    favorite ? 1 : 0,
    JSON.stringify(Array.isArray(inventory) ? inventory.filter((x) => typeof x === 'string') : []),
    Date.now(),
  );
  res.json({ ok: true });
});

gymsRouter.delete('/gyms/:id', (req: AuthedRequest, res: Response) => {
  db.prepare('DELETE FROM gyms WHERE id = ? AND user_id = ?').run(req.params.id, req.userId!);
  res.json({ ok: true });
});

// --- Presence pings --------------------------------------------------------

gymsRouter.put('/pings/:id', (req: AuthedRequest, res: Response) => {
  const userId = req.userId!;
  const { id } = req.params;
  if (!isId(id)) return res.status(400).json({ error: 'bad id' });
  const { gymId, at } = req.body ?? {};
  if (!isId(gymId) || typeof at !== 'number') {
    return res.status(400).json({ error: 'gymId and at required' });
  }
  const gym = db.prepare('SELECT user_id FROM gyms WHERE id = ?').get(gymId) as
    { user_id: string } | undefined;
  if (!gym || gym.user_id !== userId) {
    return res.status(404).json({ error: 'gym not found' });
  }
  db.prepare(
    `INSERT INTO presence_pings (id, user_id, gym_id, at) VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET at = excluded.at`,
  ).run(id, userId, gymId, at);
  res.json({ ok: true });
});

gymsRouter.post('/reminders/dismiss', (req: AuthedRequest, res: Response) => {
  const { gymId, visitStart } = req.body ?? {};
  if (!isId(gymId) || typeof visitStart !== 'number') {
    return res.status(400).json({ error: 'gymId and visitStart required' });
  }
  db.prepare(
    `INSERT OR IGNORE INTO reminder_dismissals (user_id, gym_id, visit_start)
     VALUES (?, ?, ?)`,
  ).run(req.userId!, gymId, visitStart);
  res.json({ ok: true });
});

// --- "Forgot to log a workout?" reminders ---------------------------------

const LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000; // reminders for the last week
const VISIT_GAP_MS = 45 * 60 * 1000; // a >45min gap between pings = new visit
const MIN_VISIT_MS = 60 * 60 * 1000; // remind only for visits of 1h+
const OVERLAP_SLACK_MS = 30 * 60 * 1000;

export interface Reminder {
  gymId: string;
  gymName: string;
  visitStart: number;
  visitEnd: number;
}

export function computeReminders(userId: string, now = Date.now()): Reminder[] {
  const pings = db
    .prepare('SELECT * FROM presence_pings WHERE user_id = ? AND at >= ? ORDER BY gym_id, at')
    .all(userId, now - LOOKBACK_MS) as PingRow[];
  if (pings.length === 0) return [];

  const gyms = new Map(
    (db.prepare('SELECT * FROM gyms WHERE user_id = ?').all(userId) as GymRow[]).map((g) => [
      g.id,
      g,
    ]),
  );
  const workouts = db
    .prepare('SELECT * FROM workouts WHERE user_id = ? AND started_at >= ?')
    .all(userId, now - LOOKBACK_MS - 24 * 60 * 60 * 1000) as WorkoutRow[];
  const dismissed = new Set(
    (
      db
        .prepare('SELECT gym_id, visit_start FROM reminder_dismissals WHERE user_id = ?')
        .all(userId) as { gym_id: string; visit_start: number }[]
    ).map((d) => `${d.gym_id}:${d.visit_start}`),
  );

  // Group pings into visits per gym.
  const reminders: Reminder[] = [];
  let visit: { gymId: string; start: number; end: number } | null = null;

  const flush = (v: { gymId: string; start: number; end: number }) => {
    if (v.end - v.start < MIN_VISIT_MS) return;
    if (dismissed.has(`${v.gymId}:${v.start}`)) return;
    const overlaps = workouts.some((w) => {
      const wEnd = w.finished_at ?? now;
      return w.started_at <= v.end + OVERLAP_SLACK_MS && wEnd >= v.start - OVERLAP_SLACK_MS;
    });
    if (overlaps) return;
    const gym = gyms.get(v.gymId);
    reminders.push({
      gymId: v.gymId,
      gymName: gym?.name ?? 'зал',
      visitStart: v.start,
      visitEnd: v.end,
    });
  };

  for (const p of pings) {
    if (!visit || visit.gymId !== p.gym_id || p.at - visit.end > VISIT_GAP_MS) {
      if (visit) flush(visit);
      visit = { gymId: p.gym_id, start: p.at, end: p.at };
    } else {
      visit.end = p.at;
    }
  }
  if (visit) flush(visit);

  return reminders.sort((a, b) => b.visitStart - a.visitStart);
}
