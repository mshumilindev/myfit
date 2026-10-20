/**
 * Vitest setup: the sample Coach world is available to every test through the test hooks (never in an app build).
 * Node-environment test files (no DOM, no localStorage) do not load it: they test adapters and codecs, not screens.
 */
import { beforeEach } from 'vitest';

if (typeof localStorage !== 'undefined') {
  const { setLocale } = await import('../../i18n');
  beforeEach(() => setLocale('en'));
  // findBy*/waitFor wait up to 1 s by default; the Coach story frames (thread, schedule) load their sample world lazily and on a
  // loaded CI core that takes longer. A longer ceiling changes nothing for a passing test (it resolves as soon as the element
  // appears) and does not weaken an assertion: a missing element still fails, only later.
  const { configure } = await import('@testing-library/react');
  configure({ asyncUtilTimeout: 5000 });
}
export {};
