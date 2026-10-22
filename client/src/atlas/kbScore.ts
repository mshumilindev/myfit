import { answerLocally } from './intents';
import { richCtx } from './testCtx';

/** Held-out exam scoring shared by the kb.*.test.ts files (split so CI shards can balance them). */
export type Set_ = Record<string, { test: string[]; testUk: string[] }>;
export function score(set: Set_) {
  let ok = 0;
  let unsure = 0;
  let total = 0;
  for (const [id, e] of Object.entries(set))
    for (const [qs, loc] of [
      [e.test, 'en'],
      [e.testUk, 'uk'],
    ] as const)
      for (const q of qs) {
        total++;
        const a = answerLocally(q, richCtx(loc));
        if (a?.intent === id) ok++;
        else if (a?.intent === 'did_you_mean') unsure++;
      }
  return { ok: ok / total, known: (ok + unsure) / total };
}
