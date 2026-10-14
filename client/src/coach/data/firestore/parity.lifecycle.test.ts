/**
 * Iter17 parity part 2: the lifecycle of the link over ONE shared store (real adapters on both sides, the real server
 * services on a Kv seam, firestore.rules enforced for both signed-in users). Chat tamper detection and the offline queue,
 * consent downgrade / revoke / restore with the read-audit log, ending the relationship from either side (and what is
 * left behind), live visibility, share cards that follow consent and program versions, invites and exports.
 */
import { describe, expect, it } from 'vitest';
import { C, NOW, T } from './parity/harness';
import { latest, linkUp, settle, type World } from './parity/flow';
import { createChatStore } from '../../chat/chatStore';
import { sealDoc } from '../../../encryptedDoc';
import { resolveShare } from '../../share/resolve';
import { freshProgram, type Program } from '../../../views/programs/model';
import { planProgramId } from '../../program/planCodec';
import { createFirestoreShareSource } from './shareSource';
import type { Consent } from '../../domain/types';
import type { Workout } from '../../../types';

const DAY = 86_400_000;
const ac = () => ({ signal: new AbortController().signal });
const workout = (id: string, startedAt: number, finished = true): Workout =>
  ({
    id,
    startedAt,
    finishedAt: finished ? startedAt + 3_600_000 : null,
    autoFinished: false,
    gymId: null,
    exercises: [
      {
        id: 'e' + id,
        name: 'Barbell Bench Press',
        kind: 'strength',
        position: 0,
        primaryMuscle: 'chest',
        sets: [
          { id: 's1', position: 0, reps: 5, weight: 80, isWarmup: false },
          { id: 's2', position: 1, reps: 5, weight: 82.5, isWarmup: false },
        ],
      },
    ],
    stats: { volumeKg: 825, sets: 2 },
  }) as unknown as Workout;
const seed = async (w: World, ...ws: Workout[]) => {
  const m = w.cl.vault.materialOrNull()!;
  for (const x of ws)
    await w.cl.fs.set(
      `users/${C}/workouts/${x.id}`,
      (await sealDoc('workouts', x as never, m.key, m.salt)) as never,
    );
  w.cl.workouts = ws;
};
const read = (w: World, cats: string[], via = 'client360') =>
  w.tr.fs.call<{ results: Record<string, { state: string; level?: string; docs?: unknown[] }> }>(
    'coachRead',
    {
      clientId: C,
      categories: cats,
      via,
    },
  );
type Msg = { id: string; unverified?: boolean; state?: string };
const clientThread = async (w: World) =>
  (await latest<{ messages: Msg[] }>((on, er) =>
    w.cl.chatClient.subscribe(w.cid, on as never, er),
  ))!.messages;
const trainerThread = async (w: World) =>
  (await latest<Msg[]>((on, er) => w.tr.chat.subscribeMessages(w.cid, on as never, er))) ?? [];
const denied = (w: World) => ({ c: w.cl.fs.denied, t: w.tr.fs.denied });

describe('tamper detection', () => {
  it('a changed ciphertext or signature shows as unverified with no content, on both sides', async () => {
    const w = await linkUp();
    await w.tr.chat.send(w.cid, { id: 't0', text: 'One', at: w.tr.fs.now() });
    await w.tr.chat.send(w.cid, { id: 't1', text: 'Two', at: w.tr.fs.now() + 1 });
    await w.cl.chatClient.send(w.cid, { id: 'c0', text: 'Three', at: w.cl.fs.now() + 2 });
    await settle(40);
    expect((await clientThread(w)).filter((m) => m.unverified)).toHaveLength(0);
    const flip = async (id: string, field: 'ct' | 'sig') => {
      const p = w.s.fs.keys(`conversations/${w.cid}/messages/`).find((k) => k.endsWith('/' + id))!;
      const raw = structuredClone((await w.s.fs.get(p))!) as { enc: { ct: string }; sig: string };
      if (field === 'ct') raw.enc.ct = (raw.enc.ct[0] === 'A' ? 'B' : 'A') + raw.enc.ct.slice(1);
      else raw.sig = (raw.sig[0] === 'A' ? 'B' : 'A') + raw.sig.slice(1);
      w.s.fs.seed(p, raw);
    };
    await flip('t0', 'ct');
    await flip('t1', 'sig');
    await flip('c0', 'ct');
    const mine = await clientThread(w);
    expect(mine.find((m) => m.id === 't0')!.unverified).toBe(true);
    expect(mine.find((m) => m.id === 't1')!.unverified).toBe(true);
    const theirs = await trainerThread(w);
    expect(theirs.find((m) => m.id === 'c0')!.unverified).toBe(true);
    // untouched messages stay readable
    expect(mine.find((m) => m.id === 'hello1')!.unverified).toBeFalsy();
  });
});

describe('offline queue', () => {
  it('a message sent offline stays in the outbox as failed, goes out once when the network is back and is not doubled by a retry', async () => {
    const w = await linkUp();
    for (const [side, port, uid] of [
      ['cl', w.cl.chat, C],
      ['tr', w.tr.chat, T],
    ] as const) {
      const store = createChatStore(port as never);
      store.retain(uid);
      w[side].fs.offline = true;
      const id = store.send(w.cid, `sent offline by ${side}`);
      await settle(50);
      expect(store.getState().outbox[w.cid]?.[0]).toMatchObject({ id, state: 'failed' });
      w[side].fs.offline = false;
      window.dispatchEvent(new Event('online'));
      await settle(150);
      expect(store.getState().outbox[w.cid] ?? []).toHaveLength(0);
      store.retrySend(w.cid, id); // a late retry of a delivered message
      await settle(50);
      const list = side === 'cl' ? await trainerThread(w) : await clientThread(w);
      expect(list.filter((m) => m.id === id)).toHaveLength(1);
      store.release();
    }
  });
});

describe('consent: downgrade, revoke, restore and the read-audit log', () => {
  it('each step is what the trainer can read next, and every read the client is told about is one the server really did', async () => {
    const w = await linkUp({ totals: 'full', sets: 'full' });
    await seed(w, workout('w1', NOW - 2 * DAY), workout('w2', NOW - 5 * DAY));
    const r0 = await read(w, ['totals', 'sets']);
    expect(r0.results.sets).toMatchObject({ state: 'ok', level: 'full' });
    expect(r0.results.sets.docs).toHaveLength(2);
    // log: one row per (reader, category, via, day); repeated reads count, they do not add rows
    await settle(30);
    const a1 = await w.cl.port.accessLog();
    // the Client 360 read above (summary) and the dashboard's own load when the world was built (week)
    expect(a1.map((x) => `${x.category}/${x.what}`).sort()).toEqual([
      'sets/summary',
      'sets/week',
      'totals/summary',
      'totals/week',
    ]);
    await read(w, ['sets']);
    await read(w, ['sets']);
    expect(await w.cl.port.accessLog()).toHaveLength(a1.length);
    // a screen view the trainer's device reports is in the log too
    w.tr.readLog.logRead({ clientId: C, category: 'sets', via: 'view' } as never);
    await settle(40);
    expect((await w.cl.port.accessLog()).some((x) => x.what === 'session')).toBe(true);

    await w.cl.port.setLevel('sets', 'effects');
    expect((await read(w, ['sets'])).results.sets).toMatchObject({ state: 'ok', level: 'effects' });
    await w.cl.port.setLevel('sets', 'off');
    const off = await read(w, ['sets']);
    expect(off.results.sets).toEqual({ state: 'locked' });
    expect(w.s.fs.keys(`users/${C}/shares/`)).toEqual([]);
    // a locked category is not logged as read
    const before = (await w.cl.port.accessLog()).length;
    await read(w, ['sets']);
    expect((await w.cl.port.accessLog()).length).toBe(before);
    // the consent changes are recorded for the client
    expect(w.s.fs.keys(`users/${C}/consentLog/`).length).toBeGreaterThanOrEqual(2);

    // the roster the trainer loads follows
    const world = await w.tr.world.load(ac());
    expect(world.clients.find((c) => c.id === C)!.consent.sets).toBe('off');

    // revoke everything, then restore what there was
    const { previous } = await w.cl.port.revoke();
    await settle(30);
    const rev = await read(w, ['totals', 'sets']);
    expect(rev.results.totals.state).toBe('locked');
    expect(rev.results.sets.state).toBe('locked');
    expect(w.cl.snap()!.link.state).toBe('revoked');
    await w.cl.port.restore(previous as Consent);
    await settle(30);
    const back = await read(w, ['totals', 'sets']);
    expect(back.results.totals.state).toBe('ok'); // sets was already off before the revoke, and stays off
    expect(back.results.sets.state).toBe('locked');
    // chat is not data sharing: it keeps working through all of it
    await w.cl.port.revoke();
    await w.tr.chat.send(w.cid, { id: 'after-revoke', text: 'still here', at: w.tr.fs.now() });
    expect(denied(w)).toEqual({ c: [], t: [] });
  });
});

describe('ending the relationship', () => {
  const setup = async () => {
    const w = await linkUp({ totals: 'full', sets: 'full' });
    await seed(w, workout('w1', NOW - 2 * DAY));
    const b = await w.tr.program.load(C, ac());
    await w.tr.program.send(C, {
      draft: {
        ...freshProgram('B'),
        id: planProgramId(C),
        authorId: T,
        daysPerWeek: 1,
        items: [],
      } as Program,
      trainerDays: ['Tue'],
      baseRev: b.rev,
    });
    await w.tr.notes.add({
      clientId: C,
      text: 'shared cue',
      vis: 'shared',
      anchor: { kind: 'none' },
    });
    await w.tr.notes.add({
      clientId: C,
      text: 'private thought',
      vis: 'private',
      anchor: { kind: 'none' },
    });
    await w.cl.liveWriter.sync({
      active: true,
      trainerId: T,
      cid: w.cid,
      totals: 'full',
      workouts: [workout('lv', NOW - 600_000, false)],
      athleteName: 'Oleh',
      gymName: () => null,
    });
    await settle(30);
    return w;
  };
  const leftovers = (w: World) =>
    w.s.fs
      .keys('')
      .filter(
        (k) => /^(plans|schedules|programs|assignments|liveSessions)\//.test(k) && k.includes(C),
      );

  it('by the client: both apps leave the relationship, the trainer can read and write nothing more, the client keeps their own data', async () => {
    const w = await setup();
    expect(w.s.fs.keys('liveSessions/')).toHaveLength(1);
    expect(leftovers(w).length).toBeGreaterThan(0);
    await w.cl.port.leave();
    await settle(80);
    expect((await w.s.fs.get(`coaching/${C}`))?.status).toBe('ended');
    expect(leftovers(w)).toEqual([]); // plan, versions, runnable programs, assignment and the live doc are gone
    expect(w.s.fs.keys(`users/${C}/grants/`)).toEqual([]); // the key the trainer opened the data with
    expect(await w.s.fs.get(`users/${C}/workouts/w1`)).toBeTruthy(); // the client's own data is theirs
    expect(w.cl.ended).toContain(w.cid);
    expect(w.tr.ended).toContain(w.cid);
    expect(w.cl.snap()!.link).toMatchObject({ state: 'none', cid: null });
    expect(w.cl.snap()!.program).toBeNull();
    const world = await w.tr.world.load(ac());
    expect(world.clients.some((c) => c.id === C)).toBe(false);
    await expect(read(w, ['totals'])).rejects.toThrow('not-active');
    await expect(
      w.tr.chat.send(w.cid, { id: 'post', text: 'x', at: w.tr.fs.now() }),
    ).rejects.toBeTruthy();
    await expect(
      w.cl.chatClient.send(w.cid, { id: 'post-c', text: 'x', at: w.cl.fs.now() }),
    ).rejects.toBeTruthy();
  });

  it('by the trainer: the client app leaves too, and the same two people can link again afterwards', async () => {
    const w = await setup();
    await w.tr.world.endCoaching!(C);
    await settle(80);
    expect(w.cl.ended).toContain(w.cid);
    expect(w.cl.snap()!.link.state).toBe('none');
    expect(leftovers(w)).toEqual([]);
    const req = {
      totals: 'full',
      sets: 'off',
      checkins: 'off',
      body: 'off',
      nutrition: 'off',
      sleep: 'off',
      injury: 'off',
    } as Consent;
    const inv = await w.tr.invite.create({ name: 'Oleh', mode: 'app', request: req });
    await w.cl.port.acceptInvite(inv.url!.split('/').pop()!, req);
    await settle(120);
    expect(w.cl.snap()!.link.state).toBe('active');
    await w.cl.chatClient.send(w.cid, { id: 'again', text: 'back', at: w.cl.fs.now() });
  });
});

describe('live visibility', () => {
  it('the trainer sees a running workout; the server removes it the moment totals go off, without waiting for the phone', async () => {
    const w = await linkUp({ totals: 'full', sets: 'off' });
    const input = {
      active: true,
      trainerId: T,
      cid: w.cid,
      totals: 'full' as const,
      workouts: [workout('lv1', NOW - 600_000, false)],
      athleteName: 'Oleh',
      gymName: () => 'Iron Yard',
    };
    await w.cl.liveWriter.sync(input);
    await settle(40);
    const rows =
      (await latest<{ name?: string }[]>(
        (on, er) => w.tr.live.subscribe(T, on as never, er),
        120,
      )) ?? [];
    expect(rows).toHaveLength(1);
    await w.cl.port.setLevel('totals', 'off'); // no liveWriter.sync: the app may be closed or offline
    await settle(40);
    expect(w.s.fs.keys('liveSessions/')).toEqual([]);
    expect(
      ((await latest<unknown[]>((on, er) => w.tr.live.subscribe(T, on as never, er), 120)) ?? [])
        .length,
    ).toBe(0);
    // and back on: the next sync writes it again
    await w.cl.liveWriter.sync({ ...input, totals: 'off' }); // what the app does on the consent change
    await w.cl.port.setLevel('totals', 'full');
    await w.cl.liveWriter.sync(input);
    await settle(30);
    expect(w.s.fs.keys('liveSessions/')).toHaveLength(1);
    expect(denied(w)).toEqual({ c: [], t: [] });
  });
});

describe('share cards follow consent and versions', () => {
  it('a workout card turns locked (not "removed") when the client lowers sets; a program card follows the plan to its next version', async () => {
    const w = await linkUp({ totals: 'full', sets: 'full' });
    await seed(w, workout('w1', NOW - 2 * DAY));
    const wref = { kind: 'workout' as const, id: 'w1', ownerId: C };
    const viewer = { side: 'trainer' as const, clientId: C };
    const src1 = await w.tr.share.load(C, ac());
    expect(resolveShare(wref, viewer, src1).state).toBe('ok');
    await w.cl.port.setLevel('sets', 'effects');
    await settle(30);
    // a source built after the change (the dashboard's roster is cached for a short time)
    const fresh = createFirestoreShareSource({
      fs: w.tr.fs,
      vault: w.tr.vault,
      side: 'trainer',
      uid: T,
      loadOwnCoachKey: async () => w.tr.rec,
      plan: {
        ringFor: w.tr.book.ringFor,
        ringForEpoch: w.tr.book.ringForEpoch,
        ready: w.tr.book.ready,
      },
    });
    const lowered = resolveShare(wref, viewer, await fresh.load(C, ac()));
    expect(lowered.state).toBe('locked');
    expect(lowered).toMatchObject({ reason: { code: 'notShared', cat: 'sets' } });

    const b = await w.tr.program.load(C, ac());
    const draft = {
      ...freshProgram('Block'),
      id: planProgramId(C),
      authorId: T,
      daysPerWeek: 1,
      dayNames: { '2': 'Lower A' },
      items: [
        {
          id: 'i1',
          day: 2,
          position: 0,
          name: 'Barbell Squat',
          kind: 'strength',
          sets: 4,
          reps: 5,
          durationMin: null,
          equipment: [],
          targetWeight: 100,
        },
      ],
    } as Program;
    await w.tr.program.send(C, { draft, trainerDays: ['Tue'], baseRev: b.rev });
    const prog = (await w.tr.share.load(C, ac())).programs.find((p) => p.assignedTo.includes(C))!;
    const pref = { kind: 'program' as const, id: prog.id };
    const dref = { kind: 'day' as const, id: `${prog.id}:0` };
    expect(
      resolveShare(pref, { side: 'client', clientId: C }, await w.cl.share.load(C, ac())).state,
    ).toBe('ok');
    const b2 = await w.tr.program.load(C, ac());
    await w.tr.program.send(C, { draft: { ...b2.draft }, trainerDays: ['Tue'], baseRev: b2.rev });
    await settle(40);
    const csrc = await w.cl.share.load(C, ac());
    expect(csrc.programs.map((p) => p.id)).not.toContain(prog.id); // the old document is gone ...
    expect(resolveShare(pref, { side: 'client', clientId: C }, csrc).state).toBe('ok'); // ... the card follows the plan
    expect(resolveShare(dref, { side: 'client', clientId: C }, csrc).state).toBe('ok');
    expect(
      resolveShare(
        { kind: 'program', id: 'prg-someone-else-1' },
        { side: 'client', clientId: C },
        csrc,
      ).state,
    ).toBe('removed');
  });
});

describe('invites and exports', () => {
  it('a revoked link stops working, a new one works; an export is logged for the client', async () => {
    const w = await linkUp();
    const req = {
      totals: 'full',
      sets: 'off',
      checkins: 'off',
      body: 'off',
      nutrition: 'off',
      sleep: 'off',
      injury: 'off',
    } as Consent;
    const one = await w.tr.invite.create({ name: 'Maria', mode: 'app', request: req });
    const tok = one.url!.split('/').pop()!;
    expect((await w.cl.port.getInvite(tok)).state).toBe('valid');
    await w.tr.invite.revoke(one.id);
    expect((await w.cl.port.getInvite(tok)).state).not.toBe('valid');
    const two = await w.tr.invite.create({ name: 'Maria', mode: 'app', request: req });
    expect(two.url).not.toBe(one.url);
    expect((await w.cl.port.getInvite(two.url!.split('/').pop()!)).state).toBe('valid');

    w.tr.readLog.logRead({ clientId: C, category: 'totals', via: 'export' } as never);
    await settle(40);
    expect(
      (await w.cl.port.accessLog()).some((x) => x.category === 'totals' && x.what === 'history'),
    ).toBe(true);
    const ex = await w.tr.fs.call<{ clients: Record<string, string[]> }>('coachExport', {
      clientIds: [C],
      categories: ['totals', 'sets', 'body'],
      release: false,
    });
    expect(ex.clients[C]).toEqual(['totals', 'sets']); // only what the client shares: body is off
  });
});

describe('a decision shared with the client', () => {
  it('is a shared note the member reads; the private note beside it is never visible', async () => {
    const w = await linkUp();
    await w.tr.notes.add({
      clientId: C,
      text: 'Bench stalled: swap to paused',
      vis: 'shared',
      anchor: { kind: 'decision', id: 'd1', text: 'Bench stalled 4 weeks' },
    });
    await w.tr.notes.add({
      clientId: C,
      text: 'PRIVATE',
      vis: 'private',
      anchor: { kind: 'decision', id: 'd1' },
    });
    await settle(60);
    const { createSealedNotesPort } = await import('../../notes/sealedPort');
    const { createFirestoreNotesStore } = await import('./notesDocStore');
    const mine = createSealedNotesPort({
      store: createFirestoreNotesStore({ fs: w.cl.fs, book: w.cl.book, uid: C }),
      vault: w.cl.vault,
      ringFor: w.cl.book.ringFor,
      ringForEpoch: w.cl.book.ringForEpoch,
      uid: C,
    });
    const seen =
      (await latest<{ text: string; vis: string; anchor: { kind: string; id?: string } }[]>(
        (on, er) => mine.subscribe(C, on as never, er),
        120,
      )) ?? [];
    expect(seen.map((n) => n.text)).toEqual(['Bench stalled: swap to paused']);
    expect(seen[0].anchor).toMatchObject({ kind: 'decision', id: 'd1' });
  });
});

describe('"Private again. {name} no longer sees it."', () => {
  it('moving a note from shared to private removes it for the member, editing it updates it, and moving it back shows it again', async () => {
    const w = await linkUp();
    const n = await w.tr.notes.add({
      clientId: C,
      text: 'first',
      vis: 'shared',
      anchor: { kind: 'none' },
    });
    const { createSealedNotesPort } = await import('../../notes/sealedPort');
    const { createFirestoreNotesStore } = await import('./notesDocStore');
    const mine = createSealedNotesPort({
      store: createFirestoreNotesStore({ fs: w.cl.fs, book: w.cl.book, uid: C }),
      vault: w.cl.vault,
      ringFor: w.cl.book.ringFor,
      ringForEpoch: w.cl.book.ringForEpoch,
      uid: C,
    });
    const seen = async () =>
      (
        (await latest<{ text: string }[]>((on, er) => mine.subscribe(C, on as never, er), 120)) ??
        []
      ).map((x) => x.text);
    await settle(40);
    expect(await seen()).toEqual(['first']);
    await w.tr.notes.edit(C, n.id, 'second');
    await settle(40);
    expect(await seen()).toEqual(['second']);
    await w.tr.notes.setVis(C, n.id, 'private');
    await settle(40);
    expect(await seen()).toEqual([]);
    const own =
      (await latest<{ text: string; vis: string }[]>(
        (on, er) => w.tr.notes.subscribe(C, on as never, er),
        120,
      )) ?? [];
    expect(own.map((x) => `${x.vis}:${x.text}`)).toEqual(['private:second']); // the trainer keeps it
    await w.tr.notes.setVis(C, n.id, 'shared');
    await settle(40);
    expect(await seen()).toEqual(['second']);
  });
});

describe('what the roster knows about the program', () => {
  it('shows the program the client is on and the week they are in (not an empty name and week 0)', async () => {
    const w = await linkUp();
    const before = (await w.tr.world.load(ac())).clients.find((c) => c.id === C)!;
    expect(before.program).toBe('');
    const b = await w.tr.program.load(C, ac());
    await w.tr.program.send(C, {
      draft: {
        ...freshProgram('Strength block'),
        id: planProgramId(C),
        authorId: T,
        weeks: 6,
        daysPerWeek: 1,
        items: [],
      } as Program,
      trainerDays: ['Tue'],
      baseRev: b.rev,
    });
    const after = (await w.tr.world.load(ac())).clients.find((c) => c.id === C)!;
    expect(after.program).toBe('Strength block');
    expect(after.programWeek).toBe(1);
    expect(w.tr.fs.denied).toEqual([]);
  });
});
