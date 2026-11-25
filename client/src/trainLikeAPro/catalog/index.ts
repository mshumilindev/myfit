/** The catalog data (English, one entry per program variant). Lives in the add-on's lazy chunk only. */
import data from './catalog.json';
import type { CatalogEntry } from './types';

export const CATALOG = data as unknown as CatalogEntry[];
