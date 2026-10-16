/**
 * Shared helpers for the geometry audits (story-audit, hero-audit, chat-layout-audit), SPO-140.
 * The audits are CPU/latency bound (one page.goto + a short settle wait per probe); running a few pages at once
 * and splitting the work across CI jobs (`--part i/n`) cuts wall-clock time without dropping a single probe.
 */

/** `--part 2/6` → { part: 2, parts: 6 }: shard 2 of 6, 0-based like the original story-audit flag (`0/1` = everything). */
export function parsePart(raw) {
  const [part, parts] = String(raw ?? '0/1')
    .split('/')
    .map(Number);
  if (!Number.isInteger(part) || !Number.isInteger(parts) || parts < 1 || part < 0 || part >= parts)
    throw new Error(`bad --part "${raw}": expected i/n with 0 <= i < n`);
  return { part, parts };
}

/** Keep every `parts`-th item starting at `part` (round-robin keeps the shards balanced). */
export const shard = (items, { part, parts }) => items.filter((_, i) => i % parts === part);

/** Run `fn(item, workerIndex)` over `items` with at most `workers` in flight. */
export async function runPool(items, workers, fn) {
  let next = 0;
  const n = Math.max(1, Math.min(workers, items.length));
  await Promise.all(
    Array.from({ length: n }, async (_, w) => {
      for (;;) {
        const i = next++;
        if (i >= items.length) return;
        await fn(items[i], w);
      }
    }),
  );
}
