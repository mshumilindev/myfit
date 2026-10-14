/**
 * The Live feed end to end (plan-backend section 9): the member's writer -> ONE small sealed doc -> the trainer's
 * port. Sets and weights exist only after the session ended; consent and locks cut at the writer; presence-only when
 * the key is missing.
 */
import { describe, expect, it } from 'vitest';
import type { Vault } from '../../../autoVault';
import type { Workout } from '../../../types';
import type { CoachLiveSession } from '../../screens/live/port';
import { createFirestoreLivePort } from './livePort';
import { LIVE_BEAT_MS, createLiveWriter, finalOf, type LiveWriterInput } from './liveWriter';
import { createRingBook } from './ringBook';
import { C, CID, NOW, T, makeWorld } from './testWorld';

const set = (id: string, reps: number, weight: number, warm = false) => ({
  id,
  reps,
  weight,
  isWarmup: warm,
});
const wk = (over: Partial<Workout> = {}): Workout =>
  ({
    id: 'w1',
    startedAt: NOW - 600_000,
    finishedAt: null,
    autoFinished: false,
    gymId: 'g1',
    dayName: 'Lower A',
    exercises: [
      {
        id: 'e1',
        name: 'Secret Squat Variant',
        position: 0,
        sets: [set('s0', 5, 20, true), set('s1', 5, 100), set('s2', 5, 100)],
      },
      { id: 'e2', name: 'Secret Lunge', position: 1, sets: [set('s3', 10, 40)] },
    ],
    ...over,
  }) as unknown as Workout;

const input = (over: Partial<LiveWriterInput> = {}): LiveWriterInput => ({
  active: true,
  trainerId: T,
  cid: CID,
  totals: 'full',
  workouts: [wk()],
  athleteName: 'Anna Secretname',
  gymName: (id) => (id === 'g1' ? 'Iron Temple Gym' : null),
  ...over,
});

async function setup() {
  const w = await makeWorld();
  await w.publishKey();
  w.clientBook.start();
  await w.clientBook.ready();
  const writer = createLiveWriter({
    fs: w.fs,
    vault: w.cv,
    uid: C,
    ring: async () => w.clientBook.ringFor(C)!,
  });
  const tb = createRingBook({ fs: w.fs, rings: w.trainerProvider(), uid: T, side: 'trainer' });
  tb.start();
  await tb.ready();
  const port = (over: Partial<Parameters<typeof createFirestoreLivePort>[0]> = {}) =>
    createFirestoreLivePort({
      fs: w.fs,
      roster: async () => [{ clientId: C, name: 'Anna' }],
      vault: w.tv,
      ringForEpoch: tb.ringForEpoch,
      ...over,
    });
  const read = (p = port()) =>
    new Promise<CoachLiveSession[]>((res, rej) => {
      const off = p.subscribe(
        T,
        (s) => {
          off();
          res(s);
        },
        rej,
      );
    });
  return { w, writer, port, read, tb };
}

describe('live feed', () => {
  it('round trip: the trainer sees gym, exercise count, session name and the last session', async () => {
    const { w, writer, read } = await setup();
    const prev = wk({
      id: 'w0',
      startedAt: NOW - 90_000_000,
      finishedAt: NOW - 86_000_000,
      dayName: 'Upper B',
    });
    await writer.sync(input({ workouts: [prev, wk()] }));
    const [s] = await read();
    expect(s.athleteName).toBe('Anna'); // the roster name wins
    expect(s.gymName).toBe('Iron Temple Gym');
    expect(s.exerciseCount).toBe(2);
    expect(s.sessionName).toBe('Lower A');
    expect(s.lastName).toBe('Upper B');
    expect(s.lastSets).toBe(3);
    expect(s.lastTonnageKg).toBe(1400);
    expect(s.finishedAt).toBeNull();
    // nothing about sets while it runs
    expect(s.finalSets).toBeUndefined();
    expect(s.finalTonnageKg).toBeUndefined();
    // the stored doc is sealed: no plaintext of the content
    const dump = w.fs.dump();
    for (const t of ['Iron Temple', 'Lower A', 'Secret', 'Secretname', 'Upper B'])
      expect(dump).not.toContain(t);
    const doc = (await w.fs.get(`liveSessions/${C}`))!;
    expect(Object.keys(doc).sort()).toEqual([
      'enc',
      'id',
      'keyEpoch',
      'startedAt',
      'trainerId',
      'updatedAt',
    ]);
  });

  it('heartbeat: only updatedAt is written, and only every 45 s', async () => {
    const { w, writer } = await setup();
    await writer.sync(input());
    const before = (await w.fs.get(`liveSessions/${C}`))!;
    w.fs.setNow(NOW + 10_000);
    await writer.beat();
    expect((await w.fs.get(`liveSessions/${C}`))!.updatedAt).toBe(before.updatedAt);
    w.fs.setNow(NOW + LIVE_BEAT_MS + 1);
    await writer.beat();
    const after = (await w.fs.get(`liveSessions/${C}`))!;
    expect(after.updatedAt).toBe(NOW + LIVE_BEAT_MS + 1);
    expect(after.enc).toEqual(before.enc);
  });

  it('finish: final sets and tonnage appear only after the end', async () => {
    const { w, writer, read } = await setup();
    await writer.sync(input());
    const done = wk({ finishedAt: NOW - 1000 });
    await writer.sync(input({ workouts: [done] }));
    const [s] = await read();
    expect(s.finishedAt).toBe(NOW - 1000);
    expect(s.finalSets).toBe(3);
    expect(s.finalTonnageKg).toBe(1400);
    expect(finalOf(done)).toEqual({ sets: 3, tonnageKg: 1400 });
    const doc = (await w.fs.get(`liveSessions/${C}`))!;
    expect(doc.expireAt).toBe(NOW - 1000 + 10 * 60_000);
    // a second sync of the same finished session writes nothing
    const n = w.fs.writes.length;
    await writer.sync(input({ workouts: [done] }));
    expect(w.fs.writes.length).toBe(n);
  });

  it('the reader ignores finals on a doc that is not finished', async () => {
    const { w, read } = await setup();
    const { sealOrThrow } = await import('../../../coachCrypto/sealOrThrow');
    const ring = w.clientBook.ringFor(C)!;
    const doc = await sealOrThrow(
      'liveSessions',
      {
        id: C,
        trainerId: T,
        startedAt: NOW,
        updatedAt: NOW,
        finalSets: 9,
        finalTonnageKg: 9999,
        gymName: 'G',
      },
      { vault: w.cv, ring, ctx: { messageId: C, fromUid: C, at: NOW } },
    );
    w.fs.seed(`liveSessions/${C}`, doc);
    const [s] = await read();
    expect(s.gymName).toBe('G');
    expect(s.finalSets).toBeUndefined();
    expect(s.finalTonnageKg).toBeUndefined();
  });

  it('consent: totals off or program mode removes the doc; effects hides the day name', async () => {
    const { w, writer, read } = await setup();
    await writer.sync(
      input({
        totals: 'effects',
        workouts: [
          wk({ id: 'w0', startedAt: NOW - 9e7, finishedAt: NOW - 8e7, dayName: 'Upper B' }),
          wk(),
        ],
      }),
    );
    const [s] = await read();
    expect(s.lastName).toBeUndefined();
    expect(s.lastSets).toBe(3);
    await writer.sync(input({ totals: 'off' }));
    expect(w.fs.has(`liveSessions/${C}`)).toBe(false);
    await writer.sync(input());
    expect(w.fs.has(`liveSessions/${C}`)).toBe(true);
    await writer.sync(input({ active: false }));
    expect(w.fs.has(`liveSessions/${C}`)).toBe(false);
  });

  it('fails closed: a locked vault or a missing key ring writes nothing', async () => {
    const { w } = await setup();
    const locked = { status: () => 'locked', materialOrNull: () => null } as unknown as Vault;
    const a = createLiveWriter({
      fs: w.fs,
      vault: locked,
      uid: C,
      ring: async () => w.clientBook.ringFor(C)!,
    });
    await expect(a.sync(input())).rejects.toThrow();
    const b = createLiveWriter({
      fs: w.fs,
      vault: w.cv,
      uid: C,
      ring: async () => {
        throw new Error('chat-key-missing');
      },
    });
    await expect(b.sync(input())).rejects.toThrow();
    expect(w.fs.has(`liveSessions/${C}`)).toBe(false);
    // and the queue survives a failure
    const ok = createLiveWriter({
      fs: w.fs,
      vault: w.cv,
      uid: C,
      ring: async () => w.clientBook.ringFor(C)!,
    });
    await ok.sync(input());
    expect(w.fs.has(`liveSessions/${C}`)).toBe(true);
  });

  it('presence only when the trainer has no key for the doc epoch', async () => {
    const { w, writer, port, read } = await setup();
    await writer.sync(input());
    const [s] = await read(port({ ringForEpoch: () => null }));
    expect(s.gymName).toBeUndefined();
    expect(s.exerciseCount).toBeUndefined();
    expect(s.athleteName).toBe('Anna');
    const [t] = await read(port({ vault: undefined }));
    expect(t.sessionName).toBeUndefined();
    // a tampered doc (wrong client id in the AAD) is presence only, not an error
    const doc = (await w.fs.get(`liveSessions/${C}`))!;
    w.fs.seed(`liveSessions/${C}`, { ...doc, startedAt: (doc.startedAt as number) + 1 });
    const [u] = await read();
    expect(u.gymName).toBeUndefined();
    expect(u.startedAt).toBe((doc.startedAt as number) + 1);
  });
});
