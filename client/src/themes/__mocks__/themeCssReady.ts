/**
 * Vitest setup: every look's styles count as "in the page" (the real loader is async, the suites expect a look to go on at
 * once). The loading itself is covered in `themes/lazy.test.ts`, which builds its own module instance.
 */
import { markAllThemeCssReady } from '../lazy';

markAllThemeCssReady();
