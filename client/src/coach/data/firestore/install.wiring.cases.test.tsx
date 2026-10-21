/**
 * installFirestoreCoach / installFirestoreClient failure seams: a failing wipe, a Firestore that stops listening or
 * writing, the clock the ports share. Same audit harness (real server services + firestore.rules); only the Firebase
 * boundary is a stand-in, wrapped to fail on demand.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const local = vi.hoisted(() => ({
  current: null as null | import('../../../offline/sealedLocal').SealedLocal,
}));

vi.mock('../../chat/sealedLocal', async (orig) => {
  const actual = await orig<typeof import('../../chat/sealedLocal')>();
  return { ...actual, getSealedLocal: async () => local.current! };
});

import { ALL_OFF } from '../../domain/consent';
import { createSealedLocal, memoryBackend } from '../../../offline/sealedLocal';
import { readyVault } from '../../../testVault';
import { configureCoachData, getWorldPort } from '../config';
import { getSchedulePort } from '../../schedule/useSchedule';
import { getNotesPort } from '../../notes/useNotes';
import { getClientPort } from '../../client/data/config';
import { ensureGrant, type GrantPorts, type StoredGrant } from '../../../vaultGrants';
import { createDeviceSigner, memorySignerStorage } from './signerStore';
import { installFirestoreClient, installFirestoreCoach } from './install';
import { createCoachKey } from '../../../vaultShare';
import type { FsApi } from './fsApi';
import { C, T, clientActor, trainerActor, deviceFs, makeServer, settle } from './parity/harness';
import { makeClient, makeTrainer } from './parity/sides';
import { act, renderHook } from '@testing-library/react';
import { useCoachInvites } from '../inviteStore';

const ac = () => ({ signal: new AbortController().signal });

interface Flags {
  noListen: boolean;
  noWrite: boolean;
  writes: number;
}
/** The device Firestore, optionally refusing listeners (they report an error) or writes (they reject). */
function flaky(fs: FsApi, flags: Flags): FsApi {
  const refuse = () => Promise.reject(new Error('offline'));
  return new Proxy(fs, {
    get(target, prop, recv) {
      if (prop === 'listen')
        return (c: string, q: never, on: never, err: (e: unknown) => void) => {
          if (!flags.noListen) return target.listen(c, q, on, err);
          queueMicrotask(() => err(new Error('listen-failed')));
          return () => undefined;
        };
      if (prop === 'listenDoc')
        return (p: string, on: never, err: (e: unknown) => void) => {
          if (!flags.noListen) return target.listenDoc(p, on, err);
          queueMicrotask(() => err(new Error('listen-failed')));
          return () => undefined;
        };
      if (prop === 'set' || prop === 'update' || prop === 'batch' || prop === 'del')
        return (...a: unknown[]) => {
          if (flags.noWrite) {
            flags.writes++;
            return refuse();
          }
          return (target[prop] as (...x: unknown[]) => Promise<void>)(...a);
        };
      return Reflect.get(target, prop, recv);
    },
  });
}

const grantPortsOf = (fs: FsApi): GrantPorts => ({
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

async function trainerDevice(s: Awaited<ReturnType<typeof makeServer>>, flags: Flags) {
  const fs = flaky(deviceFs(s, trainerActor), flags);
  const vault = await readyVault();
  const m = vault.materialOrNull()!;
  const rec = await createCoachKey(m.key, m.salt);
  await fs.set(`coachKeys/${T}`, { pub: rec.pub, updatedAt: fs.now() });
  await fs.call('coachKeySign', {});
  return { fs, vault, rec };
}

const flags = (): Flags => ({ noListen: false, noWrite: false, writes: 0 });

beforeEach(async () => {
  local.current = createSealedLocal({ vault: await readyVault(), backend: memoryBackend() });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('installFirestoreCoach failure seams', () => {
  it('the ports share the Firestore clock', async () => {
    const s = await makeServer();
    const f = flags();
    const t0 = await trainerDevice(s, f);
    const stop = installFirestoreCoach({
      fs: t0.fs,
      vault: t0.vault,
      trainer: { id: T, name: 'Iryna' },
      loadOwnCoachKey: async () => t0.rec,
    });
    try {
      s.fs.setNow(s.fs.now() + 12_345);
      expect(getSchedulePort().now()).toBe(t0.fs.now());
      expect(getNotesPort().now()).toBe(t0.fs.now());
    } finally {
      stop();
    }
  });

  it('a wipe that rejects and a schedule feed that errors do not break the world or the end of a link', async () => {
    const s = await makeServer();
    const f = flags();
    const t0 = await trainerDevice(s, f);
    const cl = await makeClient(s);
    // the schedule documents cannot be listened to; everything else works
    const noSchedule = new Proxy(t0.fs, {
      get(target, prop, recv) {
        if (prop === 'listenDoc')
          return (p: string, on: never, err: (e: unknown) => void) => {
            if (!p.startsWith('schedules/')) return target.listenDoc(p, on, err);
            queueMicrotask(() => err(new Error('listen-failed')));
            return () => undefined;
          };
        return Reflect.get(target, prop, recv);
      },
    });
    const wipes: string[] = [];
    const stop = installFirestoreCoach({
      fs: noSchedule,
      vault: t0.vault,
      trainer: { id: T, name: 'Iryna' },
      loadOwnCoachKey: async () => t0.rec,
      wipeCid: (cid) => {
        wipes.push(cid);
        return Promise.reject(new Error('wipe-failed'));
      },
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
      const w = await getWorldPort().load(ac());
      expect(w.clients.map((c) => c.id)).toEqual([C]);
      await cl.port.leave();
      await settle(120);
      expect(wipes).toContain(s.cidOf(C, T));
    } finally {
      stop();
      configureCoachData();
    }
  });
});

describe('installFirestoreClient failure seams', () => {
  it('an offline Firestore never throws out of the workout feed, the Live heartbeat or the link listener', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const s = await makeServer();
    const tr = await makeTrainer(s);
    const f = flags();
    const fs = flaky(deviceFs(s, clientActor), f);
    const vault = await readyVault();
    const inv = await tr.invite.create({
      name: 'Oleh',
      mode: 'app',
      request: { ...ALL_OFF, totals: 'full', sets: 'effects' },
    });
    let changed: Array<() => void> = [];
    const stop = installFirestoreClient({
      fs,
      vault,
      uid: C,
      name: () => 'Oleh',
      signer: createDeviceSigner({ fs, uid: C, storage: memorySignerStorage() }),
      afterLink: async (tid) => {
        if (tid) await ensureGrant(vault, tid, grantPortsOf(fs));
      },
      workouts: () => [],
      onWorkouts: (cb) => {
        changed.push(cb);
        return () => void (changed = changed.filter((x) => x !== cb));
      },
      wipeCid: () => Promise.reject(new Error('wipe-failed')),
    });
    try {
      await getClientPort().acceptInvite(inv.url!.split('/').pop()!, {
        ...ALL_OFF,
        totals: 'full',
        sets: 'effects',
      });
      await settle(100);
      const before = s.fs.dump();
      f.noWrite = true;
      // every publisher now fails; the failures are swallowed and nothing reaches Firestore
      changed.forEach((cb) => cb());
      await vi.advanceTimersByTimeAsync(46_000);
      await settle(60);
      expect(s.fs.dump()).toBe(before);
      // leaving ends the link although the local wipe rejects
      f.noWrite = false;
      await getClientPort().leave();
      await settle(100);
    } finally {
      stop();
    }
  });

  it('a Firestore that cannot listen leaves the member app up (the link and Live listeners report errors silently)', async () => {
    const s = await makeServer();
    const f = flags();
    f.noListen = true;
    const fs = flaky(deviceFs(s, clientActor), f);
    const vault = await readyVault();
    const stop = installFirestoreClient({
      fs,
      vault,
      uid: C,
      name: () => 'Oleh',
      workouts: () => [],
      onWorkouts: () => () => undefined,
    });
    try {
      await settle(60);
      expect(getClientPort()).toBeDefined();
      // the member's schedule and notes ports read the same Firestore clock as the rest of the device
      s.fs.setNow(s.fs.now() + 777);
      expect(getSchedulePort().now()).toBe(fs.now());
      expect(getNotesPort().now()).toBe(fs.now());
    } finally {
      stop();
    }
  });
});
