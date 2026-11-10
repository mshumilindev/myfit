/**
 * Loads the nicotine modules (they provide their functions into the `nicotineRt` facade at import time) and tells the store
 * to re-normalise its copy. Imported lazily by the add-on runtime while Nicotine is installed (SPO-500 I8).
 */
import './nicotine';
import './nicotineShare';
import { trackerReady } from './trackerRt';

trackerReady('nicotine');
