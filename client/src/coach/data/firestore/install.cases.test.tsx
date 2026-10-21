/**
 * installFirestoreCoach / installFirestoreClient / defaultWipe over the audit harness: the real server services,
 * firestore.rules enforced for both signed-in users, the real adapters. Only the Firebase boundary is a stand-in (memory
 * store); the sealed on-device store is the real one over an in-memory backend.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const local = vi.hoisted(() => ({
  current: null as null | import('../../../offline/sealedLocal').SealedLocal,
}));
const wipe = vi.hoisted(() => ({ calls: 0, throwWipe: false }));

vi.mock('../../chat/sealedLocal', async (orig) => {
  const actual = await orig<typeof import('../../chat/sealedLocal')>();
  return { ...actual, getSealedLocal: async () => local.current! };
});
vi.mock('../../../deviceWipe', () => ({
  liveEnv: async () => ({ storage: null, idb: null }),
  wipeAfterRelationshipEnd: async () => {
    wipe.calls++;
    if (wipe.throwWipe) throw new Error('boom');
    return true;
  },
}));

import { ALL_OFF } from '../../domain/consent';
import { createSealedLocal, memoryBackend, type SealedLocal } from '../../../offline/sealedLocal';
import { readyVault } from '../../../testVault';
import type { ChatPort } from '../../chat/port';
import { configureCoachData, getChatPort, getTrainerUid, getWorldPort } from '../config';
import { configureInvitePort, useCoachInvites } from '../inviteStore';
import { getSchedulePort } from '../../schedule/useSchedule';
import { getNotesPort } from '../../notes/useNotes';
import { getShareSourcePort } from '../../share/config';
import { getTrustPort } from '../../security/trustPort';
import { getLivePort } from '../../screens/live/config';
import { getProgramPort } from '../../program/config';
import { getClientChatPort, getClientPort } from '../../client/data/config';
import { freshProgram } from '../../../views/programs/model';
import { planProgramId } from '../../program/planCodec';
import { ensureGrant, type GrantPorts, type StoredGrant } from '../../../vaultGrants';
import { createDeviceSigner, memorySignerStorage } from './signerStore';
import { defaultWipe, installFirestoreClient, installFirestoreCoach } from './install';
import { createCoachKey } from '../../../vaultShare';
import { C, T, clientActor, trainerActor, deviceFs, makeServer, settle } from './parity/harness';
import { makeClient, makeTrainer } from './parity/sides';

const ac = () => ({ signal: new AbortController().signal });

/** The newest snapshot of a thread as JSON; re-subscribes until `needle` shows (a ring that arrives late is not re-emitted). */
async function readUntil(
  chat: Pick<ChatPort, 'subscribeMessages'>,
  cid: string,
  needle: string,
  refresh: () => Promise<void>,
): Promise<string> {
  let last = '';
  for (let i = 0; i < 40; i++) {
    const off = chat.subscribeMessages(
      cid,
      ((ms: unknown) => void (last = JSON.stringify(ms))) as never,
      () => undefined,
    );
    await settle(40);
    off();
    if (last.includes(needle)) return last;
    await refresh();
  }
  return last;
}

/** vaultIO.runKeyExchange(trainerId, false) over the same documents: the client's grant for the trainer's key. */
const grantPortsOf = (fs: import('./fsApi').FsApi): GrantPorts => ({
  loadOwnCoachKey: async () => null,
  saveOwnCoachKey: async () => undefined,
  publishCoachPub: async () => undefined,
  async loadCoachPub(id) {
    return ((await fs.get(`coachKeys/${id}`))?.pub as JsonWebKey | undefined) ?? null;
  },
  async loadGrant(id) {
    return (await fs.get(`users/${C}/grants/${id}`)) as unknown as StoredGrant | null;
  },
  async saveGrant(id, g) {
    await fs.set(`users/${C}/grants/${id}`, g as never);
  },
  async listGrantIds() {
    return (await fs.getDocs(`users/${C}/grants`, {})).map((r) => r.id);
  },
  async deleteGrant(id) {
    await fs.del(`users/${C}/grants/${id}`);
  },
});

/** The trainer device as makeTrainer prepares it (own coach key, signed by the server) but with NO adapters running. */
async function trainerDevice(s: Awaited<ReturnType<typeof makeServer>>) {
  const fs = deviceFs(s, trainerActor);
  const vault = await readyVault();
  const m = vault.materialOrNull()!;
  const rec = await createCoachKey(m.key, m.salt);
  await fs.set(`coachKeys/${T}`, { pub: rec.pub, updatedAt: fs.now() });
  await fs.call('coachKeySign', {});
  return { fs, vault, rec };
}

/** Polls with the real clock (the Live test fakes the interval timers, which vi.waitFor relies on). */
async function until(f: () => boolean | Promise<boolean>, ms = 5000): Promise<void> {
  const end = Date.now() + ms;
  while (!(await f())) {
    if (Date.now() > end) throw new Error('until: timed out');
    await new Promise((r) => setTimeout(r, 25));
  }
}

const SECRET_T = 'trainer-secret-plan-7731';
const SECRET_C = 'client-secret-knee-4410';

beforeEach(async () => {
  const vault = await readyVault();
  local.current = createSealedLocal({ vault, backend: memoryBackend() });
  wipe.calls = 0;
  wipe.throwWipe = false;
});
afterEach(() => {
  vi.useRealTimers();
});

describe('installFirestoreCoach', () => {
  it('wires the real ports; trainer text reaches Firestore only sealed and the linked client reads it', async () => {
    const s = await makeServer();
    const t0 = await trainerDevice(s);
    const cl = await makeClient(s);
    const wiped: string[] = [];
    const stop = installFirestoreCoach({
      fs: t0.fs,
      vault: t0.vault,
      trainer: { id: T, name: 'Iryna Melnyk' },
      loadOwnCoachKey: async () => t0.rec,
      signer: createDeviceSigner({ fs: t0.fs, uid: T, storage: memorySignerStorage() }),
      wipeCid: (cid) => void wiped.push(cid),
    });
    try {
      expect(getTrainerUid()).toBe(T);
      // invites go through the installed real invite port (a server-issued link, not a local sample)
      const inv = renderHook(() => useCoachInvites());
      let res!: Awaited<ReturnType<ReturnType<typeof useCoachInvites>['create']>>;
      await act(async () => {
        res = await inv.result.current.create({
          name: 'Oleh',
          mode: 'app',
          request: { ...ALL_OFF, totals: 'full' },
        });
      });
      const token = res.url!.split('/').pop()!;
      await cl.port.acceptInvite(token, { ...ALL_OFF, totals: 'full' });
      await settle(80);
      const cid = s.cidOf(C, T);

      // the trainer's chat port is the sealed one
      await cl.chatClient.send(cid, { id: 'h1', text: 'Hi coach', at: cl.fs.now() });
      await settle(40);
      await cl.book.refresh();
      await getChatPort().send(cid, { id: 'm1', text: SECRET_T, at: t0.fs.now() });
      await settle(40);
      expect(s.fs.dump()).not.toContain(SECRET_T);
      expect(s.fs.has(`conversations/${cid}/messages/m1`)).toBe(true);
      expect(await readUntil(cl.chat, cid, SECRET_T, () => cl.book.refresh())).toContain(SECRET_T);

      // the world of the installed port lists exactly the trainer's own client
      const w = await getWorldPort().load(ac());
      expect(w.clients.map((c) => c.id)).toEqual([C]);

      // a sent program is announced in the chat as a system card; the client reads it
      const prog = getProgramPort();
      const b = await prog.load(C, ac());
      const draft = { ...freshProgram('Block A'), id: planProgramId(C), authorId: T };
      await prog.send(C, { draft, trainerDays: ['Tue'], baseRev: b.rev });
      await cl.book.refresh();
      expect(await readUntil(cl.chat, cid, 'program-updated', () => cl.book.refresh())).toContain(
        'v1',
      );
      // once a schedule exists the world follows it without waiting
      const again = await getWorldPort().load(ac());
      expect(again.clients.map((c) => c.id)).toEqual([C]);

      // every other seam is the real adapter, not the unavailable stand-in
      await expect(
        getSchedulePort().saveDoc({
          clientId: C,
          rev: 0,
          patterns: [],
          oneOffs: [],
          exceptions: [],
          cancelled: [],
        }),
      ).resolves.toBeDefined();
      expect(s.fs.dump()).not.toContain('"patterns":[');
      expect(getNotesPort()).toBeDefined();
      expect(getShareSourcePort().peek('c1')).toBeNull();
      expect(getTrustPort()).toBeDefined();
      expect(getLivePort()).toBeDefined();
      expect(getProgramPort().library('c1')).toEqual(expect.any(Array));
      expect(t0.fs.denied).toEqual([]);

      // the relationship ends on the client side: the trainer device wipes that conversation's sealed cache
      await cl.port.leave();
      await settle(120);
      expect(wiped).toContain(cid);
    } finally {
      stop();
    }
  });

  it('without a device signing key a send fails closed (nothing unsigned is stored)', async () => {
    const s = await makeServer();
    const t0 = await trainerDevice(s);
    const cl = await makeClient(s);
    const stop = installFirestoreCoach({
      fs: t0.fs,
      vault: t0.vault,
      trainer: { id: T, name: 'Iryna' },
      loadOwnCoachKey: async () => t0.rec,
    });
    try {
      const inv = renderHook(() => useCoachInvites());
      let made!: Awaited<ReturnType<ReturnType<typeof useCoachInvites>['create']>>;
      await act(async () => {
        made = await inv.result.current.create({
          name: 'Oleh',
          mode: 'app',
          request: { ...ALL_OFF },
        });
      });
      await cl.port.acceptInvite(made.url!.split('/').pop()!, { ...ALL_OFF });
      await settle(80);
      const cid = s.cidOf(C, T);
      await expect(
        getChatPort().send(cid, { id: 'u1', text: SECRET_T, at: t0.fs.now() }),
      ).rejects.toThrow('signing-key-missing');
      expect(s.fs.has(`conversations/${cid}/messages/u1`)).toBe(false);
      expect(s.fs.dump()).not.toContain(SECRET_T);
    } finally {
      stop();
    }
  });

  it('teardown forgets the installed ports (sign-out): the chat and invite ports are no longer the real ones', async () => {
    const s = await makeServer();
    const t0 = await trainerDevice(s);
    const stop = installFirestoreCoach({
      fs: t0.fs,
      vault: t0.vault,
      trainer: { id: T, name: 'Iryna' },
      loadOwnCoachKey: async () => t0.rec,
    });
    const installed = getChatPort();
    const world = getWorldPort();
    expect(getTrainerUid()).toBe(T);
    stop();
    expect(getChatPort()).not.toBe(installed);
    expect(getWorldPort()).not.toBe(world);
    // the invite port went back to the local one: it no longer calls the server
    const callsBefore = s.fs.calls.length;
    const inv = renderHook(() => useCoachInvites());
    await act(async () => {
      await inv.result.current.create({ name: 'Local', mode: 'app', request: { ...ALL_OFF } });
    });
    expect(s.fs.calls.slice(callsBefore).filter((c) => c.name === 'coachInvite')).toEqual([]);
    configureCoachData();
    configureInvitePort((await import('../inviteStore')).createLocalInvitePort());
  });
});

describe('installFirestoreClient', () => {
  it('the member side: link, sealed chat and notes work; the member never sees another member data; teardown unwires', async () => {
    const s = await makeServer();
    const tr = await makeTrainer(s);
    // a second member and their conversation on the same server: must stay invisible to the first member
    await s.kv.set('users/client-2', {
      role: 'member',
      status: 'active',
      firstName: 'Other',
      lastName: 'M',
      username: 'other',
      trainerId: null,
    });
    // the member device: ONLY the installed adapters run on it (a second ring provider would race for the key)
    const base = { fs: deviceFs(s, clientActor), vault: await readyVault() };
    const inv = await tr.invite.create({
      name: 'Oleh',
      mode: 'app',
      request: { ...ALL_OFF, totals: 'full' },
    });
    const afterLink: (string | null)[] = [];
    let workoutsListener: (() => void) | null = null;
    const stop = installFirestoreClient({
      fs: base.fs,
      vault: base.vault,
      uid: C,
      name: () => 'Oleh',
      signer: createDeviceSigner({ fs: base.fs, uid: C, storage: memorySignerStorage() }),
      afterLink: async (tid) => {
        afterLink.push(tid);
        if (tid) await ensureGrant(base.vault, tid, grantPortsOf(base.fs));
      },
      workouts: () => [],
      onWorkouts: (f) => {
        workoutsListener = f;
        return () => {
          workoutsListener = null;
        };
      },
      wipeCid: () => undefined,
    });
    try {
      expect(workoutsListener).not.toBeNull();
      const token = inv.url!.split('/').pop()!;
      await getClientPort().acceptInvite(token, { ...ALL_OFF, totals: 'full' });
      await settle(100);
      expect(afterLink).toEqual([T]);
      const cid = s.cidOf(C, T);
      await getClientChatPort().send(cid, { id: 'c1', text: SECRET_C, at: base.fs.now() });
      await settle(50);
      expect(s.fs.dump()).not.toContain(SECRET_C);
      await tr.book.refresh();
      expect(await readUntil(tr.chat, cid, SECRET_C, () => tr.book.refresh())).toContain(SECRET_C);
      // rules: the member cannot read the other member's documents or the trainer's sealed notes of someone else
      await expect(base.fs.get('coaching/client-2')).rejects.toBeDefined();
      expect(getShareSourcePort()).toBeDefined();
      expect(getNotesPort()).toBeDefined();
      expect(getTrustPort()).toBeDefined();
      // a workout change notification does not throw even though no consent has been given yet
      workoutsListener!();
    } finally {
      const clientBefore = getClientPort();
      stop();
      expect(getClientPort()).not.toBe(clientBefore);
      expect(workoutsListener).toBeNull();
    }
  });

  it('publishes the derived sets view and the Live doc only sealed; the heartbeat touches nothing but the time', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const s = await makeServer();
    const tr = await makeTrainer(s);
    const base = { fs: deviceFs(s, clientActor), vault: await readyVault() };
    const inv = await tr.invite.create({
      name: 'Oleh',
      mode: 'app',
      request: { ...ALL_OFF, totals: 'full', sets: 'effects' },
    });
    const set = (id: string, w: number) => ({ id, reps: 5, weight: w, isWarmup: false });
    const done = {
      id: 'w-done',
      startedAt: s.fs.now() - 3 * 86_400_000,
      finishedAt: s.fs.now() - 3 * 86_400_000 + 3_600_000,
      autoFinished: false,
      gymId: 'g1',
      dayName: 'PrivateDayName',
      exercises: [
        { id: 'e1', name: 'Squat', kind: 'strength', position: 0, sets: [set('s1', 100)] },
      ],
    };
    const open = {
      id: 'w-open',
      startedAt: s.fs.now() - 600_000,
      finishedAt: null,
      autoFinished: false,
      gymId: 'g1',
      dayName: 'OpenDay',
      exercises: [{ id: 'e2', name: 'Bench', kind: 'strength', position: 0, sets: [] }],
    };
    let changed: Array<() => void> = [];
    const stop = installFirestoreClient({
      fs: base.fs,
      vault: base.vault,
      uid: C,
      name: () => 'AthleteOleh',
      signer: createDeviceSigner({ fs: base.fs, uid: C, storage: memorySignerStorage() }),
      afterLink: async (tid) => {
        if (tid) await ensureGrant(base.vault, tid, grantPortsOf(base.fs));
      },
      gyms: () => [
        {
          id: 'g1',
          name: 'PrivateGymName',
          city: '',
          amenities: [],
          machines: 0,
          equipmentIds: [],
          shareable: false,
        },
      ],
      workouts: () => [done] as never,
      liveWorkouts: () => [done, open] as never,
      onWorkouts: (f) => {
        changed.push(f);
        return () => void (changed = changed.filter((x) => x !== f));
      },
      wipeCid: () => undefined,
    });
    try {
      await getClientPort().acceptInvite(inv.url!.split('/').pop()!, {
        ...ALL_OFF,
        totals: 'full',
        sets: 'effects',
      });
      await until(() => s.fs.has(`users/${C}/shares/sets`));
      // the workout feed fires again once the key ring is there (the first attempt may precede it and is silent)
      await until(async () => {
        changed.forEach((f) => f());
        return s.fs.has(`liveSessions/${C}`);
      });
      const dump = s.fs.dump();
      for (const secret of [
        'Squat',
        'Bench',
        'PrivateDayName',
        'OpenDay',
        'PrivateGymName',
        'AthleteOleh',
      ])
        expect(dump).not.toContain(secret);
      const live0 = (await s.fs.get(`liveSessions/${C}`))!;
      expect(live0.trainerId).toBe(T);
      // the heartbeat (45 s timer) moves only updatedAt
      s.fs.setNow(s.fs.now() + 46_000);
      await vi.advanceTimersByTimeAsync(45_000);
      await until(async () => (await s.fs.get(`liveSessions/${C}`))!.updatedAt === s.fs.now());
      const live1 = (await s.fs.get(`liveSessions/${C}`))!;
      expect({ ...live1, updatedAt: 0 }).toEqual({ ...live0, updatedAt: 0 });
      // a workout change re-runs both publishers without error
      changed.forEach((f) => f());
      expect(s.fs.dump()).not.toContain('Squat');
    } finally {
      stop();
      expect(changed).toEqual([]);
    }
  });

  it('a link that ends on this device wipes that conversation locally', async () => {
    const s = await makeServer();
    const tr = await makeTrainer(s);
    const base = { fs: deviceFs(s, clientActor), vault: await readyVault() };
    const inv = await tr.invite.create({ name: 'Oleh', mode: 'app', request: { ...ALL_OFF } });
    const wiped: string[] = [];
    const stop = installFirestoreClient({
      fs: base.fs,
      vault: base.vault,
      uid: C,
      name: () => 'Oleh',
      workouts: () => [],
      onWorkouts: () => () => undefined,
      wipeCid: (cid) => void wiped.push(cid),
    });
    try {
      await getClientPort().acceptInvite(inv.url!.split('/').pop()!, { ...ALL_OFF });
      await settle(100);
      await getClientPort().leave();
      await settle(100);
      expect(wiped).toContain(s.cidOf(C, T));
    } finally {
      stop();
    }
  });
});

describe('defaultWipe', () => {
  const put = async (l: SealedLocal, k: string) => expect(await l.set(k, { secret: k })).toBe(true);

  it('removes the conversation entries and every snapshot of the other side, keeps unrelated entries', async () => {
    const l = local.current!;
    await put(l, 'threads:cid-a');
    await put(l, 'world:trainer-1');
    await put(l, 'client:client-1');
    await put(l, 'schedule:trainer-1');
    await put(l, 'draft:other-thing');
    await defaultWipe('cid-a');
    expect(await l.keys('threads:')).toEqual([]);
    expect(await l.keys('world:')).toEqual([]);
    expect(await l.keys('client:')).toEqual([]);
    expect(await l.keys('schedule:')).toEqual([]);
    expect(await l.keys('draft:')).toEqual(['draft:other-thing']);
    expect(wipe.calls).toBe(1);
  });

  it('never throws, even when the sealed store or the device wipe fail', async () => {
    local.current = {
      ...local.current!,
      wipeCid: async () => Promise.reject(new Error('io')),
    } as SealedLocal;
    wipe.throwWipe = true;
    await expect(defaultWipe('cid-a')).resolves.toBeUndefined();
    expect(wipe.calls).toBe(1);
  });
});
