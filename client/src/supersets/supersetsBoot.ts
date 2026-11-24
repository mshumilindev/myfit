/**
 * Boot of the Supersets chunk: puts its sheet into the core's `supersetsHost` and announces it is ready. Imported lazily (and
 * only) by `addons/useAddonRuntime.ts` while the module is installed.
 */
import { supersetsHost } from '../supersetsApi';
import { provide, trackerReady } from '../trackerRt';
import { SupersetSheet } from './SupersetSheet';

provide(supersetsHost, { Sheet: SupersetSheet });
trackerReady('supersets');
