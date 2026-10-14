/**
 * The schedule engine: pure functions, no React, no copy (port of the lab `slots.ts`, R-BE-CAL-1/2/5/6/9).
 *   generateSlots   docs + requests -> the instances of a window (week, month ...), statuses derived from the clock
 *   conflictIds     one trainer cannot be in two places (touching is NOT overlapping)
 *   clientClashes   the same client in two overlapping sessions
 *   draftSlots      the builder preview
 *   freeStart       first start without a clash
 *   effective state of requests: accepted ones move the block, pending ones are dashed ghosts, declined / expired change nothing
 */
import { DAY, MIN } from '../domain/time';
import type { Attendee, AttendeeStatus, Slot, SlotStatus } from '../domain/types';
import { opaqueSlotKey } from './ids';
import { dayOfTs, minOfTs, toMin, tsOf, weekStartDay } from './time';
import type {
  ReqStatus,
  RescheduleRequest,
  Row,
  ScheduleDoc,
  ScheduleSlot,
  ShareInfo,
} from './types';

export const keyOf = (rowId: string, day: number): string => `${rowId}:${day}`;
export const endOf = (s: { start: number; durationMin: number }): number =>
  s.start + s.durationMin * MIN;
export const overlaps = (
  a: { start: number; durationMin: number },
  b: { start: number; durationMin: number },
): boolean => a.start < endOf(b) && b.start < endOf(a);

const attendeesOf = (s: Slot): Attendee[] =>
  s.attendees.length ? s.attendees : [{ clientId: s.clientId, status: s.status }];
export { attendeesOf };
export const hasClient = (s: Slot, id: string): boolean =>
  attendeesOf(s).some((a) => a.clientId === id);
/** Everyone still in the session (a declined attendee is not). */
export const peopleOf = (s: Slot): string[] =>
  attendeesOf(s)
    .filter((a) => a.status !== 'declined')
    .map((a) => a.clientId);

interface Inst {
  key: string;
  clientId: string;
  day: number;
  startMin: number;
  dur: number;
  gymId: string;
  dayLabel: string | null;
  programDayId: string | null;
  note?: string;
  oneOff: boolean;
  share?: ShareInfo;
  status: SlotStatus;
  moved?: { toStart: number; at: number };
}

export interface GenerateOptions {
  fromDay: number;
  toDay: number;
  now: number;
}

/** Requests that are still open at `now` (a pending one past `expiresAt` is expired, derived here and swept by the server). */
export const statusAt = (r: RescheduleRequest, now: number): ReqStatus =>
  r.status === 'pending' && r.expiresAt <= now ? 'expired' : r.status;

export function generateSlots(
  docs: readonly ScheduleDoc[],
  requests: readonly RescheduleRequest[],
  o: GenerateOptions,
): ScheduleSlot[] {
  const insts = new Map<string, Inst[]>(); // instance key -> one entry per attendee
  const kept = new Set<string>(); // `${instance key}|${clientId}`: stays on the old time in a whole-session move
  const push = (i: Inst) => {
    if (i.day < o.fromDay || i.day > o.toDay) return;
    const l = insts.get(i.key);
    if (l) l.push(i);
    else insts.set(i.key, [i]);
  };

  for (const doc of docs) {
    const cancelled = new Set(doc.cancelled);
    const marks = new Map(doc.exceptions.map((e) => [e.slotKey, e.status]));
    for (const e of doc.exceptions)
      if (e.status === 'kept') kept.add(`${e.slotKey}|${doc.clientId}`);
    const base = (key: string, day: number, startMin: number, dur: number): SlotStatus => {
      const m = marks.get(key);
      if (m === 'missed' || m === 'done') return m;
      return tsOf(day, startMin) + dur * MIN < o.now ? 'done' : 'planned';
    };
    for (const p of doc.patterns) {
      for (let w = 0; w < p.weeks; w++) {
        for (const r of p.rows) {
          const day = weekStartDay(p.fromDay) + w * 7 + r.dow;
          if (day < p.fromDay) continue;
          const key = keyOf(r.id, day);
          if (cancelled.has(key)) continue;
          const startMin = toMin(r.start);
          push({
            key,
            clientId: doc.clientId,
            day,
            startMin,
            dur: r.dur,
            gymId: r.gymId,
            dayLabel: r.dayLabel ?? null,
            programDayId: r.programDayId ?? null,
            oneOff: false,
            share: p.share,
            status: base(key, day, startMin, r.dur),
          });
        }
      }
    }
    for (const x of doc.oneOffs) {
      const key = keyOf(x.id, x.day);
      if (cancelled.has(key)) continue;
      const startMin = toMin(x.start);
      push({
        key,
        clientId: doc.clientId,
        day: x.day,
        startMin,
        dur: x.dur,
        gymId: x.gymId,
        dayLabel: null,
        programDayId: null,
        note: x.note,
        oneOff: true,
        share: x.share,
        status: base(key, x.day, startMin, x.dur),
      });
    }
  }

  /* requests, newest decision last: accepted ones move blocks */
  const accepted = requests
    .filter((r) => r.status === 'accepted')
    .sort((a, b) => (a.decidedAt ?? 0) - (b.decidedAt ?? 0));
  const byGroup = new Map<string, RescheduleRequest[]>();
  for (const r of requests)
    if (r.groupKey) byGroup.set(r.groupKey, [...(byGroup.get(r.groupKey) ?? []), r]);
  const rawByOpaque = new Map<string, string>([...insts.keys()].map((k) => [opaqueSlotKey(k), k]));
  /** The move completes when everyone who is moving has accepted; a "kept" person (trainer's choice) is not asked. */
  const groupDone = (r: RescheduleRequest): boolean => {
    if (!r.groupKey) return true;
    const all = (byGroup.get(r.groupKey) ?? []).filter(
      (x) => !kept.has(`${rawByOpaque.get(x.slotKey) ?? ''}|${x.clientId}`),
    );
    return all.length > 0 && all.every((x) => x.status === 'accepted');
  };
  const wasPhantoms: ScheduleSlot[] = [];
  const out: ScheduleSlot[] = [];
  /** requests carry an opaque slot key; this maps it back to the instance */
  const rawOf = new Map<string, string>([...insts.keys()].map((k) => [opaqueSlotKey(k), k]));

  for (const r of accepted) {
    const raw = rawOf.get(r.slotKey);
    const list = raw ? insts.get(raw) : undefined;
    if (!raw || !list) continue;
    if (r.scope === 'one') {
      const i = list.findIndex((x) => x.clientId === r.clientId);
      if (i < 0) continue;
      const [it] = list.splice(i, 1);
      if (list.length === 0) insts.delete(raw); // a solo session moved for its only attendee: no empty shell
      const nk = `${raw}~${r.clientId}`;
      const day = dayOfTs(r.toStart);
      const moved: Inst = {
        ...it,
        key: nk,
        day,
        startMin: minOfTs(r.toStart),
        share: undefined,
        status: r.toStart + it.dur * MIN < o.now ? 'done' : 'planned',
        moved: { toStart: r.toStart, at: r.decidedAt ?? 0 },
      };
      if (day >= o.fromDay && day <= o.toDay) {
        insts.set(nk, [moved]);
        rawOf.set(opaqueSlotKey(nk), nk);
      }
      continue;
    }
    if (!groupDone(r)) continue;
    const prev = tsOf(list[0].day, list[0].startMin);
    for (const it of [...list]) {
      if (kept.has(`${raw}|${it.clientId}`)) {
        // stays on the old time as its own session
        const nk = `${raw}~stay~${it.clientId}`;
        list.splice(list.indexOf(it), 1);
        insts.set(nk, [{ ...it, key: nk, share: undefined }]);
        rawOf.set(opaqueSlotKey(nk), nk);
      }
    }
    for (const it of list) {
      it.day = dayOfTs(r.toStart);
      it.startMin = minOfTs(r.toStart);
      it.moved = { toStart: r.toStart, at: r.decidedAt ?? 0 };
      if (it.status === 'planned' || it.status === 'done')
        it.status = r.toStart + it.dur * MIN < o.now ? 'done' : 'planned';
    }
    const first = list[0];
    const was = {
      id: `${raw}~was`,
      key: raw,
      clientId: first.clientId,
      kind: 'solo' as const,
      attendees: [{ clientId: first.clientId, status: 'moved' as AttendeeStatus }],
      start: prev,
      durationMin: first.dur,
      gymId: first.gymId,
      status: 'moved' as const,
      movedTo: r.toStart,
    };
    if (dayOfTs(prev) >= o.fromDay && dayOfTs(prev) <= o.toDay) wasPhantoms.push(was);
  }

  /* pending requests (not past their expiry) */
  const pendingBy = new Map<string, RescheduleRequest[]>();
  for (const r of requests) {
    const raw = rawOf.get(r.slotKey);
    if (raw && statusAt(r, o.now) === 'pending')
      pendingBy.set(raw, [...(pendingBy.get(raw) ?? []), r]);
  }

  for (const [key, list] of insts) {
    const f = list[0];
    const shared = list.length > 1 || !!f.share;
    const pend = pendingBy.get(key) ?? [];
    const attendees: Attendee[] = list.map((it) => {
      const mine = pend.find((r) => r.clientId === it.clientId);
      return {
        clientId: it.clientId,
        status: mine ? 'pending-move' : it.status,
        programDayId: it.programDayId,
      };
    });
    const wholeMove = pend.find((r) => r.scope === 'all');
    const kind = shared ? (f.share?.kind ?? (list.length > 1 ? 'split' : 'solo')) : 'solo';
    const start = tsOf(f.day, f.startMin);
    const slot: ScheduleSlot = {
      id: key,
      key,
      clientId: f.clientId,
      kind,
      title: f.share?.title,
      capacity: f.share?.capacity,
      attendees,
      start,
      durationMin: f.dur,
      gymId: f.gymId,
      status: wholeMove || (!shared && pend[0]) ? 'pending-move' : statusOfAll(attendees, f.status),
      dayLabel: f.dayLabel,
      programDayId: f.programDayId,
      oneOff: f.oneOff,
      note: f.note,
      justMoved: !!f.moved && o.now - f.moved.at < 3 * DAY,
    };
    const m = wholeMove ?? (!shared ? pend[0] : undefined);
    if (m) slot.move = { reqId: m.id, from: m.from, start: m.toStart, note: m.note };
    out.push(slot);
  }
  return [...out, ...wasPhantoms].sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
}

/** The session's own status: that of its attendees when they agree, else the "worst" visible one. */
function statusOfAll(att: readonly Attendee[], fallback: SlotStatus): SlotStatus {
  const live = att.filter((a) => a.status !== 'declined');
  if (!live.length) return fallback;
  const set = new Set(live.map((a) => a.status));
  if (set.size === 1) return live[0].status as SlotStatus;
  if (set.has('missed') && !set.has('planned')) return 'missed';
  return fallback;
}

/* ---- conflicts ---------------------------------------------------------------------------------------------------- */
const act = (s: Slot): boolean => s.status === 'planned' || s.status === 'pending-move';
/** ids of sessions that overlap another one (one trainer cannot be in two places). Back-to-back is not a clash. */
export function conflictIds(slots: readonly Slot[]): Set<string> {
  const out = new Set<string>();
  const L = slots.filter(act).sort((a, b) => a.start - b.start);
  for (let i = 0; i < L.length; i++)
    for (let j = i + 1; j < L.length && L[j].start < endOf(L[i]); j++)
      if (overlaps(L[i], L[j])) {
        out.add(L[i].id);
        out.add(L[j].id);
      }
  return out;
}
/** Sessions that clash with `s` (itself excluded). */
export const clashWith = <T extends Slot>(
  s: { id?: string; start: number; durationMin: number },
  slots: readonly T[],
): T[] => slots.filter((x) => x.id !== s.id && act(x) && overlaps(s, x));
/** One client booked into two overlapping sessions (attendees of the same session never clash with each other). */
export function clientClashes(slots: readonly Slot[]): { clientId: string; a: Slot; b: Slot }[] {
  const L = slots.filter(act);
  const out: { clientId: string; a: Slot; b: Slot }[] = [];
  for (let i = 0; i < L.length; i++)
    for (let j = i + 1; j < L.length; j++)
      if (overlaps(L[i], L[j]))
        for (const a of attendeesOf(L[i]))
          if (hasClient(L[j], a.clientId)) out.push({ clientId: a.clientId, a: L[i], b: L[j] });
  return out;
}
/** Per attendee of a shared session: who is already booked elsewhere at that time. */
export const attendeeClashes = (
  s: Slot,
  slots: readonly Slot[],
): { clientId: string; hit: Slot[] }[] =>
  attendeesOf(s)
    .map((a) => ({
      clientId: a.clientId,
      hit: slots.filter(
        (x) => x.id !== s.id && act(x) && overlaps(s, x) && hasClient(x, a.clientId),
      ),
    }))
    .filter((x) => x.hit.length);

/** The first start (15-minute steps from `from` minutes) on `day` where `d` clashes with nobody. */
export function freeStart(
  d: { id?: string; day: number; durationMin: number },
  base: readonly Slot[],
  fromMin: number,
  lastMin = 21 * 60 + 30,
): number | null {
  for (let m = fromMin; m <= lastMin; m += 15) {
    const probe = { id: d.id, start: tsOf(d.day, m), durationMin: d.durationMin };
    if (!clashWith(probe, base).length) return m;
  }
  return null;
}

/** Sessions on a day (moved-away ghosts excluded). */
export const onDay = <T extends Slot>(slots: readonly T[], day: number): T[] =>
  slots.filter((s) => s.status !== 'moved' && dayOfTs(s.start) === day);

/** Pending requests as dashed ghost blocks: the proposed time of a session that has not moved yet. */
export interface Ghost {
  req: RescheduleRequest;
  slot: ScheduleSlot;
  start: number;
}
export function ghostsOf(
  slots: readonly ScheduleSlot[],
  requests: readonly RescheduleRequest[],
  now: number,
): Ghost[] {
  const byKey = new Map(
    slots.filter((s) => s.status !== 'moved').map((s) => [opaqueSlotKey(s.key), s]),
  );
  const out: Ghost[] = [];
  for (const r of requests) {
    if (statusAt(r, now) !== 'pending') continue;
    const slot = byKey.get(r.slotKey);
    if (slot) out.push({ req: r, slot, start: r.toStart });
  }
  return out;
}

/* ---- builder ------------------------------------------------------------------------------------------------------ */
export interface DraftSlot {
  id: string;
  day: number;
  start: number;
  durationMin: number;
  gymId: string;
  rowId: string;
  dow: number;
}
/** The sessions a weekly pattern would create (preview + conflicts). */
export function draftSlots(rows: readonly Row[], fromDay: number, weeks: number): DraftSlot[] {
  const out: DraftSlot[] = [];
  for (let w = 0; w < weeks; w++)
    for (const r of rows) {
      const day = weekStartDay(fromDay) + w * 7 + r.dow;
      if (day < fromDay) continue;
      out.push({
        id: `draft-${r.id}:${day}`,
        day,
        start: tsOf(day, toMin(r.start)),
        durationMin: r.dur,
        gymId: r.gymId,
        rowId: r.id,
        dow: r.dow,
      });
    }
  return out.sort((a, b) => a.start - b.start);
}

/* ---- week helpers ------------------------------------------------------------------------------------------------- */
export const slotsOfWeek = <T extends Slot>(slots: readonly T[], weekStart: number): T[] =>
  slots.filter((s) => {
    const d = dayOfTs(s.start);
    return d >= weekStart && d < weekStart + 7;
  });

/** Sessions WITH the trainer in a week, moved-away ghosts not counted. Week, Roster and Client 360 read this. */
export const trainerSlotsOf = <T extends Slot>(
  clientId: string,
  slots: readonly T[],
  weekStart: number,
): T[] =>
  slotsOfWeek(slots, weekStart).filter((s) => hasClient(s, clientId) && s.status !== 'moved');
