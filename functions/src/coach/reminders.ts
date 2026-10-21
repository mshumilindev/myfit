/**
 * Scheduled reminders (SPO-265). The schedule is sealed; the saving device writes one OPEN field, `timing`
 * ({starts, unmarked, dueAt}: moments only, see client `schedule/timing.ts`). This job reads only that.
 *   starts[i] - 18 h   the CLIENT gets a `reminder` push + a Spotter notice "session tomorrow"
 *   unmarked[i] + 2 h  the TRAINER and the team's managers get a Spotter notice "a session is not marked"
 * Everything is idempotent: a notice has a deterministic id, and `timing.dueAt` is advanced after acting (an Admin
 * write; the client's own save recomputes it). Nothing here knows what the session is, where, or who the program is for.
 */
import type { Ctx } from './service';
import { nameOf } from './team';
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
