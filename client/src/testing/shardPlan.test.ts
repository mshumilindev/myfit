import { describe, expect, it } from 'vitest';
import { DEFAULT_WEIGHT, planShards } from '../../shardPlan';

describe('weighted test sharding', () => {
  const files = Array.from({ length: 40 }, (_, i) => `src/f${i}.test.ts`);
  const w: Record<string, number> = {
    'src/f0.test.ts': 50,
    'src/f1.test.ts': 30,
    'src/f2.test.ts': 20,
  };

  it('assigns every file to exactly one shard', () => {
    const bins = planShards(files, 8, w);
    const all = bins.flat();
    expect(all).toHaveLength(files.length);
    expect(new Set(all)).toEqual(new Set(files));
  });

  it('is deterministic, so every CI shard computes the same plan', () => {
    expect(planShards([...files].reverse(), 8, w)).toEqual(planShards(files, 8, w));
  });

  it('balances load: the heaviest shard stays near the mean unless one file dominates', () => {
    const bins = planShards(files, 4, w);
    const loads = bins.map((b) => b.reduce((a, f) => a + (w[f] ?? DEFAULT_WEIGHT), 0));
    const total = loads.reduce((a, b) => a + b, 0);
    expect(Math.max(...loads)).toBeLessThanOrEqual(Math.max(50, total / 4 + DEFAULT_WEIGHT));
  });

  it('puts a file without a recorded weight at the default and still runs it', () => {
    const bins = planShards(['src/new.test.ts'], 3, {});
    expect(bins.flat()).toEqual(['src/new.test.ts']);
  });

  it('with one shard returns everything', () => {
    expect(planShards(files, 1, w)[0]).toHaveLength(files.length);
  });
});
