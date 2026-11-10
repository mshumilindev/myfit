/**
 * Loads every alcohol module (they provide their functions into the `alcoholRt` facade at import time) and tells the store
 * to re-normalise its copy. Imported lazily by the add-on runtime while Alcohol is installed (SPO-500 I8).
 */
import './alcohol';
import './alcoholRegion';
import './alcoholShare';
import { trackerReady } from './trackerRt';

trackerReady('alcohol');
