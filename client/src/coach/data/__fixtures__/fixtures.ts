/**
 * In-memory adapter seeded from the design-lab world (v11 world.ts + fixtures.ts), so the UI can be built
 * before the backend exists. Trainer NOW = Wed 7 Oct 2026 09:05 (Iryna Melnyk). Numbers are copied, not
 * imported: client/src must not depend on client/design-lab.
 *  - Oleh Bondar (c1): bench stall, 4 weeks (e1RM 115 -> 117 -> 116 kg) -> urgent
 *  - Andriy Lysenko (c3): Military press vs "no overhead movement" -> urgent
 *  - Sofiia Hnatiuk (c4): leg press 180 -> 160 after a machine change -> machine (watch)
 *  - Bohdan Palamar (c11): legs 30 sets vs 21 chronic -> spike (watch)
 *  - Maria Tkach (c2) ready, Taras Rudenko (c7) PR, Denys Koval (c5) totals only -> informational
 *  - Maksym Shevchuk (c9) is program-only: no signals (plan 15; the lab card "no sessions logged" is not built)
 *  - 42 decisions: 26 improved, 10 no clear change, 4 declined, 2 measuring (a lab fixture, not a rule)
 */
import { emptyBook, type DecisionBook } from '../../domain/decisions';
import type {
  ClientSignalInput,
  LiftSeries,
  LiftSession,
  LiftWeek,
} from '../../domain/signalInputs';
import { DAY, HOUR } from '../../domain/time';
import type {
  Category,
  CoachClient,
  Consent,
  Dow,
  Level,
  SharedInjury,
  Slot,
} from '../../domain/types';
import { CATEGORIES } from '../../domain/types';
import { ROWS, type ConsentKind } from './fixtureRows';
import { fixtureDecisions } from './fixtureDecisions';
import { buildFixtureHistory } from './fixtureHistory';
import { D } from './fixtureTime';
import type { CoachWorldPort, WorldData } from '../port';
import { PortError, type PortErrorCode } from '../port';

export const FIXTURE_NOW = Date.UTC(2026, 9, 7, 9, 5);
export const FIXTURE_WEEK_START = Date.UTC(2026, 9, 5);
const TODAY_IDX = 2;

const SLOTS: Record<string, number[]> = {
  c1: [1, 3, 4, 5],
  c2: [0, 2, 5],
  c3: [0, 2, 4],
  c4: [1, 3, 5],
  c5: [0, 2, 3],
  c6: [0, 3, 5],
  c7: [0, 1, 2, 4, 5],
  c8: [1, 3, 5, 6],
  c9: [0, 1, 3, 5],
  c10: [0, 2, 4],
  c11: [0, 3, 4, 5],
  c12: [1, 5],
  c13: [0, 3, 5],
  c14: [0, 1, 3, 5],
};
const DONE: Record<string, number[]> = {
  c1: [1],
  c2: [0],
  c3: [0],
  c4: [1],
  c5: [0, 2],
  c6: [0],
  c7: [0, 1],
  c8: [1],
  c9: [],
  c10: [0],
  c11: [0],
  c12: [1],
  c13: [],
  c14: [0, 1],
};
const IDLE_DAYS: Record<string, number> = { c9: 9, c13: 4 };
const TRAINER_DAYS: Record<string, Dow[]> = {
  c1: ['Tue', 'Fri'],
  c8: ['Tue'],
  c2: ['Wed'],
  c3: ['Mon', 'Wed', 'Fri'],
  c9: [],
  c14: ['Sat'],
};
const RESTRICTION: Record<string, string> = {
  c3: 'Left shoulder: no overhead movement',
  c13: 'Right knee: no deep squats',
};
/** The shared injuries behind those restrictions (what the real adapter opens from the member's `injuries`). */
const INJURIES: Record<string, SharedInjury[]> = {
  c3: [
    {
      id: 'inj-c3',
      reason: 'injury',
      bodyPart: 'shoulder',
      side: 'left',
      stage: 'reintroduce',
      startDay: Math.floor((FIXTURE_NOW - 40 * DAY) / DAY),
      healed: false,
      note: 'Pinching when the bar passes my ears. Physio cleared everything below the shoulder line.',
    },
  ],
  c13: [
    {
      id: 'inj-c13',
      reason: 'injury',
      bodyPart: 'knee',
      side: 'right',
      stage: 'rebuild',
      startDay: Math.floor((FIXTURE_NOW - 75 * DAY) / DAY),
      healed: false,
    },
    {
      id: 'inj-c13b',
      reason: 'injury',
      bodyPart: 'ankle',
      side: 'left',
      stage: 'return',
      startDay: Math.floor((FIXTURE_NOW - 200 * DAY) / DAY),
      healed: true,
    },
  ],
};
const LIVE = new Set(['c5', 'c11']);
const RHYTHM_OVERRIDE: Record<string, number[]> = { c9: [4, 4, 4, 4, 3, 1, 0] };

const allOff = (): Record<Category, Level> =>
  Object.fromEntries(CATEGORIES.map((c) => [c, 'off'])) as Record<Category, Level>;
const BASE: Record<ConsentKind, Partial<Record<Category, Level>>> = {
  totals: { totals: 'full' },
  sets: { totals: 'full', sets: 'full', checkins: 'full' },
  'sets+injury': {
    totals: 'full',
    sets: 'full',
    sleep: 'effects',
    injury: 'effects',
    checkins: 'full',
  },
};
const OVERRIDE: Record<string, Partial<Record<Category, Level>>> = {
  c1: { sleep: 'effects', injury: 'effects' },
  c3: { injury: 'full' },
};
const consentOf = (id: string, kind: ConsentKind): Consent => ({
  ...allOff(),
  ...BASE[kind],
  ...(OVERRIDE[id] ?? {}),
});

const daysSinceLast = (id: string) =>
  DONE[id].length ? TODAY_IDX - Math.max(...DONE[id]) : (IDLE_DAYS[id] ?? 7);

function clients(): CoachClient[] {
  return ROWS.map(([id, name, goal, program, programWeek, gym, mode, ck, streakWeeks]) => {
    const consent = consentOf(id, ck);
    return {
      id,
      name,
      goal,
      program,
      programWeek,
      gym,
      mode,
      consent,
      streakWeeks,
      planned: SLOTS[id].length,
      done: DONE[id].length,
      lastSessionAt: FIXTURE_NOW - daysSinceLast(id) * DAY,
      trainerDays: TRAINER_DAYS[id] ?? [],
      restriction: RESTRICTION[id],
      ...(INJURIES[id] && consent.injury !== 'off' ? { injuries: INJURIES[id] } : {}),
      live: LIVE.has(id) && mode !== 'program' && consent.totals !== 'off',
    };
  });
}

/* ---- lifts ----------------------------------------------------------------------------------------------------- */
const sess = (
  at: number,
  variant: string,
  e1rm: number,
  rpe: number,
  setsText: string,
  reps = true,
): LiftSession => ({
  at,
  variant,
  e1rm,
  workingSets: 3,
  rpe,
  allRepsDone: reps,
  setsText,
});
const BENCH = 'iron-yard:eleiko-bench-3';
const olehBench: LiftSeries = {
  liftId: 'bench-press',
  name: 'Bench press',
  sessions: [
    sess(D(8, 26), BENCH, 111, 7.5, '90x5, 90x5, 92.5x4'),
    sess(D(9, 1), BENCH, 112, 8, '92.5x5, 92.5x5, 92.5x4'),
    sess(D(9, 4), BENCH, 113, 8, '95x5, 95x5, 95x3'),
    sess(D(9, 8), BENCH, 115, 8, '97.5x5, 97.5x5, 100x3'),
    sess(D(9, 11), BENCH, 115, 8, '97.5x5, 97.5x5, 100x3'),
    sess(D(9, 15), BENCH, 115, 8.5, '97.5x5, 97.5x5, 97.5x5'),
    sess(D(9, 18), BENCH, 114, 8, '97.5x5, 97.5x5, 97.5x4'),
    sess(D(9, 22), BENCH, 114, 8, '97.5x5, 97.5x5, 97.5x5'),
    sess(D(9, 25), BENCH, 116, 9, '100x5, 100x4, 100x4'),
    sess(D(9, 29), BENCH, 114, 8.5, '97.5x5, 97.5x5, 97.5x5'),
    sess(D(10, 2), BENCH, 117, 8.5, '100x5, 100x5, 100x5'),
    sess(D(10, 6), BENCH, 116, 9, '100x5, 100x5, 100x4'),
  ],
};
const wk = (
  weekStart: number,
  bestE1rm: number,
  workingSets: number,
  variant: string,
  avgRpe: number | null = 8,
): LiftWeek => ({ weekStart, bestE1rm, workingSets, avgRpe, variant });
const W = (n: number) => FIXTURE_WEEK_START - n * 7 * DAY;
const sofiiaLegPress: LiftSeries = {
  liftId: 'leg-press',
  name: 'Leg press',
  weeks: [
    wk(W(4), 180, 9, 'technogym'),
    wk(W(3), 180, 9, 'technogym'),
    wk(W(2), 181, 9, 'technogym'),
    wk(W(1), 180, 9, 'technogym'),
    wk(W(0), 160, 3, 'hammer-strength'),
  ],
};
const mariaDeadlift: LiftSeries = {
  liftId: 'deadlift',
  name: 'Deadlift',
  sessions: [
    sess(D(9, 28), 'iron-yard:bar', 99, 7, '85x5, 85x5, 85x5'),
    sess(D(10, 1), 'iron-yard:bar', 99, 7, '85x5, 85x5, 85x5'),
    sess(D(10, 5), 'iron-yard:bar', 100, 7, '85x5, 85x5, 85x6'),
  ],
};
const tarasDeadlift: LiftSeries = {
  liftId: 'deadlift',
  name: 'Deadlift',
  weeks: [
    wk(W(5), 176, 6, 'eleiko'),
    wk(W(4), 177, 6, 'eleiko'),
    wk(W(3), 178, 6, 'eleiko'),
    wk(W(2), 179, 6, 'eleiko'),
    wk(W(1), 178, 6, 'eleiko'),
    wk(W(0), 182, 3, 'eleiko', 9),
  ],
};

function rhythm(id: string, planned: number, streak: number) {
  const done =
    RHYTHM_OVERRIDE[id] ??
    Array.from({ length: 7 }, (_, i) =>
      7 - i <= streak ? planned : Math.max(0, Math.floor(planned / 2)),
    );
  return done;
}

function inputs(cs: CoachClient[]): ClientSignalInput[] {
  return cs.map((c) => {
    const done = rhythm(c.id, c.planned, c.streakWeeks);
    const inp: ClientSignalInput = {
      clientId: c.id,
      mode: c.mode,
      consent: c.consent,
      totals: {
        completedWeeks: done.map((d) => ({ done: d, planned: c.planned })),
        plannedThisWeek: c.planned,
        daysSinceLast: daysSinceLast(c.id),
        sessionsLast4Weeks: done.slice(-4).reduce((a, b) => a + b, 0) + c.done,
      },
    };
    if (c.id === 'c1') inp.lifts = [olehBench];
    if (c.id === 'c4') inp.lifts = [sofiiaLegPress];
    if (c.id === 'c2') inp.lifts = [mariaDeadlift];
    if (c.id === 'c7') inp.lifts = [tarasDeadlift];
    if (c.id === 'c11') inp.muscles = [{ muscle: 'legs', weeklySets: [20, 21, 22, 21, 30] }];
    if (c.id === 'c3')
      inp.injury = {
        restrictions: ['no overhead movement'],
        conflicts: [{ exercise: 'Military press', restriction: 'no overhead movement' }],
      };
    if (c.id === 'c13') inp.injury = { restrictions: ['no deep squats'], conflicts: [] };
    return inp;
  });
}

/* ---- slots ------------------------------------------------------------------------------------------------------ */
const DOW_IDX: Record<Dow, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
function slots(): Slot[] {
  const out: Slot[] = [];
  for (const [cid, days] of Object.entries(TRAINER_DAYS)) {
    for (const d of days) {
      const i = DOW_IDX[d];
      const start = FIXTURE_WEEK_START + i * DAY + 18 * HOUR;
      out.push({
        id: `s-${cid}-${i}`,
        clientId: cid,
        kind: 'solo',
        attendees: [{ clientId: cid, status: 'planned' }],
        start,
        durationMin: 60,
        gymId: 'iron-yard',
        status: DONE[cid].includes(i) ? 'done' : start < FIXTURE_NOW ? 'missed' : 'planned',
      });
    }
  }
  out.push({
    id: 's-group-mobility',
    clientId: 'c2',
    kind: 'group',
    title: 'Mobility class',
    capacity: 8,
    attendees: [
      { clientId: 'c2', status: 'planned' },
      { clientId: 'c5', status: 'planned' },
      { clientId: 'c10', status: 'planned' },
    ],
    start: FIXTURE_WEEK_START + 3 * DAY + 12 * HOUR,
    durationMin: 45,
    gymId: 'iron-yard',
    status: 'planned',
  });
  // two reschedule requests (Today: RESCHEDULE REQUESTS (2))
  const fri = out.find((s) => s.id === 's-c1-4');
  if (fri) {
    fri.status = 'pending-move';
    fri.move = {
      reqId: 'rq1',
      from: 'client',
      start: FIXTURE_WEEK_START + 5 * DAY + 10 * HOUR,
      note: 'Work trip, back on Saturday.',
    };
    fri.attendees = [{ clientId: 'c1', status: 'pending-move' }];
  }
  const wed = out.find((s) => s.id === 's-c2-2');
  if (wed) {
    wed.status = 'pending-move';
    wed.move = { reqId: 'rq2', from: 'trainer', start: FIXTURE_WEEK_START + 2 * DAY + 19 * HOUR };
    wed.attendees = [{ clientId: 'c2', status: 'pending-move' }];
  }
  return out;
}

export function buildFixtureWorld(): WorldData {
  const cs = clients();
  return {
    asOf: FIXTURE_NOW,
    trainer: { id: 'trainer-iryna', name: 'Iryna Melnyk' },
    clients: cs,
    inputs: inputs(cs),
    slots: slots(),
    book: { ...emptyBook(), decisions: fixtureDecisions() },
    history: buildFixtureHistory(cs, FIXTURE_NOW),
  };
}

/** The lab's unread seed for the 9+ demo: Oleh 3, Maria 12, Andriy 1 (total 16). */
export const FIXTURE_UNREAD: Record<string, number> = { c1: 3, c2: 12, c3: 1, c7: 0, c9: 0 };

export interface FixturesPortOptions {
  /** simulated latency of load() */
  delayMs?: number;
  /** return a code to make the next load fail (stories, tests) */
  failWith?: () => PortErrorCode | null;
  /** start with a warm cache (peek returns data) */
  warm?: boolean;
  /** age of the warm cache in ms (default 14 minutes) */
  cacheAgeMs?: number;
}

export function createFixturesPort(
  o: FixturesPortOptions = {},
): CoachWorldPort & { saved: () => DecisionBook } {
  let world = buildFixtureWorld();
  let cache: { data: WorldData; fetchedAt: number } | null = o.warm
    ? { data: world, fetchedAt: FIXTURE_NOW - (o.cacheAgeMs ?? 14 * 60_000) }
    : null;
  return {
    now: () => FIXTURE_NOW,
    peek: () => cache,
    async load({ signal }) {
      if (o.delayMs) {
        await new Promise<void>((res, rej) => {
          const t = setTimeout(res, o.delayMs);
          signal.addEventListener('abort', () => {
            clearTimeout(t);
            rej(new PortError('timeout'));
          });
        });
      }
      const f = o.failWith?.();
      if (f) throw new PortError(f);
      cache = { data: world, fetchedAt: FIXTURE_NOW };
      return world;
    },
    async save(_op, book) {
      world = { ...world, book };
    },
    async endCoaching(clientId) {
      world = {
        ...world,
        clients: world.clients.filter((c) => c.id !== clientId),
        inputs: world.inputs.filter((i) => i.clientId !== clientId),
      };
    },
    saved: () => world.book,
  };
}
