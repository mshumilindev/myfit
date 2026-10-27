import { describe, expect, it } from 'vitest';
// @ts-expect-error — plain .mjs script without type declarations
import * as spread from '../scripts/layout-shard-spread.mjs';

const job = (name: string, secs: number | null) => ({
  name,
  started_at: '2026-10-27T10:00:00Z',
  completed_at:
    secs === null ? null : new Date(Date.parse('2026-10-27T10:00:00Z') + secs * 1000).toISOString(),
});

describe('layout shard spread (SPO-369)', () => {
  it('keeps only finished "Layout shard N" jobs, slowest first', () => {
    const out = spread.shardDurations({
      jobs: [
        job('Layout shard 1', 100),
        job('Build Storybook', 999),
        job('Layout shard 0', 300),
        job('Layout shard 2', null),
      ],
    }) as { name: string; seconds: number }[];
    expect(out.map((d) => d.name)).toEqual(['Layout shard 0', 'Layout shard 1']);
  });

  it('computes fastest, slowest, median and the spread', () => {
    const s = spread.summarize([
      { name: 'a', seconds: 300 },
      { name: 'b', seconds: 200 },
      { name: 'c', seconds: 150 },
    ]);
    expect(s).toEqual({ fastest: 150, slowest: 300, median: 200, spread: 0.5 });
  });

  it('warns above the limit and stays quiet below it', () => {
    const uneven = spread.render({
      jobs: [job('Layout shard 0', 600), job('Layout shard 1', 180)],
    }) as string;
    expect(uneven).toContain('::warning');
    const even = spread.render({
      jobs: [job('Layout shard 0', 250), job('Layout shard 1', 220)],
    }) as string;
    expect(even).not.toContain('::warning');
    expect(even).toContain('| Layout shard 0 | 4m 10s |');
  });

  it('never throws on an empty or odd response', () => {
    expect(spread.render({})).toContain('No finished layout shards');
    expect(spread.render(null)).toContain('No finished layout shards');
  });
});
