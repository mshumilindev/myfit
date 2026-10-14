import { expect, it } from 'vitest';
import { FEATURE_FLAGS } from './flags';

it('does not gate released conditions behind a feature flag', () => {
  expect(FEATURE_FLAGS.map((f) => f.id)).not.toContain('conditions');
});

it('the coach flag exists, is global and defaults OFF', async () => {
  const { isFlagOn } = await import('./flags');
  expect(FEATURE_FLAGS.find((f) => f.id === 'coach')?.scope).toBe('global');
  expect(isFlagOn('coach')).toBe(false);
});
