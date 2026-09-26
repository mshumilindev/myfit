/**
 * The answers-by-question-type ("why…", "how…") of every topic. They arrive
 * with the understanding index from the worker, so the chat bundle never
 * carries the thousands of example phrasings the index is built from.
 */
import type { Facet } from './kb/types';

type Facets = Partial<Record<Facet, [string, string]>>;
let table: Record<string, Facets> = {};

export function setFacets(t: Record<string, Facets>): void {
  table = t;
}
export function facetsOf(id: string | undefined): Facets | undefined {
  return id ? table[id] : undefined;
}
