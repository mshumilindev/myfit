/// <reference lib="webworker" />
/**
 * Builds Atlas's understanding index off the main thread — it takes a few
 * seconds on a phone and would otherwise freeze the chat on the first question.
 * The phrasings (most of the knowledge base by size) live only here; the chat
 * gets the index plus the answers-by-question-type.
 */
import { KB, facetsTable } from './kb';
import { buildIndex } from './retrieve';

self.onmessage = () => {
  (self as unknown as Worker).postMessage({ index: buildIndex(KB), facets: facetsTable(KB) });
};
