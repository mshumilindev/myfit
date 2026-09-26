/** Tests answer synchronously: the knowledge base is loaded up front (the app gets it from the worker). */
import { KB, facetsTable } from './kb';
import { loadKb } from './retrieve';
import { setFacets } from './facetStore';

loadKb(KB);
setFacets(facetsTable(KB));
