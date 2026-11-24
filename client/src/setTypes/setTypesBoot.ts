/**
 * Boot of the Set types chunk: puts its editor pieces into the core's `setTypesHost` and announces it is ready. Imported lazily
 * (and only) by `addons/useAddonRuntime.ts` while the module is installed.
 */
import { setTypesHost } from '../setTypesApi';
import { provide, trackerReady } from '../trackerRt';
import { DropBody } from './DropBody';
import { TypeNote } from './TypeNote';

provide(setTypesHost, { DropBody, TypeNote });
trackerReady('set-types');
