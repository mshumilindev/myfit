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
import { KB_R5 } from './partR5';
import { KB_R6 } from './partR6';
import { KB_R7 } from './partR7';
import { KB_R8 } from './partR8';
import { KB_R9 } from './partR9';
import { KB_R10 } from './partR10';
import { KB_PLLTET } from './partPlLtEt';
import { FACETS_R1 } from './depthR1';
import { FACETS_R2 } from './depthR2';
import { FACETS_R3 } from './depthR3';
import { NEW_TOPICS } from './topicsNew';
import { NEW_TOPICS_EX } from './topicsNewEx';
import { APP_TOPICS } from '../appTopics';
import type { Kb } from './types';

const base: Kb = { ...KB_A, ...KB_B, ...KB_C, ...KB_D, ...KB_E };
type More = Record<string, { ex: string[]; exUk: string[] }>;
/** Rounds of extra phrasings, concatenated per topic (round 3 targets the topics Atlas mixed up). */
const rounds: More[] = [
  { ...KB_A2, ...KB_B2, ...KB_C2, ...KB_D2, ...KB_E2 },
  { ...KB_R1, ...KB_R2, ...KB_R3, ...KB_R4 },
  KB_R5,
  KB_R6,
  KB_R7,
  KB_R8,
  KB_R9,
  KB_R10,
  // Other languages ride in the English list — the matcher doesn't care.
  Object.fromEntries(Object.entries(KB_PLLTET).map(([id, ex]) => [id, { ex, exUk: [] }])),
];
const more: More = {};
for (const r of rounds)
  for (const [id, e] of Object.entries(r))
    more[id] = {
      ex: [...(more[id]?.ex ?? []), ...e.ex],
      exUk: [...(more[id]?.exUk ?? []), ...e.exUk],
    };

/** More sides of a topic ("why…", "how…") — the first-written answer wins. */
const facetRounds = [FACETS_R1, FACETS_R2, FACETS_R3];

export const KB: Kb = Object.fromEntries([
  ...Object.entries(base).map(([id, e]) => {
    const facets = facetRounds.reduce((f, r) => ({ ...(r[id] ?? {}), ...f }), e.facets ?? {});
    return [
      id,
      {
        ...e,
        ex: [...e.ex, ...(more[id]?.ex ?? [])],
        exUk: [...e.exUk, ...(more[id]?.exUk ?? [])],
        ...(Object.keys(facets).length ? { facets } : {}),
      },
    ];
  }),
  // How the app works — from the app's own screens.
  ...APP_TOPICS.map((t) => [t.id, { ex: t.ex, exUk: t.exUk }]),
  // Topics added later — whole (phrasings + sides) in one file.
  ...NEW_TOPICS.map((t) => [
    t.id,
    {
      ex: [...(NEW_TOPICS_EX[t.id]?.ex ?? []), ...(more[t.id]?.ex ?? [])],
      exUk: [...(NEW_TOPICS_EX[t.id]?.exUk ?? []), ...(more[t.id]?.exUk ?? [])],
      facets: t.facets,
    },
  ]),
]);
export type { Facet, Kb, KbEntry } from './types';

/** Every topic's answer by question type — what the chat needs from the base (the phrasings stay in the worker). */
export function facetsTable(kb: Kb): Record<string, NonNullable<Kb[string]['facets']>> {
  return Object.fromEntries(
    Object.entries(kb).flatMap(([id, e]) => (e.facets ? [[id, e.facets]] : [])),
  );
}
