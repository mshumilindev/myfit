/** SPO-336 F1: `coachMyLink` is asked once per link, however many snapshot callbacks build in parallel at start. */
import { describe, expect, it } from 'vitest';
import { readyVault } from '../../../testVault';
import type { ClientSnapshot } from '../../client/data/types';
import { createMemoryFs, type MemoryFs } from './memoryFs';
import { createFirestoreClientPort } from './clientPort';

const NOW = 1_800_000_000_000;
const ME = 'client-1';
const TR = 'trainer-1';
const link = {
  linked: true,
  trainer: { id: TR, name: 'Iryna Melnyk' },
  since: NOW - 5000,
  cid: 'cid-1',
};
const coaching = {
  trainerId: TR,
  status: 'active',
  mode: 'app',
  consentVersion: 2,
  consent: { totals: 'full' },
};
const settle = (ms = 40) => new Promise((r) => setTimeout(r, ms));
const myLinkCalls = (fs: MemoryFs) => fs.calls.filter((c) => c.name === 'coachMyLink').length;

async function start(handler: () => unknown) {
  const fs = createMemoryFs(NOW);
  fs.onCall('coachMyLink', handler);
  const port = createFirestoreClientPort({ fs, vault: await readyVault(), uid: ME });
  const snaps: ClientSnapshot[] = [];
  const off = port.subscribe(
    (s) => snaps.push(s),
    () => undefined,
  );
  return { fs, port, snaps, off };
}

describe('coachMyLink on start (SPO-336 F1)', () => {
  it('many parallel builds (coaching, grant, plan and notice all landing together) make one call', async () => {
    let slow: (v: unknown) => void = () => undefined;
    const gate = new Promise((r) => (slow = r));
    const { fs, snaps, off } = await start(() => gate.then(() => link)); // the call is still in flight while the others build
    fs.seed(`coaching/${ME}`, coaching);
    fs.seed(`users/${ME}/grants/${TR}`, { any: 'grant' });
    fs.seed(`plans/${ME}`, { v: 1 });
    fs.seed(`users/${ME}/notices/pu-${ME}`, { v: 1 });
    await settle();
    slow(undefined);
    await settle();
    off();
    expect(myLinkCalls(fs)).toBe(1);
    expect(snaps.at(-1)?.link.state).toBe('active');
  });

  it('a failed call is not remembered: the next build asks again', async () => {
    let n = 0;
    const { fs, off } = await start(() => {
      n += 1;
      if (n === 1) throw Object.assign(new Error('x'), { status: 503 });
      return link;
    });
    fs.seed(`coaching/${ME}`, coaching);
    await settle();
    fs.seed(`plans/${ME}`, { v: 2 });
    await settle();
    off();
    expect(myLinkCalls(fs)).toBe(2);
  });

  it('offline after a good answer keeps the trainer line (no new call while the key is unchanged)', async () => {
    const { fs, snaps, off } = await start(() => link);
    fs.seed(`coaching/${ME}`, coaching);
    await settle();
    fs.seed(`plans/${ME}`, { v: 3 });
    await settle();
    off();
    expect(myLinkCalls(fs)).toBe(1);
    expect(snaps.at(-1)?.link.trainer?.name).toBe('Iryna Melnyk');
  });
});
