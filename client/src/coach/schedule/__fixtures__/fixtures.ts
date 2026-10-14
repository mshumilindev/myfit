/**
 * In-memory schedule adapter (fixtures) behind the `SchedulePort`: seeded with the lab's week (Wed 7 Oct 2026, 09:05),
 * behaves like the server contract (optimistic `rev`, requests change only their open status, idempotent ids).
 * Nothing here touches Firebase. The real adapter is `data/firestore/scheduleDocStore.ts` under the sealed adapter (`sealedPort.ts`); this one is for stories, tests and the demo build.
 * The current week matches the world fixtures (`data/fixtures.ts`): Oleh Fri 18:00 -> Sat 10:00 (rq1, asked by the
 * client), Maria Wed 18:00 -> 19:00 (rq2, asked by the trainer).
 */
import { FIXTURE_NOW, FIXTURE_WEEK_START } from '../../data/__fixtures__/fixtures';
import { DAY, HOUR, MIN } from '../../domain/time';
import { opaqueSlotKey } from '../ids';
import { keyOf } from '../model';
import { SchedulePortError, type ScheduleData, type SchedulePort, type Unsubscribe } from '../port';
import { dayOfTs, tsOf } from '../time';
import {
  emptyDoc,
  type PatternDoc,
  type RescheduleRequest,
  type Row,
  type ScheduleDoc,
  type ShareInfo,
} from '../types';

export const WEEK0 = dayOfTs(FIXTURE_WEEK_START);
export const TODAY_KEY = dayOfTs(FIXTURE_NOW);
export { FIXTURE_NOW };

const row = (
  id: string,
  dow: number,
  start: string,
  dur: number,
  gymId: string,
  dayLabel: string | null,
): Row => ({
  id,
  dow,
  start,
  dur,
  gymId,
  dayLabel,
  programDayId: dayLabel ? dayLabel.toLowerCase().replace(/ /g, '-') : null,
});
const pattern = (id: string, rows: Row[], share?: ShareInfo): PatternDoc => ({
  id,
  fromDay: WEEK0 - 5 * 7,
  weeks: 14,
  rows,
  ...(share ? { share } : {}),
});

/** The seed: [docs, requests]. Exported for stories and tests. */
export function scheduleSeed(): ScheduleData {
  const docs: Record<string, ScheduleDoc> = {};
  const doc = (id: string) => (docs[id] ??= { ...emptyDoc(id), rev: 1 });
  doc('c1').patterns.push(
    pattern('p-c1', [
      row('r-c1-tue', 1, '18:00', 60, 'iron-yard', 'Upper A'),
      row('r-c1-fri', 4, '18:00', 60, 'iron-yard', 'Upper B'),
    ]),
  );
  doc('c8').patterns.push(pattern('p-c8', [row('r-c8-tue', 1, '18:30', 60, 'fithub', 'Upper A')]));
  doc('c2').patterns.push(
    pattern('p-c2', [row('r-c2-wed', 2, '18:00', 60, 'iron-yard', 'Glute A')]),
  );
  doc('c3').patterns.push(
    pattern('p-c3', [
      row('r-c3-mon', 0, '10:00', 45, 'iron-yard', 'Rehab Upper'),
      row('r-c3-wed', 2, '10:00', 45, 'iron-yard', 'Rehab Upper'),
      row('r-c3-fri', 4, '10:00', 45, 'iron-yard', 'Rehab Upper'),
    ]),
  );
  doc('c14').patterns.push(
    pattern('p-c14', [row('r-c14-sat', 5, '09:00', 60, 'iron-yard', 'Hybrid A')]),
  );

  const oneOff = (
    cid: string,
    dow: number,
    start: string,
    dur: number,
    gymId: string,
    note: string,
    id: string,
  ) => doc(cid).oneOffs.push({ id, day: WEEK0 + dow, start, dur, gymId, note });
  oneOff('c5', 3, '17:00', 45, 'iron-yard', 'Technique check, squat', 'o-c5');
  oneOff('c4', 3, '13:30', 60, 'fithub', 'Strength test', 'o-c4');
  oneOff('c11', 4, '18:30', 60, 'iron-yard', 'Bench peaking check', 'o-c11');
  oneOff('c6', 0, '17:00', 45, 'iron-yard', '', 'o-c6');
  doc('c6').exceptions.push({ slotKey: keyOf('o-c6', WEEK0), status: 'missed' });

  /* a group class every Thursday 12:00 (the world fixture) and a split session this Thursday */
  const grp: ShareInfo = { groupId: 'g-mob', kind: 'group', title: 'Mobility class', capacity: 8 };
  for (const cid of ['c2', 'c5', 'c10'])
    doc(cid).patterns.push({
      id: 'p-mob',
      fromDay: WEEK0 - 3 * 7,
      weeks: 12,
      rows: [row('r-mob', 3, '12:00', 45, 'iron-yard', null)],
      share: grp,
    });
  const spl: ShareInfo = { groupId: 'g-spl', kind: 'split' };
  for (const cid of ['c6', 'c11'])
    doc(cid).oneOffs.push({
      id: 'o-spl',
      day: WEEK0 + 3,
      start: '15:30',
      dur: 60,
      gymId: 'iron-yard',
      share: spl,
    });

  const slotKey = (rowId: string, day: number) => opaqueSlotKey(keyOf(rowId, day));
  const requests: RescheduleRequest[] = [
    {
      id: 'rq1',
      clientId: 'c1',
      from: 'client',
      slotKey: slotKey('r-c1-fri', WEEK0 + 4),
      fromStart: tsOf(WEEK0 + 4, 18 * 60),
      toStart: tsOf(WEEK0 + 5, 10 * 60),
      note: 'Work trip, back on Saturday.',
      status: 'pending',
      createdAt: FIXTURE_NOW - 50 * MIN,
      expiresAt: tsOf(WEEK0 + 4, 16 * 60),
      scope: 'all',
    },
    {
      id: 'rq2',
      clientId: 'c2',
      from: 'trainer',
      slotKey: slotKey('r-c2-wed', WEEK0 + 2),
      fromStart: tsOf(WEEK0 + 2, 18 * 60),
      toStart: tsOf(WEEK0 + 2, 19 * 60),
      note: 'Gym is booked at 18:00.',
      status: 'pending',
      createdAt: FIXTURE_NOW - 11 * HOUR - 25 * MIN,
      expiresAt: tsOf(WEEK0 + 2, 16 * 60),
      scope: 'all',
    },
    {
      id: 'rq3',
      clientId: 'c3',
      from: 'client',
      slotKey: slotKey('r-c3-mon', WEEK0),
      fromStart: tsOf(WEEK0, 10 * 60),
      toStart: tsOf(WEEK0 + 1, 10 * 60),
      status: 'accepted',
      createdAt: FIXTURE_NOW - 3 * DAY - 2 * HOUR,
      decidedAt: FIXTURE_NOW - 3 * DAY + HOUR,
      expiresAt: tsOf(WEEK0, 8 * 60),
      scope: 'all',
    },
    {
      id: 'rq4',
      clientId: 'c14',
      from: 'trainer',
      slotKey: slotKey('r-c14-sat', WEEK0 - 2),
      fromStart: tsOf(WEEK0 - 2, 9 * 60),
      toStart: tsOf(WEEK0 - 1, 9 * 60),
      status: 'declined',
      createdAt: FIXTURE_NOW - 5 * DAY,
      decidedAt: FIXTURE_NOW - 5 * DAY + HOUR,
      expiresAt: FIXTURE_NOW - 3 * DAY,
      scope: 'all',
    },
  ];
  return { docs: Object.values(docs), requests, asOf: FIXTURE_NOW };
}

export interface FixturesScheduleOptions {
  /** simulated latency of a write */
  delayMs?: number;
  /** start from this data instead of the seed (stories, tests) */
  seed?: ScheduleData;
  /** return true to make the next write fail */
  failWrite?: () => boolean;
  /** start without data */
  empty?: boolean;
  /** the app clock (stories, tests); default: the fixture "now" running on from the real clock */
  now?: () => number;
}

export interface FixturesSchedulePort extends SchedulePort {
  /** Test / story helper: another device changed a doc (to provoke a conflict). */
  bumpRev(clientId: string): void;
  dump(): ScheduleData;
}

export function createFixturesSchedulePort(
  opts: FixturesScheduleOptions = {},
): FixturesSchedulePort {
  const seed = opts.empty
    ? { docs: [], requests: [], asOf: FIXTURE_NOW }
    : (opts.seed ?? scheduleSeed());
  const docs = new Map(seed.docs.map((d) => [d.clientId, structuredClone(d)]));
  const requests = new Map(seed.requests.map((r) => [r.id, { ...r }]));
  const subs = new Set<(d: ScheduleData) => void>();
  const t0 = Date.now();
  const now = opts.now ?? (() => FIXTURE_NOW + (Date.now() - t0));
  const delay = () =>
    opts.delayMs ? new Promise<void>((r) => setTimeout(r, opts.delayMs)) : Promise.resolve();
  const snap = (): ScheduleData => ({
    docs: [...docs.values()].map((d) => structuredClone(d)),
    requests: [...requests.values()].map((r) => ({ ...r })),
    asOf: now(),
  });
  const emit = () => {
    const s = snap();
    subs.forEach((f) => f(s));
  };
  const guard = () => {
    if (opts.failWrite?.()) throw new SchedulePortError('unavailable');
  };
  return {
    now,
    peek: () => snap(),
    subscribe(on): Unsubscribe {
      subs.add(on);
      on(snap());
      return () => void subs.delete(on);
    },
    async saveDoc(doc) {
      await delay();
      guard();
      const cur = docs.get(doc.clientId);
      if ((cur?.rev ?? 0) !== doc.rev) throw new SchedulePortError('conflict');
      const next = { ...structuredClone(doc), rev: doc.rev + 1 };
      docs.set(doc.clientId, next);
      emit();
      return structuredClone(next);
    },
    async createRequest(r) {
      await delay();
      guard();
      if (!requests.has(r.id)) requests.set(r.id, { ...r }); // idempotent by id
      emit();
    },
    async setStatus(req, status, decidedAt) {
      await delay();
      guard();
      const r = requests.get(req.id);
      if (!r) throw new SchedulePortError('forbidden');
      requests.set(req.id, { ...r, status, decidedAt });
      emit();
    },
    bumpRev(clientId) {
      const d = docs.get(clientId) ?? emptyDoc(clientId);
      docs.set(clientId, { ...d, rev: d.rev + 1 });
    },
    dump: snap,
  };
}

/** Stories: the Thursday mobility class has a whole-session move out (one request per person): c2 said yes, c5 waits, c10 declined. */
export function scheduleSeedWithGroupMove(): ScheduleData {
  const base = scheduleSeed();
  const day = WEEK0 + 3;
  const mk = (clientId: string, status: RescheduleRequest['status']): RescheduleRequest => ({
    id: `rq-g-${clientId}`,
    clientId,
    from: 'trainer',
    slotKey: opaqueSlotKey(keyOf('r-mob', day)),
    fromStart: tsOf(day, 12 * 60),
    toStart: tsOf(day, 13 * 60 + 30),
    note: 'Instructor change, same room.',
    status,
    createdAt: FIXTURE_NOW - 2 * HOUR,
    ...(status !== 'pending' ? { decidedAt: FIXTURE_NOW - HOUR } : {}),
    expiresAt: tsOf(day, 10 * 60),
    scope: 'all',
    groupKey: 'gk-mob',
  });
  return {
    ...base,
    requests: [...base.requests, mk('c2', 'accepted'), mk('c5', 'pending'), mk('c10', 'declined')],
  };
}

/**
 * Stories, tests: the seed plus four one-off sessions on `day` (a DST change day), so the Now line has blocks to pass
 * and to dim: 09:00 and 13:00 (past at 14:05), 14:30 and 16:00 (upcoming). Wall-clock times, so the zone shift never
 * moves them.
 */
export function scheduleSeedDstDay(day: number): ScheduleData {
  const base = scheduleSeed();
  const add = (cid: string, start: string, dur: number, id: string) => {
    const d = base.docs.find((x) => x.clientId === cid);
    d?.oneOffs.push({ id, day, start, dur, gymId: 'iron-yard', note: '' });
  };
  add('c1', '09:00', 45, 'o-dst-1');
  add('c2', '13:00', 60, 'o-dst-2');
  add('c5', '14:30', 45, 'o-dst-3');
  add('c8', '16:00', 60, 'o-dst-4');
  return base;
}
