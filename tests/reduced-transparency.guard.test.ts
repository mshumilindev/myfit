/**
 * Reduced-transparency guard (SPO-136, ADR 010).
 * Every backdrop blur in the app is a `--bf-*` token (stylelint enforces that no CSS file draws its
 * own), and `@media (prefers-reduced-transparency: reduce)` must turn every one of them off, so a
 * new blur recipe cannot ship without an opt-out. The Brass Glass translucent surfaces must become
 * opaque in the same media query. All of it lives in client/src/reduced-transparency.css.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', 'client', 'src');
const file = readFileSync(join(SRC, 'reduced-transparency.css'), 'utf8');

/** Body of the first `@media (prefers-reduced-transparency: reduce) { … }` block (brace-matched). */
function reducedBlock(css: string): string {
  const start = css.indexOf('@media (prefers-reduced-transparency: reduce)');
  if (start < 0) return '';
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) return css.slice(open + 1, i);
  }
  return '';
}

describe('prefers-reduced-transparency', () => {
  const declared = [...file.matchAll(/^\s*(--bf-[a-z0-9-]+)\s*:\s*blur\(/gm)].map((m) => m[1]);
  const block = reducedBlock(file);

  it('declares backdrop recipes as --bf-* tokens', () => {
    expect(declared.length).toBeGreaterThan(0);
  });

  it('switches every --bf-* token and --glass-backdrop off', () => {
    const off = new Set([...block.matchAll(/(--[a-z0-9-]+)\s*:\s*none\s*;/g)].map((m) => m[1]));
    const missing = [...declared, '--glass-backdrop'].filter((t) => !off.has(t));
    expect(missing).toEqual([]);
  });

  it('makes the Brass Glass translucent surfaces opaque', () => {
    for (const token of [
      '--glass-surface',
      '--glass-tint',
      '--glass-hero-tint',
      '--glass-rest-tint',
    ]) {
      expect(block, token).toMatch(new RegExp(`${token}\\s*:`));
    }
  });
});
