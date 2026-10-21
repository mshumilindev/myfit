import { describe, expect, it } from 'vitest';
import { DAY } from '../domain/time';
import { opaqueSlotKey } from './ids';
import { keyOf } from './model';
import { tsOf } from './time';
import { emptyDoc, type RescheduleRequest, type ScheduleSlot } from './types';
import { hourRange, openRequestsOf, placeBlocks, requestsOf, slotOfRequest, toneOf } from './view';

const D0 = Math.floor(Date.UTC(2026, 9, 5) / DAY);
const NOW = Date.UTC(2026, 9, 7, 9, 5);
const box = (s: number, e: number) => ({ start: tsOf(D0, s), end: tsOf(D0, e), id: `${s}-${e}` });
const place = (items: ReturnType<typeof box>[], from = 7 * 60, to = 21 * 60) =>
  placeBlocks(items, (b) => b, from, to);
const sl = (over: Partial<ScheduleSlot>): ScheduleSlot =>
  ({
    id: 's',
    key: 'r:1',
    clientId: 'c1',
    kind: 'solo',
    attendees: [],
    start: tsOf(D0, 600),
    durationMin: 60,
    gymId: 'g',
    status: 'planned',
    ...over,
  }) as ScheduleSlot;

describe('placeBlocks', () => {
  it('a lone block is its own cluster with full width and fractional position', () => {
    const [p] = place([box(9 * 60, 10 * 60)]);
    expect(p).toMatchObject({ lane: 0, lanes: 1, span: 1, cluster: 0, first: false, size: 1 });
    expect(p.top).toBeCloseTo(2 / 14);
    expect(p.height).toBeCloseTo(1 / 14);
  });

  it('blocks that only touch are separate clusters', () => {
    const out = place([box(540, 600), box(600, 660)]);
    expect(out.map((o) => [o.cluster, o.lanes, o.first])).toEqual([
      [0, 1, false],
      [1, 1, false],
    ]);
  });

  it('overlapping blocks take lanes; the earliest of the cluster is marked first; width is shared', () => {
    const out = place([box(540, 660), box(570, 630)]);
    expect(out.map((o) => [o.lane, o.lanes, o.first, o.size])).toEqual([
      [0, 2, true, 2],
      [1, 2, false, 2],
    ]);
  });

  it('a block grows right into columns that are free for its whole length', () => {
    // A 9:00-12:00, B 9:00-10:00, C 10:30-11:30: B and C share lane 1, A is in lane 0; with three columns B may span two
    const out = place([box(540, 720), box(540, 600), box(540, 660), box(630, 690)]);
    const byId = Object.fromEntries(out.map((o) => [o.item.id, o]));
    expect(byId['540-720'].lanes).toBe(3);
    // the 9-11 block (lane 2) is blocked on its right by nobody and has no more columns
    expect(byId['540-660'].span).toBe(1);
    // 10:30-11:30 sits in lane 1 and can grow into lane 2 only if the 9-11 block (lane 2) ended: it did not
    expect(byId['630-690'].span).toBe(1);
    // the 9-10 block can grow into lane 2? lane 2 is taken during 9-11: blocked
    expect(byId['540-600'].span).toBe(1);
  });

  it('a block grows right into a column that is free for its whole length, not into a busy one', () => {
    const out = place([box(540, 720), box(550, 600), box(555, 580), box(610, 700)]);
    const by = Object.fromEntries(out.map((o) => [o.item.id, o]));
    expect(out.every((o) => o.lanes === 3 && o.size === 4)).toBe(true);
    expect(by['540-720']).toMatchObject({ lane: 0, span: 1 }); // lane 1 is busy 9:10-10:00
    expect(by['550-600']).toMatchObject({ lane: 1, span: 1 }); // lane 2 is busy 9:15-9:40
    expect(by['555-580']).toMatchObject({ lane: 2, span: 1 });
    expect(by['610-700']).toMatchObject({ lane: 1, span: 2 }); // lane 2 is free after 9:40
  });

  it('a block that ends at midnight is as tall as the rest of the day; a block shorter than 15 minutes gets 15 minutes', () => {
    const [late] = place([{ start: tsOf(D0, 20 * 60), end: tsOf(D0 + 1, 0), id: 'late' }]);
    expect(late.height).toBeCloseTo(1 / 14);
    const [tiny] = place([box(9 * 60, 9 * 60 + 5)]);
    expect(tiny.height).toBeCloseTo(15 / (14 * 60));
  });

  it('a block above the visible range starts at 0, one below is clamped to the range; height never reaches zero', () => {
    const [early] = place([box(6 * 60, 8 * 60)]);
    expect(early.top).toBe(0);
    expect(early.height).toBeCloseTo(60 / (14 * 60));
    const [outside] = place([box(22 * 60, 23 * 60)]);
    expect(outside.height).toBe(0.01);
  });

  it('empty input and unsorted input', () => {
    expect(place([])).toEqual([]);
    const out = place([box(600, 660), box(540, 570)]);
    expect(out.map((o) => o.item.id)).toEqual(['540-570', '600-660']);
  });
});

describe('hourRange', () => {
  it('defaults to 07:00-21:00', () => {
    expect(hourRange([])).toEqual({ from: 420, to: 1260 });
  });

  it('widens to whole hours around sessions outside it', () => {
    const r = hourRange([
      sl({ start: tsOf(D0, 6 * 60 + 30), durationMin: 30 }),
      sl({ start: tsOf(D0, 21 * 60 + 30), durationMin: 45 }),
    ]);
    expect(r).toEqual({ from: 360, to: 23 * 60 });
  });

  it('a session ending exactly at midnight extends the range to 24:00', () => {
    expect(hourRange([sl({ start: tsOf(D0, 23 * 60), durationMin: 60 })]).to).toBe(24 * 60);
  });

  it('extra instants (ghosts) also widen it by their hour', () => {
    expect(hourRange([], [tsOf(D0, 5 * 60 + 10), tsOf(D0, 22 * 60 + 10)])).toEqual({
      from: 300,
      to: 23 * 60 + 60,
    });
  });
});

describe('toneOf', () => {
  it('a clash wins over every status; done is ok, missed is danger, moved is neutral, the rest accent', () => {
    expect(toneOf(sl({ status: 'done' }), true)).toBe('danger');
    expect(toneOf(sl({ status: 'done' }), false)).toBe('ok');
    expect(toneOf(sl({ status: 'missed' }), false)).toBe('danger');
    expect(toneOf(sl({ status: 'moved' }), false)).toBe('neutral');
    expect(toneOf(sl({ status: 'planned' }), false)).toBe('accent');
    expect(toneOf(sl({ status: 'pending-move' }), false)).toBe('accent');
  });
});

describe('requests of a session', () => {
  const s = sl({ key: 'r1:20000' });
  const mk = (
    id: string,
    slotKey: string,
    over: Partial<RescheduleRequest> = {},
  ): RescheduleRequest => ({
    id,
    clientId: 'c1',
    from: 'trainer',
    slotKey,
    fromStart: 0,
    toStart: 0,
    status: 'pending',
    createdAt: 0,
    expiresAt: NOW + DAY,
    scope: 'all',
    ...over,
  });
  const reqs = [
    mk('a', opaqueSlotKey('r1:20000')),
    mk('b', opaqueSlotKey('r1:20000'), { status: 'declined' }),
    mk('c', opaqueSlotKey('r1:20000'), { expiresAt: NOW }),
    mk('d', opaqueSlotKey('r2:20000')),
  ];
  it('requestsOf matches the opaque key in any status', () => {
    expect(requestsOf(s, reqs).map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });
  it('openRequestsOf keeps only the pending ones that have not expired at now', () => {
    expect(openRequestsOf(s, reqs, NOW).map((r) => r.id)).toEqual(['a']);
  });
});

describe('slotOfRequest', () => {
  const key = keyOf('r1', D0 + 4);
  const doc = {
    ...emptyDoc('c1'),
    patterns: [
      {
        id: 'p',
        fromDay: D0,
        weeks: 2,
        rows: [{ id: 'r1', dow: 4, start: '18:00', dur: 60, gymId: 'g' }],
      },
    ],
  };
  const from = tsOf(D0 + 4, 18 * 60);
  const base: RescheduleRequest = {
    id: 'q',
    clientId: 'c1',
    from: 'trainer',
    slotKey: opaqueSlotKey(key),
    fromStart: from,
    toStart: tsOf(D0 + 5, 9 * 60),
    status: 'pending',
    createdAt: NOW,
    expiresAt: NOW + DAY,
    scope: 'all',
  };

  it('finds the instance on the day the request was made for', () => {
    expect(slotOfRequest([doc], [base], base, NOW)?.id).toBe(key);
  });

  it('after an accepted move the live session wins over the "moved" ghost at the old time', () => {
    const acc = { ...base, status: 'accepted' as const, decidedAt: NOW };
    const s = slotOfRequest([doc], [acc], acc, NOW)!;
    expect(s.id).toBe(key);
    expect(s.status).not.toBe('moved');
    expect(s.start).toBe(acc.toStart);
  });

  it('a session moved for its only attendee (scope one) no longer exists at the old key', () => {
    const acc = { ...base, status: 'accepted' as const, scope: 'one' as const, decidedAt: NOW };
    expect(slotOfRequest([doc], [acc], acc, NOW)).toBeUndefined();
  });

  it('a request for a session that does not exist yields undefined', () => {
    expect(slotOfRequest([doc], [], { ...base, slotKey: 'sk_nothing' }, NOW)).toBeUndefined();
    expect(slotOfRequest([], [], base, NOW)).toBeUndefined();
  });
});
