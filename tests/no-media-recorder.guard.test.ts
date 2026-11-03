/**
 * SPO-22 / SPO-440 (spike: "Не записуємо"): calls are never recorded. No source file of the client, the functions or the
 * desktop shell may mention `MediaRecorder`. Adding a recorder needs an owner decision and a change of this guard.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..');
const DIRS = ['client/src', 'functions/src', 'desktop/src'];
const SKIP_DIR = new Set(['node_modules', 'lib', 'dist']);
const isTest = (f: string) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(f);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIR.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.[cm]?[jt]sx?$/.test(name) && !isTest(name)) out.push(p);
  }
  return out;
}

describe('calls are never recorded', () => {
  it('no MediaRecorder in client/src, functions/src, desktop/src (test files excluded)', () => {
    const files = DIRS.flatMap((d) => walk(join(ROOT, d)));
    expect(files.length).toBeGreaterThan(100); // the walk still sees the sources
    const hits = files.filter((f) => /MediaRecorder/.test(readFileSync(f, 'utf8')));
    expect(hits.map((f) => relative(ROOT, f))).toEqual([]);
  });
});
