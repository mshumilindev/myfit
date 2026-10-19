import { describe, expect, it, vi } from 'vitest';
import { readyVault } from '../../../testVault';
import { ALL_OFF } from '../../domain/consent';
import { ClientPortError, type ClientSnapshot } from '../../client/data/types';
import { createMemoryFs, type MemoryFs } from './memoryFs';
import { createFirestoreClientPort, type ClientPortDeps } from './clientPort';

const NOW = 1_800_000_000_000;
const ME = 'client-1';
const TR = 'trainer-1';

const link = {
  linked: true,
  trainer: { id: TR, name: 'Iryna Melnyk' },
  since: NOW - 5000,
  cid: 'cid-1',
};
const coaching = (over: Record<string, unknown> = {}) => ({
  trainerId: TR,
  status: 'active',
  mode: 'app',
  consentVersion: 2,
  consent: { totals: 'full', sets: 'effects' },
  ...over,
});

async function setup(over: Partial<ClientPortDeps> = {}) {
  const fs: MemoryFs = createMemoryFs(NOW);
  const vault = await readyVault();
  fs.onCall('coachMyLink', () => link);
  const listened: string[] = [];
  const realListen = fs.listenDoc.bind(fs);
  fs.listenDoc = (p, on, err) => {
    listened.push(p);
    return realListen(p, on, err);
  };
  const port = createFirestoreClientPort({ fs, vault, uid: ME, ...over });
  return { fs, vault, port, listened };
}

/** Subscribes and resolves with the first snapshot (or the first error). */
function first(port: ReturnType<typeof createFirestoreClientPort>) {
  return new Promise<{ snap?: ClientSnapshot; err?: ClientPortError; off: () => void }>((res) => {
    const off = port.subscribe(
      (snap) => res({ snap, off }),
      (err) => res({ err: err as ClientPortError, off }),
    );
  });
}
const settle = (ms = 20) => new Promise((r) => setTimeout(r, ms));
const err = (extra: Record<string, unknown>) => Object.assign(new Error('x'), extra);

describe('the link as the client sees it', () => {
  it('an active link with a grant is active; levels are read strictly (anything unknown is off)', async () => {
    const { fs, port } = await setup();
    fs.seed(
      `coaching/${ME}`,
      coaching({ consent: { totals: 'full', sets: 'effects', body: 'everything', sleep: 5 } }),
    );
    fs.seed(`users/${ME}/grants/${TR}`, { any: 'grant' });
    const { snap, off } = await first(port);
    off();
    expect(snap!.link.state).toBe('active');
    expect(snap!.link.grants).toEqual({ ...ALL_OFF, totals: 'full', sets: 'effects' });
    expect(snap!.link.trainer).toEqual({
      id: TR,
      name: 'Iryna Melnyk',
      org: '',
      since: NOW - 5000,
    });
    expect(snap!.link.cid).toBe('cid-1');
    expect(snap!.link.clientId).toBe(ME);
    expect(port.peek()).toBe(snap);
  });

  it('only this member own documents are ever listened to (no other client, no trainer-side path)', async () => {
    const { fs, port, listened } = await setup();
    fs.seed(`coaching/${ME}`, coaching());
    fs.seed(`users/${ME}/grants/${TR}`, {});
    const { off } = await first(port);
    off();
    expect(new Set(listened)).toEqual(
      new Set([
        `plans/${ME}`,
        `users/${ME}/notices/pu-${ME}`,
        `coaching/${ME}`,
        `users/${ME}/grants/${TR}`,
      ]),
    );
  });

  it('without the trainer grant on an in-app link the state is waiting; a program-only link never waits', async () => {
    const a = await setup();
    a.fs.seed(`coaching/${ME}`, coaching());
    const w = await first(a.port);
    w.off();
    expect(w.snap!.link.state).toBe('waiting');

    const b = await setup();
    b.fs.seed(`coaching/${ME}`, coaching({ mode: 'program', consent: {} }));
    const p = await first(b.port);
    p.off();
    expect(p.snap!.link.state).toBe('active');
  });

  it('sharing nothing after having shared is revoked; a never-shared link and a program link are not', async () => {
    const mk = async (c: Record<string, unknown>) => {
      const s = await setup();
      s.fs.seed(`coaching/${ME}`, coaching(c));
      s.fs.seed(`users/${ME}/grants/${TR}`, {});
      const r = await first(s.port);
      r.off();
      return r.snap!.link;
    };
    expect((await mk({ consent: {}, consentVersion: 3 })).state).toBe('revoked');
    expect((await mk({ consent: {}, consentVersion: 1 })).state).toBe('active');
    expect((await mk({ consent: { checkins: 'full' }, consentVersion: 3 })).state).toBe('revoked'); // check-ins alone do not count
    expect((await mk({ consent: { totals: 'effects' }, consentVersion: 3 })).state).toBe('active');
  });

  it('a link migrated from the legacy card is flagged until the member has chosen something', async () => {
    const mk = async (c: Record<string, unknown>) => {
      const s = await setup();
      s.fs.seed(`coaching/${ME}`, coaching({ migratedFrom: 'legacy', consent: {}, ...c }));
      s.fs.seed(`users/${ME}/grants/${TR}`, {});
      const r = await first(s.port);
      r.off();
      return r.snap!.link;
    };
    expect((await mk({ consentVersion: 1 })).migrated).toBe(true);
    expect((await mk({ consentVersion: 2 })).migrated).toBeUndefined();
    expect((await mk({ consentVersion: 1, consent: { sets: 'full' } })).migrated).toBeUndefined();
  });

  it('an ended link is "none": no trainer is shown and the link callable is not asked', async () => {
    const { fs, port } = await setup();
    fs.seed(`coaching/${ME}`, coaching({ status: 'ended' }));
    fs.onCall('coachAdoptLegacy', () => ({ adopted: false }));
    const r = await first(port);
    await settle();
    r.off();
    expect(fs.calls.map((c) => c.name)).not.toContain('coachMyLink');
    expect(r.snap!.link.state).toBe('none');
    expect(r.snap!.link.trainer).toBeNull();
    expect(r.snap!.link.grants).toEqual(ALL_OFF);
  });

  it('a link callable that says "not linked" gives none even with an active document', async () => {
    const { fs, port } = await setup();
    fs.onCall('coachMyLink', () => ({ linked: false }));
    fs.seed(`coaching/${ME}`, coaching());
    const r = await first(port);
    r.off();
    expect(r.snap!.link.state).toBe('none');
  });

  it('the trainer line is kept while the link callable is offline, but a first failure is reported', async () => {
    const a = await setup();
    a.fs.seed(`coaching/${ME}`, coaching());
    a.fs.seed(`users/${ME}/grants/${TR}`, {});
    a.fs.onCall('coachMyLink', () => {
      throw err({ status: 503 });
    });
    const r = await first(a.port);
    r.off();
    expect(r.err?.code).toBe('offline');

    const b = await setup();
    b.fs.seed(`coaching/${ME}`, coaching());
    b.fs.seed(`users/${ME}/grants/${TR}`, {});
    const snaps: ClientSnapshot[] = [];
    const off = b.port.subscribe(
      (s) => snaps.push(s),
      () => undefined,
    );
    await settle();
    expect(snaps.at(-1)?.link.trainer?.name).toBe('Iryna Melnyk');
    b.fs.onCall('coachMyLink', () => {
      throw err({ status: 503 });
    });
    b.fs.seed(`coaching/${ME}`, coaching({ consentVersion: 9 })); // key changes: info is asked again and fails
    b.fs.seed(`users/${ME}/grants/${TR}`, { again: 1 });
    await settle();
    off();
    expect(snaps.at(-1)?.link.trainer?.name).toBe('Iryna Melnyk');
  });

  it('a snapshot is delivered to a second subscriber at once, and the cache holds the latest one', async () => {
    const set = vi.fn(async () => undefined);
    const { fs, port } = await setup({ cache: { get: async () => null, set } });
    fs.seed(`coaching/${ME}`, coaching());
    fs.seed(`users/${ME}/grants/${TR}`, {});
    const a = await first(port);
    expect(set).toHaveBeenCalledWith(a.snap);
    const on = vi.fn();
    const off2 = port.subscribe(on, () => undefined);
    expect(on).toHaveBeenCalledWith(a.snap);
    off2();
    a.off();
    const calls = on.mock.calls.length;
    fs.seed(`coaching/${ME}`, coaching({ consentVersion: 7 }));
    await settle();
    expect(on.mock.calls.length).toBe(calls); // unsubscribed: nothing more arrives
  });

  it('hydrate adopts the stored snapshot; a failing cache is ignored', async () => {
    const stored = {
      link: { state: 'active' },
      program: null,
      selfCoachDays: [],
      asOf: 1,
    } as unknown as ClientSnapshot;
    const a = await setup({ cache: { get: async () => stored, set: async () => undefined } });
    await a.port.hydrate!();
    expect(a.port.peek()).toBe(stored);
    const b = await setup({
      cache: {
        get: async () => {
          throw new Error('corrupt');
        },
        set: async () => undefined,
      },
    });
    await expect(b.port.hydrate!()).resolves.toBeUndefined();
    expect(b.port.peek()).toBeNull();
  });
});

describe('adopting a legacy trainer', () => {
  it('a member without a coaching document asks the server once, runs the key exchange, then gets the link', async () => {
    const afterLink = vi.fn(async () => undefined);
    const { fs, port } = await setup({ afterLink });
    fs.onCall('coachAdoptLegacy', () => ({ adopted: true, trainerId: TR }));
    const snaps: ClientSnapshot[] = [];
    const off = port.subscribe(
      (s) => snaps.push(s),
      () => undefined,
    );
    await settle();
    expect(afterLink).toHaveBeenCalledWith(TR);
    expect(snaps.at(-1)!.link.state).toBe('none'); // adopted, but the coaching document has not arrived yet
    fs.seed(`coaching/${ME}`, coaching({ migratedFrom: 'legacy', consent: {}, consentVersion: 1 }));
    fs.seed(`users/${ME}/grants/${TR}`, {});
    await settle();
    off();
    expect(snaps.at(-1)!.link.state).toBe('active');
    expect(fs.calls.filter((c) => c.name === 'coachAdoptLegacy')).toHaveLength(1);
  });

  it('nothing to adopt: no key exchange', async () => {
    const afterLink = vi.fn();
    const { fs, port } = await setup({ afterLink });
    fs.onCall('coachAdoptLegacy', () => ({ adopted: false }));
    const r = await first(port);
    r.off();
    expect(afterLink).not.toHaveBeenCalled();
  });

  it('a failing key exchange does not break the link', async () => {
    const { fs, port } = await setup({
      afterLink: async () => {
        throw new Error('exchange');
      },
    });
    fs.onCall('coachAdoptLegacy', () => ({ adopted: true, trainerId: null }));
    const r = await first(port);
    r.off();
    expect(r.snap!.link.state).toBe('none');
  });

  it('a failing adoption is an error the screen explains, no "No trainer yet" snapshot, and the next subscription asks again', async () => {
    const { fs, port } = await setup();
    let fail = true;
    fs.onCall('coachAdoptLegacy', () => {
      if (fail) throw err({ code: 'functions/not-found' });
      return { adopted: false };
    });
    const bad = await first(port);
    bad.off();
    expect(bad.snap).toBeUndefined();
    expect(bad.err?.code).toBe('not-deployed'); // a read path: a missing callable means the backend is not deployed
    fail = false;
    const ok = await first(port);
    ok.off();
    expect(ok.snap?.link.state).toBe('none');
    expect(fs.calls.filter((c) => c.name === 'coachAdoptLegacy')).toHaveLength(2);
  });

  it('errors of the coaching listener are reported as port errors', async () => {
    const { fs, port } = await setup();
    fs.listenDoc = (p, _on, onErr) => {
      if (p.startsWith('coaching/'))
        queueMicrotask(() => onErr(err({ code: 'permission-denied' })));
      return () => undefined;
    };
    const r = await first(port);
    r.off();
    expect(r.err?.code).toBe('forbidden');
  });
});

describe('invites and consent', () => {
  it('preview states: valid, expired, used, declined; an unknown problem is expired', async () => {
    const { fs, port } = await setup();
    const preview = async (r: Record<string, unknown>) => {
      fs.onCall('coachInvitePreview', () => r);
      return port.getInvite('tok');
    };
    expect(await preview({ trainerName: 'Iryna', expiresAt: 99 })).toEqual({
      token: 'tok',
      state: 'valid',
      trainerName: 'Iryna',
      org: '',
      expiresAt: 99,
    });
    expect((await preview({ problem: 'expired' })).state).toBe('expired');
    expect((await preview({ problem: 'claimed' })).state).toBe('used');
    expect((await preview({ problem: 'revoked' })).state).toBe('declined');
    expect((await preview({ problem: 'weird' })).state).toBe('expired');
    expect((await preview({ problem: 'expired' })).trainerName).toBe('');
  });

  it('an invite meant for someone else looks like no invite at all', async () => {
    const { fs, port } = await setup();
    for (const problem of ['wrong-kind', 'not-for-you']) {
      fs.onCall('coachInvitePreview', () => ({ problem, trainerName: 'LEAK' }));
      await expect(port.getInvite('tok')).rejects.toMatchObject({ code: 'not-found' });
    }
  });

  it('accept sends the member own choice, then runs the key exchange; a failing exchange is retried later, not an error', async () => {
    const afterLink = vi.fn(async () => {
      throw new Error('later');
    });
    const { fs, port } = await setup({ afterLink });
    fs.onCall('coachAccept', () => ({ trainerId: TR }));
    const grants = { ...ALL_OFF, totals: 'full' as const };
    await port.acceptInvite('tok', grants);
    expect(fs.calls).toEqual([{ name: 'coachAccept', data: { token: 'tok', consent: grants } }]);
    expect(afterLink).toHaveBeenCalledWith(TR);
  });

  it('every callable failure maps to a port error code', async () => {
    const { fs, port } = await setup();
    const codes: [Record<string, unknown>, string][] = [
      [{ status: 403 }, 'forbidden'],
      [{ code: 'permission-denied' }, 'forbidden'],
      [{ status: 404 }, 'not-found'],
      [{ code: 'functions/not-found' }, 'not-found'],
      [{ code: 'unimplemented' }, 'not-deployed'],
      [{ status: 501 }, 'not-deployed'],
      [{ status: 503 }, 'offline'],
      [{ code: 'unavailable' }, 'offline'],
      [{ status: 500, code: 'internal' }, 'unavailable'],
      [{ name: 'VaultLockedError' }, 'vault-locked'],
      [{ message: 'vault-locked' }, 'vault-locked'],
    ];
    for (const [e, code] of codes) {
      fs.onCall('coachDecline', () => {
        throw Object.assign(new Error((e.message as string) ?? 'x'), e);
      });
      await expect(port.declineInvite('t'), JSON.stringify(e)).rejects.toMatchObject({ code });
    }
    fs.onCall('coachDecline', () => {
      throw new ClientPortError('timeout');
    });
    await expect(port.declineInvite('t')).rejects.toMatchObject({ code: 'timeout' });
  });

  it('declineInvite, setLevel, restore call the server with exactly the member choice', async () => {
    const { fs, port } = await setup();
    for (const n of ['coachDecline', 'setConsent']) fs.onCall(n, () => ({}));
    await port.declineInvite('tok');
    await port.setLevel('sets', 'effects');
    await port.restore({ ...ALL_OFF, totals: 'full' });
    expect(fs.calls).toEqual([
      { name: 'coachDecline', data: { token: 'tok' } },
      { name: 'setConsent', data: { category: 'sets', level: 'effects' } },
      { name: 'setConsent', data: { consent: { ...ALL_OFF, totals: 'full' } } },
    ]);
    fs.onCall('setConsent', () => {
      throw err({ status: 403 });
    });
    await expect(port.setLevel('sets', 'off')).rejects.toMatchObject({ code: 'forbidden' });
    await expect(port.restore(ALL_OFF)).rejects.toMatchObject({ code: 'forbidden' });
    await expect(port.revoke()).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('revoke turns everything off and hands back the previous levels for Undo', async () => {
    const { fs, port } = await setup();
    fs.onCall('setConsent', () => ({}));
    expect((await port.revoke()).previous).toEqual(ALL_OFF); // nothing known yet
    fs.seed(`coaching/${ME}`, coaching());
    fs.seed(`users/${ME}/grants/${TR}`, {});
    const r = await first(port);
    r.off();
    fs.calls.length = 0;
    const out = await port.revoke();
    expect(out.previous).toEqual({ ...ALL_OFF, totals: 'full', sets: 'effects' });
    expect(fs.calls).toEqual([{ name: 'setConsent', data: { consent: { ...ALL_OFF } } }]);
  });

  it('leave ends coaching for the member own id, wipes that conversation locally, then drops the key exchange', async () => {
    const onLeft = vi.fn();
    const afterLink = vi.fn(async () => undefined);
    const { fs, port } = await setup({ onLeft, afterLink });
    fs.seed(`coaching/${ME}`, coaching());
    fs.seed(`users/${ME}/grants/${TR}`, {});
    fs.onCall('coachEnd', () => ({}));
    (await first(port)).off();
    await port.leave();
    expect(fs.calls.at(-1)).toEqual({ name: 'coachEnd', data: { clientId: ME } });
    expect(onLeft).toHaveBeenCalledWith('cid-1');
    expect(afterLink).toHaveBeenCalledWith(null);
    fs.onCall('coachEnd', () => {
      throw err({ status: 403 });
    });
    onLeft.mockClear();
    await expect(port.leave()).rejects.toMatchObject({ code: 'forbidden' });
    expect(onLeft).not.toHaveBeenCalled(); // a refused end wipes nothing
  });
});

describe('the access log', () => {
  it('lists the trainer reads in the order the query returns, content-free, mapping the way of access; unknown categories are skipped', async () => {
    const { fs, port } = await setup();
    fs.seed(`users/${ME}/audit/a1`, {
      category: 'sets',
      via: 'client360',
      at: 100,
      lastAt: 300,
      count: 3,
    });
    fs.seed(`users/${ME}/audit/a2`, { category: 'totals', via: 'live', at: 200, count: 1 });
    fs.seed(`users/${ME}/audit/a3`, { category: 'secret', via: 'view', at: 250 });
    fs.seed(`users/${ME}/audit/a4`, { category: 'body', via: 'unknown-way', at: 50 });
    const asked: unknown[] = [];
    const real = fs.getDocs.bind(fs);
    fs.getDocs = async (c, q) => {
      asked.push([c, q]);
      return real(c, q);
    };
    const log = await port.accessLog();
    // the query is the member own audit collection, newest `at` first, bounded
    expect(asked).toEqual([[`users/${ME}/audit`, { orderBy: ['at', 'desc'], limit: 200 }]]);
    expect(log).toEqual([
      { id: 'a2', at: 200, category: 'totals', what: 'live' },
      { id: 'a1', at: 300, category: 'sets', what: 'summary', count: 3 },
      { id: 'a4', at: 50, category: 'body', what: 'summary' },
    ]);
  });

  it('an unreadable log is a port error', async () => {
    const { fs, port } = await setup();
    fs.getDocs = async () => {
      throw err({ code: 'permission-denied' });
    };
    await expect(port.accessLog()).rejects.toMatchObject({ code: 'forbidden' });
  });
});

describe('the program notice', () => {
  it('opening a version marks the notice read and tells the trainer which version was seen', async () => {
    const { fs, port } = await setup();
    fs.seed(`users/${ME}/notices/pu-${ME}`, { at: 1 });
    fs.onCall('programAck', () => ({}));
    await port.ackProgram(4);
    expect((await fs.get(`users/${ME}/notices/pu-${ME}`))!.readAt).toBe(NOW);
    expect(fs.calls).toEqual([{ name: 'programAck', data: { version: 4 } }]);
  });

  it('with no notice, or a failing ack, it still resolves (the dot must clear)', async () => {
    const { fs, port } = await setup();
    fs.onCall('programAck', () => {
      throw new Error('down');
    });
    await expect(port.ackProgram(1)).resolves.toBeUndefined();
  });
});
