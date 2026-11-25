/**
 * Boot of the Train like a pro chunk: puts its screens into the core's `trainLikeAProHost` and announces it is ready.
 * Imported lazily (and only) by `addons/useAddonRuntime.ts` while the add-on is installed.
 */
import { trainLikeAProHost } from '../trainLikeAProRt';
import { provide, trackerReady } from '../trackerRt';

// Screens are provided here as they land (catalog page, entry row); the skeleton announces the chunk only.
provide(trainLikeAProHost, {});
trackerReady('train-like-a-pro');
