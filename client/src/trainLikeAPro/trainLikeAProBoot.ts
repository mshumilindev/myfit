/**
 * Boot of the Train like a pro chunk: puts its screens into the core's `trainLikeAProHost` and announces it is ready.
 * Imported lazily (and only) by `addons/useAddonRuntime.ts` while the add-on is installed.
 */
import { trainLikeAProHost } from '../trainLikeAProRt';
import { provide, trackerReady } from '../trackerRt';
import { CatalogRoute } from './CatalogRoute';
import { TlEntryRow } from './TlEntryRow';

provide(trainLikeAProHost, { Page: CatalogRoute, EntryRow: TlEntryRow });
trackerReady('train-like-a-pro');
