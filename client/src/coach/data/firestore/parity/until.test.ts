import { describe, expect, it } from 'vitest';
import { settle, until } from './harness';

describe('parity until()', () => {
  it('returns at once when the condition already holds', async () => {
    const t0 = Date.now();
    await until(() => true);
    expect(Date.now() - t0).toBeLessThan(500);
  });

  it('polls until the condition becomes true', async () => {
    let ready = false;
    void settle(60).then(() => {
      ready = true;
    });
    await until(() => ready);
    expect(ready).toBe(true);
  });

  it('gives up after the timeout instead of hanging', async () => {
    const t0 = Date.now();
    await until(() => false, 80);
    expect(Date.now() - t0).toBeGreaterThanOrEqual(70);
  });
});
