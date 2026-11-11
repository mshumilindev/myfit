/**
 * Loads the Sleep engine (it `provide`s itself into the `sleepRt` facade at import time) and tells the store to rebuild what
 * depends on it. Imported lazily by the add-on runtime while Sleep is installed (SPO-500 I8).
 */
import './sleep';
import { trackerReady } from './trackerRt';

trackerReady('sleep');
