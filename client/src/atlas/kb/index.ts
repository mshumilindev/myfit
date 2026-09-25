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
import { KB_R1 } from './partR1';
import { KB_R2 } from './partR2';
import { KB_R3 } from './partR3';
import { KB_R4 } from './partR4';
import type { Kb } from './types';

const base: Kb = { ...KB_A, ...KB_B, ...KB_C, ...KB_D, ...KB_E };
type More = Record<string, { ex: string[]; exUk: string[] }>;
/** Rounds of extra phrasings, concatenated per topic (round 3 targets the topics Atlas mixed up). */
const rounds: More[] = [
  { ...KB_A2, ...KB_B2, ...KB_C2, ...KB_D2, ...KB_E2 },
  { ...KB_R1, ...KB_R2, ...KB_R3, ...KB_R4 },
];
const more: More = {};
for (const r of rounds)
  for (const [id, e] of Object.entries(r))
    more[id] = {
      ex: [...(more[id]?.ex ?? []), ...e.ex],
      exUk: [...(more[id]?.exUk ?? []), ...e.exUk],
    };

export const KB: Kb = Object.fromEntries(
  Object.entries(base).map(([id, e]) => [
    id,
    { ...e, ex: [...e.ex, ...(more[id]?.ex ?? [])], exUk: [...e.exUk, ...(more[id]?.exUk ?? [])] },
  ]),
);
export type { Facet, Kb, KbEntry } from './types';
