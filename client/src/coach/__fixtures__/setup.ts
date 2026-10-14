/**
 * Vitest setup: the sample Coach world is available to every test through the test hooks (never in an app build).
 * Node-environment test files (no DOM, no localStorage) do not load it: they test adapters and codecs, not screens.
 */
import { beforeEach } from 'vitest';

if (typeof localStorage !== 'undefined') {
  const { setLocale } = await import('../../i18n');
  beforeEach(() => setLocale('en'));
  await import('./register');
}
export {};
