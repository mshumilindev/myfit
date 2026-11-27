import { describe, expect, it } from 'vitest';
import { check } from '../scripts/lib/bundle-budget.mjs';

describe('bundle budget ratchet', () => {
  const budget = { totalJsGzip: 1000, initialJsGzip: 400 };
  it('passes at or under the ceiling', () => {
    expect(check({ totalJsGzip: 1000, initialJsGzip: 400 }, budget)).toEqual([]);
  });
  it('fails when the initial chunk grows, naming the key and the delta', () => {
    const p = check({ totalJsGzip: 900, initialJsGzip: 450 }, budget);
    expect(p).toHaveLength(1);
    expect(p[0]).toContain('initialJsGzip');
    expect(p[0]).toContain('+50 B');
  });
  it('fails when total grows', () => {
    expect(check({ totalJsGzip: 1001, initialJsGzip: 1 }, budget)[0]).toContain('totalJsGzip');
  });
});
