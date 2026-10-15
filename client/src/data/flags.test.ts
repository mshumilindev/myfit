import { expect, it } from 'vitest';
import { FEATURE_FLAGS } from './flags';

it('does not gate released conditions behind a feature flag', () => {
  expect(FEATURE_FLAGS.map((f) => f.id)).not.toContain('conditions');
});

it('Coach is released: there is no feature flag for it any more', () => {
  expect(FEATURE_FLAGS.map((f) => f.id)).not.toContain('coach');
});
