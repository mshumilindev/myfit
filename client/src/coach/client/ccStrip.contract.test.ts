import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// SPO-102: an empty `.cc-strip` (nothing to show yet) must take no room, or the content below jumps when it fills.
describe('cc-strip takes no room while empty', () => {
  const css = readFileSync(join(__dirname, 'ClientCoach.css'), 'utf8').replace(
    /\/\*[\s\S]*?\*\//g,
    '',
  );
  it('hides itself with :empty', () => {
    expect(css).toMatch(/\.cc-strip:empty\s*\{[^}]*display:\s*none/);
  });
});
