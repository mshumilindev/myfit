/**
 * Boot of the Circuit chunk: puts its screens into the core's `circuitHost` and announces it is ready. Imported lazily (and only)
 * by `addons/useAddonRuntime.ts` while the module is installed.
 */
import { circuitHost } from '../circuitApi';
import { provide, trackerReady } from '../trackerRt';
import { CircuitBlock, CircuitRunSheet } from './CircuitParts';

provide(circuitHost, { Block: CircuitBlock, RunSheet: CircuitRunSheet });
trackerReady('circuit');
