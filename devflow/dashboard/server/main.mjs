#!/usr/bin/env node
/** SPO-639 (W17 B2): starts the Dev Console on 127.0.0.1:5174 (strict port; never falls back to another one). */
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collect, readDoc, validateSnapshot } from './collector.mjs';
import { linearOf, loadKey } from './linear.mjs';
import { createDashServer } from './server.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(process.env.CLAUDE_PROJECT_DIR ?? process.cwd());
const PORT = Number(process.env.DEV_DASH_PORT ?? 5174);
/** @param {...string} a */
const git = (...a) =>
  execFileSync('git', a, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    timeout: 8000,
  }).trim();

/** gh is optional; results are cached for a minute so polling never hammers the API. */
/** @type {Map<string, { at: number, out: string }>} */
const ghCache = new Map();
const gh = (/** @type {string} */ path) => {
  const hit = ghCache.get(path);
  if (hit && Date.now() - hit.at < 60000) return hit.out;
  const out = execFileSync('gh', ['api', path], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    timeout: 8000,
  });
  ghCache.set(path, { at: Date.now(), out });
  return out;
};

/** Linear status of the tasks in flight, refreshed at most once a minute in the background (never blocks a poll). */
let linearCache = { at: 0, data: {} };
let linearBusy = false;
function refreshLinear(/** @type {string[]} */ ids) {
  if (linearBusy || Date.now() - linearCache.at < 60000 || !ids.length) return;
  linearBusy = true;
  linearOf({ key: loadKey(ROOT), ids })
    .then((data) => (linearCache = { at: Date.now(), data }))
    .catch(() => {})
    .finally(() => (linearBusy = false));
}

const server = createDashServer({
  uiRoot: join(HERE, '../ui'),
  port: PORT,
  doc: (id, dir, name) => readDoc(ROOT, id, dir, name),
  collect: () => {
    const first = collect({ root: ROOT, git, gh });
    refreshLinear(first.tasks.map((/** @type {{ id: string }} */ x) => x.id));
    const snap = collect({ root: ROOT, git, gh, linear: linearCache.data });
    const problems = validateSnapshot(snap);
    return problems.length
      ? { v: snap.v, error: 'snapshot-rejected', problems: problems.slice(0, 5) }
      : snap;
  },
});
server.on('error', (e) => {
  console.error(
    `[dev-dashboard] cannot listen on 127.0.0.1:${PORT}: ${/** @type {NodeJS.ErrnoException} */ (e).code ?? e.message}`,
  );
  process.exit(1);
});
server.listen(PORT, '127.0.0.1', () => console.log(`[dev-dashboard] http://127.0.0.1:${PORT}`));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.close(() => process.exit(0)));
