// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  decryptJson,
  deriveVaultKey,
  encryptJson,
  formatRecoveryKey,
  generateRecoveryKey,
  isEnvelope,
  newSalt,
  parseRecoveryKey,
} from './vaultCrypto';

describe('recovery key', () => {
  it('is 32 Crockford chars and round-trips through display formatting', () => {
    const rk = generateRecoveryKey();
    expect(rk).toMatch(/^[0-9A-HJKMNP-TV-Z]{32}$/);
    const shown = formatRecoveryKey(rk);
    expect(shown).toMatch(/^([0-9A-Z]{4}-){7}[0-9A-Z]{4}$/);
    expect(parseRecoveryKey(shown)).toBe(rk);
    expect(parseRecoveryKey(shown.toLowerCase().replace(/-/g, ' '))).toBe(rk);
  });
  it('rejects wrong length and bad characters', () => {
    expect(parseRecoveryKey('')).toBeNull();
    expect(parseRecoveryKey('ABCD-EFGH')).toBeNull();
    expect(parseRecoveryKey('U'.repeat(32))).toBeNull(); // U is not in the alphabet
  });
  it('keys are unique', () => {
    expect(generateRecoveryKey()).not.toBe(generateRecoveryKey());
  });
});

describe('encrypt / decrypt', () => {
  const data = { conditions: [{ key: 'back_lumbar_disc', note: 'secret' }] };

  it('round-trips with the same recovery key', async () => {
    const rk = generateRecoveryKey();
    const salt = newSalt();
    const env = await encryptJson(await deriveVaultKey(rk, salt), salt, data);
    expect(isEnvelope(env)).toBe(true);
    // A second device derives the key from the RK + the envelope's salt.
    const other = await deriveVaultKey(rk, env.salt);
    expect(await decryptJson(other, env)).toEqual(data);
  });

  it('never leaks plaintext into the envelope', async () => {
    const rk = generateRecoveryKey();
    const salt = newSalt();
    const env = await encryptJson(await deriveVaultKey(rk, salt), salt, data);
    expect(JSON.stringify(env)).not.toContain('secret');
    expect(JSON.stringify(env)).not.toContain('back_lumbar_disc');
  });

  it('uses a fresh IV on every write', async () => {
    const salt = newSalt();
    const key = await deriveVaultKey(generateRecoveryKey(), salt);
    const a = await encryptJson(key, salt, data);
    const b = await encryptJson(key, salt, data);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ct).not.toBe(b.ct);
  });

  it('fails with a wrong key', async () => {
    const salt = newSalt();
    const env = await encryptJson(await deriveVaultKey(generateRecoveryKey(), salt), salt, data);
    const wrong = await deriveVaultKey(generateRecoveryKey(), salt);
    await expect(decryptJson(wrong, env)).rejects.toThrow();
  });

  it('fails when the ciphertext is tampered with', async () => {
    const rk = generateRecoveryKey();
    const salt = newSalt();
    const key = await deriveVaultKey(rk, salt);
    const env = await encryptJson(key, salt, data);
    const flipped = { ...env, ct: (env.ct[0] === 'A' ? 'B' : 'A') + env.ct.slice(1) };
    await expect(decryptJson(key, flipped)).rejects.toThrow();
  });

  it('extractable flag is honoured', async () => {
    const rk = generateRecoveryKey();
    const salt = newSalt();
    expect((await deriveVaultKey(rk, salt)).extractable).toBe(true);
    const locked = await deriveVaultKey(rk, salt, false);
    expect(locked.extractable).toBe(false);
    await expect(globalThis.crypto.subtle.exportKey('raw', locked)).rejects.toThrow();
  });

  it('isEnvelope rejects junk', () => {
    expect(isEnvelope(null)).toBe(false);
    expect(isEnvelope({ v: 2, salt: '', iv: '', ct: '' })).toBe(false);
    expect(isEnvelope({ v: 1, salt: 'a', iv: 'b' })).toBe(false);
  });
});
