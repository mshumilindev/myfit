#!/usr/bin/env node
/**
 * Change-stability metrics (SPO-125 §6.5, DORA-style), measured from git history, per ISO week:
 *   commits      all commits on the branch
 *   fixShare     share of commits that are fixes (fix / фікс / виправ / hotfix / revert / відкат)
 *   revertShare  share of commits that revert something
 *   layoutFixes  fix commits touching CSS / layout (the "same layout broke again" signal)
 *   rework       fixes to a file changed within the previous 3 days by a non-fix commit (a fix on fresh code)
 * Usage:  node scripts/stability-metrics.mjs [--since 2026-08-01] [--ref origin/main] [--json]
 * "Before" = weeks up to the rules rollout (SPO-125, 2026-10-16); re-run later for "after".
 */
import { execFileSync } from 'node:child_process';

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > -1 ? process.argv[i + 1] : d;
};
const ref = arg('ref', 'HEAD');
const since = arg('since', '2026-08-01');
const out = execFileSync(
  'git',
  ['log', ref, `--since=${since}`, '--no-merges', '--name-only', '--format=@@%H|%cI|%s'],
  { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
);
const FIX = /\b(fix|hotfix|revert)\b|фікс|виправ|відкат|поправ/i;
const REVERT = /\brevert\b|відкат/i;
const commits = out
  .split('@@')
  .filter(Boolean)
  .map((b) => {
    const [head, ...files] = b.split('\n').filter(Boolean);
    const [hash, date, ...s] = head.split('|');
    return { hash, t: Date.parse(date), date, subject: s.join('|'), files };
  })
  .sort((a, b) => a.t - b.t);

const week = (t) => {
  const d = new Date(t);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
};
const lastChange = new Map();
const weeks = new Map();
for (const c of commits) {
  const w = week(c.t);
  const row = weeks.get(w) ?? {
    week: w,
    commits: 0,
    fixes: 0,
    reverts: 0,
    layoutFixes: 0,
    rework: 0,
  };
  const isFix = FIX.test(c.subject);
  row.commits++;
  if (isFix) {
    row.fixes++;
    if (REVERT.test(c.subject)) row.reverts++;
    if (c.files.some((f) => /\.css$|ui\//.test(f))) row.layoutFixes++;
    if (c.files.some((f) => lastChange.has(f) && c.t - lastChange.get(f) < 3 * 864e5)) row.rework++;
  }
  for (const f of c.files) if (!isFix) lastChange.set(f, c.t);
  weeks.set(w, row);
}
const rows = [...weeks.values()].map((r) => ({
  ...r,
  fixShare: +((100 * r.fixes) / r.commits).toFixed(1),
  revertShare: +((100 * r.reverts) / r.commits).toFixed(1),
}));
if (process.argv.includes('--json')) console.log(JSON.stringify(rows, null, 1));
else {
  console.log('week        commits fix% revert% layoutFixes rework');
  for (const r of rows)
    console.log(
      `${r.week}  ${String(r.commits).padStart(6)} ${String(r.fixShare).padStart(5)} ${String(r.revertShare).padStart(7)} ${String(r.layoutFixes).padStart(11)} ${String(r.rework).padStart(6)}`,
    );
  const tot = rows.reduce(
    (a, r) => ({ c: a.c + r.commits, f: a.f + r.fixes, l: a.l + r.layoutFixes, w: a.w + r.rework }),
    { c: 0, f: 0, l: 0, w: 0 },
  );
  console.log(
    `TOTAL ${tot.c} commits, ${((100 * tot.f) / tot.c).toFixed(1)}% fixes, ${tot.l} layout fixes, ${tot.w} rework`,
  );
}
