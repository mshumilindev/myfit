/**
 * Boot of the Circuit chunk: puts its screens into the core's `circuitHost` and announces it is ready. Imported lazily (and only)
 * by `addons/useAddonRuntime.ts` while the module is installed.
 */
import { circuitHost } from '../circuitApi';
import { provide, trackerReady } from '../trackerRt';
import { CircuitBlock } from './CircuitBlock';
import { CIRCUIT_CONTROLS } from './CircuitControls';
import { CircuitRunSheet } from './CircuitRun';

provide(circuitHost, {
  Block: CircuitBlock,
  RunSheet: CircuitRunSheet,
  Controls: CIRCUIT_CONTROLS,
});
trackerReady('circuit');
