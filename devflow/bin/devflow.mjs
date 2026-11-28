#!/usr/bin/env node
/** devflow CLI. `devflow init` writes a starter devflow.config.json for the current project (never overwrites). */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import process from 'node:process';

const cmd = process.argv[2];
if (cmd === 'init') {
  const root = resolve(process.env.CLAUDE_PROJECT_DIR ?? process.cwd());
  const dir = join(root, 'devflow');
  const file = join(dir, 'devflow.config.json');
  if (existsSync(file)) {
    process.stdout.write(`devflow.config.json already exists: ${file}\n`);
  } else {
    mkdirSync(dir, { recursive: true });
    const config = {
      taskPattern: '^[A-Z]+-\\d+$',
      stateDir: '.claude/state',
      mirrorDir: '.devflow/mirror',
      wfCli: 'scripts/wf.mjs',
      barCli: 'scripts/wf-bar.mjs',
      docsDirs: ['docs/specs', 'docs/plans'],
      dashboardPort: 5174,
      brand: 'PROJECT',
      repo: 'owner/repo',
      rulesDir: '.claude/rules',
      dashRoot: 'devflow/dashboard',
      publish: { branch: 'wf-state', dir: 'wf', minIntervalMs: 3000 },
      dashboardUrl: 'http://localhost:5174',
    };
    writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
    process.stdout.write(
      `Wrote ${file}. Edit repo, taskPattern and brand, then install the plugin.\n`,
    );
  }
} else {
  process.stdout.write('usage: devflow init\n');
  process.exitCode = cmd ? 1 : 0;
}
