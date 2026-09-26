/// <reference lib="webworker" />
/**
 * Builds Atlas's understanding index off the main thread — it takes a few
 * seconds on a phone and would otherwise freeze the chat on the first question.
 */
import { buildIndex } from './retrieve';

self.onmessage = () => {
  (self as unknown as Worker).postMessage(buildIndex());
};
