#!/usr/bin/env node
/**
 * SPO-639 (W17 B6): `npm run dev` starts the client (5173, strict) and the Dev Console (5174, loopback only) together.
 * Ctrl-C / SIGTERM stop both children. A Dev Console failure never stops the client; a client failure stops everything.
 * No new dependencies, no pkill: children are plain child_process handles.
 */
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DASH_PORT = Number(process.env.DEV_DASH_PORT ?? 5174);

/** @returns {{ name: string, cmd: string, args: string[], essential: boolean }[]} */
export function childSpecs() {
  return [
    {
      name: 'client',
      cmd: 'npm',
      args: ['run', 'dev', '-w', 'client', '--', '--strictPort'],
      essential: true,
    },
    {
      name: 'dev-console',
      cmd: process.execPath,
      args: ['devflow/dashboard/server/main.mjs'],
      essential: false,
    },
  ];
}

/** Opens the Dev Console in the default browser (best effort, desktop only, skipped with DEV_NO_OPEN=1). */
function openTab(url) {
  if (process.env.DEV_NO_OPEN === '1' || process.env.CI) return;
  const cmd =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  try {
    spawn(cmd, args, { stdio: 'ignore', detached: true })
      .on('error', () => {})
      .unref();
  } catch {
    /* no opener available: the URL is printed anyway */
  }
}

/**
 * @param {ReturnType<typeof childSpecs>} specs
 * @param {{ spawnFn?: typeof spawn, cwd?: string, log?: (s: string) => void }} [o]
 * @returns {Promise<number>} exit code
 */
export function runAll(specs, { spawnFn = spawn, cwd = ROOT, log = console.log } = {}) {
  return new Promise((done) => {
    /** @type {Map<string, import('node:child_process').ChildProcess>} */
    const live = new Map();
    let finished = false;
    const stopAll = (signal = 'SIGTERM') => {
      for (const c of live.values()) {
        try {
          c.kill(signal);
        } catch {
          /* already gone */
        }
      }
    };
    const finish = (code) => {
      if (finished) return;
      finished = true;
      done(code);
    };
    /** @type {number | null} */
    let result = null;
    const settle = () => {
      if (live.size === 0) finish(result ?? 0);
    };
    for (const spec of specs) {
      const child = spawnFn(spec.cmd, spec.args, { cwd, stdio: 'inherit', env: process.env });
      live.set(spec.name, child);
      child.on('error', (e) => {
        log(`[dev] ${spec.name}: cannot start (${e.message})`);
        live.delete(spec.name);
        if (spec.essential) {
          result = 1;
          stopAll();
        }
        settle();
      });
      child.on('exit', (code, sig) => {
        live.delete(spec.name);
        if (spec.essential) {
          log(`[dev] ${spec.name} stopped (${sig ?? code}); stopping the rest`);
          result = code ?? 1;
          stopAll();
        } else {
          log(`[dev] ${spec.name} stopped (${sig ?? code}); the client keeps running`);
        }
        settle();
      });
    }
    for (const sig of ['SIGINT', 'SIGTERM']) {
      process.once(sig, () => {
        result = 0;
        stopAll(sig);
        settle();
      });
    }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`[dev] client http://localhost:5173 · Dev Console http://127.0.0.1:${DASH_PORT}`);
  openTab(`http://127.0.0.1:${DASH_PORT}`);
  runAll(childSpecs()).then((code) => process.exit(code));
}
