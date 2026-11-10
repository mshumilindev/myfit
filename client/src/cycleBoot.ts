/**
 * Loads the cycle modules (they provide their functions into the `cycleRt` facade at import time) and tells the store to
 * re-normalise its copy. Imported lazily by the add-on runtime while Cycle is installed (SPO-500 I8).
 */
import './cycle/cycleState';
import { trackerReady } from './trackerRt';

trackerReady('cycle');
