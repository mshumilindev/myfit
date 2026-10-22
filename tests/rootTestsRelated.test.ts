/**
 * SPO-270: pre-push runs only the root tests related to the push; config/deps changes fall back to the full suite.
 */
import { describe, expect, it } from 'vitest';
// @ts-expect-error — plain .mjs script without type declarations
import { plan } from '../scripts/root-tests-related.mjs';

describe('root-tests-related plan', () => {
  it('skips when nothing changed', () => {
    expect(plan([]).mode).toBe('skip');
  });

  it('runs related tests for ordinary source and test changes', () => {
    expect(plan(['client/src/feats.ts', 'tests/patchCoverage.test.ts']).mode).toBe('related');
  });

  it.each([
    'vitest.config.ts',
    'tests/setup.ts',
    'package.json',
    'package-lock.json',
    'tsconfig.base.json',
  ])('runs the full suite when %s changes', (f) => {
    expect(plan(['client/src/feats.ts', f]).mode).toBe('all');
  });
});
