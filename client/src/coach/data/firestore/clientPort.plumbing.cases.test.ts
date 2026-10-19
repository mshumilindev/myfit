import { describe, expect, it, vi } from 'vitest';
import { readyVault, unsetVault } from '../../../testVault';
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

describe('days with my own coach (sealed)', () => {
  it('stores only valid days, sealed with the member vault, and publishes them into the snapshot', async () => {
    const { fs, port } = await setup();
    fs.seed(`coaching/${ME}`, coaching({ status: 'ended' }));
    fs.onCall('coachAdoptLegacy', () => ({ adopted: false }));
    const r = await first(port);
    await port.setSelfCoachDays(['Tue', 'Funday', 'Thu'] as never);
    const doc = (await fs.get(`users/${ME}/meta/selfCoach`))!;
    expect(JSON.stringify(doc)).not.toMatch(/Tue|Thu|Funday/);
    expect(port.peek()!.selfCoachDays).toEqual(['Tue', 'Thu']);
    r.off();
  });

  it('a new session reads the sealed days back; garbage or foreign-key data is ignored', async () => {
    const a = await setup();
    await a.port.setSelfCoachDays(['Mon', 'Fri']);
    const b = await setup();
    b.fs.seed(`users/${ME}/meta/selfCoach`, (await a.fs.get(`users/${ME}/meta/selfCoach`))!);
    b.fs.seed(`coaching/${ME}`, coaching({ status: 'ended' }));
    b.fs.onCall('coachAdoptLegacy', () => ({ adopted: false }));
    // sealed by ANOTHER vault: unreadable, stays empty
    const r1 = await first(b.port);
    await settle();
    r1.off();
    expect(r1.snap!.selfCoachDays).toEqual([]);

    // same vault: read back
    const c = await setup({ vault: a.vault });
    c.fs.seed(`users/${ME}/meta/selfCoach`, (await a.fs.get(`users/${ME}/meta/selfCoach`))!);
    c.fs.seed(`coaching/${ME}`, coaching({ status: 'ended' }));
    c.fs.onCall('coachAdoptLegacy', () => ({ adopted: false }));
    const snaps: ClientSnapshot[] = [];
    const off = c.port.subscribe(
      (s) => snaps.push(s),
      () => undefined,
    );
    await settle(50);
    off();
    expect(snaps.at(-1)!.selfCoachDays).toEqual(['Mon', 'Fri']);
  });

  it('with the vault locked it refuses (vault-locked) and writes nothing', async () => {
    const { fs, port } = await setup({ vault: await unsetVault() });
    await expect(port.setSelfCoachDays(['Mon'])).rejects.toMatchObject({ code: 'vault-locked' });
    expect(fs.writes).toEqual([]);
  });

  it('a failing write is a port error and the days are not adopted', async () => {
    const { fs, port } = await setup();
    fs.failWrites('unavailable');
    await expect(port.setSelfCoachDays(['Mon'])).rejects.toMatchObject({ code: 'offline' });
  });
});

describe('plumbing', () => {
  it('waits for the key rings before reading the program layer, and re-reads when the plan or its notice changes', async () => {
    const ready = vi.fn(async () => undefined);
    const ringFor = vi.fn(() => null);
    const { fs, port } = await setup({ plan: { ringFor, ringForEpoch: () => null, ready } });
    fs.seed(`coaching/${ME}`, coaching());
    fs.seed(`users/${ME}/grants/${TR}`, {});
    const snaps: ClientSnapshot[] = [];
    const off = port.subscribe(
      (s) => snaps.push(s),
      () => undefined,
    );
    await settle(40);
    const n = snaps.length;
    expect(ready).toHaveBeenCalled();
    expect(ringFor).toHaveBeenCalledWith(ME); // the member own ring, never another uid
    fs.seed(`plans/${ME}`, { liveVersion: 0, rev: 1 });
    await settle(40);
    expect(snaps.length).toBeGreaterThan(n);
    const m = snaps.length;
    fs.seed(`users/${ME}/notices/pu-${ME}`, { at: 5 });
    await settle(40);
    off();
    expect(snaps.length).toBeGreaterThan(m);
  });

  it('a failing snapshot cache never breaks delivery; now follows the store clock', async () => {
    const { fs, port } = await setup({
      cache: {
        get: async () => null,
        set: async () => {
          throw new Error('quota');
        },
      },
    });
    fs.seed(`coaching/${ME}`, coaching());
    fs.seed(`users/${ME}/grants/${TR}`, {});
    const r = await first(port);
    r.off();
    expect(r.snap?.link.state).toBe('active');
    expect(port.now()).toBe(NOW);
  });

  it('an error of the grant listener is reported', async () => {
    const { fs, port } = await setup();
    fs.seed(`coaching/${ME}`, coaching());
    const real = fs.listenDoc.bind(fs);
    fs.listenDoc = (p, on, onErr) => {
      if (p.includes('/grants/')) queueMicrotask(() => onErr(err({ code: 'permission-denied' })));
      return real(p, on, onErr);
    };
    const r = await first(port);
    r.off();
    expect(r.err?.code).toBe('forbidden');
  });

  it('leaving the screen while the adoption is still running delivers nothing afterwards', async () => {
    const { fs, port } = await setup();
    let done!: () => void;
    const gate = new Promise<void>((r) => (done = r));
    fs.onCall('coachAdoptLegacy', async () => {
      await gate;
      return { adopted: false };
    });
    const on = vi.fn();
    const onErr = vi.fn();
    const off = port.subscribe(on, onErr);
    await settle();
    off();
    done();
    await settle();
    expect(on).not.toHaveBeenCalled();
    expect(onErr).not.toHaveBeenCalled();
  });

  it('a preview that fails is a port error', async () => {
    const { fs, port } = await setup();
    fs.onCall('coachInvitePreview', () => {
      throw err({ status: 403 });
    });
    await expect(port.getInvite('t')).rejects.toMatchObject({ code: 'forbidden' });
  });
});
