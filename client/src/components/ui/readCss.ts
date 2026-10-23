import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PRIM = new Map<string, string>();
for (const m of readFileSync(
  join(__dirname, '..', '..', 'tokens', 'primitives.css'),
  'utf8',
).matchAll(/(--(?:c|bw|sz|z)-[\w-]+):\s*([^;]+);/g)) {
  PRIM.set(m[1], m[2].trim());
}

/** Tier-1 primitives (tokens/primitives.css) substituted back to their raw values, so tests that assert on literal colours/sizes keep reading what the browser sees. */
export function inlinePrimitives(css: string): string {
  return css.replace(/var\((--(?:c|bw|sz|z)-[\w-]+)\)/g, (all, n) => PRIM.get(n) ?? all);
}

/** Raw text of a kit stylesheet for tests (vite's ?raw glob returns '' for CSS under vitest). */
export function kitCss(name: string): string {
  return inlinePrimitives(readFileSync(join(__dirname, `${name}.css`), 'utf8'));
}

/** Raw text of client/src/styles.css (the :root tokens). */
export function stylesCss(): string {
  return inlinePrimitives(readFileSync(join(__dirname, '..', '..', 'styles.css'), 'utf8'));
}

/** glass.css (kit rules) + themes/glass.css (theme tokens, sub-app skins), selectors normalised to unquoted attrs. */
export function glassCss(): string {
  const base = join(__dirname, '..', '..');
  return inlinePrimitives(
    [
      readFileSync(join(base, 'glass.css'), 'utf8'),
      readFileSync(join(base, 'themes', 'glass.css'), 'utf8'),
    ].join('\n'),
  ).replace(/\[data-theme='glass'\]/g, '[data-theme=glass]');
}
