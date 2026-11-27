#!/usr/bin/env node
// Usage: gcloud logging read '<filter since deploy>' --format=json | node scripts/post-deploy-gate.mjs [--max-errors N] [--max-share P]
// Exit 1 → roll back by docs/runbooks/ROLLBACK.md. Reads logs only.
import { readFileSync } from 'node:fs';
import { evaluateGate } from './lib/post-deploy-gate.mjs';

const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? Number(process.argv[i + 1]) : d;
};
const entries = JSON.parse(readFileSync(0, 'utf8') || '[]');
const r = evaluateGate(entries, {
  maxErrors: arg('--max-errors', 5),
  maxSharePct: arg('--max-share', 2),
});
console.log(
  `post-deploy-gate: ${r.ok ? 'OK' : 'FAIL'} · errors ${r.errors}/${r.total} (${r.sharePct}%) · cap ${r.maxErrors} / ${r.maxSharePct}%`,
);
process.exit(r.ok ? 0 : 1);
