/**
 * Loads the Conditions engine (it `provide`s itself into the `conditionsRt` facade at import time) and tells the store to
 * rebuild what depends on it. Imported lazily by the add-on runtime while Conditions is installed (SPO-500 I8).
 */
import './conditions';
import { trackerReady } from './trackerRt';

trackerReady('conditions');
