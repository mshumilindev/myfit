/**
 * Boot of the Periodization chunk: puts its pieces into the core's `periodizationHost` and announces it is ready.
 * Imported lazily (and only) by `addons/useAddonRuntime.ts` while the module is installed.
 */
import { periodizationHost } from '../periodizationApi';
import { provide, trackerReady } from '../trackerRt';
import { activeWeekPlan, loadKg, repsLabel } from './cycle';
import { cloneCycle, rowExtras, sanitizeCycle } from './cycleData';
import { maxFor } from './maxes';

provide(periodizationHost, {
  maxFor,
  weekPlan: activeWeekPlan,
  sanitizeCycle,
  cloneCycle,
  rowExtras,
  load: loadKg,
  repsLabel,
});
trackerReady('periodization');
