/**
 * Boot of the Time blocks chunk: puts its screens into the core's `timeBlocksHost` and announces it is ready. Imported lazily
 * (and only) by `addons/useAddonRuntime.ts` while the module is installed.
 */
import { timeBlocksHost } from '../timeBlocksApi';
import { provide, trackerReady } from '../trackerRt';
import { BlockCountdownRun } from './BlockCountdownRun';

provide(timeBlocksHost, { Countdown: BlockCountdownRun });
trackerReady('time-blocks');
