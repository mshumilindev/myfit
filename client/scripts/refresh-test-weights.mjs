// Rebuilds client/test-weights.json from a vitest JSON report (seconds per test file, >= 2 s only; the rest default to 1).
//   cd client && npx vitest run --reporter=json --outputFile=/tmp/vt.json && node scripts/refresh-test-weights.mjs /tmp/vt.json
import { readFileSync, writeFileSync } from 'node:fs';

const report = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const weights = {};
for (const r of report.testResults) {
  const s = Math.round((r.endTime - r.startTime) / 1000);
  if (s >= 2) weights[r.name.replace(/\\/g, '/').replace(/^.*\/client\//, '')] = s;
}
const sorted = Object.fromEntries(Object.entries(weights).sort(([a], [b]) => (a < b ? -1 : 1)));
writeFileSync(
  new URL('../test-weights.json', import.meta.url),
  JSON.stringify(sorted, null, 2) + '\n',
);
console.log(`${Object.keys(sorted).length} weighted files`);
