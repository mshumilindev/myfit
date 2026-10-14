import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Raw text of a kit stylesheet for tests (vite's ?raw glob returns '' for CSS under vitest). */
export function kitCss(name: string): string {
  return readFileSync(join(__dirname, `${name}.css`), 'utf8');
}

/** Raw text of client/src/styles.css (the :root tokens). */
export function stylesCss(): string {
  return readFileSync(join(__dirname, '..', '..', 'styles.css'), 'utf8');
}
