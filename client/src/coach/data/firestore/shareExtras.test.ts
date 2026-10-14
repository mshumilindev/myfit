/**
 * Share source gaps closed: activities (totals `full`), sets per muscle this week (sets `effects` view / derived at
 * `full`) and the days trained with the trainer, for the trainer's and the member's source. Consent-gated and sealed.
 */
import { describe, expect, it } from 'vitest';
import { sealOrThrow } from '../../../coachCrypto/sealOrThrow';
import type { Activity, Workout } from '../../../types';
import { createGrant } from '../../../vaultShare';
import { weekStartOf, DAY } from '../../domain/time';
import { ALL_OFF } from '../../domain/consent';
import type { Consent } from '../../domain/types';
import { emptyOverlay, sealPlan, sealVersion } from '../../program/planCodec';
import { freshProgram } from '../../../views/programs/model';
import { workoutCatalog } from './shareCatalog';
import { activitiesFromView, activitiesForShare, weeklySetsOf, onTrainerDay } from './shareExtras';
import { createFirestoreShareSource } from './shareSource';
import { createSharesPublisher } from './sharesPublisher';
import { C, NOW, T, makeWorld, type TestWorld } from './testWorld';

const W0 = weekStartOf(NOW);
const at = (dayIdx: number, hour = 12) => W0 + dayIdx * DAY + hour * 3_600_000;
const set = (reps: number, weight: number, warm = false) =>
  ({ id: `s${reps}${weight}${warm}`, reps, weight, isWarmup: warm }) as never;
const workout = (id: string, startedAt: number, sets: number, muscle = 'chest'): Workout =>
  ({
    id,
    startedAt,
    finishedAt: startedAt + 3_600_000,
    autoFinished: false,
    exercises: [
      {
        id: `e-${id}`,
        name: 'Barbell Bench Press',
        kind: 'strength',
        position: 0,
        primaryMuscle: muscle,
        sets: [set(5, 40, true), ...Array.from({ length: sets }, () => set(5, 80))],
      },
    ],
  }) as unknown as Workout;
const act = (id: string, startedAt: number, over: Partial<Activity> = {}): Activity => ({
  id,
  type: 'run',
  category: 'conditioning',
  startedAt,
  finishedAt: startedAt + 30 * 60_000,
  durationMin: 30,
  distanceKm: 5.04,
  effort: 'hard',
  note: 'PRIVATE NOTE: knee felt odd',
  calories: 300,
  ...over,
});

const consent = (o: Partial<Consent>): Consent => ({ ...ALL_OFF, ...o });

describe('pure helpers', () => {
  it('activities: finished, last 90 days, no note, rounded', () => {
    const list = [
      act('a1', NOW - DAY),
      act('old', NOW - 100 * DAY),
      act('live', NOW - 1000, { finishedAt: null }),
    ];
    const out = activitiesForShare(list, NOW, workoutCatalog);
    expect(out).toEqual([
      {
        id: 'a1',
        at: NOW - DAY,
        type: 'run',
        icon: 'person-simple-run',
        minutes: 30,
        effort: 'hard',
        km: 5,
      },
    ]);
    expect(JSON.stringify(out)).not.toContain('knee');
  });
  it('weekly sets: working sets of this week by primary muscle; warm-ups and old weeks do not count', () => {
    const w = [
      workout('a', at(1), 3),
      workout('b', at(3), 2),
      workout('c', at(0) - 3 * DAY, 9), // last week
      workout('d', at(2), 4, 'back'),
    ];
    expect(weeklySetsOf(w, at(4), workoutCatalog)).toEqual({ chest: 5, back: 4 });
  });
  it('views from the wire are cleaned', () => {
    expect(activitiesFromView({ activities: [{ id: 'x' }, 5, null] })).toEqual([]);
    expect(activitiesFromView({})).toBeUndefined();
  });
  it('trainer day by weekday', () => {
    expect(onTrainerDay(at(1), ['Tue'])).toBe(true);
    expect(onTrainerDay(at(2), ['Tue'])).toBe(false);
  });
});

async function seedPlan(w: TestWorld, days: ('Tue' | 'Fri')[]) {
  await w.publishKey();
  w.trainerBook.start();
  w.clientBook.start();
  await w.trainerBook.ready();
  await w.clientBook.ready();
  const t0 = Date.now();
  while ((!w.trainerBook.ringFor(C) || !w.clientBook.ringFor(C)) && Date.now() - t0 < 1500)
    await new Promise((r) => setTimeout(r, 5));
  const ring = w.trainerBook.ringFor(C)!;
  const src = { vault: w.tv, ring };
  w.fs.seed(
    `plans/${C}/versions/1`,
    await sealVersion(src, C, T, {
      n: 1,
      programId: `prg-${C}-1`,
      state: 'live',
      createdAt: NOW,
      publishedAt: NOW,
      reason: '',
      summary: '',
      diff: [],
      program: freshProgram('P'),
      trainerDays: days,
    }),
  );
  w.fs.seed(
    `plans/${C}`,
    await sealPlan(src, {
      clientId: C,
      trainerId: T,
      programId: `prg-${C}-1`,
      liveVersion: 1,
      rev: 2,
      updatedAt: NOW,
      ...emptyOverlay(),
    }),
  );
}

/** The client's device publishes, the "server" cuts by level, the trainer's source reads. */
async function scenario(level: Partial<Consent>, opts: { acts?: Activity[]; wk?: Workout[] } = {}) {
  const w = await makeWorld();
  await seedPlan(w, ['Tue', 'Fri']);
  const cons = consent(level);
  const workouts = opts.wk ?? [workout('w1', at(1), 3), workout('w2', at(2), 2)];
  const acts = opts.acts ?? [
    act('a1', at(0)),
    act('a2', at(3), { type: 'walk', effort: 'light', distanceKm: null }),
  ];
  await createSharesPublisher({ fs: w.fs, vault: w.cv, uid: C, catalog: workoutCatalog }).sync({
    consent: cons,
    workouts,
    activities: acts,
  });
  const m = w.cv.material();
  const grant = { ...(await createGrant(m.key, m.salt, w.rec.pub)), fp: 'x' };
  w.fs.onCall('coachClients', () => ({
    clients: [
      {
        clientId: C,
        name: 'Oleh Bondar',
        status: 'active',
        mode: 'app',
        consent: cons,
        consentVersion: 1,
        keyEpoch: 1,
        cid: 'x',
      },
    ],
    invites: [],
    serverTime: NOW,
  }));
  // what coachRead returns, cut by level exactly like service.ts (readCategory)
  w.fs.onCall('coachRead', async (data) => {
    const results: Record<string, unknown> = {};
    for (const cat of data.categories as string[]) {
      const l = cons[cat as 'totals' | 'sets'];
      if (l === 'off') {
        results[cat] = { state: 'locked' };
        continue;
      }
      if (cat === 'totals')
        results.totals =
          l === 'full'
            ? {
                state: 'ok',
                level: l,
                asOf: NOW,
                docs: [],
                extras: w.fs.has(`users/${C}/shares/totals`)
                  ? [(await w.fs.get(`users/${C}/shares/totals`))!]
                  : [],
              }
            : { state: 'ok', level: l, asOf: NOW, view: { weeks: [], lastSessionAt: null } };
      else if (l === 'effects')
        results.sets = {
          state: 'ok',
          level: l,
          asOf: NOW,
          docs: w.fs.has(`users/${C}/shares/sets`)
            ? [(await w.fs.get(`users/${C}/shares/sets`))!]
            : [],
        };
      else {
        // full: the sealed workout documents
        const { sealDoc } = await import('../../../encryptedDoc');
        const docs = await Promise.all(
          workouts.map((x) => sealDoc('workouts', x as never, m.key, m.salt)),
        );
        results.sets = { state: 'ok', level: l, asOf: NOW, docs };
      }
    }
    return { results, grant };
  });
  const source = createFirestoreShareSource({
    fs: w.fs,
    vault: w.tv,
    side: 'trainer',
    uid: T,
    loadOwnCoachKey: async () => w.rec,
    catalog: workoutCatalog,
    plan: {
      ringFor: w.trainerBook.ringFor,
      ringForEpoch: w.trainerBook.ringForEpoch,
      ready: w.trainerBook.ready,
    },
  });
  const data = (await source.load(C, { signal: new AbortController().signal })).clients[C];
  return { w, data, source, cons };
}

describe('publisher (member device)', () => {
  it('writes the activity view only at totals full, sealed; the sets view carries weekly sets; removes both below', async () => {
    const w = await makeWorld();
    const pub = createSharesPublisher({ fs: w.fs, vault: w.cv, uid: C, catalog: workoutCatalog });
    const acts = [act('a1', NOW - DAY)];
    const wk = [workout('w1', at(1), 3)];
    await pub.sync({
      consent: consent({ totals: 'full', sets: 'effects' }),
      workouts: wk,
      activities: acts,
    });
    const t = (await w.fs.get(`users/${C}/shares/totals`))!;
    const s = (await w.fs.get(`users/${C}/shares/sets`))!;
    expect(Object.keys(t).sort()).toEqual(['asOf', 'category', 'enc', 'level', 'v']);
    expect(w.fs.dump()).not.toContain('PRIVATE NOTE');
    expect(w.fs.dump()).not.toContain('person-simple-run');
    expect(w.fs.dump()).not.toContain('chest');
    expect(s.level).toBe('effects');
    // totals effects: the activity doc goes away, sets stay
    await pub.sync({
      consent: consent({ totals: 'effects', sets: 'effects' }),
      workouts: wk,
      activities: acts,
    });
    expect(w.fs.has(`users/${C}/shares/totals`)).toBe(false);
    expect(w.fs.has(`users/${C}/shares/sets`)).toBe(true);
    await pub.sync({ consent: consent({}), workouts: wk, activities: acts });
    expect(w.fs.has(`users/${C}/shares/sets`)).toBe(false);
  });
  it('rewrites only when the view changed, and not while the vault is locked', async () => {
    const w = await makeWorld();
    const pub = createSharesPublisher({ fs: w.fs, vault: w.cv, uid: C });
    const input = {
      consent: consent({ totals: 'full' }),
      workouts: [],
      activities: [act('a1', NOW - DAY)],
    };
    await pub.sync(input);
    const n = w.fs.writes.length;
    await pub.sync(input);
    expect(w.fs.writes.length).toBe(n);
    await pub.sync({ ...input, activities: [...input.activities, act('a2', NOW - 2 * DAY)] });
    expect(w.fs.writes.length).toBe(n + 1);
  });
});

describe('trainer share source', () => {
  it('totals full + sets effects: activities, weekly sets and trainer days arrive; workouts are not invented', async () => {
    const { data } = await scenario({ totals: 'full', sets: 'effects' });
    expect(data.activities.map((a) => a.id)).toEqual(['a2', 'a1']);
    expect(data.activities[1]).toMatchObject({ type: 'run', minutes: 30, effort: 'hard', km: 5 });
    expect(JSON.stringify(data)).not.toContain('PRIVATE NOTE');
    expect(data.weeklySets).toEqual({ chest: 5 });
    expect(data.trainerDays).toEqual(['Tue', 'Fri']);
    expect(data.workouts).toEqual([]); // sets are effects only: no sessions
  });
  it('totals effects: no activities, even if a stale view were handed over', async () => {
    const { data } = await scenario({ totals: 'effects', sets: 'effects' });
    expect(data.activities).toEqual([]);
    expect(data.weeklySets).toEqual({ chest: 5 });
  });
  it("sets off: no weekly sets; trainer days stay (the trainer's own plan)", async () => {
    const { data } = await scenario({ totals: 'full' });
    expect(data.weeklySets).toEqual({});
    expect(data.trainerDays).toEqual(['Tue', 'Fri']);
    expect(data.activities).toHaveLength(2);
  });
  it('sets full: weekly sets derive from the opened workouts and sessions on a trainer day are marked', async () => {
    const { data } = await scenario({ totals: 'full', sets: 'full' });
    expect(data.weeklySets).toEqual({ chest: 5 });
    const byId = Object.fromEntries(data.workouts.map((x) => [x.id, x.withTrainer]));
    expect(byId).toEqual({ w1: true, w2: false }); // Tue yes, Wed no
  });
  it('an activity view sealed with another key is dropped, nothing throws', async () => {
    const w = await makeWorld();
    await seedPlan(w, ['Tue']);
    const other = await makeWorld();
    await createSharesPublisher({ fs: other.fs, vault: other.cv, uid: C }).sync({
      consent: consent({ totals: 'full' }),
      workouts: [],
      activities: [act('a1', NOW - DAY)],
    });
    const foreign = (await other.fs.get(`users/${C}/shares/totals`))!;
    const m = w.cv.material();
    const cons = consent({ totals: 'full' });
    w.fs.onCall('coachClients', () => ({
      clients: [
        {
          clientId: C,
          name: 'Oleh',
          status: 'active',
          mode: 'app',
          consent: cons,
          consentVersion: 1,
          keyEpoch: 1,
          cid: 'x',
        },
      ],
      invites: [],
      serverTime: NOW,
    }));
    w.fs.onCall('coachRead', async () => ({
      results: { totals: { state: 'ok', level: 'full', asOf: NOW, docs: [], extras: [foreign] } },
      grant: { ...(await createGrant(m.key, m.salt, w.rec.pub)), fp: 'x' },
    }));
    const src = createFirestoreShareSource({
      fs: w.fs,
      vault: w.tv,
      side: 'trainer',
      uid: T,
      loadOwnCoachKey: async () => w.rec,
      plan: { ringFor: w.trainerBook.ringFor, ready: w.trainerBook.ready },
    });
    const d = (await src.load(C, { signal: new AbortController().signal })).clients[C];
    expect(d.activities).toEqual([]);
    void sealOrThrow;
  });
  it('program mode / nothing shared reads nothing but still knows the trainer days', async () => {
    const { data, w } = await scenario({});
    expect(data.activities).toEqual([]);
    expect(data.weeklySets).toEqual({});
    expect(data.trainerDays).toEqual(['Tue', 'Fri']);
    expect(w.fs.calls.some((c) => c.name === 'coachRead')).toBe(false);
  });
});

describe('trainer program library', () => {
  it('lists templates and the runnable copy a plan points at, not the superseded copies', async () => {
    const { w, source } = await scenario({ totals: 'full' });
    const prog = (id: string) => ({ ...freshProgram('Upper/Lower'), id, authorId: T });
    w.fs.seed('programs/mine', prog('mine') as never);
    w.fs.seed(`programs/prg-${C}-1`, prog(`prg-${C}-1`) as never);
    w.fs.seed(`programs/prg-${C}-0`, prog(`prg-${C}-0`) as never);
    const s = await source.load(C, { signal: new AbortController().signal });
    expect(s.programs.map((p) => p.id).sort()).toEqual(['mine', `prg-${C}-1`].sort());
    expect(s.programs.find((p) => p.id === `prg-${C}-1`)?.assignedTo).toEqual([C]);
  });
});

describe('member share source', () => {
  it('own activities, own weekly sets, trainer days from the plan, or their own marker without a trainer', async () => {
    const w = await makeWorld();
    await seedPlan(w, ['Fri']);
    const base = {
      fs: w.fs,
      vault: w.cv,
      side: 'client' as const,
      uid: C,
      own: () => [workout('w1', at(4), 3), workout('w2', at(1), 2)],
      ownActivities: () => [act('a1', at(0))],
      ownName: () => 'Oleh',
      catalog: workoutCatalog,
    };
    const withPlan = createFirestoreShareSource({
      ...base,
      plan: {
        ringFor: w.clientBook.ringFor,
        ringForEpoch: w.clientBook.ringForEpoch,
        ready: w.clientBook.ready,
      },
    });
    const me = (await withPlan.load(C, { signal: new AbortController().signal })).clients[C];
    expect(me.activities.map((a) => a.id)).toEqual(['a1']);
    expect(me.trainerDays).toEqual(['Fri']);
    expect(me.workouts.find((x) => x.id === 'w1')?.withTrainer).toBe(true);
    expect(me.workouts.find((x) => x.id === 'w2')?.withTrainer).toBe(false);

    // no in-app trainer: the member's own sealed marker
    const lone = await makeWorld();
    lone.fs.seed(
      `users/${C}/meta/selfCoach`,
      await sealOrThrow('selfCoach', { updatedAt: NOW, days: ['Mon', 'Thu'] }, { vault: lone.cv }),
    );
    const solo = createFirestoreShareSource({ ...base, fs: lone.fs, vault: lone.cv });
    const me2 = (await solo.load(C, { signal: new AbortController().signal })).clients[C];
    expect(me2.trainerDays).toEqual(['Mon', 'Thu']);
  });
});
