// Turns `semgrep --json` output into GitHub Actions annotations (visible on the PR/commit and via the API)
// and fails when anything was found. Usage: node scripts/semgrep-annotate.mjs semgrep.json
import { readFileSync } from 'node:fs';

const report = JSON.parse(readFileSync(process.argv[2] ?? 'semgrep.json', 'utf8'));
const results = report.results ?? [];
const escape = (s) => String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');

for (const r of results) {
  const rule = String(r.check_id).split('.').slice(-1)[0];
  const msg = escape(String(r.extra?.message ?? '').slice(0, 300));
  console.log(
    `::error file=${r.path},line=${r.start?.line ?? 1},title=semgrep ${escape(rule)}::${msg}`,
  );
}
for (const e of report.errors ?? [])
  console.log(`::warning title=semgrep::${escape(e.message ?? e.type)}`);
console.log(`semgrep: ${results.length} finding(s)`);
process.exit(results.length ? 1 : 0);
