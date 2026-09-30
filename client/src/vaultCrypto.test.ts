// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { b64, decryptJson, encryptJson, importRawKey, isEnvelope } from './vaultCrypto';

const rnd = (n: number) => b64(globalThis.crypto.getRandomValues(new Uint8Array(n)));
const newSalt = () => rnd(16);
const newKey = (extractable = true) => importRawKey(rnd(32), extractable);

describe('encrypt / decrypt', () => {
  const data = { conditions: [{ key: 'back_lumbar_disc', note: 'secret' }] };

  it('round-trips with the same key', async () => {
    const key = await newKey();
    const salt = newSalt();
    const env = await encryptJson(key, salt, data);
    expect(isEnvelope(env)).toBe(true);
    expect(await decryptJson(key, env)).toEqual(data);
  });

  it('never leaks plaintext into the envelope', async () => {
    const salt = newSalt();
    const env = await encryptJson(await newKey(), salt, data);
    expect(JSON.stringify(env)).not.toContain('secret');
    expect(JSON.stringify(env)).not.toContain('back_lumbar_disc');
  });

  it('uses a fresh IV on every write', async () => {
    const salt = newSalt();
    const key = await newKey();
    const a = await encryptJson(key, salt, data);
    const b = await encryptJson(key, salt, data);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ct).not.toBe(b.ct);
  });

  it('fails with a wrong key', async () => {
    const salt = newSalt();
    const env = await encryptJson(await newKey(), salt, data);
    await expect(decryptJson(await newKey(), env)).rejects.toThrow();
  });

  it('fails when the ciphertext is tampered with', async () => {
    const salt = newSalt();
    const key = await newKey();
    const env = await encryptJson(key, salt, data);
    const flipped = { ...env, ct: (env.ct[0] === 'A' ? 'B' : 'A') + env.ct.slice(1) };
    await expect(decryptJson(key, flipped)).rejects.toThrow();
  });

  it('extractable flag is honoured', async () => {
    expect((await newKey(true)).extractable).toBe(true);
    const locked = await newKey(false);
    expect(locked.extractable).toBe(false);
    await expect(globalThis.crypto.subtle.exportKey('raw', locked)).rejects.toThrow();
  });

  it('importRawKey rejects a key of the wrong length', async () => {
    await expect(importRawKey(rnd(16), true)).rejects.toThrow('bad-key');
  });

  it('isEnvelope rejects junk', () => {
    expect(isEnvelope(null)).toBe(false);
    expect(isEnvelope({ v: 2, salt: '', iv: '', ct: '' })).toBe(false);
    expect(isEnvelope({ v: 1, salt: 'a', iv: 'b' })).toBe(false);
  });
});
