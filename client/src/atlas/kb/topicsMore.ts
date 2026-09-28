/**
 * A hundred more topics (programming methods, lift variations, recovery,
 * supplements, cardio, mobility, kit, gym life, women's and older lifters,
 * mindset, measuring, recomposition, other activities, anatomy, symptoms).
 * Same shape as topicsNew.ts plus follow-up chips (ids of related topics);
 * the phrasings live in topicsMoreEx.ts (the understanding index only).
 */
import type { NewTopic } from './topicsNew';
import { MORE_A } from './topicsMoreA';
import { MORE_B } from './topicsMoreB';

export interface MoreTopic extends NewTopic {
  /** Related topics offered as chips (their canonical questions). */
  chips: string[];
}

export const MORE_TOPICS: MoreTopic[] = [...MORE_A, ...MORE_B];
