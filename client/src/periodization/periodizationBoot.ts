/**
 * Boot of the Periodization chunk: puts its pieces into the core's `periodizationHost` and announces it is ready.
 * Imported lazily (and only) by `addons/useAddonRuntime.ts` while the module is installed.
 */
import { periodizationHost } from '../periodizationRt';
import { provide, trackerReady } from '../trackerRt';
import { maxFor } from './maxes';

provide(periodizationHost, { maxFor });
trackerReady('periodization');
