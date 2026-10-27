#!/usr/bin/env node
/**
 * Shows how evenly the layout shards finished (SPO-369): fastest, slowest, median and the spread between them.
 * Informational, never fails: speed budgets are a development gate, not a gate for runs (.claude/rules/speed-budgets.md).
 *   gh api repos/<repo>/actions/runs/<id>/jobs?per_page=100 | node scripts/layout-shard-spread.mjs
 * Reads the Actions "list jobs" response from stdin; prints a Markdown table (CI appends it to the job summary) and, when
 * the slowest shard is more than SPREAD_LIMIT slower than the fastest, a `::warning::` annotation.
 */
import { pathToFileURL } from 'node:url';

export const SPREAD_LIMIT = 0.3;

const seconds = (job) => (Date.parse(job.completed_at) - Date.parse(job.started_at)) / 1000;

/** Durations of finished `Layout shard N` jobs, slowest first. */
export function shardDurations(response) {
  return (response?.jobs ?? [])
    .filter((j) => /^Layout shard \d+$/.test(j.name ?? '') && j.started_at && j.completed_at)
    .map((j) => ({ name: j.name, seconds: seconds(j) }))
    .filter((j) => Number.isFinite(j.seconds) && j.seconds >= 0)
    .sort((a, b) => b.seconds - a.seconds);
}

/** { fastest, slowest, median, spread } where spread = (slowest - fastest) / slowest. */
export function summarize(durations) {
  if (durations.length === 0) return null;
  const s = durations.map((d) => d.seconds).sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  const median = s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  const slowest = s[s.length - 1];
  return { fastest: s[0], slowest, median, spread: slowest === 0 ? 0 : (slowest - s[0]) / slowest };
}

const fmt = (n) => `${Math.floor(n / 60)}m ${String(Math.round(n % 60)).padStart(2, '0')}s`;

export function render(response) {
  const durations = shardDurations(response);
  const sum = summarize(durations);
  if (!sum) return 'No finished layout shards to compare.\n';
  const lines = [
    '### Layout shard time spread',
    '',
    `Fastest ${fmt(sum.fastest)}, median ${fmt(sum.median)}, slowest ${fmt(sum.slowest)}; spread ${Math.round(sum.spread * 100)} % (target <= ${Math.round(SPREAD_LIMIT * 100)} %).`,
    '',
    '| Shard | Time |',
    '| --- | --- |',
    ...durations.map((d) => `| ${d.name} | ${fmt(d.seconds)} |`),
    '',
  ];
  if (sum.spread > SPREAD_LIMIT) {
    lines.push(
      `::warning title=Uneven layout shards::Slowest ${fmt(sum.slowest)} vs fastest ${fmt(sum.fastest)} (${Math.round(sum.spread * 100)} % spread). Look at the step times of the slowest shard (SPO-369).`,
      '',
    );
  }
  return lines.join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => (raw += c));
  process.stdin.on('end', () => {
    try {
      process.stdout.write(render(JSON.parse(raw)));
    } catch (e) {
      process.stdout.write(`Shard spread unavailable: ${e.message}\n`);
    }
  });
}
