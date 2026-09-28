/**
 * Atlas's own language understanding — no model, no network. Questions are
 * normalised, split into words and matched against keyword stems with typo
 * tolerance (Damerau–Levenshtein) and prefix stemming, so "скільки відпочивтаи"
 * and "how lng shuold i rest" still land. Entities (a lift, a muscle) are
 * pulled out the same way.
 */
import type { MuscleGroup } from '../data/exercises';

/** "жимчик", "становушка", "біцуха" — the lift's own name, for everything that follows. */
const DIMINUTIVES: [RegExp, string][] = [
  [/^жим(чик|чику|чика|ок|очок)$/u, 'жим'],
  [/^станов(ушк|ачк|ух)\p{L}*$/u, 'станова'],
  [/^(біцух|біцушк|бицух)\p{L}*$/u, 'біцепс'],
  [/^присідан(ьк|ячк)\p{L}*$/u, 'присідання'],
  [/^(турнічок|турнічк\p{L}*)$/u, 'турнік'],
];
const DIMINUTIVE =
  /(?<=^|\s)(жим(чик|чику|чика|ок|очок)|станов(ушк|ачк|ух)\p{L}*|(біцух|біцушк|бицух)\p{L}*|присідан(ьк|ячк)\p{L}*|турнічо?к\p{L}*)(?=\s|$)/gu;

/** Lowercase, strip accents/punctuation, unify apostrophes and ё/ї variants. */
/** Recent inputs — the same catalog names and messages are normalized over and over. */
const normMemo = new Map<string, string>();
export function normalize(text: string): string {
  const hit = normMemo.get(text);
  if (hit !== undefined) return hit;
  const out = normalizeRaw(text);
  normMemo.set(text, out);
  if (normMemo.size > 8192) normMemo.delete(normMemo.keys().next().value as string);
  return out;
}

function normalizeRaw(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, (m) => (m === '̈' || m === '̆' ? m : ''))
    .normalize('NFC')
    .replace(/[’'`ʼ]/g, '')
    .replace(/ё/g, 'е')
    .replace(/%/g, ' percent ')
    .replace(/[^\p{L}\p{N}:.]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(DIMINUTIVE, (w) => DIMINUTIVES.find(([re]) => re.test(w))?.[1] ?? w);
}

/** Chat shorthand → the plain word ("tmrw" → "tomorrow", "скока" → "скільки", "треня" → "тренування"). */
const SLANG: Record<string, string> = {
  tmrw: 'tomorrow',
  tmr: 'tomorrow',
  tmrow: 'tomorrow',
  tmrrw: 'tomorrow',
  '2moro': 'tomorrow',
  '2morrow': 'tomorrow',
  tomoz: 'tomorrow',
  '2day': 'today',
  tday: 'today',
  tdy: 'today',
  '2nite': 'tonight',
  tonite: 'tonight',
  rn: 'right now',
  wat: 'what',
  wut: 'what',
  wht: 'what',
  shud: 'should',
  shld: 'should',
  cud: 'could',
  wud: 'would',
  pls: 'please',
  plz: 'please',
  thx: 'thanks',
  thnx: 'thanks',
  tnx: 'thanks',
  cuz: 'because',
  coz: 'because',
  nxt: 'next',
  wk: 'week',
  wkout: 'workout',
  wrkout: 'workout',
  b4: 'before',
  gonna: 'going to',
  wanna: 'want to',
  lemme: 'let me',
  dunno: 'do not know',
  idk: 'i do not know',
  треня: 'тренування',
  треню: 'тренування',
  трені: 'тренуванні',
  трене: 'тренуванні',
  трєня: 'тренування',
  тренить: 'тренувати',
  сьодні: 'сьогодні',
  сьодня: 'сьогодні',
  сєдня: 'сьогодні',
  седня: 'сьогодні',
  сёдня: 'сьогодні',
  скока: 'скільки',
  скіки: 'скільки',
  скіко: 'скільки',
  шо: 'що',
  чо: 'що',
  чё: 'що',
  че: 'що',
  щас: 'зараз',
  ща: 'зараз',
  ваще: 'взагалі',
  спс: 'дякую',
  дякс: 'дякую',
  качалка: 'зал',
  качалку: 'зал',
  качалці: 'залі',
  качалке: 'зале',
  след: 'следующей',
};

/** Words said TO someone that carry no topic ("bro what do I hit today"). */
const VOCATIVE =
  /(^|[\s,.!?])(bro|bruh|brah|dude|fam|бро|братан|братанчик|чувак|чуваче)(?=[\s,.!?]|$)(?![\s,]+(split|спліт|сплит))/giu;

/** Shorthand spelled out, "bro" dropped, the rest of the message untouched. */
export function expandSlang(text: string): string {
  const t = text.replace(/[\p{L}\p{N}]+/gu, (w) => SLANG[w.toLowerCase()] ?? w);
  const bare = t.replace(VOCATIVE, '$1').replace(/\s+/g, ' ').trim();
  return /[\p{L}\p{N}]/u.test(bare) ? bare : t;
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

/**
 * Diacritics dropped the way normalize() drops them (ą→a, ė→e, õ→o; the
 * diaeresis and the breve stay: ä, ö, ü, й, ї). For keywords and regexes that
 * are matched against normalized text.
 */
export function fold(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, (m) => (m === '\u0308' || m === '\u0306' ? m : ''))
    .normalize('NFC');
}

/** A regex written with diacritics, made to match normalized (folded) text. */
export function foldRe(re: RegExp): RegExp {
  const f = fold(re.source);
  return f === re.source ? re : new RegExp(f, re.flags);
}

const kwMemo = new Map<string, string>();
function foldKw(k: string): string {
  let v = kwMemo.get(k);
  if (v === undefined) {
    v = fold(k).replace(/[’'`ʼ]/g, '');
    kwMemo.set(k, v);
  }
  return v;
}

/** Typos allowed for a word of this length. */
function tolerance(len: number): number {
  // Short words must match exactly: last≠lats, belt≠best, good≠food.
  return len <= 4 ? 0 : len <= 7 ? 1 : 2;
}

/**
 * Does a word match a keyword? Keywords ending in "*" are stems (Ukrainian
 * endings vary: "відпочив*" ← відпочивати, відпочинок…). Multi-word keywords
 * are matched against the joined phrase.
 */
export function wordMatches(word: string, keyword0: string): boolean {
  // Keywords are written with their letters (ą, ė, õ…); messages arrive folded.
  const keyword = foldKw(keyword0);
  const stem = keyword.endsWith('*');
  const k = stem ? keyword.slice(0, -1) : keyword;
  if (word === k) return true;
  if (stem) {
    if (word.startsWith(k)) return true;
    // A typo inside the stem: compare against the same-length prefix.
    const head = word.slice(0, k.length);
    return (
      k.length >= 5 &&
      head.length === k.length &&
      sameStart(head, k) &&
      editDistance(head, k, 1) <= 1
    );
  }
  const tol = tolerance(k.length);
  // Too short to be a typo of anything, or a different first letter
  // ("danced" is not "advanced", "fast" is not "last").
  if (!tol || word.length < 4 || !sameStart(word, k)) return false;
  const d = editDistance(word, k, tol);
  // Two typos only between words of about the same length.
  return d <= Math.min(tol, Math.abs(word.length - k.length) <= 1 ? 2 : 1);
}

/** Same first letter — or the first two swapped ("rpotein"). */
function sameStart(a: string, b: string): boolean {
  return a[0] === b[0] || (a[0] === b[1] && a[1] === b[0]);
}

/**
 * Exact matching only (a stem may take any ending, but no typos) — for what
 * Atlas REMEMBERS about you: a fuzzy guess must never become a fact.
 */
export function exactWordMatches(word: string, keyword: string): boolean {
  if (keyword.endsWith('*')) return word.startsWith(keyword.slice(0, -1));
  return word === keyword;
}

export function exactGroupMatches(words: string[], phrase: string, group: string[]): boolean {
  return group.some((kw) => {
    const k = normalize(kw.replace(/\*/g, '')) + (kw.endsWith('*') ? '*' : '');
    if (k.includes(' ')) {
      const parts = k.split(' ');
      for (let i = 0; i + parts.length <= words.length; i++)
        if (parts.every((p, j) => exactWordMatches(words[i + j], p))) return true;
      return false;
    }
    return words.some((w) => exactWordMatches(w, k));
  });
}

/** Any keyword of the group found among the words (or the phrase for multi-word keywords). */
export function groupMatches(words: string[], phrase: string, group: string[]): boolean {
  return group.some((kw) => {
    if (kw.includes(' ')) {
      const parts = kw.split(' ');
      for (let i = 0; i + parts.length <= words.length; i++)
        if (parts.every((p, j) => wordMatches(words[i + j], p))) return true;
      return phrase.includes(foldKw(kw).replace(/\*/g, ''));
    }
    return words.some((w) => wordMatches(w, kw));
  });
}

/** How many of the question's words the groups account for (ranking signal). */
export function matchedWords(words: string[], groups: string[][]): number {
  const hit = new Set<number>();
  for (const g of groups)
    for (const kw of g) {
      const parts = kw.split(' ');
      for (let i = 0; i + parts.length <= words.length; i++)
        if (parts.every((p, j) => wordMatches(words[i + j], p)))
          for (let j = 0; j < parts.length; j++) hit.add(i + j);
    }
  return hit.size;
}

// ---- Entities ---------------------------------------------------------------

/** Muscle words (en + uk) → muscle group. */
export const MUSCLE_WORDS: [MuscleGroup, string[]][] = [
  ['chest', ['chest', 'pec*', 'груд*', 'klat*', 'krūtin*', 'krutin*', 'rind*']],
  [
    'lats',
    ['back', 'lat', 'lats', 'спин*', 'широчайш*', 'крил*', 'plec*', 'nugar*', 'selg*', 'selja'],
  ],
  ['traps', ['trap*', 'трапец*']],
  [
    'shoulders',
    ['shoulder*', 'delt*', 'плеч*', 'дельт*', 'bark*', 'pečia*', 'pecia*', 'õla*', 'ola*', 'õlad'],
  ],
  ['biceps', ['bicep*', 'біцепс*', 'бицепс*']],
  ['triceps', ['tricep*', 'трицепс*']],
  ['forearms', ['forearm*', 'передпліч*', 'предплеч*']],
  [
    'quads',
    [
      'quad*',
      'legs',
      'leg',
      'thigh*',
      'ноги',
      'ног',
      'квадрицепс*',
      'стегн*',
      'nogi',
      'nóg',
      'kojos',
      'kojų',
      'jalad',
      'jalgu',
      'jalgade',
    ],
  ],
  ['hamstrings', ['hamstring*', 'hams', 'задня поверхня', 'задн* поверхн*', 'біцепс стегна']],
  [
    'glutes',
    [
      'glute*',
      'butt',
      'сідниц*',
      'ягодиц*',
      'сраку',
      'pośladk*',
      'posladk*',
      'sėdmen*',
      'sedmen*',
      'tuhar*',
    ],
  ],
  ['calves', ['calf', 'calves', 'литк*', 'икр*', 'łyd*', 'lyd*', 'blauzd*', 'sääre*']],
  ['core', ['abs', 'core', 'прес', 'пресс', 'кор', 'brzuch*', 'pilv*', 'kõh*', 'koht']],
  ['lower_back', ['lower back', 'поперек*']],
];

export function findMuscle(words: string[], phrase: string): MuscleGroup | null {
  for (const [m, kws] of MUSCLE_WORDS) if (groupMatches(words, phrase, kws)) return m;
  return null;
}

/** Everyday lift words (en + uk) → a fragment to look for in exercise names. */
const LIFT_ALIASES: [string[], string][] = [
  [
    [
      'bench',
      'жим лежа*',
      'жиму лежа*',
      'лежачи',
      'бенч',
      'wyciskan*',
      'ławk*',
      'lawk*',
      'ławc*',
      'lawc*',
      'spaudim*',
      'rinnalt*',
      'surumi*',
      'pingi',
      'pingil',
      'pingilt',
      'pink',
    ],
    'bench',
  ],
  // Bare "жим" is the bench in gym talk — unless it's a leg / standing press.
  [['жим', 'жиму', 'жимі', 'жимом'], 'bench'],
  [
    [
      'squat*',
      'присід*',
      'присяд*',
      'przysiad*',
      'pritūpim*',
      'pritupim*',
      'kükk*',
      'kukk*',
      'küki*',
      'kükis*',
      'kükid*',
      'kukis*',
    ],
    'squat',
  ],
  [
    ['rdl', 'rdls', 'romanian', 'румунськ*', 'румынск*', 'rumuński*', 'rumunisk*', 'rumeenia*'],
    'romanian',
  ],
  [['deadlift*', 'dl', 'станов*', 'мертв*', 'martw*', 'mirties', 'jõutõm*', 'joutom*'], 'deadlift'],
  [
    ['row', 'rows', 'тяга в нахил*', 'тягу в нахил*', 'wiosłow*', 'wioslow*', 'irklav*', 'sõudm*'],
    'row',
  ],
  [
    [
      'pulldown*',
      'тяга верхн*',
      'тягу верхн*',
      'верхнього блок*',
      'ściąganie drążka',
      'sciaganie drazka',
      'ściąganie*',
      'plokitõmme*',
      'ploki tõmme*',
    ],
    'pulldown',
  ],
  [
    [
      'pullup*',
      'pull up*',
      'chin*',
      'підтяг*',
      'подтяг*',
      'podciąg*',
      'podciag*',
      'prisitrauk*',
      'lõuatõm*',
      'louatom*',
    ],
    'pull',
  ],
  [
    [
      'pushup*',
      'push up*',
      'віджим*',
      'отжим*',
      'pompk*',
      'atsispaud*',
      'kätekõver*',
      'katekover*',
    ],
    'push',
  ],
  [
    ['curl*', 'згинан*', 'на біцепс', 'uginan*', 'lenkim*', 'biitsepsikõverd*', 'kõverdus*'],
    'curl',
  ],
  [
    [
      'ohp',
      'overhead',
      'military',
      'армійськ*',
      'жим стоячи',
      'жим над голов*',
      'żołniersk*',
      'nad głowę',
      'nad glowe',
      'virš galvos',
      'pea kohal*',
      'õlapress*',
    ],
    'press',
  ],
  [['dip*', 'бруси', 'брусах', 'брусі*', 'poręcz*', 'lygiagreči*', 'rööbaspu*'], 'dip'],
  [
    [
      'lunge*',
      'випад*',
      'выпад*',
      'wykrok*',
      'įtūpst*',
      'ituptst*',
      'išpuol*',
      'väljaast*',
      'väljaaste*',
    ],
    'lunge',
  ],
  [
    [
      'hip thrust*',
      'thrust*',
      'ягодичн* міст*',
      'сідничн* міст*',
      'most biodrow*',
      'klubų kėlim*',
      'puusatõst*',
    ],
    'thrust',
  ],
  [
    ['leg press', 'жим ногами', 'suwnic*', 'kojų pres*', 'kojų presas', 'jalapress*', 'jalgpress*'],
    'leg press',
  ],
  [['calf raise*', 'на литки', 'wspięci*', 'pasistiebim*', 'sääretõst*'], 'calf'],
  [
    ['lateral*', 'raise*', 'махи', 'мах*', 'wznos*', 'šonin* kėlim*', 'külgtõst*', 'küljetõst*'],
    'raise',
  ],
  [['plank*', 'планк*', 'deska', 'desk*', 'lenta', 'lentos'], 'plank'],
];

/** Words in Ukrainian/Russian → the English words exercise names are built from. */
const NAME_WORDS: [RegExp, string[]][] = [
  [/^(гантел|гантел)\S*$/u, ['dumbbell']],
  [/^штанг\S*$/u, ['barbell']],
  [/^(жим|жиму|жимі|жимом)$/u, ['press', 'bench']],
  [/^гир\S*$/u, ['kettlebell']],
  [/^(блок|кросовер|кроссовер|трос)\S*$/u, ['cable']],
  [/^тренажер\S*$/u, ['machine']],
  [/^ногами$/u, ['leg']],
  [/^сидяч?и?\S*$/u, ['seated']],
  [/^стоячи?\S*$/u, ['standing']],
  [/^(похил|наклон)\S*$/u, ['incline']],
  [/^лежач\S*$/u, ['lying']],
  [/^румунськ\S*$|^румынск\S*$/u, ['romanian']],
  [/^болгарськ\S*$|^болгарск\S*$/u, ['bulgarian', 'split']],
  [/^фронтальн\S*$/u, ['front']],
  [/^сумо$/u, ['sumo']],
  [/^вузьк\S*$|^узк\S*$/u, ['close']],
  [/^широк\S*$/u, ['wide']],
  [/^(тяг|тягу|тяга)$/u, ['row', 'deadlift']],
  [/^(розведен|розводк)\S*$/u, ['fly']],
  [/^(згинан)\S*$/u, ['curl']],
  [/^(розгинан)\S*$/u, ['extension']],
  [/^(підйом|махи)\S*$/u, ['raise']],
  [/^(гак|хак|хакк)\S*$/u, ['hack']],
  // pl / lt / et (folded)
  [/^(hantl|hantel|hanteli|kasikang)\S*$/u, ['dumbbell']],
  [/^(sztang|stang|kang)\S*$/u, ['barbell']],
  [/^(maszyn|treniruokl|masin)\S*$/u, ['machine']],
  [/^(wyciag|trosas|trossi)\S*$/u, ['cable']],
  [/^(skos|skosie|nuozuln|kaldpin|kaldpingil)\S*$/u, ['incline']],
  [/^(bułgarsk|bulgarsk|bulgarisk|bulgaaria)\S*$/u, ['bulgarian', 'split']],
  [/^(przedni|frontal|eesmi)\S*$/u, ['front']],
];

const OTHER_PRESS = ['ногами', 'стоячи', 'над', 'сидячи', 'гантел*', 'плеч*'];
function aliasFrags(words: string[], phrase: string): string[] {
  const out = LIFT_ALIASES.filter(([kws]) => groupMatches(words, phrase, kws)).map(([, f]) => f);
  // "жим ногами / стоячи / гантелей" is not the bench.
  if (
    out.includes('bench') &&
    groupMatches(words, phrase, OTHER_PRESS) &&
    !groupMatches(words, phrase, ['bench', 'лежа*', 'лежачи', 'бенч'])
  )
    return out.filter((f) => f !== 'bench');
  return out;
}

/**
 * The lift a question is about, resolved against the names you actually log
 * (so "bench" → "Barbell Bench Press - Medium Grip"). Most-logged match wins.
 */
export function findExercise(
  words: string[],
  phrase: string,
  logged: { name: string; count: number }[],
): string | null {
  const frags = aliasFrags(words, phrase);
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

// ---- Negation, transliteration, catalog ------------------------------------

const NEGATORS = new Set([
  'no',
  'not',
  'never',
  'without',
  'dont',
  'don',
  'doesnt',
  'isnt',
  'не',
  'ні',
  'без',
  'нема',
  'немає',
  'ніде',
  'нічого',
]);

/** Is the word matching `keywords` preceded (within 2 words) by a negation? */
export function negated(words: string[], keywords: string[]): boolean {
  for (let i = 0; i < words.length; i++) {
    if (!keywords.some((k) => wordMatches(words[i], k))) continue;
    for (let j = Math.max(0, i - 2); j < i; j++) if (NEGATORS.has(words[j])) return true;
  }
  return false;
}

const TRANSLIT: [string, string][] = [
  ['shch', 'щ'],
  ['zh', 'ж'],
  ['kh', 'х'],
  ['ts', 'ц'],
  ['ch', 'ч'],
  ['sh', 'ш'],
  ['yu', 'ю'],
  ['ya', 'я'],
  ['ye', 'є'],
  ['yi', 'ї'],
  ['ia', 'я'],
  ['iu', 'ю'],
  ['ie', 'є'],
  ['a', 'а'],
  ['b', 'б'],
  ['v', 'в'],
  ['h', 'г'],
  ['g', 'г'],
  ['d', 'д'],
  ['e', 'е'],
  ['z', 'з'],
  ['y', 'и'],
  ['i', 'і'],
  ['j', 'й'],
  ['k', 'к'],
  ['l', 'л'],
  ['m', 'м'],
  ['n', 'н'],
  ['o', 'о'],
  ['p', 'п'],
  ['r', 'р'],
  ['s', 'с'],
  ['t', 'т'],
  ['u', 'у'],
  ['f', 'ф'],
  ['c', 'ц'],
  ['w', 'в'],
  ['x', 'кс'],
  ['q', 'к'],
];

/** Latin-typed Ukrainian ("skilky vidpochyvaty") → Cyrillic, for a second try. */
/** Common words whose soft sign / apostrophe the letter rules can't guess. */
const TRANSLIT_WORDS: Record<string, string> = {
  sohodni: 'сьогодні',
  sogodni: 'сьогодні',
  sohodnі: 'сьогодні',
  zavtra: 'завтра',
  vchora: 'вчора',
  skilky: 'скільки',
  skiky: 'скільки',
  deshcho: 'дещо',
  mjazy: 'мʼязи',
  miazy: 'мʼязи',
  myazy: 'мʼязи',
  pryvit: 'привіт',
  zdorov: 'здоров',
  zdorovo: 'здорово',
  dyakuyu: 'дякую',
  diakuiu: 'дякую',
  dyakuju: 'дякую',
  bilok: 'білок',
  bilka: 'білка',
  vidpochynok: 'відпочинок',
  vidpochyvaty: 'відпочивати',
  trenuvannia: 'тренування',
  trenuvannya: 'тренування',
  zhym: 'жим',
  prysid: 'присід',
  stanova: 'станова',
};

export function translitToUk(text: string): string {
  let out = '';
  const t = text
    .toLowerCase()
    .split(/(\s+)/)
    .map((w) => TRANSLIT_WORDS[w] ?? w)
    .join('');
  for (let i = 0; i < t.length;) {
    const hit = TRANSLIT.find(([lat]) => t.startsWith(lat, i));
    if (hit) {
      out += hit[1];
      i += hit[0].length;
    } else {
      out += t[i];
      i += 1;
    }
  }
  return out;
}

/** Latin-typed Russian ("skolko otdyhat") → Cyrillic: y is ы, h is х, i is и. */
const TRANSLIT_RU: [string, string][] = [
  ['shch', 'щ'],
  ['sch', 'щ'],
  ['zh', 'ж'],
  ['kh', 'х'],
  ['ts', 'ц'],
  ['ch', 'ч'],
  ['sh', 'ш'],
  ['yu', 'ю'],
  ['ya', 'я'],
  ['yo', 'ё'],
  ['ye', 'е'],
  ['a', 'а'],
  ['b', 'б'],
  ['v', 'в'],
  ['g', 'г'],
  ['d', 'д'],
  ['e', 'е'],
  ['z', 'з'],
  ['i', 'и'],
  ['j', 'й'],
  ['k', 'к'],
  ['l', 'л'],
  ['m', 'м'],
  ['n', 'н'],
  ['o', 'о'],
  ['p', 'п'],
  ['r', 'р'],
  ['s', 'с'],
  ['t', 'т'],
  ['u', 'у'],
  ['f', 'ф'],
  ['h', 'х'],
  ['y', 'ы'],
  ['c', 'ц'],
  ['w', 'в'],
  ['x', 'кс'],
  ['q', 'к'],
];
export function translitToRu(text: string): string {
  let out = '';
  const t = text.toLowerCase();
  for (let i = 0; i < t.length;) {
    const hit = TRANSLIT_RU.find(([lat]) => t.startsWith(lat, i));
    out += hit ? hit[1] : t[i];
    i += hit ? hit[0].length : 1;
  }
  return out;
}

export const hasCyrillic = (s: string) => /[\u0400-\u04ff]/.test(s);

/** A catalog name for a lift mentioned by alias (for lifts you haven't logged yet). */
/** Name words that echo ordinary question words ("weight"). */
const NAME_STOP = new Set(['weighted', 'weight', 'with', 'using']);

/** The everyday version of a lift when only its common name is given. */
const CANONICAL: Record<string, string> = {
  bench: 'Barbell Bench Press - Medium Grip',
  squat: 'Barbell Full Squat',
  deadlift: 'Barbell Deadlift',
  romanian: 'Romanian Deadlift',
  row: 'Bent Over Barbell Row',
  pulldown: 'Wide-Grip Lat Pulldown',
  pull: 'Pullups',
  push: 'Pushups',
  curl: 'Barbell Curl',
  press: 'Standing Military Press',
  dip: 'Dips - Triceps Version',
  lunge: 'Dumbbell Lunges',
  thrust: 'Barbell Hip Thrust',
  'leg press': 'Leg Press',
  calf: 'Standing Calf Raises',
  raise: 'Side Lateral Raise',
  plank: 'Plank',
};

/** Per name list (the catalog is one long-lived array): recent lookups. */
const catalogMemo = new WeakMap<string[], Map<string, string | null>>();
export function findCatalogExercise(
  words: string[],
  phrase: string,
  names: string[],
): string | null {
  let memo = catalogMemo.get(names);
  if (!memo) catalogMemo.set(names, (memo = new Map()));
  const key = `${words.join(' ')}\u0000${phrase}`;
  const hit = memo.get(key);
  if (hit !== undefined) return hit;
  const out = findCatalogExerciseRaw(words, phrase, names);
  memo.set(key, out);
  if (memo.size > 256) memo.delete(memo.keys().next().value as string);
  return out;
}

function findCatalogExerciseRaw(words: string[], phrase: string, names: string[]): string | null {
  const frags = aliasFrags(words, phrase);
  // A muscle word alone ("chest") names a muscle, not a lift.
  const plain = words
    .filter((w) => !MUSCLE_WORDS.some(([, kws]) => groupMatches([w], w, kws)))
    .flatMap((w) => [w, ...(NAME_WORDS.find(([re]) => re.test(w))?.[1] ?? [])]);
  let best: { name: string; score: number; hits: number } | null = null;
  for (const name of names) {
    const lower = name.toLowerCase();
    const nameWords = [...new Set(tokens(name).filter((w) => w.length >= 4 && !NAME_STOP.has(w)))];
    const hits = nameWords.filter((nw) => plain.some((w) => wordMatches(w, nw))).length;
    const base = hits * 2 + (frags.some((f) => lower.includes(f)) ? 3 : 0);
    // Shorter names win ties; the length never decides whether it's a match.
    const score = base - lower.length / 100;
    if (base >= 3 && (!best || score > best.score)) best = { name, score, hits };
  }
  // Only the common name was given ("lunges") → the everyday version.
  if (best && best.hits <= 1 && frags.length) {
    const canon = CANONICAL[frags[frags.length - 1]] ?? CANONICAL[frags[0]];
    if (canon && names.includes(canon) && canon.toLowerCase().includes(frags[0])) return canon;
  }
  return best?.name ?? null;
}

const LIFT_SEP = new Set([
  'vs',
  'versus',
  'or',
  'and',
  'with',
  'for',
  'to',
  'than',
  'instead',
  'into',
  'чи',
  'або',
  'і',
  'й',
  'та',
  'на',
  'ніж',
  'проти',
  'замість',
  'з',
  'чем',
  'или',
  'lub',
  'czy',
  'albo',
  'ar',
  'arba',
  'või',
  'voi',
  'ja',
  // pl / lt / et: "and", "for" (a swap: zamień X na Y, pakeisk X į Y, vaheta X Y vastu)
  'i',
  'a',
  'na',
  'zamiast',
  'niż',
  'niz',
  'ir',
  'vietoj',
  'nei',
  'kui',
  'vastu',
  'asemel',
]);

/**
 * Every lift named in the question, in order ("swap bench for dumbbell
 * press" → [bench, dumbbell press]). Split at "vs / or / for / на / чи…".
 */
export function findExercises(
  words: string[],
  logged: { name: string; count: number }[],
  catalog: string[],
): string[] {
  const segs: string[][] = [[]];
  for (const w of words) {
    if (LIFT_SEP.has(w)) segs.push([]);
    else segs[segs.length - 1].push(w);
  }
  const out: string[] = [];
  for (const seg of segs) {
    if (!seg.length) continue;
    const ph = seg.join(' ');
    const cover = (name: string) => {
      const nw = tokens(name);
      return seg.filter((w) => w.length >= 4 && nw.some((n) => wordMatches(w, n))).length;
    };
    const mine = findExercise(seg, ph, logged);
    const cat = findCatalogExercise(
      seg,
      ph,
      catalog.filter((n) => !out.includes(n)),
    );
    // "leg press" — the name that carries the alias itself beats one that just shares "press".
    const frags = aliasFrags(seg, ph);
    const fits = (name: string) => (frags.some((f) => name.toLowerCase().includes(f)) ? 1 : 0);
    const ex =
      mine &&
      !out.includes(mine) &&
      (!cat || cover(mine) + fits(mine) * 2 >= cover(cat) + fits(cat) * 2)
        ? mine
        : (cat ?? mine);
    if (ex && !out.includes(ex)) out.push(ex);
  }
  return out;
}
