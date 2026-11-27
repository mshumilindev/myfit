#!/usr/bin/env node
/** SPO-639 (W17 B2): starts the Dev Console on 127.0.0.1:5174 (strict port; never falls back to another one). */
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collect, validateSnapshot } from './collector.mjs';
import { createDashServer } from './server.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const PORT = Number(process.env.DEV_DASH_PORT ?? 5174);
/** @param {...string} a */
const git = (...a) =>
  execFileSync('git', a, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    timeout: 8000,
  }).trim();

const server = createDashServer({
  uiRoot: join(HERE, '../ui'),
  port: PORT,
  collect: () => {
    const snap = collect({ root: ROOT, git });
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
