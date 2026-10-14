import { afterEach, describe, expect, it } from 'vitest';
import { setCoachTimeZone } from '../format';
import { DAY, MIN } from '../domain/time';
import { conflictIds, draftSlots, freeStart, generateSlots, overlaps, statusAt } from './model';
import { opaqueSlotKey } from './ids';
import { dayOfTs, dowOfDay, fromMin, minOfTs, toMin, tsOf, weekStartDay } from './time';
import { keyOf } from './model';
import {
  emptyDoc,
  type PatternDoc,
  type RescheduleRequest,
  type Row,
  type ScheduleDoc,
} from './types';

afterEach(() => setCoachTimeZone('UTC'));

const D0 = Math.floor(Date.UTC(2026, 9, 5) / DAY); // Monday 5 Oct 2026
const NOW = Date.UTC(2026, 9, 7, 9, 5);
const row = (id: string, dow: number, start = '18:00', dur = 60): Row => ({
  id,
  dow,
  start,
  dur,
  gymId: 'iron-yard',
});
const pat = (rows: Row[], weeks = 14, fromDay = D0 - 35, id = 'p'): PatternDoc => ({
  id,
  fromDay,
  weeks,
  rows,
});
const doc = (clientId: string, over: Partial<ScheduleDoc> = {}): ScheduleDoc => ({
  ...emptyDoc(clientId),
  ...over,
});
const gen = (docs: ScheduleDoc[], reqs: RescheduleRequest[] = [], from = D0 - 70, to = D0 + 120) =>
  generateSlots(docs, reqs, { fromDay: from, toDay: to, now: NOW });

describe('wall clock', () => {
  it('Monday is 0 and weeks start on Monday', () => {
    expect(dowOfDay(D0)).toBe(0);
    expect(dowOfDay(D0 + 6)).toBe(6);
    expect(weekStartDay(D0 + 3)).toBe(D0);
    expect(weekStartDay(D0 - 1)).toBe(D0 - 7);
  });
  it('round-trips minutes and times', () => {
    expect(toMin('18:30')).toBe(1110);
    expect(fromMin(1110)).toBe('18:30');
    const ts = tsOf(D0 + 2, 18 * 60 + 30);
    expect(dayOfTs(ts)).toBe(D0 + 2);
    expect(minOfTs(ts)).toBe(1110);
  });
  it('keeps the wall-clock time across a DST change (Europe/Kyiv)', () => {
    setCoachTimeZone('Europe/Kyiv');
    const before = Math.floor(Date.UTC(2026, 2, 28) / DAY); // Sat 28 Mar, EET
    const after = before + 2; // Mon 30 Mar, EEST
    expect(minOfTs(tsOf(before, 18 * 60))).toBe(18 * 60);
    expect(minOfTs(tsOf(after, 18 * 60))).toBe(18 * 60);
    // the UTC distance is 47 h, not 48: the wall clock stayed put
    expect(tsOf(after, 18 * 60) - tsOf(before, 18 * 60)).toBe(2 * DAY - 60 * MIN);
  });
  it('a time that does not exist (spring gap) shifts forward; a repeated one is taken once', () => {
    setCoachTimeZone('Europe/Kyiv');
    const gap = Math.floor(Date.UTC(2026, 2, 29) / DAY); // 03:00 -> 04:00
    expect(minOfTs(tsOf(gap, 3 * 60 + 30))).toBe(4 * 60 + 30);
    const fall = Math.floor(Date.UTC(2026, 9, 25) / DAY);
    expect(minOfTs(tsOf(fall, 3 * 60 + 30))).toBe(3 * 60 + 30);
  });
});

describe('generateSlots (R-BE-CAL-1)', () => {
  it('a pattern of 14 weeks produces 14 instances per row', () => {
    const out = gen([doc('c1', { patterns: [pat([row('r1', 4)])] })]);
    expect(out).toHaveLength(14);
    expect(new Set(out.map((s) => dowOfDay(dayOfTs(s.start))))).toEqual(new Set([4]));
  });
  it('never starts before its first day', () => {
    const out = gen([doc('c1', { patterns: [pat([row('r1', 0)], 4, D0 + 2)] })]);
    expect(out.map((s) => dayOfTs(s.start))).toEqual([D0 + 7, D0 + 14, D0 + 21]);
  });
  it('derives done / planned from the clock and honours the trainer marks', () => {
    const d = doc('c1', {
      patterns: [pat([row('r1', 0), row('r2', 4)], 2, D0)],
      exceptions: [{ slotKey: keyOf('r1', D0), status: 'missed' }],
    });
    const out = gen([d]);
    const by = Object.fromEntries(out.map((s) => [s.id, s.status]));
    expect(by[keyOf('r1', D0)]).toBe('missed');
    expect(by[keyOf('r2', D0 + 4)]).toBe('planned');
    expect(gen([doc('c1', { patterns: [pat([row('r1', 0)], 2, D0)] })])[0].status).toBe('done');
  });
  it('a cancelled instance disappears, the others stay', () => {
    const d = doc('c1', {
      patterns: [pat([row('r1', 4)], 3, D0)],
      cancelled: [keyOf('r1', D0 + 4)],
    });
    expect(gen([d])).toHaveLength(2);
  });
  it('a one-off is one session', () => {
    const d = doc('c5', {
      oneOffs: [{ id: 'o1', day: D0 + 3, start: '17:00', dur: 45, gymId: 'iron-yard', note: 'x' }],
    });
    const [s] = gen([d]);
    expect(s).toMatchObject({
      clientId: 'c5',
      durationMin: 45,
      oneOff: true,
      note: 'x',
      kind: 'solo',
    });
  });
  it('merges the attendees of a shared session into one slot', () => {
    const share = { groupId: 'g', kind: 'group' as const, title: 'Mobility', capacity: 8 };
    const mk = (id: string) =>
      doc(id, { patterns: [{ ...pat([row('rm', 3, '12:00', 45)], 2, D0), share }] });
    const out = gen([mk('c2'), mk('c5'), mk('c10')]);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ kind: 'group', title: 'Mobility', capacity: 8 });
    expect(out[0].attendees.map((a) => a.clientId).sort()).toEqual(['c10', 'c2', 'c5']);
  });
});

const baseDoc = () => doc('c1', { patterns: [pat([row('r1', 4)], 4, D0)] });
const reqFor = (over: Partial<RescheduleRequest> = {}): RescheduleRequest => ({
  id: 'rq',
  clientId: 'c1',
  from: 'client',
  slotKey: opaqueSlotKey(keyOf('r1', D0 + 4)),
  fromStart: tsOf(D0 + 4, 18 * 60),
  toStart: tsOf(D0 + 5, 10 * 60),
  status: 'pending',
  createdAt: NOW - HOURS(1),
  expiresAt: NOW + HOURS(30),
  scope: 'all',
  ...over,
});
function HOURS(n: number) {
  return n * 60 * MIN;
}

describe('requests change the effective schedule (R-BE-CAL-5/6)', () => {
  it('a pending move keeps the session where it was and carries the proposal', () => {
    const out = gen([baseDoc()], [reqFor()]);
    const s = out.find((x) => x.id === keyOf('r1', D0 + 4))!;
    expect(s.status).toBe('pending-move');
    expect(s.start).toBe(tsOf(D0 + 4, 18 * 60));
    expect(s.move).toMatchObject({ reqId: 'rq', from: 'client', start: tsOf(D0 + 5, 10 * 60) });
  });
  it('accepting moves exactly that block and leaves a "moved" mark at the old time', () => {
    const out = gen([baseDoc()], [reqFor({ status: 'accepted', decidedAt: NOW })]);
    const moved = out.find((x) => x.id === keyOf('r1', D0 + 4))!;
    expect(moved.start).toBe(tsOf(D0 + 5, 10 * 60));
    expect(moved.justMoved).toBe(true);
    expect(out.filter((x) => x.status === 'moved')).toHaveLength(1);
    expect(out.filter((x) => x.status !== 'moved')).toHaveLength(4);
  });
  it('declined, cancelled and expired change nothing', () => {
    for (const status of ['declined', 'cancelled', 'countered'] as const) {
      const s = gen([baseDoc()], [reqFor({ status })]).find((x) => x.id === keyOf('r1', D0 + 4))!;
      expect(s.status).toBe('planned');
      expect(s.start).toBe(tsOf(D0 + 4, 18 * 60));
    }
    const expired = reqFor({ expiresAt: NOW - 1 });
    expect(statusAt(expired, NOW)).toBe('expired');
    expect(gen([baseDoc()], [expired]).find((x) => x.id === keyOf('r1', D0 + 4))!.status).toBe(
      'planned',
    );
  });
  it('a whole-session move happens only when every attendee confirmed; "keep on old time" splits one off', () => {
    const share = { groupId: 'g', kind: 'group' as const, title: 'Mobility', capacity: 8 };
    const mk = (id: string, extra: Partial<ScheduleDoc> = {}) =>
      doc(id, { patterns: [{ ...pat([row('rm', 3, '12:00', 45)], 2, D0), share }], ...extra });
    const key = keyOf('rm', D0 + 3);
    const rq = (cid: string, status: RescheduleRequest['status']): RescheduleRequest =>
      reqFor({
        id: `q-${cid}`,
        clientId: cid,
        from: 'trainer',
        slotKey: opaqueSlotKey(key),
        fromStart: tsOf(D0 + 3, 12 * 60),
        toStart: tsOf(D0 + 4, 12 * 60),
        status,
        decidedAt: NOW,
        groupKey: 'gk',
      });
    const docs = [mk('c2'), mk('c5'), mk('c10')];
    const some = gen(docs, [rq('c2', 'accepted'), rq('c5', 'accepted'), rq('c10', 'pending')]);
    expect(some.find((s) => s.id === key)!.start).toBe(tsOf(D0 + 3, 12 * 60));
    const all = gen(docs, [rq('c2', 'accepted'), rq('c5', 'accepted'), rq('c10', 'accepted')]);
    expect(all.find((s) => s.id === key)!.start).toBe(tsOf(D0 + 4, 12 * 60));
    // c10 declined and the trainer kept c10 on the old time: the others move, c10 stays as its own session
    const kept = [
      mk('c2'),
      mk('c5'),
      mk('c10', { exceptions: [{ slotKey: key, status: 'kept' }] }),
    ];
    const split = gen(kept, [rq('c2', 'accepted'), rq('c5', 'accepted'), rq('c10', 'declined')]);
    const moved = split.find((s) => s.id === key)!;
    expect(moved.attendees.map((a) => a.clientId).sort()).toEqual(['c2', 'c5']);
    expect(moved.start).toBe(tsOf(D0 + 4, 12 * 60));
    const stay = split.find((s) => s.id === `${key}~stay~c10`)!;
    expect(stay.start).toBe(tsOf(D0 + 3, 12 * 60));
    expect(stay.kind).toBe('solo');
  });
  it('moving ONE person splits them off into their own session', () => {
    const share = { groupId: 'g', kind: 'split' as const };
    const mk = (id: string) =>
      doc(id, {
        oneOffs: [{ id: 'o', day: D0 + 3, start: '15:30', dur: 60, gymId: 'iron-yard', share }],
      });
    const key = keyOf('o', D0 + 3);
    const out = gen(
      [mk('c6'), mk('c11')],
      [
        reqFor({
          clientId: 'c6',
          slotKey: opaqueSlotKey(key),
          scope: 'one',
          status: 'accepted',
          decidedAt: NOW,
          toStart: tsOf(D0 + 5, 9 * 60),
        }),
      ],
    );
    expect(out.find((s) => s.id === key)!.attendees.map((a) => a.clientId)).toEqual(['c11']);
    const own = out.find((s) => s.id === `${key}~c6`)!;
    expect(own).toMatchObject({ clientId: 'c6', kind: 'solo' });
    expect(own.start).toBe(tsOf(D0 + 5, 9 * 60));
  });
});

describe('conflicts (R-BE-CAL-2)', () => {
  const at = (id: string, h: number, m: number, dur = 60) => ({
    id,
    clientId: id,
    kind: 'solo' as const,
    attendees: [],
    start: tsOf(D0 + 1, h * 60 + m),
    durationMin: dur,
    gymId: 'g',
    status: 'planned' as const,
  });
  it('overlap table: touching is not a clash', () => {
    const a = at('a', 18, 0);
    expect(overlaps(a, at('b', 19, 0))).toBe(false); // back to back
    expect(overlaps(a, at('b', 18, 59))).toBe(true);
    expect(overlaps(a, at('b', 17, 0))).toBe(false);
    expect(overlaps(a, at('b', 17, 1))).toBe(true);
    expect(overlaps(a, at('b', 18, 15, 15))).toBe(true); // contained
  });
  it('flags both sessions, ignores done / moved ones', () => {
    const list = [
      at('a', 18, 0),
      at('b', 18, 30),
      at('c', 19, 30),
      { ...at('d', 18, 0), status: 'done' as const },
    ];
    expect([...conflictIds(list)].sort()).toEqual(['a', 'b']);
  });
  it('finds the first free start', () => {
    const base = [at('a', 18, 0), at('b', 19, 0)];
    const m = freeStart({ day: D0 + 1, durationMin: 60 }, base, 18 * 60);
    expect(m).toBe(20 * 60);
  });
});

describe('builder preview', () => {
  it('expands rows over weeks from the start day', () => {
    const out = draftSlots([row('a', 0), row('b', 3)], D0 + 2, 3);
    expect(out.map((x) => x.day)).toEqual([D0 + 3, D0 + 7, D0 + 10, D0 + 14, D0 + 17]);
  });
});
