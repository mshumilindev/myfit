// @vitest-environment node
/** The schedule survives a restart: the sealed port keeps its last complete answer, the store adopts it when it lands. */
import { describe, expect, it } from 'vitest';
import { pairedRings, trainer } from '../../coachCrypto/testHelpers';
import { readyVault } from '../../testVault';
import { createMemoryDocStore } from './memoryDocStore';
import type { ScheduleData, SchedulePort } from './port';
import { createScheduleStore } from './scheduleStore';
import { createSealedSchedulePort, type ScheduleCache } from './sealedPort';
import { emptyDoc, type ScheduleDoc } from './types';

const NOW = 1_800_000_000_000;
const snap = (ids: string[], asOf = NOW): ScheduleData => ({
  docs: ids.map((id) => ({ ...emptyDoc(id), rev: 1 })),
  requests: [],
  asOf,
});
const tick = () => new Promise((r) => setTimeout(r, 20));

function memCache(initial: ScheduleData | null = null) {
  let stored = initial;
  let release: () => void = () => undefined;
  const gate = new Promise<void>((r) => (release = r));
  const sets: ScheduleData[] = [];
  const cache: ScheduleCache = {
    get: async () => {
      await gate;
      return stored;
    },
    set: async (d) => {
      stored = d;
      sets.push(d);
    },
  };
  return { cache, release, sets, stored: () => stored };
}

async function sealedSetup(cache?: ScheduleCache, ringOn = true) {
  const vault = await readyVault();
  const t = await trainer();
  const rings = await pairedRings(t);
  const store = createMemoryDocStore();
  let ring = ringOn;
  const mk = (c?: ScheduleCache) =>
    createSealedSchedulePort({
      store,
      vault,
      ringFor: () => (ring ? rings.trainer : null),
      uid: 't1',
      now: () => NOW,
      cache: c,
    });
  // write one doc, always through a port that has its ring
  const was = ring;
  ring = true;
  await mk().saveDoc(emptyDoc('c1'));
  ring = was;
  return { store, mk, setRing: (v: boolean) => (ring = v), port: mk(cache) };
}

describe('the sealed schedule port with an on-device snapshot', () => {
  it('peeks nothing before the snapshot lands, then the snapshot; hydrate never rejects', async () => {
    const m = memCache(snap(['c9']));
    const { port } = await sealedSetup(m.cache);
    expect(port.peek()).toBeNull();
    m.release();
    await port.hydrate?.();
    expect(port.peek()?.docs.map((d) => d.clientId)).toEqual(['c9']);
    const broken = (
      await sealedSetup({ get: () => Promise.reject(new Error('x')), set: async () => {} })
    ).port;
    await expect(broken.hydrate?.()).resolves.toBeUndefined();
    expect(broken.peek()).toBeNull();
  });

  it('live data wins: a snapshot landing after it is not adopted', async () => {
    const m = memCache(snap(['old']));
    const { port } = await sealedSetup(m.cache);
    const got: ScheduleData[] = [];
    const off = port.subscribe(
      (d) => got.push(d),
      () => undefined,
    );
    await tick();
    m.release();
    await port.hydrate?.();
    off();
    expect(got.at(-1)?.docs.map((d) => d.clientId)).toEqual(['c1']);
    expect(port.peek()?.docs.map((d) => d.clientId)).toEqual(['c1']);
  });

  it('persists each complete live answer', async () => {
    const m = memCache();
    m.release();
    const { port } = await sealedSetup(m.cache);
    const off = port.subscribe(
      () => undefined,
      () => undefined,
    );
    await tick();
    off();
    expect(m.stored()?.docs.map((d) => d.clientId)).toEqual(['c1']);
  });

  it('does not overwrite a good snapshot with an answer that skipped a document for want of its key ring', async () => {
    const good = snap(['c1', 'c2']);
    const m = memCache(good);
    m.release();
    const { mk, setRing } = await sealedSetup();
    setRing(false); // the rings have not arrived yet
    const port = mk(m.cache);
    const got: ScheduleData[] = [];
    const off = port.subscribe(
      (d) => got.push(d),
      () => undefined,
    );
    await tick();
    off();
    expect(got.at(-1)?.docs).toHaveLength(0); // shown as it is (live), but not stored
    expect(m.sets).toHaveLength(0);
    expect(m.stored()).toBe(good);
  });
});

/** A port that only holds a snapshot and a live callback, to drive the store. */
function fakePort(late: ScheduleData | null) {
  let last: ScheduleData | null = null;
  let release: () => void = () => undefined;
  const hydrated = new Promise<void>((r) => (release = r));
  let live: ((d: ScheduleData) => void) | null = null;
  const port: SchedulePort = {
    now: () => NOW,
    peek: () => last,
    hydrate: () => hydrated,
    subscribe(on) {
      live = (d) => {
        last = d;
        on(d);
      };
      return () => (live = null);
    },
    saveDoc: async (d: ScheduleDoc) => d,
    createRequest: async () => undefined,
    setStatus: async () => undefined,
  };
  return {
    port,
    land: () => {
      if (!last) last = late; // what the real port does: only when nothing is there yet
      release();
    },
    emit: (d: ScheduleData) => live?.(d),
  };
}

describe('the schedule store adopts a late snapshot', () => {
  it('shows it as stale once it lands, then the live data replaces it', async () => {
    const f = fakePort(snap(['old']));
    const s = createScheduleStore(f.port, { isOnline: () => true });
    s.start();
    expect(s.getState().status).toBe('loading');
    f.land();
    await tick();
    expect(s.getState().status).toBe('stale');
    expect(s.getState().docs.map((d) => d.clientId)).toEqual(['old']);
    f.emit(snap(['live'], NOW + 1));
    expect(s.getState().status).toBe('ready');
    expect(s.getState().docs.map((d) => d.clientId)).toEqual(['live']);
  });

  it('is offline, not stale, when the device is offline', async () => {
    const f = fakePort(snap(['old']));
    const s = createScheduleStore(f.port, { isOnline: () => false });
    s.start();
    f.land();
    await tick();
    expect(s.getState().status).toBe('offline');
    expect(s.getState().docs).toHaveLength(1);
  });

  it('never overrides live data, not even an empty live answer', async () => {
    const f = fakePort(snap(['old']));
    const s = createScheduleStore(f.port, { isOnline: () => true });
    s.start();
    f.emit({ docs: [], requests: [], asOf: NOW + 1 });
    f.land();
    await tick();
    expect(s.getState().docs).toHaveLength(0);
    expect(s.getState().status).toBe('ready');
  });

  it('does not adopt after stop(), and a port without hydrate is unchanged', async () => {
    const f = fakePort(snap(['old']));
    const s = createScheduleStore(f.port, { isOnline: () => true });
    s.start();
    s.stop();
    f.land();
    await tick();
    expect(s.getState().docs).toHaveLength(0);
    const { hydrate: _h, ...bare } = fakePort(null).port;
    void _h;
    const s2 = createScheduleStore(bare, { isOnline: () => true });
    expect(() => s2.start()).not.toThrow();
    expect(s2.getState().status).toBe('loading');
  });
});
