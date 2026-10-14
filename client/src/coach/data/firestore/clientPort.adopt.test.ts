/** A member without a coaching document whose legacy-trainer adoption FAILS is told why (never a silent "No trainer yet"). */
import { describe, expect, it } from 'vitest';
import { readyVault } from '../../../testVault';
import { ClientPortError } from '../../client/data/types';
import type { ClientSnapshot } from '../../client/data/types';
import { createFirestoreClientPort } from './clientPort';
import { createMemoryFs } from './memoryFs';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function run(setup: (fs: ReturnType<typeof createMemoryFs>) => void) {
  const fs = createMemoryFs();
  setup(fs);
  const port = createFirestoreClientPort({ fs, vault: await readyVault(), uid: 'c1' });
  const snaps: ClientSnapshot[] = [];
  const errs: unknown[] = [];
  const off = port.subscribe(
    (s) => snaps.push(s),
    (e) => errs.push(e),
  );
  await wait(80);
  off();
  return { snaps, errs, fs };
}

describe('legacy adoption failure', () => {
  it('service not deployed: an error "not-deployed", no snapshot', async () => {
    const { snaps, errs } = await run(() => undefined); // no handler = unimplemented
    expect(snaps).toHaveLength(0);
    expect((errs[0] as ClientPortError).code).toBe('not-deployed');
  });
  it('permission denied: "forbidden"', async () => {
    const { snaps, errs } = await run((fs) =>
      fs.onCall('coachAdoptLegacy', () => {
        throw Object.assign(new Error('x'), { status: 403 });
      }),
    );
    expect(snaps).toHaveLength(0);
    expect((errs[0] as ClientPortError).code).toBe('forbidden');
  });
  it('adoption answers "nothing to adopt": the plain "no trainer" snapshot', async () => {
    const { snaps, errs } = await run((fs) =>
      fs.onCall('coachAdoptLegacy', () => ({ adopted: false })),
    );
    expect(errs).toHaveLength(0);
    expect(snaps[0]?.link.state).toBe('none');
  });
});
