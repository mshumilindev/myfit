/**
 * Atlas learns your way of asking. When you pick "did you mean…" option, or
 * tap 👍 on an answer, that phrasing → that topic is remembered; a 👎 marks
 * the topic as wrong for it. Next time the same (or nearly the same) words
 * go straight to what you meant — no retraining, no server, just your memory.
 */
import type { AtlasMemory } from './memory';
import { terms } from './retrieve';

export interface Taught {
  q: string;
  id: string;
  at: number;
}

/** How many phrasings are kept of each kind (newest win). */
const CAP = 150;
/** Near-identical wording: share at least two thirds of meaning-words. */
const NEAR = 0.66;

const bag = (q: string) => new Set(terms(q).filter((t) => t !== '~me' && t !== '~you'));

/** Jaccard overlap of meaning-words (stems + synonyms), 0..1. */
export function similarity(a: string, b: string): number {
  const x = bag(a);
  const y = bag(b);
  if (!x.size || !y.size) return 0;
  let both = 0;
  for (const t of x) if (y.has(t)) both++;
  return both / (x.size + y.size - both);
}

/** The topic you taught for this wording, if any (closest, newest first). */
export function taughtFor(question: string, mem: AtlasMemory | undefined): string | null {
  let best: { id: string; s: number } | null = null;
  for (const t of mem?.taught ?? []) {
    const s = similarity(question, t.q);
    if (s >= NEAR && (!best || s > best.s)) best = { id: t.id, s };
  }
  return best?.id ?? null;
}

/** Topics you said were wrong for this wording. */
export function wrongFor(question: string, mem: AtlasMemory | undefined): Set<string> {
  const out = new Set<string>();
  for (const t of mem?.wrong ?? []) if (similarity(question, t.q) >= NEAR) out.add(t.id);
  return out;
}

/** "This wording means that topic." Returns the memory patch. */
export function teach(
  mem: AtlasMemory | undefined,
  q: string,
  id: string,
  now: number,
): AtlasMemory {
  const same = (t: Taught) => similarity(t.q, q) >= 0.999;
  return {
    taught: [...(mem?.taught ?? []).filter((t) => !same(t)), { q, id, at: now }].slice(-CAP),
    wrong: (mem?.wrong ?? []).filter((t) => !(same(t) && t.id === id)),
  };
}

/** "Not this topic for that wording." Returns the memory patch. */
export function unteach(
  mem: AtlasMemory | undefined,
  q: string,
  id: string,
  now: number,
): AtlasMemory {
  const same = (t: Taught) => similarity(t.q, q) >= 0.999;
  return {
    taught: (mem?.taught ?? []).filter((t) => !(same(t) && t.id === id)),
    wrong: [
      ...(mem?.wrong ?? []).filter((t) => !(same(t) && t.id === id)),
      { q, id, at: now },
    ].slice(-CAP),
  };
}
