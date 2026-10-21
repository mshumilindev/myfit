/**
 * Scheduled reminders (SPO-265). The schedule is sealed; the saving device writes one OPEN field, `timing`
 * ({starts, unmarked, dueAt}: moments only, see client `schedule/timing.ts`). This job reads only that.
 *   starts[i] - 18 h   the CLIENT gets a `reminder` push + a Spotter notice "session tomorrow"
 *   unmarked[i] + 2 h  the TRAINER and the team's managers get a Spotter notice "a session is not marked"
 * Everything is idempotent: a notice has a deterministic id, and `timing.dueAt` is advanced after acting (an Admin
 * write; the client's own save recomputes it). Nothing here knows what the session is, where, or who the program is for.
 */
import type { Ctx } from './service';
import { CLIENT_SPOTTER_KINDS, nameOf, SPOTTER_KINDS } from './team';
import { localDate, localMinutes } from './pushPolicy';
import { DAY } from './logic';

export const REMIND_BEFORE = 18 * 3_600_000;
export const UNMARKED_AFTER = 2 * 3_600_000;
const BATCH = 200;
/** a reminder later than this after its moment is dropped (the job was down; "tomorrow" would be a lie) */
const STALE = 3 * 3_600_000;

interface Timing {
  starts: number[];
  unmarked: number[];
  dueAt: number;
}

const nums = (x: unknown): number[] =>
  Array.isArray(x) ? x.filter((n): n is number => typeof n === 'number' && Number.isFinite(n)) : [];

export const dueAtOf = (t: Pick<Timing, 'starts' | 'unmarked'>, after: number): number => {
  const all = [
    ...t.starts.map((s) => s - REMIND_BEFORE),
    ...t.unmarked.map((e) => e + UNMARKED_AFTER),
  ].filter((x) => x > after);
  return all.length ? Math.min(...all) : 0;
};

export interface RemindersResult {
  schedules: number;
  reminders: number;
  unmarked: number;
}

export async function runReminders(ctx: Ctx): Promise<RemindersResult> {
  const kv = ctx.kv;
  const now = ctx.now();
  const out: RemindersResult = { schedules: 0, reminders: 0, unmarked: 0 };
  const rows = await kv.list('schedules', {
    where: [
      ['timing.dueAt', '>', 0],
      ['timing.dueAt', '<=', now],
    ],
    limit: BATCH,
  });
  for (const r of rows) {
    const clientId = r.id;
    const trainerId = String(r.data.trainerId ?? '');
    const raw = (r.data.timing ?? {}) as Partial<Timing>;
    const t = { starts: nums(raw.starts), unmarked: nums(raw.unmarked) };
    out.schedules++;
    const c = (await kv.get(`coaching/${clientId}`)) as {
      status?: string;
      trainerId?: string;
    } | null;
    const active = !!c && c.status === 'active' && c.trainerId === trainerId;
    if (active) {
      for (const s of t.starts) {
        const at = s - REMIND_BEFORE;
        if (at > now || now - at > STALE || s <= now) continue;
        const id = `rm-${clientId}-${s}`;
        if (await kv.get(`users/${clientId}/reminderLog/${id}`)) continue;
        await kv.set(`users/${clientId}/reminderLog/${id}`, {
          start: s,
          sentAt: now,
        });
        // the client's own Spotter: when the session starts (a time the server already holds in the open `timing`), and
        // the trainer's name; nothing about the session itself
        const nid = `rm-${clientId}-${s}`;
        await kv.set(`users/${clientId}/notices/${nid}`, {
          id: nid,
          kind: 'reminder',
          actor: trainerId || null,
          detail: nameOf((await kv.get(`users/${trainerId}`)) as never) || null,
          start: s,
          createdAt: now,
          readAt: null,
        });
        await ctx.notify?.(clientId, 'reminder');
        out.reminders++;
      }
      const dueUnmarked = t.unmarked.filter((e) => e + UNMARKED_AFTER <= now && now - e < 3 * DAY);
      if (dueUnmarked.length) {
        const who = await staffOf(ctx, trainerId);
        const name = nameOf((await kv.get(`users/${clientId}`)) as never);
        for (const e of dueUnmarked) {
          for (const uid of who) {
            const id = `um-${clientId}-${e}`;
            if (await kv.get(`users/${uid}/notices/${id}`)) continue;
            await kv.set(`users/${uid}/notices/${id}`, {
              id,
              kind: 'unmarked',
              detail: name || null,
              clientId,
              start: e,
              createdAt: now,
              readAt: null,
            });
            await ctx.notify?.(uid, 'team');
            out.unmarked++;
          }
        }
      }
    }
    // the log only exists to make a reminder idempotent: nothing older than a month is kept (plaintext session times)
    for (const l of await kv.list(`users/${clientId}/reminderLog`, { limit: 100 }))
      if (Number(l.data.sentAt) < now - 30 * DAY) await kv.del(l.path);
    // advance the timer only if nobody saved the schedule meanwhile (their save carries its own, fresher `dueAt`)
    await kv.tx(async (tx) => {
      const cur = await tx.get(r.path);
      if (cur && cur.rev === r.data.rev)
        await tx.merge(r.path, { 'timing.dueAt': active ? dueAtOf(t, now) : 0 });
    });
  }
  return out;
}

/** The trainer and the active managers of their team. */
async function staffOf(ctx: Ctx, trainerId: string): Promise<string[]> {
  const trainer = (await ctx.kv.get(`users/${trainerId}`)) as { teamId?: string } | null;
  const teamId = trainer?.teamId || trainerId;
  const members = await ctx.kv.list(`teams/${teamId}/members`);
  const mgrs = members
    .map((m) => m.data as { uid?: string; role?: string; status?: string })
    .filter((m) => m.role === 'manager' && m.status === 'active' && m.uid)
    .map((m) => String(m.uid));
  return [trainerId, ...mgrs];
}

/* ---- requests nobody answered for 24 h, and the 08:00 summary (SPO-265) ------------------------------------------- */
export const UNANSWERED_AFTER = DAY;
/** the local time of the daily summary and how long after it a late job run still sends it (the notice id is per day) */
export const SUMMARY_AT = 8 * 60;
export const SUMMARY_GRACE = 30;

export interface DailyResult {
  unanswered: number;
  summaries: number;
}

/**
 * One reminder per open request per day it stays unanswered, to whoever has to answer (the trainer for a client's request;
 * the client for a trainer's or a manager's). Open fields only (status, times, side); one group query (status + createdAt
 * index), one read per candidate. The Spotter notice is always written; the push follows the person's reminder switch and
 * quiet hours (shouldDeliver).
 */
export async function runUnanswered(ctx: Ctx): Promise<number> {
  const kv = ctx.kv;
  const now = ctx.now();
  let sent = 0;
  const rows = await kv.group('requests', {
    where: [
      ['status', '==', 'pending'],
      ['createdAt', '<=', now - UNANSWERED_AFTER],
    ],
    orderBy: ['createdAt', 'asc'],
    limit: BATCH,
  });
  for (const r of rows) {
    const [, cid] = r.path.split('/');
    if (r.path.split('/')[0] !== 'conversations' || Number(r.data.expiresAt) <= now) continue;
    const conv = (await kv.get(`conversations/${cid}`)) as {
      active?: boolean;
      clientId?: string;
      trainerId?: string;
    } | null;
    if (!conv?.active || !conv.clientId || !conv.trainerId) continue;
    const to = r.data.from === 'client' ? conv.trainerId : conv.clientId;
    const day = Math.floor((now - Number(r.data.createdAt)) / UNANSWERED_AFTER);
    const id = `rq-${r.id}-${day}`;
    if (await kv.get(`users/${to}/notices/${id}`)) continue;
    const name =
      to === conv.trainerId ? nameOf((await kv.get(`users/${conv.clientId}`)) as never) : '';
    await kv.set(`users/${to}/notices/${id}`, {
      id,
      kind: 'reminder',
      actor: null,
      detail: name || null,
      refId: r.id,
      clientId: conv.clientId,
      createdAt: now,
      readAt: null,
    });
    await ctx.notify?.(to, 'reminder');
    sent++;
  }
  return sent;
}

/** Candidate IANA zones: the platform's list plus the old spellings browsers still report. */
const ALIASES = [
  'Europe/Kyiv',
  'Europe/Kiev',
  'Asia/Calcutta',
  'Asia/Katmandu',
  'Asia/Saigon',
  'Asia/Rangoon',
  'America/Buenos_Aires',
];
let zoneCache: string[] | null = null;
const allZones = (): string[] => {
  if (!zoneCache) {
    const sv = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] })
      .supportedValuesOf;
    zoneCache = [...new Set([...(sv ? sv('timeZone') : []), ...ALIASES, 'UTC'])];
  }
  return zoneCache;
};

/** Zones where it is 08:00 to 08:29 right now (DST-aware: the zone database decides). */
export const zonesAtSummaryTime = (at: number): string[] =>
  allZones().filter((z) => {
    const m = localMinutes(at, z);
    return m >= SUMMARY_AT && m < SUMMARY_AT + SUMMARY_GRACE;
  });

/**
 * 08:00 local time (the zone of the person's push device): a `summary` notice in Spotter with the count of unread service
 * messages, only when there is something unread. No push. One notice per person per local day (deterministic id).
 */
export async function runSummaries(ctx: Ctx): Promise<number> {
  const kv = ctx.kv;
  const now = ctx.now();
  const zones = zonesAtSummaryTime(now);
  const seen = new Set<string>();
  const kinds = new Set<string>([...SPOTTER_KINDS, ...CLIENT_SPOTTER_KINDS]);
  let made = 0;
  for (let i = 0; i < zones.length; i += 30) {
    const devices = await kv.group('push', {
      where: [['tz', 'in', zones.slice(i, i + 30)]],
      limit: BATCH,
    });
    for (const d of devices) {
      const [root, uid] = d.path.split('/');
      if (root !== 'users' || !uid || seen.has(uid)) continue;
      seen.add(uid);
      const id = `sum-${uid}-${localDate(now, d.data.tz)}`;
      if (await kv.get(`users/${uid}/notices/${id}`)) continue;
      const unread = (await kv.list(`users/${uid}/notices`, { limit: 200 })).filter(
        (n) => n.data.readAt == null && kinds.has(String(n.data.kind)) && n.data.kind !== 'summary',
      ).length;
      if (!unread) continue;
      await kv.set(`users/${uid}/notices/${id}`, {
        id,
        kind: 'summary',
        actor: null,
        detail: null,
        count: unread,
        createdAt: now,
        readAt: null,
      });
      made++;
    }
  }
  return made;
}

export async function runDaily(ctx: Ctx): Promise<DailyResult> {
  return { unanswered: await runUnanswered(ctx), summaries: await runSummaries(ctx) };
}
