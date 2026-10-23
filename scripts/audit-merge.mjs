#!/usr/bin/env node
/**
 * Proves that sharded geometry audits cover the WHOLE matrix (SPO-140): every shard report must exist, each shard must have
 * run every probe it was given, and the shards must add up to the full matrix size. Also fails when any shard has findings.
 *   node scripts/audit-merge.mjs <dir with *.json reports> --shards 16
 * Report files: stories-<i>.json, hero-<i>.json, chat-<i>.json, swap-<i>.json (written by the audits via --out).
 */
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
const shards = Number(process.argv[process.argv.indexOf('--shards') + 1]);
if (!dir || !Number.isInteger(shards) || shards < 1) {
  console.error('usage: audit-merge.mjs <dir> --shards N');
  process.exit(2);
}

let failed = false;
const fail = (m) => {
  failed = true;
  console.error(`✗ ${m}`);
};

for (const audit of ['stories', 'hero', 'chat', 'swap']) {
  let sum = 0;
  let total = null;
  let findings = 0;
  for (let i = 0; i < shards; i++) {
    const f = path.join(dir, `${audit}-${i}.json`);
    if (!fs.existsSync(f)) {
      fail(`${audit}: report for shard ${i}/${shards} is missing (the job did not finish)`);
      continue;
    }
    const r = JSON.parse(fs.readFileSync(f, 'utf8'));
    if (r.part?.part !== i || r.part?.parts !== shards)
      fail(`${audit}: shard file ${i} was produced for part ${r.part?.part}/${r.part?.parts}`);
    if (r.probes !== r.expected)
      fail(
        `${audit}: shard ${i} ran ${r.probes} of ${r.expected} probes (some probes were skipped)`,
      );
    if (total !== null && r.total !== total) fail(`${audit}: shards disagree on the matrix size`);
    total = r.total;
    sum += r.expected;
    findings += Array.isArray(r.report) ? r.report.length : 0;
  }
  if (total !== null && sum !== total)
    fail(`${audit}: shards cover ${sum} probes but the full matrix is ${total}`);
  if (findings) fail(`${audit}: ${findings} finding(s) (see the shard logs)`);
  if (!failed)
    console.log(`✓ ${audit}: ${sum}/${total} probes across ${shards} shards, 0 findings`);
}
process.exit(failed ? 1 : 0);
