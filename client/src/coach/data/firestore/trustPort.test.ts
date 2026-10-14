// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { securityCode } from '../../../coachCrypto/securityCode';
import { makeWorld, T } from './testWorld';
import { createServerSigningLoader } from './trust';
import type { PeerKey } from '../../security/trustPort';
import { createFirestoreTrustPort } from './trustPort';

const next = (sub: (on: (v: PeerKey) => void) => () => void): Promise<PeerKey> =>
  new Promise<PeerKey>((res) => {
    let off: (() => void) | null = null;
    off = sub((v) => {
      queueMicrotask(() => off?.());
      res(v);
    });
  });

describe('real trust port', () => {
  it('shows the code of the SIGNED coach key, and a new code after a signed rotation', async () => {
    const w = await makeWorld();
    const port = createFirestoreTrustPort(w.cfs, createServerSigningLoader(w.fs));
    const first = await next((on) => port.subscribe(T, on, () => undefined));
    expect(first.code).toBe(await securityCode(w.rec.pub));
    expect(port.peek(T)?.code).toBe(first.code);
    const rot = await w.rotateCoachKey();
    const second = await next((on) => port.subscribe(T, on, () => undefined));
    expect(second.code).toBe(await securityCode(rot.pub));
    expect(second.code).not.toBe(first.code);
  });
  it('an unsigned or foreign key yields NO code (never a code for a key we would not trust)', async () => {
    const w = await makeWorld();
    const cur = await w.fs.get(`coachKeys/${T}`);
    w.fs.seed(`coachKeys/${T}`, { ...cur!, sig: 'AAAA' });
    const port = createFirestoreTrustPort(w.cfs, createServerSigningLoader(w.fs));
    const got = await next((on) => port.subscribe(T, on, () => undefined));
    expect(got.code).toBeNull();
  });
});
