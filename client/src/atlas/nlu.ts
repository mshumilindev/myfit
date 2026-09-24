/**
 * Atlas's own language understanding — no model, no network. Questions are
 * normalised, split into words and matched against keyword stems with typo
 * tolerance (Damerau–Levenshtein) and prefix stemming, so "скільки відпочивтаи"
 * and "how lng shuold i rest" still land. Entities (a lift, a muscle) are
 * pulled out the same way.
 */
import type { MuscleGroup } from '../data/exercises';

/** Lowercase, strip accents/punctuation, unify apostrophes and ё/ї variants. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, (m) => (m === '̈' || m === '̆' ? m : ''))
    .normalize('NFC')
    .replace(/[’'`ʼ]/g, '')
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}:.]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokens(text: string): string[] {
  return normalize(text)
    .split(' ')
    .map((t) => t.replace(/^[.:]+|[.:]+$/g, ''))
    .filter(Boolean);
}

/** Optimal string alignment distance (Damerau–Levenshtein with adjacent swaps). */
export function editDistance(a: string, b: string, max = 3): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      rowMin = Math.min(rowMin, d[i][j]);
    }
    if (rowMin > max) return max + 1;
  }
  return d[a.length][b.length];
}

/** Typos allowed for a word of this length. */
function tolerance(len: number): number {
  return len <= 3 ? 0 : len <= 7 ? 1 : 2;
}

/**
 * Does a word match a keyword? Keywords ending in "*" are stems (Ukrainian
 * endings vary: "відпочив*" ← відпочивати, відпочинок…). Multi-word keywords
 * are matched against the joined phrase.
 */
export function wordMatches(word: string, keyword: string): boolean {
  const stem = keyword.endsWith('*');
  const k = stem ? keyword.slice(0, -1) : keyword;
  if (word === k) return true;
  if (stem) {
    if (word.startsWith(k)) return true;
    // A typo inside the stem: compare against the same-length prefix.
    const head = word.slice(0, k.length);
    return k.length >= 5 && editDistance(head, k, 1) <= 1;
  }
  return editDistance(word, k, tolerance(k.length)) <= tolerance(k.length);
}

/** Any keyword of the group found among the words (or the phrase for multi-word keywords). */
export function groupMatches(words: string[], phrase: string, group: string[]): boolean {
  return group.some((kw) => {
    if (kw.includes(' ')) {
      const parts = kw.split(' ');
      for (let i = 0; i + parts.length <= words.length; i++)
        if (parts.every((p, j) => wordMatches(words[i + j], p))) return true;
      return phrase.includes(kw.replace(/\*/g, ''));
    }
    return words.some((w) => wordMatches(w, kw));
  });
}

// ---- Entities ---------------------------------------------------------------

/** Muscle words (en + uk) → muscle group. */
export const MUSCLE_WORDS: [MuscleGroup, string[]][] = [
  ['chest', ['chest', 'pec*', 'груд*']],
  ['lats', ['back', 'lat', 'lats', 'спин*', 'широчайш*', 'крил*']],
  ['traps', ['trap*', 'трапец*']],
  ['shoulders', ['shoulder*', 'delt*', 'плеч*', 'дельт*']],
  ['biceps', ['bicep*', 'біцепс*', 'бицепс*']],
  ['triceps', ['tricep*', 'трицепс*']],
  ['forearms', ['forearm*', 'передпліч*', 'предплеч*']],
  ['quads', ['quad*', 'legs', 'leg', 'thigh*', 'ноги', 'ног', 'квадрицепс*', 'стегн*']],
  ['hamstrings', ['hamstring*', 'hams', 'задня поверхня', 'біцепс стегна']],
  ['glutes', ['glute*', 'butt', 'сідниц*', 'ягодиц*', 'сраку']],
  ['calves', ['calf', 'calves', 'литк*', 'икр*']],
  ['core', ['abs', 'core', 'прес', 'пресс', 'кор']],
  ['lower_back', ['lower back', 'поперек*']],
];

export function findMuscle(words: string[], phrase: string): MuscleGroup | null {
  for (const [m, kws] of MUSCLE_WORDS) if (groupMatches(words, phrase, kws)) return m;
  return null;
}

/** Everyday lift words (en + uk) → a fragment to look for in exercise names. */
const LIFT_ALIASES: [string[], string][] = [
  [['bench', 'жим лежа*', 'жиму лежа*', 'лежачи', 'бенч'], 'bench'],
  [['squat*', 'присід*', 'присяд*'], 'squat'],
  [['deadlift*', 'dl', 'станов*', 'мертв*'], 'deadlift'],
  [['row', 'rows', 'тяга в нахил*', 'тягу в нахил*'], 'row'],
  [['pulldown*', 'тяга верхн*', 'тягу верхн*', 'верхнього блок*'], 'pulldown'],
  [['pullup*', 'pull up*', 'chin*', 'підтяг*', 'подтяг*'], 'pull'],
  [['pushup*', 'push up*', 'віджим*', 'отжим*'], 'push'],
  [['curl*', 'згинан*', 'на біцепс'], 'curl'],
  [['ohp', 'overhead', 'military', 'армійськ*', 'жим стоячи', 'жим над голов*'], 'press'],
  [['dip*', 'бруси', 'брусах', 'брусі*'], 'dip'],
  [['lunge*', 'випад*', 'выпад*'], 'lunge'],
  [['hip thrust*', 'thrust*', 'ягодичн* міст*', 'сідничн* міст*'], 'thrust'],
  [['leg press', 'жим ногами'], 'leg press'],
  [['calf raise*', 'на литки'], 'calf'],
  [['lateral*', 'raise*', 'махи', 'мах*'], 'raise'],
  [['plank*', 'планк*'], 'plank'],
];

/**
 * The lift a question is about, resolved against the names you actually log
 * (so "bench" → "Barbell Bench Press - Medium Grip"). Most-logged match wins.
 */
export function findExercise(
  words: string[],
  phrase: string,
  logged: { name: string; count: number }[],
): string | null {
  const frags = LIFT_ALIASES.filter(([kws]) => groupMatches(words, phrase, kws)).map(([, f]) => f);
  // Also match words that appear in your own exercise names ("incline", "hammer"…).
  const byName = logged
    .map((ex) => {
      const nameWords = tokens(ex.name).filter((w) => w.length >= 4);
      const hits = nameWords.filter((nw) => words.some((w) => wordMatches(w, nw))).length;
      const aliasHit = frags.some((f) => ex.name.toLowerCase().includes(f));
      return { ex, score: hits + (aliasHit ? 2 : 0) };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.ex.count - a.ex.count);
  return byName[0]?.ex.name ?? null;
}
