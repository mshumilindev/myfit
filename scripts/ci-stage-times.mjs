#!/usr/bin/env node
/**
 * Where the time of one CI run went (SPO-370): per job the wait for a runner, start, end and duration, plus the
 * critical path (the job that finished last, then whatever it waited for is visible from the start/end columns).
 * Informational, never fails: speed budgets are a development gate, not a gate for runs (.claude/rules/speed-budgets.md).
 *   gh api repos/<repo>/actions/runs/<id>/jobs?per_page=100 | node scripts/ci-stage-times.mjs
 * Reads the Actions "list jobs" response from stdin; prints a Markdown table (CI appends it to the job summary) and a
 * `::warning::` annotation when the run took longer than BUDGET_SECONDS (docs/adr/004-sharded-ci.md: <= 7 min).
 */
import { pathToFileURL } from 'node:url';

export const BUDGET_SECONDS = 420;

const ms = (s) => Date.parse(s);

/** Finished jobs as { name, queued, start, end, seconds } in seconds from the moment the run's first job was created. */
export function stages(response) {
  const jobs = (response?.jobs ?? []).filter((j) => j.created_at && j.started_at && j.completed_at);
  if (jobs.length === 0) return [];
  const t0 = Math.min(...jobs.map((j) => ms(j.created_at)));
  return jobs
    .map((j) => ({
      name: j.name,
      queued: (ms(j.started_at) - ms(j.created_at)) / 1000,
      start: (ms(j.started_at) - t0) / 1000,
      end: (ms(j.completed_at) - t0) / 1000,
      seconds: (ms(j.completed_at) - ms(j.started_at)) / 1000,
    }))
    .filter((s) => [s.queued, s.start, s.end, s.seconds].every((n) => Number.isFinite(n) && n >= 0))
    .sort((a, b) => b.end - a.end);
}

const fmt = (n) => `${Math.floor(n / 60)}m ${String(Math.round(n % 60)).padStart(2, '0')}s`;

export function render(response) {
  const rows = stages(response);
  if (rows.length === 0) return 'No finished jobs to time.\n';
  const wall = rows[0].end;
  const waiting = rows.filter((r) => r.queued >= 30);
  const lines = [
    '### Pipeline timeline',
    '',
    `Wall time ${fmt(wall)} (budget ${fmt(BUDGET_SECONDS)}). Last to finish: **${rows[0].name}** (${fmt(rows[0].seconds)}, started at ${fmt(rows[0].start)}).`,
    waiting.length
      ? `Waited 30 s or more for a runner: ${waiting.length} job(s), worst ${fmt(Math.max(...waiting.map((r) => r.queued)))} (${waiting.sort((a, b) => b.queued - a.queued)[0].name}).`
      : 'No job waited 30 s or more for a runner.',
    '',
    '| Job | Waited | Start | End | Took |',
    '| --- | --- | --- | --- | --- |',
    ...rows.map(
      (r) =>
        `| ${r.name} | ${fmt(r.queued)} | ${fmt(r.start)} | ${fmt(r.end)} | ${fmt(r.seconds)} |`,
    ),
    '',
  ];
  if (wall > BUDGET_SECONDS) {
    lines.push(
      `::warning title=Slow CI run::Wall time ${fmt(wall)} is over the ${fmt(BUDGET_SECONDS)} budget. Last job: ${rows[0].name} (SPO-370).`,
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
      process.stdout.write(`Pipeline timeline unavailable: ${e.message}\n`);
    }
  });
}
