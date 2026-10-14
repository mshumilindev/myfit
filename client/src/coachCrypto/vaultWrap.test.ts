// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createGrant, createWrap, openGrant, openWrap } from '../vaultShare';
import { encryptJson } from '../vaultCrypto';
import { person, trainer } from './testHelpers';

const INFO = { info: 'test.wrap.v1' };

describe('generic wrap (createWrap / openWrap)', () => {
  it('wraps a key for a recipient and opens it with the usages the recipient asks for', async () => {
    const owner = await person();
    const t = await trainer();
    const w = await createWrap(owner.key, t.rec.pub, INFO);
    const both = await openWrap(w, t.rec, t.key, ['encrypt', 'decrypt'], INFO);
    expect(both.extractable).toBe(false);
    const env = await encryptJson(both, owner.salt, { x: 1 }); // can encrypt
    const dec = await openWrap(w, t.rec, t.key, ['decrypt'], INFO);
    await expect(encryptJson(dec, owner.salt, { x: 1 })).rejects.toThrow(); // decrypt-only
    expect(env.v).toBe(1);
  });

  it('is bound to its info and aad', async () => {
    const owner = await person();
    const t = await trainer();
    const aad = new TextEncoder().encode('ctx-a');
    const w = await createWrap(owner.key, t.rec.pub, { ...INFO, aad });
    await expect(openWrap(w, t.rec, t.key, ['decrypt'], { ...INFO, aad })).resolves.toBeTruthy();
    await expect(
      openWrap(w, t.rec, t.key, ['decrypt'], { ...INFO, aad: new TextEncoder().encode('ctx-b') }),
    ).rejects.toThrow();
    await expect(openWrap(w, t.rec, t.key, ['decrypt'], { info: 'other', aad })).rejects.toThrow();
    await expect(openWrap(w, t.rec, t.key, ['decrypt'], INFO)).rejects.toThrow();
  });

  it('a vault grant is NOT openable as a chat wrap and keeps its exact shape', async () => {
    const owner = await person();
    const t = await trainer();
    const grant = await createGrant(owner.key, owner.salt, t.rec.pub);
    expect(Object.keys(grant).sort()).toEqual(['ct', 'epk', 'iv', 'salt', 'v']);
    await expect(openWrap(grant, t.rec, t.key, ['decrypt'], INFO)).rejects.toThrow();
    const opened = await openGrant(grant, t.rec, t.key);
    expect(opened.salt).toBe(owner.salt);
    expect(opened.key.usages).toEqual(['decrypt']);
  });
});
