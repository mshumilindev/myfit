// @vitest-environment node
import { generateKeyPairSync, sign, type KeyObject } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createServerSigningLoader } from '../coach/data/firestore/trust';
import type { FsApi, Raw } from '../coach/data/firestore/fsApi';
import { parsePins, rotationPayload } from './signingPins';

const pem = (k: KeyObject) => k.export({ type: 'spki', format: 'pem' }).toString();
const gen = () => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return { pub: pem(publicKey), priv: privateKey };
};
const fsWith = (doc: Raw | null) => ({ get: async () => doc }) as unknown as FsApi;
const payload = Buffer.from('hello');

describe('server signing-key pin', () => {
  it('trusts the pin and ignores a swapped config document', async () => {
    const pinned = gen();
    const evil = gen();
    const load = createServerSigningLoader(
      fsWith({ kid: 'evil', pub: evil.pub, alg: 'Ed25519' }),
      [{ kid: 'k1', pub: pinned.pub }],
      true,
    );
    const s = await load();
    expect(s?.kid).toBe('k1');
    const sig = sign(null, payload, pinned.priv);
    expect(await crypto.subtle.verify({ name: 'Ed25519' }, s!.key, sig, payload)).toBe(true);
    const bad = sign(null, payload, evil.priv);
    expect(await crypto.subtle.verify({ name: 'Ed25519' }, s!.key, bad, payload)).toBe(false);
  });
  it('accepts a rotation announcement only when a pinned key signed it', async () => {
    const a = gen();
    const b = gen();
    const evil = gen();
    const announce = (by: string, signer: KeyObject) => ({
      kid: 'k1',
      pub: a.pub,
      alg: 'Ed25519',
      next: {
        kid: 'k2',
        pub: b.pub,
        by,
        sig: sign(null, Buffer.from(rotationPayload('k2', b.pub)), signer).toString('base64'),
      },
    });
    const good = await createServerSigningLoader(
      fsWith(announce('k1', a.priv)),
      [{ kid: 'k1', pub: a.pub }],
      true,
    )();
    expect(good?.kid).toBe('k2');
    const forged = await createServerSigningLoader(
      fsWith(announce('k1', evil.priv)),
      [{ kid: 'k1', pub: a.pub }],
      true,
    )();
    expect(forged?.kid).toBe('k1');
    const unknownSigner = await createServerSigningLoader(
      fsWith(announce('zz', a.priv)),
      [{ kid: 'k1', pub: a.pub }],
      true,
    )();
    expect(unknownSigner?.kid).toBe('k1');
  });
  it('without pins: production fails closed, development reads the document', async () => {
    const a = gen();
    const doc = { kid: 'k1', pub: a.pub, alg: 'Ed25519' };
    expect(await createServerSigningLoader(fsWith(doc), [], true)()).toBeNull();
    expect((await createServerSigningLoader(fsWith(doc), [], false)())?.kid).toBe('k1');
  });
  it('parses the build config defensively', () => {
    expect(parsePins('')).toEqual([]);
    expect(parsePins('not json')).toEqual([]);
    expect(parsePins('[{"kid":"a","pub":"x"},{"kid":1},null]')).toEqual([{ kid: 'a', pub: 'x' }]);
    expect(parsePins({})).toEqual([]);
  });
});
