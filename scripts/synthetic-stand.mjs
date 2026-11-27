#!/usr/bin/env node
// node scripts/synthetic-stand.mjs [--seed N] [--out file.json]  → synthetic data for verifiers (read-only for prod: writes only the file).
import { writeFileSync } from 'node:fs';
import { buildStand } from './lib/synthetic-stand.mjs';

const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : d;
};
const stand = buildStand({ seed: Number(arg('--seed', 1)) });
const out = arg('--out', '');
if (out) writeFileSync(out, JSON.stringify(stand, null, 2));
console.log(
  `synthetic-stand: users ${stand.users.length}, workouts ${stand.workouts.length}, sleep ${stand.sleep.length}${out ? ` → ${out}` : ''}`,
);
