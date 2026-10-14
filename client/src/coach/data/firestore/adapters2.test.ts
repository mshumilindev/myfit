// @vitest-environment node
import { inviteLink } from '../../inviteLink';
import { describe, expect, it, vi } from 'vitest';
import { createSealedNotesPort } from '../../notes/sealedPort';
import type { Note } from '../../notes/types';
import { createSealedSchedulePort } from '../../schedule/sealedPort';
import { emptyDoc, type RescheduleRequest } from '../../schedule/types';
import type { ScheduleData } from '../../schedule/port';
import { createFirestoreClientPort } from './clientPort';
import { keepCoachKeySigned } from './coachKeySigned';
import { createFirestoreInvitePort } from './invitePort';
import { createFirestoreLivePort } from './livePort';
import { createFirestoreNotesStore } from './notesDocStore';
import { createRingBook } from './ringBook';
import { createFirestoreScheduleStore } from './scheduleDocStore';
import { createDeviceSigner, memorySignerStorage } from './signerStore';
import { createSharesPublisher, buildSetsView } from './sharesPublisher';
import { C, CID, NOW, T, makeWorld } from './testWorld';
import { createFirestoreChatPort } from './chatPort';
import { createServerSigningLoader } from './trust';
import { generateSigningKey } from '../../chat/chatSignature';
import { ALL_OFF } from '../../domain/consent';
import type { Workout } from '../../../types';

const tick = () => new Promise((r) => setTimeout(r, 0));
async function until<T>(f: () => T | undefined | null | false, ms = 1500): Promise<T> {
  const t0 = Date.now();
  for (;;) {
    const v = f();
    if (v) return v;
    if (Date.now() - t0 > ms) throw new Error('timeout');
    await tick();
  }
}

describe('ring book', () => {
  it('primes the trainer ring once the client published the key, and reports an ended conversation', async () => {
    const w = await makeWorld();
    const ended: string[] = [];
    const book = createRingBook({
      fs: w.fs,
      rings: w.trainerRings,
      uid: T,
      side: 'trainer',
      onEnded: (cid) => ended.push(cid),
    });
    book.start();
    await book.ready();
    expect(book.cidOf(C)).toBe(CID);
    expect(book.ringFor(C)).toBeNull(); // no key published yet
    await w.publishKey();
    await until(() => book.ringFor(C));
    expect(book.ringFor(C)?.epoch).toBe(1);
    const cur = await w.fs.get(`conversations/${CID}`);
    w.fs.seed(`conversations/${CID}`, { ...cur!, active: false });
    await until(() => ended.length);
    expect(ended).toEqual([CID]);
    expect(book.cidOf(C)).toBeNull();
  });
});

describe('notes over the firestore store', () => {
  async function setup() {
    const w = await makeWorld();
    await w.publishKey();
    w.trainerBook.start();
    await w.trainerBook.ready();
    await until(() => w.trainerBook.ringFor(C));
    const store = createFirestoreNotesStore({ fs: w.fs, book: w.trainerBook, uid: T });
    const port = createSealedNotesPort({
      store,
      vault: w.tv,
      ringFor: w.trainerBook.ringFor,
      uid: T,
      now: () => NOW,
    });
    return { w, port };
  }

  it('stores a private note sealed under the trainer, a shared one under the conversation, and moves between them atomically', async () => {
    const { w, port } = await setup();
    let latest: Note[] = [];
    const off = port.subscribe(
      C,
      (n) => (latest = n),
      (e) => {
        throw e;
      },
    );
    const priv = await port.add({
      clientId: C,
      text: 'knee clicks on deep squats',
      vis: 'private',
      anchor: { kind: 'none' },
    });
    const shared = await port.add({
      clientId: C,
      text: 'Great week, keep it up',
      vis: 'shared',
      anchor: { kind: 'none' },
    });
    expect(w.fs.dump()).not.toContain('knee clicks');
    expect(w.fs.dump()).not.toContain('Great week');
    expect(w.fs.has(`users/${T}/clientNotes/${priv.id}`)).toBe(true);
    expect(w.fs.has(`conversations/${CID}/notes/${shared.id}`)).toBe(true);
    await until(() => latest.length === 2);
    expect(latest.map((n) => n.vis).sort()).toEqual(['private', 'shared']);

    await port.setVis(C, priv.id, 'shared');
    expect(w.fs.has(`users/${T}/clientNotes/${priv.id}`)).toBe(false);
    expect(w.fs.has(`conversations/${CID}/notes/${priv.id}`)).toBe(true);
    await until(() => latest.filter((n) => n.vis === 'shared').length === 2);

    await port.remove(C, shared.id);
    await until(() => latest.length === 1);
    expect(w.fs.has(`conversations/${CID}/notes/${shared.id}`)).toBe(false);
    off();
  });

  it('refuses a shared note while the conversation key is not held (no plaintext fallback)', async () => {
    const w = await makeWorld(); // key never published
    w.trainerBook.start();
    await w.trainerBook.ready();
    const port = createSealedNotesPort({
      store: createFirestoreNotesStore({ fs: w.fs, book: w.trainerBook, uid: T }),
      vault: w.tv,
      ringFor: w.trainerBook.ringFor,
      uid: T,
    });
    await expect(
      port.add({ clientId: C, text: 'secret', vis: 'shared', anchor: { kind: 'none' } }),
    ).rejects.toThrow('chat-key-missing');
    expect(w.fs.dump()).not.toContain('secret');
  });
});

describe('schedule over the firestore store', () => {
  const req = (over: Partial<RescheduleRequest> = {}): RescheduleRequest => ({
    id: 'rq1',
    clientId: C,
    from: 'trainer',
    slotKey: 'sk_0123456789abcdef',
    fromStart: NOW + 86_400_000,
    toStart: NOW + 2 * 86_400_000,
    note: 'Gym is closed',
    status: 'pending',
    createdAt: NOW,
    expiresAt: NOW + 5 * 86_400_000,
    scope: 'one',
    ...over,
  });

  async function setup() {
    const w = await makeWorld();
    await w.publishKey();
    w.trainerBook.start();
    w.clientBook.start();
    await w.trainerBook.ready();
    await w.clientBook.ready();
    await until(() => w.trainerBook.ringFor(C) && w.clientBook.ringFor(C));
    // the callables are functions-only writers: emulate their effect on the store
    w.fs.onCall('rescheduleCreate', (data) => {
      const r = (data as { request: Record<string, unknown> }).request;
      return w.fs.set(`conversations/${CID}/requests/${String(r.id)}`, r);
    });
    w.fs.onCall('rescheduleRespond', async (data) => {
      const p = `conversations/${CID}/requests/${String(data.id)}`;
      await w.fs.update(p, { status: data.status, decidedAt: NOW + 1 });
    });
    const trainer = createSealedSchedulePort({
      store: createFirestoreScheduleStore({ fs: w.fs, book: w.trainerBook }),
      vault: w.tv,
      ringFor: w.trainerBook.ringFor,
      uid: T,
      now: () => NOW,
    });
    const client = createSealedSchedulePort({
      store: createFirestoreScheduleStore({ fs: w.fs, book: w.clientBook }),
      vault: w.cv,
      ringFor: w.clientBook.ringFor,
      uid: C,
      now: () => NOW,
    });
    return { w, trainer, client };
  }

  it('the trainer saves a doc (rev check), the client reads it; nothing readable is stored', async () => {
    const { w, trainer, client } = await setup();
    let seen: ScheduleData | null = null;
    client.subscribe(
      (d) => (seen = d),
      (e) => {
        throw e;
      },
    );
    const saved = await trainer.saveDoc({
      ...emptyDoc(C),
      oneOffs: [
        {
          id: 'o1',
          day: 20_000,
          start: '07:30',
          dur: 60,
          gymId: 'iron-yard',
          note: 'Heavy squats',
        },
      ],
    });
    expect(saved.rev).toBe(1);
    expect(w.fs.dump()).not.toContain('Heavy squats');
    expect(w.fs.dump()).not.toContain('iron-yard');
    const got = await until(() => (seen as ScheduleData | null)?.docs[0]);
    expect(got.oneOffs[0].note).toBe('Heavy squats');
    // a stale writer loses
    await expect(trainer.saveDoc({ ...saved, rev: 0 })).rejects.toMatchObject({ code: 'conflict' });
    const again = await trainer.saveDoc(saved);
    expect(again.rev).toBe(2);
  });

  it('requests go through the callables (sealed content, open fields only) and the other side answers by status', async () => {
    const { w, trainer, client } = await setup();
    let seen: ScheduleData | null = null;
    client.subscribe(
      (d) => (seen = d),
      (e) => {
        throw e;
      },
    );
    await trainer.createRequest(req());
    expect(w.fs.calls.map((c) => c.name)).toEqual(['rescheduleCreate']);
    expect(JSON.stringify(w.fs.calls[0].data)).not.toContain('Gym is closed');
    const r = await until(() => (seen as ScheduleData | null)?.requests[0]);
    expect(r).toMatchObject({
      id: 'rq1',
      note: 'Gym is closed',
      status: 'pending',
      from: 'trainer',
    });
    await client.setStatus(r, 'accepted', NOW + 1);
    expect(w.fs.calls[1]).toMatchObject({
      name: 'rescheduleRespond',
      data: { clientId: C, id: 'rq1', status: 'accepted' },
    });
    await until(() => (seen as ScheduleData | null)?.requests[0]?.status === 'accepted');
  });
});

describe('invite port', () => {
  it('maps the callable result and keeps the reason code of a refusal', async () => {
    const w = await makeWorld();
    w.fs.onCall('coachInvite', (d) => {
      if (d.name === 'x') throw Object.assign(new Error('invalid-name'), { status: 400 });
      return {
        inviteId: 'tok1',
        name: d.name,
        mode: d.mode,
        url: 'https://spotter.app/i/tok1',
        sentAt: NOW,
        expiresAt: NOW + 1,
      };
    });
    const port = createFirestoreInvitePort(w.fs);
    const r = await port.create({
      name: 'Oleh',
      mode: 'app',
      request: { ...ALL_OFF, totals: 'full' },
    });
    // the link is always `<origin>/#/invite/<token>` (iteration 14: one helper, `coach/inviteLink.ts`)
    expect(r).toMatchObject({ id: 'tok1', url: inviteLink('tok1') });
    expect(w.fs.calls[0].data).toMatchObject({
      name: 'Oleh',
      mode: 'app',
      request: { totals: 'full' },
    });
    await expect(port.create({ name: 'x', mode: 'app', request: ALL_OFF })).rejects.toMatchObject({
      code: 'unavailable',
      message: 'invalid-name',
    });
    // program-only: the request is cut to nothing before it leaves the device
    w.fs.onCall('coachInvite', (d) => ({
      inviteId: 'pc-1',
      name: d.name,
      mode: 'program',
      url: null,
      sentAt: NOW,
      expiresAt: null,
      clientId: 'pc-1',
    }));
    await port.create({ name: 'Maria', mode: 'program', request: { ...ALL_OFF, totals: 'full' } });
    expect((w.fs.calls[2].data.request as Record<string, string>).totals).toBe('off');
  });
});

describe('client port', () => {
  it('derives none / waiting / active / revoked and maps the actions to callables', async () => {
    const w = await makeWorld();
    w.fs.onCall('coachMyLink', () => ({
      linked: true,
      trainer: { id: T, name: 'Iryna' },
      since: NOW,
      cid: CID,
      mode: 'app',
    }));
    w.fs.onCall('setConsent', () => ({}));
    w.fs.onCall('coachEnd', () => ({ ok: true }));
    const left = vi.fn();
    const port = createFirestoreClientPort({ fs: w.fs, vault: w.cv, uid: C, onLeft: left });
    const states: string[] = [];
    port.subscribe(
      (s) => states.push(s.link.state),
      () => undefined,
    );
    await until(() => states.length);
    // coaching doc has no consent/version yet and no grant doc -> waiting
    expect(states.at(-1)).toBe('waiting');
    w.fs.seed(`users/${C}/grants/${T}`, { fp: 'x' });
    await until(() => states.at(-1) === 'active');
    expect(port.peek()?.link.trainer).toMatchObject({ id: T, name: 'Iryna' });
    // everything off after a change of consent = the client stopped sharing
    w.fs.seed(`coaching/${C}`, {
      keyEpoch: 1,
      trainerId: T,
      status: 'active',
      mode: 'app',
      consentVersion: 3,
      consent: {},
    });
    await until(() => states.at(-1) === 'revoked');
    const { previous } = await port.revoke();
    expect(previous).toBeDefined();
    await port.restore({ ...ALL_OFF, totals: 'full' });
    await port.setLevel('sets', 'effects');
    const writes = w.fs.calls.filter((c) => c.name !== 'coachMyLink');
    expect(writes.map((c) => c.name)).toEqual(['setConsent', 'setConsent', 'setConsent']);
    expect(writes[2].data).toEqual({ category: 'sets', level: 'effects' });
    await port.leave();
    expect(w.fs.calls.at(-1)).toMatchObject({ name: 'coachEnd', data: { clientId: C } });
    expect(left).toHaveBeenCalledWith(CID);
  });

  it('seals the "with my coach" days with the member key', async () => {
    const w = await makeWorld();
    const port = createFirestoreClientPort({ fs: w.fs, vault: w.cv, uid: C });
    await port.setSelfCoachDays(['Tue', 'Fri', 'Nope']);
    const raw = await w.fs.get(`users/${C}/meta/selfCoach`);
    // compare the quoted token: bare 3 letters can occur by chance in base64 ciphertext
    expect(JSON.stringify(raw)).not.toContain('"Tue"');
    expect(raw).toHaveProperty('enc');
  });

  it('maps the invite preview problems and the audit log', async () => {
    const w = await makeWorld();
    w.fs.onCall('coachInvitePreview', (d) => ({
      kind: 'link',
      trainerName: 'Iryna',
      expiresAt: NOW,
      problem: d.token === 'old' ? 'claimed' : null,
    }));
    w.fs.seed(`users/${C}/audit/a1`, { category: 'sets', via: 'live', at: 5, lastAt: 9, count: 2 });
    w.fs.seed(`users/${C}/audit/a2`, { category: 'bogus', via: 'view', at: 6 });
    const port = createFirestoreClientPort({ fs: w.fs, vault: w.cv, uid: C });
    expect(await port.getInvite('old')).toMatchObject({ state: 'used', trainerName: 'Iryna' });
    expect(await port.getInvite('new')).toMatchObject({ state: 'valid' });
    expect(await port.accessLog()).toEqual([
      { id: 'a1', at: 9, category: 'sets', what: 'live', count: 2 },
    ]);
  });
});

describe('live port', () => {
  it('lists the presence docs of my active clients with roster names and drops the others', async () => {
    const w = await makeWorld();
    w.fs.onCall('coachClients', () => ({
      clients: [
        { clientId: C, name: 'Oleh K', status: 'active' },
        { clientId: 'c9', name: 'Pending', status: 'pending' },
      ],
    }));
    w.fs.seed(`liveSessions/${C}`, {
      id: C,
      trainerId: T,
      startedAt: NOW - 600_000,
      updatedAt: NOW - 10_000,
    });
    w.fs.seed('liveSessions/c9', { id: 'c9', trainerId: T, startedAt: NOW, updatedAt: NOW });
    w.fs.seed('liveSessions/other', {
      id: 'other',
      trainerId: 'someone-else',
      startedAt: NOW,
      updatedAt: NOW,
    });
    const port = createFirestoreLivePort({ fs: w.fs });
    const got = await new Promise<unknown[]>((res, rej) => {
      const off = port.subscribe(
        T,
        (s) => {
          off();
          res(s);
        },
        rej,
      );
    });
    expect(got).toEqual([
      expect.objectContaining({
        clientId: C,
        athleteName: 'Oleh K',
        trainerId: T,
        finishedAt: null,
      }),
    ]);
  });
});

describe('device signer', () => {
  it('publishes the public key before it hands out the private one, fails closed offline and reuses the key', async () => {
    const w = await makeWorld();
    const storage = memorySignerStorage();
    let online = false;
    w.fs.onCall('coachPublishSignKey', () => {
      if (!online) throw new Error('offline');
      return {};
    });
    const signer = createDeviceSigner({ fs: w.fs, uid: C, storage, generate: generateSigningKey });
    expect(await signer()).toBeNull();
    online = true;
    const k = await signer();
    expect(k?.kid).toMatch(/^[0-9a-f]{16}$/);
    expect(k?.privateKey.extractable).toBe(false);
    const again = await createDeviceSigner({ fs: w.fs, uid: C, storage })();
    expect(again?.kid).toBe(k?.kid);
    expect(w.fs.calls.filter((c) => c.name === 'coachPublishSignKey')).toHaveLength(2); // 1 failed + 1 ok, none after
  });
});

describe('coach key signature keeper', () => {
  it('asks the server to sign an unsigned key once and leaves a signed one alone', async () => {
    const w = await makeWorld();
    w.fs.seed(`coachKeys/${T}`, { pub: w.rec.pub, updatedAt: NOW });
    let signs = 0;
    w.fs.onCall('coachKeySign', async () => {
      signs++;
      await w.fs.update(`coachKeys/${T}`, { sig: 's', kid: 'srv1', signedAt: NOW + 1 });
      return {};
    });
    const off = keepCoachKeySigned(w.fs, T);
    await until(() => signs === 1);
    await tick();
    await tick();
    expect(signs).toBe(1);
    off();
  });
});

describe('effects publisher', () => {
  const wk = (id: string, day: number, kg: number): Workout =>
    ({
      id,
      startedAt: NOW - day * 86_400_000,
      finishedAt: NOW - day * 86_400_000 + 3_600_000,
      autoFinished: false,
      exercises: [
        {
          id: 'e1',
          name: 'Bench Press',
          sets: [{ id: 's1', reps: 5, weight: kg, isWarmup: false }],
        },
      ],
    }) as unknown as Workout;

  it('writes weekly aggregates sealed, only at effects, only when changed, and removes them after', async () => {
    const w = await makeWorld();
    const pub = createSharesPublisher({ fs: w.fs, vault: w.cv, uid: C });
    const ws = [wk('a', 3, 80), wk('b', 10, 85)];
    await pub.sync({ consent: { ...ALL_OFF, sets: 'full' }, workouts: ws });
    expect(w.fs.has(`users/${C}/shares/sets`)).toBe(false);
    await pub.sync({ consent: { ...ALL_OFF, sets: 'effects' }, workouts: ws });
    const raw = await w.fs.get(`users/${C}/shares/sets`);
    expect(raw).toMatchObject({ category: 'sets', level: 'effects', v: 1 });
    expect(JSON.stringify(raw)).not.toContain('Bench');
    const writes = w.fs.writes.length;
    await pub.sync({ consent: { ...ALL_OFF, sets: 'effects' }, workouts: ws });
    expect(w.fs.writes.length).toBe(writes);
    await pub.sync({ consent: { ...ALL_OFF, sets: 'off' }, workouts: ws });
    expect(w.fs.has(`users/${C}/shares/sets`)).toBe(false);
  });

  it('builds no sessions, only weeks per lift', () => {
    const v = buildSetsView([wk('a', 3, 80), wk('b', 4, 82.5)], NOW);
    expect(v.lifts).toHaveLength(1);
    expect(v.lifts[0].weeks.length).toBeGreaterThan(0);
    expect(JSON.stringify(v)).not.toContain('"sessions"');
  });
});

describe('chat paging and relationship end', () => {
  it('fetches one extra row to know hasMore and never shows it; reports an ended conversation', async () => {
    const w = await makeWorld();
    await w.publishKey();
    const ended: string[] = [];
    const signing = createServerSigningLoader(w.fs);
    void signing;
    const port = createFirestoreChatPort({
      fs: w.fs,
      vault: w.tv,
      uid: T,
      side: 'trainer',
      rings: w.trainerRings,
      onEnded: (cid) => ended.push(cid),
    });
    const client = createFirestoreChatPort({
      fs: w.fs,
      vault: w.cv,
      uid: C,
      side: 'client',
      rings: w.clientRings,
    });
    for (let i = 0; i < 4; i++)
      await client.send(CID, {
        id: `m${i}`,
        text: `hello ${i}`,
        at: NOW + i,
        state: 'sending',
      } as never);
    const page = await new Promise<{ n: number; hasMore: boolean | undefined }>((res, rej) => {
      const off = port.subscribeMessages(
        CID,
        (m, meta) => {
          if (m.length) {
            off();
            res({ n: m.length, hasMore: meta?.hasMore });
          }
        },
        rej,
        { limit: 3 },
      );
    });
    expect(page).toEqual({ n: 3, hasMore: true });
    const all = await new Promise<{ n: number; hasMore: boolean | undefined }>((res, rej) => {
      const off = port.subscribeMessages(
        CID,
        (m, meta) => {
          if (m.length) {
            off();
            res({ n: m.length, hasMore: meta?.hasMore });
          }
        },
        rej,
        { limit: 4 },
      );
    });
    expect(all).toEqual({ n: 4, hasMore: false });

    const off = port.subscribeThreads(
      T,
      () => undefined,
      () => undefined,
    );
    await tick();
    await tick();
    const cur = await w.fs.get(`conversations/${CID}`);
    w.fs.seed(`conversations/${CID}`, { ...cur!, active: false });
    await until(() => ended.length);
    expect(ended).toEqual([CID]);
    off();
  });
});
