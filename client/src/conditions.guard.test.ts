// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Privacy guard: no Cloud Function may read the private conditions profile. The coach
 * sees only what the user chose to share (see conditions.ts → coachView), and that
 * arrives through an explicit share document, never through the raw conditions store.
 */
const FN_DIR = join(__dirname, '../../functions/src');
const FORBIDDEN =
  /(collection|doc)\(\s*['"`](conditions|chronic|chronicConditions|health)['"`]\s*\)/;

describe('trainer/admin functions never read private conditions', () => {
  const files = readdirSync(FN_DIR).filter((f) => f.endsWith('.ts'));
  it('has functions to scan', () => expect(files.length).toBeGreaterThan(3));
  it.each(files)('%s', (f) => {
    expect(readFileSync(join(FN_DIR, f), 'utf8')).not.toMatch(FORBIDDEN);
  });
});
