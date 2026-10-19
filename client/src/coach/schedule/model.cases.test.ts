/** Schedule engine: accepted moves (one person / whole session / kept person), ghosts, clashes, week helpers. UTC zone, fixed clock. */
import { afterEach, describe, expect, it } from 'vitest';
import { setCoachTimeZone } from '../format';
import { DAY, MIN } from '../domain/time';
import type { Slot } from '../domain/types';
import {
  attendeeClashes,
  attendeesOf,
  clashWith,
  clientClashes,
  conflictIds,
  draftSlots,
  endOf,
  freeStart,
  generateSlots,
  ghostsOf,
  hasClient,
  keyOf,
  onDay,
  overlaps,
  peopleOf,
  slotsOfWeek,
  statusAt,
  trainerSlotsOf,
} from './model';
import { opaqueSlotKey } from './ids';
import { dayOfTs, minOfTs, tsOf } from './time';
import {
  emptyDoc,
  type PatternDoc,
  type RescheduleRequest,
  type Row,
  type ScheduleDoc,
} from './types';

afterEach(() => setCoachTimeZone('UTC'));

const D0 = Math.floor(Date.UTC(2026, 9, 5) / DAY); // Monday 5 Oct 2026
const NOW = Date.UTC(2026, 9, 7, 9, 5); // Wed 09:05
const row = (id: string, dow: number, start = '18:00', dur = 60): Row => ({
  id,
  dow,
  start,
  dur,
  gymId: 'gym-a',
});
const pat = (
  rows: Row[],
  weeks = 4,
  fromDay = D0,
  extra: Partial<PatternDoc> = {},
): PatternDoc => ({
  id: 'p',
  fromDay,
  weeks,
  rows,
  ...extra,
});
const doc = (clientId: string, over: Partial<ScheduleDoc> = {}): ScheduleDoc => ({
  ...emptyDoc(clientId),
  ...over,
});
const gen = (docs: ScheduleDoc[], reqs: RescheduleRequest[] = [], from = D0, to = D0 + 60) =>
  generateSlots(docs, reqs, { fromDay: from, toDay: to, now: NOW });
const req = (
  over: Partial<RescheduleRequest> & Pick<RescheduleRequest, 'slotKey' | 'clientId'>,
): RescheduleRequest => ({
  id: `q-${over.clientId}`,
  from: 'trainer',
  fromStart: 0,
  toStart: 0,
  status: 'pending',
  createdAt: NOW - DAY,
  expiresAt: NOW + DAY,
  scope: 'all',
  ...over,
});
const slot = (id: string, start: number, durationMin = 60, over: Partial<Slot> = {}): Slot => ({
  id,
  clientId: 'c1',
  kind: 'solo',
  attendees: [],
  start,
  durationMin,
  gymId: 'g',
  status: 'planned',
  ...over,
});
const T = (day: number, hhmm: number) => tsOf(day, hhmm);

describe('basic geometry', () => {
  it('touching blocks do not overlap, one minute of overlap does', () => {
    const a = { start: 0, durationMin: 60 };
    expect(endOf(a)).toBe(60 * MIN);
    expect(overlaps(a, { start: 60 * MIN, durationMin: 30 })).toBe(false);
    expect(overlaps(a, { start: 60 * MIN - 1, durationMin: 30 })).toBe(true);
  });

  it('a slot without attendees counts its own client; a declined attendee is not "still in"', () => {
    const solo = slot('a', 0);
    expect(attendeesOf(solo)).toEqual([{ clientId: 'c1', status: 'planned' }]);
    expect(hasClient(solo, 'c1')).toBe(true);
    expect(hasClient(solo, 'c2')).toBe(false);
    const g = slot('g', 0, 60, {
      attendees: [
        { clientId: 'c1', status: 'planned' },
        { clientId: 'c2', status: 'declined' },
        { clientId: 'c3', status: 'planned' },
      ],
    });
    expect(peopleOf(g)).toEqual(['c1', 'c3']);
    expect(hasClient(g, 'c2')).toBe(true);
  });

  it('statusAt expires only pending requests that are due (boundary inclusive)', () => {
    const r = req({ slotKey: 'k', clientId: 'c1', expiresAt: NOW });
    expect(statusAt(r, NOW - 1)).toBe('pending');
    expect(statusAt(r, NOW)).toBe('expired');
    expect(statusAt({ ...r, status: 'accepted' }, NOW + DAY)).toBe('accepted');
  });
});

describe('generateSlots window and clock', () => {
  it('only the window is produced', () => {
    const d = doc('c1', { patterns: [pat([row('r1', 0)], 6)] });
    const out = gen([d], [], D0 + 7, D0 + 14);
    expect(out.map((s) => dayOfTs(s.start))).toEqual([D0 + 7, D0 + 14]);
    expect(gen([d], [], D0 + 100, D0 + 200)).toEqual([]);
  });

  it('a session that ended before now is done, one still running is planned (boundary: ends exactly at now = planned)', () => {
    // Wed 08:05-09:05 ends exactly at NOW
    const d = doc('c1', {
      oneOffs: [
        { id: 'a', day: D0 + 2, start: '08:05', dur: 60, gymId: 'g' },
        { id: 'b', day: D0 + 2, start: '08:04', dur: 60, gymId: 'g' },
      ],
    });
    const by = Object.fromEntries(gen([d]).map((s) => [s.id, s.status]));
    expect(by[keyOf('a', D0 + 2)]).toBe('planned');
    expect(by[keyOf('b', D0 + 2)]).toBe('done');
  });

  it('a pattern row dated before the pattern start is skipped (mid-week start)', () => {
    const d = doc('c1', { patterns: [pat([row('r1', 0), row('r2', 4)], 1, D0 + 2)] });
    expect(gen([d]).map((s) => s.id)).toEqual([keyOf('r2', D0 + 4)]);
  });

  it('a cancelled one-off disappears', () => {
    const d = doc('c1', {
      oneOffs: [{ id: 'o', day: D0 + 3, start: '10:00', dur: 30, gymId: 'g' }],
      cancelled: [keyOf('o', D0 + 3)],
    });
    expect(gen([d])).toEqual([]);
  });

  it('the output is ordered by start, ties by id', () => {
    const d = doc('c1', {
      oneOffs: [
        { id: 'z', day: D0 + 3, start: '10:00', dur: 30, gymId: 'g' },
        { id: 'a', day: D0 + 3, start: '10:00', dur: 30, gymId: 'g' },
        { id: 'm', day: D0 + 2, start: '23:00', dur: 30, gymId: 'g' },
      ],
    });
    expect(gen([d]).map((s) => s.id)).toEqual([
      keyOf('m', D0 + 2),
      keyOf('a', D0 + 3),
      keyOf('z', D0 + 3),
    ]);
  });

  it("a session everybody missed is missed; when the attendees disagree the first one's status is the session status", () => {
    const share = { groupId: 'g', kind: 'split' as const };
    const mk = (id: string, mark?: 'missed') =>
      doc(id, {
        patterns: [pat([row('rs', 4, '09:00')], 1, D0, { share })],
        exceptions: mark ? [{ slotKey: keyOf('rs', D0 + 4), status: mark }] : [],
      });
    expect(gen([mk('c1', 'missed'), mk('c2', 'missed')])[0].status).toBe('missed');
    const mixed = gen([mk('c2'), mk('c1', 'missed')]);
    expect(mixed[0].status).toBe('planned');
    expect(mixed[0].kind).toBe('split');
    expect(mixed[0].attendees.map((a) => a.status).sort()).toEqual(['missed', 'planned']);
  });
});

describe('accepted requests move sessions', () => {
  const solo = doc('c1', { patterns: [pat([row('r1', 4, '18:00')], 2)] });
  const key = keyOf('r1', D0 + 4);
  const sk = opaqueSlotKey(key);
  const from = T(D0 + 4, 18 * 60);

  it('a solo session moved for its only attendee leaves a "was" ghost and a new session (scope one)', () => {
    const to = T(D0 + 5, 10 * 60);
    const out = gen(
      [solo],
      [
        req({
          slotKey: sk,
          clientId: 'c1',
          status: 'accepted',
          scope: 'one',
          fromStart: from,
          toStart: to,
          decidedAt: NOW - 1000,
        }),
      ],
    );
    const moved = out.find((s) => s.id === `${key}~c1`)!;
    expect(moved.start).toBe(to);
    expect(moved.justMoved).toBe(true);
    expect(moved.status).toBe('planned');
    // the original instance is gone (no empty shell) and no phantom for scope one
    expect(out.some((s) => s.id === key)).toBe(false);
  });

  it('a move into the past is done; a move that decided long ago is not "just moved"', () => {
    const to = T(D0 + 1, 10 * 60);
    const out = gen(
      [solo],
      [
        req({
          slotKey: sk,
          clientId: 'c1',
          status: 'accepted',
          scope: 'one',
          fromStart: from,
          toStart: to,
          decidedAt: NOW - 4 * DAY,
        }),
      ],
    );
    const moved = out.find((s) => s.id === `${key}~c1`)!;
    expect(moved.status).toBe('done');
    expect(moved.justMoved).toBe(false);
  });

  it('a request moved outside the window drops the session from the window; a request for an unknown or another person is ignored', () => {
    const far = T(D0 + 300, 600);
    const out = gen(
      [solo],
      [req({ slotKey: sk, clientId: 'c1', status: 'accepted', scope: 'one', toStart: far })],
    );
    expect(out.some((s) => s.id.startsWith(key))).toBe(false);
    const ignored = gen(
      [solo],
      [
        req({
          id: 'u',
          slotKey: 'sk_unknown',
          clientId: 'c1',
          status: 'accepted',
          scope: 'one',
          toStart: far,
        }),
        req({
          id: 'o',
          slotKey: sk,
          clientId: 'nobody',
          status: 'accepted',
          scope: 'one',
          toStart: far,
        }),
      ],
    );
    expect(ignored.find((s) => s.id === key)).toBeDefined();
  });

  it('a whole-session move of a solo session moves it and leaves the old time as a "moved" ghost pointing at the new one', () => {
    const to = T(D0 + 5, 9 * 60);
    const out = gen(
      [solo],
      [
        req({
          slotKey: sk,
          clientId: 'c1',
          status: 'accepted',
          scope: 'all',
          fromStart: from,
          toStart: to,
          decidedAt: NOW,
        }),
      ],
    );
    const live = out.find((s) => s.id === key && s.status !== 'moved')!;
    expect(live.start).toBe(to);
    const was = out.find((s) => s.id === `${key}~was`)!;
    expect(was).toMatchObject({ status: 'moved', start: from, movedTo: to });
    expect(onDay(out, D0 + 4)).toEqual([]);
    expect(trainerSlotsOf('c1', out, D0)).toContain(live);
    expect(trainerSlotsOf('c1', out, D0)).not.toContain(was);
  });

  it('a ghost outside the window is not produced', () => {
    const to = T(D0 + 5, 9 * 60);
    const out = gen(
      [solo],
      [req({ slotKey: sk, clientId: 'c1', status: 'accepted', scope: 'all', toStart: to })],
      D0 + 5,
      D0 + 6,
    );
    expect(out.some((s) => s.id.endsWith('~was'))).toBe(false);
  });

  describe('group moves', () => {
    const share = { groupId: 'g', kind: 'group' as const, title: 'Mobility' };
    const mk = (id: string, extra: Partial<ScheduleDoc> = {}) =>
      doc(id, { patterns: [pat([row('rg', 4, '12:00', 45)], 1, D0, { share })], ...extra });
    const gkey = keyOf('rg', D0 + 4);
    const gsk = opaqueSlotKey(gkey);
    const to = T(D0 + 6, 11 * 60);
    const r = (clientId: string, status: RescheduleRequest['status']) =>
      req({
        id: `q-${clientId}`,
        slotKey: gsk,
        clientId,
        status,
        scope: 'all',
        groupKey: 'gk',
        toStart: to,
        decidedAt: NOW,
      });

    it('the session moves only when every asked person has accepted', () => {
      const out = gen([mk('c1'), mk('c2')], [r('c1', 'accepted'), r('c2', 'pending')]);
      const s = out.find((x) => x.id === gkey)!;
      expect(s.start).toBe(T(D0 + 4, 12 * 60));
      expect(s.status).toBe('pending-move');
      expect(s.move).toMatchObject({ reqId: 'q-c2', start: to });
      expect(s.attendees.find((a) => a.clientId === 'c2')!.status).toBe('pending-move');
    });

    it('when all accepted it moves for everybody; a kept person stays on the old time as their own session and is not asked', () => {
      const keep = { slotKey: gkey, status: 'kept' as const };
      const out = gen(
        [mk('c1'), mk('c2'), mk('c3', { exceptions: [keep] })],
        [r('c1', 'accepted'), r('c2', 'accepted'), r('c3', 'pending')],
      );
      const moved = out.find((x) => x.id === gkey && x.status !== 'moved')!;
      expect(moved.start).toBe(to);
      expect(moved.attendees.map((a) => a.clientId).sort()).toEqual(['c1', 'c2']);
      const stay = out.find((x) => x.id === `${gkey}~stay~c3`)!;
      expect(stay.start).toBe(T(D0 + 4, 12 * 60));
      expect(stay.attendees.map((a) => a.clientId)).toEqual(['c3']);
      expect(stay.kind).toBe('solo');
      expect(out.find((x) => x.id === `${gkey}~was`)).toMatchObject({
        status: 'moved',
        movedTo: to,
      });
    });

    it('a group request with nobody left to ask (everyone kept) does not move anything', () => {
      const keep = { slotKey: gkey, status: 'kept' as const };
      const out = gen([mk('c1', { exceptions: [keep] })], [r('c1', 'accepted')]);
      expect(out.find((x) => x.id === gkey)!.start).toBe(T(D0 + 4, 12 * 60));
    });

    it('accepted requests apply oldest decision first (the later one wins)', () => {
      const t1 = T(D0 + 5, 8 * 60);
      const t2 = T(D0 + 6, 8 * 60);
      const out = gen(
        [solo],
        [
          req({
            id: 'b',
            slotKey: sk,
            clientId: 'c1',
            status: 'accepted',
            scope: 'all',
            toStart: t2,
            decidedAt: 20,
          }),
          req({
            id: 'a',
            slotKey: sk,
            clientId: 'c1',
            status: 'accepted',
            scope: 'all',
            toStart: t1,
            decidedAt: 10,
          }),
        ],
      );
      expect(out.find((s) => s.id === key && s.status !== 'moved')!.start).toBe(t2);
    });
  });

  it('pending requests mark the person, an expired one changes nothing, a solo pending carries the proposal', () => {
    const to = T(D0 + 5, 9 * 60);
    const pend = req({
      slotKey: sk,
      clientId: 'c1',
      scope: 'one',
      fromStart: from,
      toStart: to,
      note: 'gym busy',
    });
    const out = gen([solo], [pend]);
    const s = out.find((x) => x.id === key)!;
    expect(s.status).toBe('pending-move');
    expect(s.move).toEqual({ reqId: pend.id, from: 'trainer', start: to, note: 'gym busy' });
    const expired = gen([solo], [{ ...pend, expiresAt: NOW }]);
    expect(expired.find((x) => x.id === key)!.status).toBe('planned');
    expect(expired.find((x) => x.id === key)!.move).toBeUndefined();
  });
});

describe('ghostsOf', () => {
  it('lists open requests of live sessions at their proposed time, not expired, not of moved-away ghosts', () => {
    const d = doc('c1', { patterns: [pat([row('r1', 4)], 2)] });
    const key = keyOf('r1', D0 + 4);
    const sk = opaqueSlotKey(key);
    const slots = gen([d]);
    const open = req({ slotKey: sk, clientId: 'c1', toStart: 777 });
    const g = ghostsOf(
      slots,
      [
        open,
        req({ id: 'x', slotKey: sk, clientId: 'c1', expiresAt: NOW - 1, toStart: 1 }),
        req({ id: 'y', slotKey: 'sk_none', clientId: 'c1' }),
        req({ id: 'z', slotKey: sk, clientId: 'c1', status: 'declined' }),
      ],
      NOW,
    );
    expect(g).toHaveLength(1);
    expect(g[0]).toMatchObject({ start: 777 });
    expect(g[0].slot.id).toBe(key);
    const movedAway = slots.map((s) => (s.id === key ? { ...s, status: 'moved' as const } : s));
    expect(ghostsOf(movedAway, [open], NOW)).toEqual([]);
  });
});

describe('conflicts', () => {
  const a = slot('a', T(D0, 600), 60);
  const b = slot('b', T(D0, 630), 60);
  const c = slot('c', T(D0, 660), 60); // touches b? b ends 690 > 660: overlaps b; a ends 660 touches c
  it('conflictIds marks only overlapping planned / pending sessions; touching is fine; done / missed are ignored', () => {
    expect([...conflictIds([a, b, c])].sort()).toEqual(['a', 'b', 'c']);
    expect([...conflictIds([a, slot('t', T(D0, 660))])]).toEqual([]);
    expect([...conflictIds([a, { ...b, status: 'done' }])]).toEqual([]);
    expect([...conflictIds([a, { ...b, status: 'pending-move' }])].sort()).toEqual(['a', 'b']);
    expect([...conflictIds([])]).toEqual([]);
  });

  it('clashWith excludes itself and inactive sessions', () => {
    expect(clashWith(a, [a, b, { ...c, status: 'missed' }]).map((s) => s.id)).toEqual(['b']);
    expect(clashWith({ start: a.start, durationMin: 5 }, [a]).map((s) => s.id)).toEqual(['a']);
  });

  it('clientClashes reports a person booked into two overlapping sessions, once per pair', () => {
    const x = slot('x', T(D0, 600), 60, {
      attendees: [
        { clientId: 'c1', status: 'planned' },
        { clientId: 'c2', status: 'planned' },
      ],
    });
    const y = slot('y', T(D0, 630), 60, {
      clientId: 'c2',
      attendees: [{ clientId: 'c2', status: 'planned' }],
    });
    const z = slot('z', T(D0, 640), 30, {
      clientId: 'c9',
      attendees: [{ clientId: 'c9', status: 'planned' }],
    });
    const out = clientClashes([x, y, z]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ clientId: 'c2' });
    expect(out[0].a.id).toBe('x');
    expect(out[0].b.id).toBe('y');
    expect(clientClashes([x, { ...y, status: 'done' }])).toEqual([]);
  });

  it('attendeeClashes lists, per attendee, who is booked elsewhere at that time', () => {
    const x = slot('x', T(D0, 600), 60, {
      attendees: [
        { clientId: 'c1', status: 'planned' },
        { clientId: 'c2', status: 'planned' },
      ],
    });
    const y = slot('y', T(D0, 630), 60, {
      clientId: 'c2',
      attendees: [{ clientId: 'c2', status: 'planned' }],
    });
    const res = attendeeClashes(x, [x, y]);
    expect(res).toHaveLength(1);
    expect(res[0].clientId).toBe('c2');
    expect(res[0].hit.map((s) => s.id)).toEqual(['y']);
    expect(attendeeClashes(x, [x])).toEqual([]);
  });

  it('freeStart steps in 15 minutes to the first clash-free start, or null when the day is full', () => {
    const busy = slot('busy', T(D0, 9 * 60), 60);
    expect(freeStart({ day: D0, durationMin: 60 }, [busy], 9 * 60)).toBe(10 * 60);
    expect(freeStart({ day: D0, durationMin: 60 }, [busy], 8 * 60)).toBe(8 * 60);
    expect(freeStart({ day: D0, durationMin: 60 }, [busy], 8 * 60 + 15)).toBe(10 * 60);
    expect(freeStart({ id: 'busy', day: D0, durationMin: 60 }, [busy], 9 * 60)).toBe(9 * 60);
    const wall = slot('wall', T(D0, 0), 24 * 60);
    expect(freeStart({ day: D0, durationMin: 30 }, [wall], 0, 600)).toBeNull();
  });
});

describe('day and week helpers', () => {
  const slots = [
    slot('mon', T(D0, 600)),
    slot('sun', T(D0 + 6, 600), 60, { attendees: [{ clientId: 'c2', status: 'planned' }] }),
    slot('next', T(D0 + 7, 600)),
    slot('ghost', T(D0 + 1, 600), 60, { status: 'moved' }),
  ];
  it('onDay excludes moved-away ghosts', () => {
    expect(onDay(slots, D0).map((s) => s.id)).toEqual(['mon']);
    expect(onDay(slots, D0 + 1)).toEqual([]);
  });
  it('slotsOfWeek is Monday to Sunday inclusive and excludes the next Monday', () => {
    expect(slotsOfWeek(slots, D0).map((s) => s.id)).toEqual(['mon', 'sun', 'ghost']);
  });
  it("trainerSlotsOf keeps only the client's own sessions of the week without ghosts", () => {
    expect(trainerSlotsOf('c1', slots, D0).map((s) => s.id)).toEqual(['mon']);
    expect(trainerSlotsOf('c2', slots, D0).map((s) => s.id)).toEqual(['sun']);
    expect(trainerSlotsOf('c3', slots, D0)).toEqual([]);
  });
});

describe('draftSlots', () => {
  it('previews the pattern: sorted, skips days before the start, ids are stable', () => {
    const rows = [row('r1', 4, '18:00', 60), row('r2', 0, '07:30', 45)];
    const out = draftSlots(rows, D0 + 1, 2);
    expect(out.map((d) => d.day)).toEqual([D0 + 4, D0 + 7, D0 + 11]);
    expect(out[0]).toMatchObject({
      id: `draft-r1:${D0 + 4}`,
      rowId: 'r1',
      dow: 4,
      durationMin: 60,
      gymId: 'gym-a',
    });
    expect(minOfTs(out[1].start)).toBe(7 * 60 + 30);
    expect(draftSlots([], D0, 3)).toEqual([]);
    expect(draftSlots(rows, D0, 0)).toEqual([]);
  });
});
