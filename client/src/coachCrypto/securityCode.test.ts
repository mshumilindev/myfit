// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { SECURITY_CODE_DIGITS, securityCode } from './securityCode';
import { trainer } from './testHelpers';

describe('security code', () => {
  it('is 24 digits in six groups of four, and carries more than 64 bits', async () => {
    const t = await trainer();
    const c = await securityCode(t.rec.pub);
    expect(c).toMatch(/^(\d{4} ){5}\d{4}$/);
    expect(c.replace(/ /g, '')).toHaveLength(SECURITY_CODE_DIGITS);
    expect(Math.log2(10) * SECURITY_CODE_DIGITS).toBeGreaterThan(64);
  });
  it('is deterministic per key and differs between keys', async () => {
    const a = await trainer();
    const b = await trainer();
    expect(await securityCode(a.rec.pub)).toBe(await securityCode(a.rec.pub));
    expect(await securityCode(a.rec.pub)).not.toBe(await securityCode(b.rec.pub));
  });
  it('ignores extra JWK fields but changes with the key material', async () => {
    const a = await trainer();
    const withExtras = { ...a.rec.pub, ext: false, key_ops: ['x'] };
    expect(await securityCode(withExtras)).toBe(await securityCode(a.rec.pub));
    expect(await securityCode({ ...a.rec.pub, x: a.rec.pub.x!.slice(1) + 'A' })).not.toBe(
      await securityCode(a.rec.pub),
    );
  });
  it('refuses a malformed or non-P-256 key', async () => {
    await expect(securityCode({ kty: 'EC', crv: 'P-256' })).rejects.toThrow('bad-key');
    await expect(securityCode({ kty: 'EC', crv: 'P-384', x: 'a', y: 'b' })).rejects.toThrow(
      'bad-key',
    );
  });
});
