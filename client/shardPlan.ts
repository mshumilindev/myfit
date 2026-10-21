import weights from './test-weights.json';

/**
 * Weight-balanced sharding (SPO-56, ADR 004). Vitest's own `--shard i/N` hashes file paths and slices equal COUNTS, so one
 * heavy Atlas file made the slowest CI shard 2-3x the median. Here every shard computes the same greedy
 * longest-processing-time partition from `test-weights.json` (seconds per file, measured), so each file runs in exactly one
 * shard and the shards come out within about one mid-sized file of each other. A stale or missing weight only costs balance,
 * never coverage: every spec is always assigned. Refresh the weights with
 *   npx vitest run --reporter=json --outputFile=/tmp/vt.json   (see scripts/refresh-test-weights.mjs)
 */
export const DEFAULT_WEIGHT = 1;

export function planShards(
  files: string[],
  count: number,
  w: Record<string, number> = weights as Record<string, number>,
): string[][] {
  const bins = Array.from({ length: count }, () => ({ load: 0, files: [] as string[] }));
  const weighted = files
    .map((f) => ({ f, w: w[f] ?? DEFAULT_WEIGHT }))
    .sort((a, b) => b.w - a.w || (a.f < b.f ? -1 : 1));
  for (const { f, w: wt } of weighted) {
    let best = bins[0];
    for (const b of bins) if (b.load < best.load) best = b;
    best.load += wt;
    best.files.push(f);
  }
  return bins.map((b) => b.files);
}
