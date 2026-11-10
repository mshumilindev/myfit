/**
 * Loads the supplements modules (they provide their functions into the `supplementsRt` facade at import time) and tells the
 * store to re-normalise its copy. Imported lazily by the add-on runtime while Supplements is installed (SPO-500 I8).
 */
import './supplements';
import './supplementsShare';
import { trackerReady } from './trackerRt';

trackerReady('supplements');
