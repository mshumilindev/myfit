/**
 * NO DATA LOSS (iter17), everything else that travels between the two apps over the shared store with the rules
 * enforced: schedule documents and reschedule requests, notes, chat bodies and share references, the client's logged
 * workouts as the trainer reads them, and what the trainer's view deliberately leaves out.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { setCoachTimeZone } from '../../format';
import { configureScheduleGyms, forgetGymNames, gymName } from '../../schedule/types';
import { C, NOW } from './parity/harness';
import { latest, linkUp, settle, type World } from './parity/flow';
import { sealDoc, unsealDoc } from '../../../encryptedDoc';
import { workoutsToLifts } from './worldMap';
import { SHARE_KINDS } from '../../share/types';
import { MAX_NOTE, type NoteAnchor } from '../../notes/types';
import type { ScheduleData } from '../../schedule/port';
import type { RescheduleRequest, ScheduleDoc } from '../../schedule/types';
import type { Workout } from '../../../types';

const clone = <X>(x: X): X => JSON.parse(JSON.stringify(x)) as X;
const docs = async (w: World, side: 'tr' | 'cl'): Promise<ScheduleData> =>
  (await latest<ScheduleData>((on, er) => w[side].schedule.subscribe(on, er), 100))!;

afterEach(() => {
  setCoachTimeZone('UTC');
  configureScheduleGyms(null);
  forgetGymNames();
});

describe('schedule documents and requests', () => {
  it('a schedule with every optional field arrives unchanged on the member device (and the other way round for requests)', async () => {
    setCoachTimeZone('Europe/Kyiv'); // the zone the trainer saves in travels with the document
    const w = await linkUp();
    const doc: ScheduleDoc = {
      clientId: C,
      rev: 0,
      tz: 'Europe/Kyiv',
      patterns: [
        {
          id: 'p1',
          fromDay: 20_000,
          weeks: 8,
          rows: [
            {
              id: 'r1',
              dow: 0,
              start: '07:30',
              dur: 45,
              gymId: 'iron-yard',
              dayLabel: 'Lower A',
              programDayId: 'prg-client-1-1:0',
            },
            {
              id: 'r2',
              dow: 4,
              start: '18:00',
              dur: 90,
              gymId: 'fithub',
              dayLabel: null,
              programDayId: null,
            },
            { id: 'r3', dow: 6, start: '10:00', dur: 30, gymId: 'x' },
          ],
          share: { groupId: 'g1', kind: 'split', title: 'Pair "Ä" session', capacity: 2 },
        },
        {
          id: 'p2',
          fromDay: 20_100,
          weeks: 0,
          rows: [{ id: 'r4', dow: 2, start: '12:00', dur: 60, gymId: 'iron-yard' }],
        },
      ],
      oneOffs: [
        {
          id: 'o1',
          day: 20_010,
          start: '09:00',
          dur: 60,
          gymId: 'iron-yard',
          note: 'Bring straps — Привіт 💪',
          share: { groupId: 'g2', kind: 'group', capacity: 6 },
        },
        { id: 'o2', day: 20_011, start: '09:00', dur: 60, gymId: 'iron-yard' },
      ],
      exceptions: [
        { slotKey: 'k1', status: 'missed' },
        { slotKey: 'k2', status: 'done' },
        { slotKey: 'k3', status: 'kept' },
      ],
      cancelled: ['c1', 'c2'],
    };
    const stored = await w.tr.schedule.saveDoc(doc);
    expect(stored.rev).toBe(1);
    await settle(80);
    // the trainer's gym names travel with the document (the two fixture gyms are known here; 'x' is not)
    const expected = {
      ...clone(doc),
      rev: 1,
      gymNames: { 'iron-yard': 'Iron Yard', fithub: 'FitHub Pozniaky' },
    };
    const seen = (await docs(w, 'cl')).docs.find((d) => d.clientId === C)!;
    expect(seen).toEqual(expected);
    const mine = (await docs(w, 'tr')).docs.find((d) => d.clientId === C)!;
    expect(mine).toEqual(expected);
    // a rewrite keeps the rev chain, every field and the names
    expect(seen.gymNames).toEqual({ 'iron-yard': 'Iron Yard', fithub: 'FitHub Pozniaky' });
    const again = await w.tr.schedule.saveDoc({ ...seen, cancelled: [...seen.cancelled, 'c3'] });
    expect(again.rev).toBe(2);

    // requests: every field, created by each side, read by the other
    const base = (id: string, from: 'trainer' | 'client'): RescheduleRequest => ({
      id,
      clientId: C,
      from,
      slotKey: `slot-${id}`,
      fromStart: NOW + 86_400_000,
      toStart: NOW + 2 * 86_400_000,
      note: 'Dentist at 6 — ąčę',
      status: 'pending',
      createdAt: NOW,
      expiresAt: NOW + 3 * 86_400_000,
      scope: 'one',
      groupKey: 'grp-1',
      supersedes: 'older-req',
    });
    await w.tr.schedule.createRequest(base('rq-t', 'trainer'));
    await w.cl.schedule.createRequest(base('rq-c', 'client'));
    await settle(80);
    for (const side of ['tr', 'cl'] as const) {
      const rs = (await docs(w, side)).requests;
      expect(rs.find((r) => r.id === 'rq-t')).toEqual(base('rq-t', 'trainer'));
      expect(rs.find((r) => r.id === 'rq-c')).toEqual(base('rq-c', 'client'));
    }
    expect(w.cl.fs.denied).toEqual([]);
    expect(w.tr.fs.denied).toEqual([]);
  });
});

describe('notes', () => {
  it('every anchor kind and the longest allowed text survive; the member reads the shared ones unchanged', async () => {
    const w = await linkUp();
    const anchors: NoteAnchor[] = [
      { kind: 'none' },
      { kind: 'message', id: 'm1', text: 'Upper A · Fri', at: NOW },
      { kind: 'decision', id: 'd1' },
      { kind: 'day', id: 'prg-client-1-1:2', text: 'Lower A' },
      { kind: 'exercise', id: 'ex-1', text: 'Barbell Squat' },
    ];
    const long = 'я'.repeat(MAX_NOTE - 2) + '💪';
    const made = [];
    for (const [i, anchor] of anchors.entries())
      made.push(
        await w.tr.notes.add({
          clientId: C,
          text: i === 0 ? long : `note ${i} "q" \\ ä`,
          vis: i % 2 ? 'shared' : 'private',
          anchor,
        }),
      );
    await settle(60);
    const mineAll =
      (await latest<{ id: string; text: string; vis: string; anchor: NoteAnchor }[]>(
        (on, er) => w.tr.notes.subscribe(C, on as never, er),
        120,
      )) ?? [];
    for (const [i, n] of made.entries()) {
      const got = mineAll.find((x) => x.id === n.id)!;
      expect(got.text).toBe(i === 0 ? long : `note ${i} "q" \\ ä`);
      expect(got.anchor).toEqual(anchors[i]);
      expect(got.vis).toBe(i % 2 ? 'shared' : 'private');
    }
  });
});

describe('chat bodies and share references', () => {
  it('every share kind keeps id and owner, text bodies keep their text, in both directions', async () => {
    const w = await linkUp();
    const t = (id: string) => ({ id, text: '', at: w.tr.fs.now() });
    for (const [i, kind] of SHARE_KINDS.entries()) {
      const ref = { kind, id: `id-${kind}`, ...(i % 2 ? { ownerId: C } : {}) };
      await w.tr.chat.send(w.cid, {
        ...t(`s-t${i}`),
        body: { kind: 'share', share: ref, text: `look: ${kind} ä` } as never,
      });
      await w.cl.chatClient.send(w.cid, {
        ...t(`s-c${i}`),
        at: w.cl.fs.now(),
        body: { kind: 'share', share: ref, text: `mine: ${kind}` } as never,
      });
    }
    const text = 'x'.repeat(1999) + 'é';
    await w.tr.chat.send(w.cid, { id: 'long', text, at: w.tr.fs.now() });
    await settle(60);
    const mine =
      (await latest<{ id: string; body: { kind: string; share?: unknown; text?: string } }[]>(
        (on, er) => w.tr.chat.subscribeMessages(w.cid, on as never, er),
        150,
      )) ?? [];
    const theirs = (
      (await latest<{ messages: typeof mine }>(
        (on, er) => w.cl.chatClient.subscribe(w.cid, on as never, er),
        150,
      )) ?? { messages: [] }
    ).messages;
    for (const [i, kind] of SHARE_KINDS.entries()) {
      const ref = { kind, id: `id-${kind}`, ...(i % 2 ? { ownerId: C } : {}) };
      for (const list of [mine, theirs]) {
        expect(list.find((m) => m.id === `s-t${i}`)!.body).toEqual({
          kind: 'share',
          share: ref,
          text: `look: ${kind} ä`,
        });
        expect(list.find((m) => m.id === `s-c${i}`)!.body).toEqual({
          kind: 'share',
          share: ref,
          text: `mine: ${kind}`,
        });
      }
    }
    expect(theirs.find((m) => m.id === 'long')!.body).toEqual({ kind: 'text', text });
    // too long is refused loudly, never cut
    await expect(
      w.tr.chat.send(w.cid, { id: 'toolong', text: 'y'.repeat(2001), at: w.tr.fs.now() }),
    ).rejects.toThrow('too-long');
  });
});

describe("the client's logged workout as the trainer reads it", () => {
  const full = (): Workout =>
    ({
      id: 'w1',
      startedAt: NOW - 86_400_000,
      finishedAt: NOW - 82_000_000,
      autoFinished: false,
      gymId: 'iron-yard',
      dayName: 'Lower A',
      targetMuscles: ['quads'],
      kind: null,
      homeSetId: null,
      exercises: [
        {
          id: 'e1',
          name: 'Barbell Squat',
          kind: 'strength',
          position: 0,
          plannedSets: 4,
          plannedReps: 5,
          planItemId: 'it1',
          equipment: ['barbell'],
          equipmentItems: ['barbell-olympic', 'belt'],
          groupId: 'g',
          groupOrder: 0,
          groupKind: 'superset',
          primaryMuscle: 'quads',
          secondaryMuscles: ['glutes'],
          measure: 'reps',
          sets: [
            {
              id: 's1',
              position: 0,
              reps: 5,
              weight: 100,
              isWarmup: false,
              rpe: 8,
              loggedAt: NOW - 85_000_000,
              restSec: 150,
              failure: 'manual',
              partials: 2,
              type: 'working',
              restTargetSec: 150,
              rpeAuto: 7,
            },
            {
              id: 's2',
              position: 1,
              reps: 8,
              weight: 60,
              isWarmup: true,
              warmupManual: true,
              type: 'warmup',
            },
            {
              id: 's3',
              position: 2,
              reps: 5,
              weight: 90,
              isWarmup: false,
              type: 'drop',
              drops: [{ weight: 70, reps: 6 }] as never,
            },
          ],
        },
        {
          id: 'e2',
          name: 'Plank',
          kind: 'strength',
          position: 1,
          measure: 'hold',
          sets: [{ id: 's4', position: 0, reps: 0, weight: null, isWarmup: false, durationMin: 1 }],
        },
        {
          id: 'e3',
          name: 'Rowing',
          kind: 'cardio',
          position: 2,
          sets: [
            {
              id: 's5',
              position: 0,
              reps: 0,
              weight: null,
              isWarmup: false,
              durationMin: 12,
              distanceKm: 2.5,
              calories: 120,
              speedKmh: 12,
              inclinePct: 1,
              watts: 150,
              level: 5,
              floors: 0,
            },
          ],
        },
        {
          id: 'e4',
          name: 'Warm-up',
          kind: 'warmup',
          position: 3,
          warmupMeasuredSec: 300,
          warmupItems: [
            { id: 'wi', name: 'Goblet Squat', reps: 8, weight: 12, done: true },
          ] as never,
          sets: [],
        },
      ],
    }) as unknown as Workout;

  it('the sealed workout the trainer opens is the one the client logged, field for field (planItemId included)', async () => {
    const w = await linkUp({ totals: 'full', sets: 'full' });
    const m = w.cl.vault.materialOrNull()!;
    const wk = full();
    await w.cl.fs.set(
      `users/${C}/workouts/w1`,
      (await sealDoc('workouts', wk as never, m.key, m.salt)) as never,
    );
    const res = await w.tr.fs.call<{
      results: { sets: { docs: Record<string, unknown>[] } };
      grant: unknown;
    }>('coachRead', { clientId: C, categories: ['sets'], via: 'client360' });
    expect(res.results.sets.docs).toHaveLength(1);
    const opened = await unsealDoc<Record<string, unknown>>(res.results.sets.docs[0], m.key);
    expect(opened).toEqual(clone(wk));
    // what the strength view derives from it: working strength sets with a load; holds, cardio and warm-ups are not lifts
    const lifts = workoutsToLifts([wk]);
    expect(lifts.map((l) => l.name)).toEqual(['Barbell Squat']);
    expect(lifts[0].sessions?.[0]).toMatchObject({ workingSets: 2 });
  });
});

describe('gym names reach a device that does not own the gym', () => {
  it("the member sees the trainer's gym name, not its id", async () => {
    const w = await linkUp();
    configureScheduleGyms(() => [{ id: 'gym-7f3a', name: 'Iron Yard, Kyiv', short: 'Iron Yard' }]);
    await w.tr.schedule.saveDoc({
      clientId: C,
      rev: 0,
      patterns: [],
      cancelled: [],
      exceptions: [],
      oneOffs: [{ id: 'o1', day: 20_010, start: '09:00', dur: 60, gymId: 'gym-7f3a' }],
    });
    configureScheduleGyms(null); // this device (the member's) has no such gym
    forgetGymNames();
    expect(gymName('gym-7f3a')).toBe('gym-7f3a');
    await settle(80);
    await docs(w, 'cl');
    expect(gymName('gym-7f3a')).toBe('Iron Yard, Kyiv');
  });
});
