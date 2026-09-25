/** The whole knowledge base (paraphrases + facets), merged from its parts. */
import { KB_A } from './partA';
import { KB_B } from './partB';
import { KB_C } from './partC';
import { KB_D } from './partD';
import { KB_E } from './partE';
import { KB_A2 } from './partA2';
import { KB_B2 } from './partB2';
import { KB_C2 } from './partC2';
import { KB_D2 } from './partD2';
import { KB_E2 } from './partE2';
import type { Kb } from './types';

const base: Kb = { ...KB_A, ...KB_B, ...KB_C, ...KB_D, ...KB_E };
const more: Record<string, { ex: string[]; exUk: string[] }> = {
  ...KB_A2,
  ...KB_B2,
  ...KB_C2,
  ...KB_D2,
  ...KB_E2,
};

export const KB: Kb = Object.fromEntries(
  Object.entries(base).map(([id, e]) => [
    id,
    { ...e, ex: [...e.ex, ...(more[id]?.ex ?? [])], exUk: [...e.exUk, ...(more[id]?.exUk ?? [])] },
  ]),
);
export type { Facet, Kb, KbEntry } from './types';
