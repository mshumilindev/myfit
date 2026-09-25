/**
 * Which lift you mean — however you call it. Every known name of a lift (the
 * library name, its Ukrainian/Polish/Lithuanian/Estonian names, your own
 * custom name) is broken into meaning-tokens (stems + synonyms: "pullups",
 * "pull-ups", "підтягування", "подтягивания" all become one concept), and the
 * question is matched against them, rare words weighing more ("pull-up" says
 * more than "barbell"). Your own lifts are tried first, then the library.
 */
import { BUILT_IN_CATALOG } from '../data/exercises';
import { exerciseNameVariants } from '../data/exerciseNames';
import { terms } from './retrieve';

interface NameIndex {
  names: string[];
  /** All tokens of a name, across its languages. */
  toks: Set<string>[];
  /** Tokens of each language variant separately (coverage is per variant). */
  variants: Set<string>[][];
  idf: Map<string, number>;
}

function indexOf(names: string[]): NameIndex {
  const variants = names.map((n) =>
    exerciseNameVariants(n)
      // Pronoun tokens aren't part of a name (Lithuanian "į" reads as "I").
      .map((v) => new Set(terms(v).filter((t) => t !== '~me' && t !== '~you')))
      .filter((v) => v.size),
  );
  const toks = variants.map((vs) => new Set(vs.flatMap((v) => [...v])));
  const df = new Map<string, number>();
  for (const s of toks) for (const t of s) df.set(t, (df.get(t) ?? 0) + 1);
  const idf = new Map<string, number>();
  for (const [t, d] of df) idf.set(t, Math.log(1 + names.length / d));
  return { names, toks, variants, idf };
}

/**
 * Words that name a muscle, the body or training in general. In a library
 * search they never pick a lift on their own: "train chest" is a muscle
 * question, not "Chest Dip"; "bodyweight trend" isn't "Bodyweight Squat".
 */
let generic: Set<string> | null = null;
const GENERIC_TEXT =
  'train training workout lift lifting exercise exercises gym session body bodyweight weight ' +
  'chest back legs leg shoulders shoulder arms arm biceps triceps abs core glutes calves lats traps ' +
  'quads hamstrings forearms neck hips muscle muscles ' +
  'тренування тренувати вправа вправи зал вага тіла груди спина ноги плечі руки біцепс трицепс прес ' +
  'сідниці литки широчайші трапеції квадрицепс шия мʼяз мязи мяз мʼязи мʼязів мязів ' +
  'тренировка упражнение вес тела грудь спина ноги плечи руки бицепс трицепс пресс ягодицы мышца мышцы';

const FILLER = new Set([
  'over',
  'under',
  'up',
  'down',
  'out',
  'off',
  'with',
  'without',
  'around',
  'through',
]);

let catalogIndex: NameIndex | null = null;
const catalog = () =>
  (catalogIndex ??= indexOf([...new Set(BUILT_IN_CATALOG.map((e) => e.names[0]))]));

let mineKey = '';
let mineIndex: NameIndex | null = null;

/**
 * The best-matching name, or null. A name needs a real hit (a distinctive
 * word, not just "barbell") and to be covered well enough by the question.
 */
function best(
  qIn: Set<string>,
  ix: NameIndex,
  weightOf: (i: number) => number,
  strict: boolean,
): string | null {
  generic ??= new Set(terms(GENERIC_TEXT));
  const q0 = new Set(qIn);
  // Numbers ("3 months", "80 kg") never name a library lift ("3/4 Sit-Up").
  // Little words inside names ("Bent OVER Row") never pick a lift on their own.
  for (const t of FILLER) q0.delete(t);
  const q = strict ? new Set([...q0].filter((t) => !generic!.has(t) && !/^\d/.test(t))) : q0;
  if (!q.size) return null;
  let top: { i: number; score: number } | null = null;
  for (let i = 0; i < ix.names.length; i++) {
    let rare = 0;
    for (const t of ix.toks[i]) if (q.has(t)) rare = Math.max(rare, ix.idf.get(t) ?? 0);
    // Distinctive enough? (A word shared by half the names doesn't count.)
    if (rare < Math.log(1 + (strict ? 6 : 3)) - 1e-9) continue;
    // How much of the name (in its best-matching language) the question covers.
    let coverage = 0;
    for (const v of ix.variants[i]) {
      let hit = 0;
      let all = 0;
      let hits = 0;
      for (const t of v) {
        const w = ix.idf.get(t) ?? 0;
        all += w;
        if (q.has(t)) {
          hit += w;
          hits++;
        }
      }
      // A library name of several words needs at least two of them
      // ("what split" is not "Split Clean").
      if (strict && hits < Math.min(2, v.size)) continue;
      coverage = Math.max(coverage, hit / (all || 1));
    }
    if (coverage < (strict ? 0.6 : 0.2)) continue;
    const score = coverage + 0.02 * weightOf(i);
    if (!top || score > top.score) top = { i, score };
  }
  return top ? ix.names[top.i] : null;
}

/** One of YOUR lifts named in the question (any language / spelling). */
export function resolveMyLift(
  question: string,
  logged: { name: string; count: number }[],
): string | null {
  if (!logged.length) return null;
  const key = logged.map((l) => l.name).join('|');
  if (key !== mineKey) {
    mineIndex = indexOf(logged.map((l) => l.name));
    mineKey = key;
  }
  const q = new Set(terms(question));
  if (!q.size) return null;
  const counts = new Map(logged.map((l) => [l.name, l.count]));
  return best(q, mineIndex!, (i) => Math.min(10, counts.get(mineIndex!.names[i]) ?? 0), false);
}

/** A library lift named in the question (for lifts you haven't logged yet). */
export function resolveCatalogLift(question: string): string | null {
  const q = new Set(terms(question));
  if (!q.size) return null;
  return best(q, catalog(), () => 0, true);
}

/** Words that ask how a lift is going, not anything more specific. */
let statusWords: Set<string> | null = null;
const STATUS_TEXT =
  'progress progressing going doing status trend update how is how are ' +
  'прогрес прогресія динаміка йде ідуть іде справи успіхи ' +
  'прогресс динамика идет идут дела успехи postęp idzie ' +
  'progresas eina edusammud läheb';

/**
 * "How are my pull-ups?", "як мої підтягування", "прогрес підтягувань" — the
 * question is only your lift plus how-is-it-going words: it asks for YOUR
 * progress on it, not for knowledge about the exercise.
 */
export function isLiftStatus(question: string, lift: string): boolean {
  statusWords ??= new Set(terms(STATUS_TEXT));
  const name = new Set<string>();
  for (const v of exerciseNameVariants(lift)) for (const t of terms(v)) name.add(t);
  const q = terms(question);
  if (!q.includes('~me') || !q.some((t) => name.has(t))) return false;
  return q.every((t) => t === '~me' || name.has(t) || statusWords!.has(t));
}
