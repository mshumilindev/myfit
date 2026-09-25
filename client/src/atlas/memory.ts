/**
 * Atlas's memory. Two parts:
 *  - what you told him (a sore knee, your goal, lifts you avoid, your time…) —
 *    synced with the coach settings, so every device knows it;
 *  - what he already answered (per topic) — kept on this device, so a later
 *    answer never contradicts an earlier one: same data → same answer, and
 *    when the data changed he says so instead of silently flipping.
 * Pure helpers here; the chat view persists the results.
 */
import type { Taught } from './teach';
import { groupMatches, negated } from './nlu';
import type { Tr } from './intentKit';

export const DAY_MS = 86_400_000;

export type BodyPart =
  'lower_back' | 'knee' | 'shoulder' | 'elbow' | 'wrist' | 'neck' | 'hip' | 'ankle' | 'hamstring';

export type Goal = 'fat_loss' | 'muscle' | 'strength' | 'fitness';
export type Level = 'beginner' | 'intermediate' | 'advanced';

export interface AtlasMemory {
  /** Body part → when you said it hurts (forgotten after SORE_DAYS or when you say it's fine). */
  sore?: Partial<Record<BodyPart, number>>;
  goal?: { v: Goal; at: number };
  /** Lifts you don't want (exact library names). */
  avoid?: string[];
  /** Your swaps: "bench → dumbbell press". */
  prefer?: { from: string; to: string }[];
  /** Usual time you have for a session (min). */
  minutes?: { v: number; at: number };
  /** Days a week you can train. */
  days?: { v: number; at: number };
  home?: boolean;
  level?: Level;
  age?: number;
  /** Your wordings → the topic you meant (from "did you mean…" and 👍). */
  taught?: Taught[];
  /** Your wordings → a topic that was wrong for them (👎). */
  wrong?: Taught[];
}

export const SORE_DAYS = 14;

/** One answer Atlas gave, by topic. */
export interface SaidRec {
  key: string;
  text: string;
  /** The data it was built from (sessions, weigh-ins, injuries). */
  stamp: string;
  at: number;
}

// ---- body parts ---------------------------------------------------------------

export const PART_WORDS: [BodyPart, string[]][] = [
  [
    'lower_back',
    [
      'lower back',
      'back',
      'поперек*',
      'спина',
      'спині',
      'спину',
      'спины',
      'plecy',
      'plecach',
      'nugara',
      'selg*',
      'поясниц*',
    ],
  ],
  ['knee', ['knee*', 'коліно', 'коліна', 'колін*', 'колено', 'колени', 'kolan*', 'kel*', 'põlv*']],
  ['shoulder', ['shoulder*', 'плеч*', 'плечо', 'barku', 'bark', 'petys', 'peč*', 'õla*', 'õlg']],
  ['elbow', ['elbow*', 'лікоть', 'лікт*', 'локоть', 'локт*', 'łok*', 'alkūn*', 'küünar*']],
  [
    'wrist',
    ['wrist*', 'зап’яст*', 'запяст*', 'кист*', 'запяст', 'nadgarst*', 'riešas', 'rieš*', 'randm*'],
  ],
  ['neck', ['neck', 'шия', 'шиї', 'шию', 'шея', 'шеи', 'szyj*', 'kakl*', 'kael*']],
  ['hip', ['hip', 'hips', 'стегно', 'кульш*', 'таз*', 'бедро', 'biodr*', 'klub*', 'puus*']],
  ['ankle', ['ankle*', 'гомілк*', 'щиколот*', 'голеностоп*', 'kostk*', 'čiurn*', 'pahkl*']],
  [
    'hamstring',
    ['hamstring*', 'задня поверхня', 'біцепс стегна', 'задн* бедр*', 'dwugłow*', 'reie tagum*'],
  ],
];

/** What loads a sore part — lifts and muscles to be careful with. */
const PART_LOADS: Record<BodyPart, string[]> = {
  lower_back: ['deadlift', 'good morning', 'bent over', 'row', 'squat', 'lower_back', 'hyperext'],
  knee: ['squat', 'lunge', 'leg press', 'leg extension', 'split', 'step', 'quads', 'jump'],
  shoulder: [
    'press',
    'bench',
    'dip',
    'lateral',
    'raise',
    'shoulders',
    'pull-up',
    'pullup',
    'upright',
  ],
  elbow: ['curl', 'skull', 'triceps', 'extension', 'chin', 'pushdown', 'biceps'],
  wrist: ['bench', 'curl', 'front squat', 'push-up', 'pushup', 'press', 'forearms'],
  neck: ['shrug', 'overhead', 'military', 'traps', 'upright'],
  hip: ['squat', 'deadlift', 'lunge', 'hip thrust', 'glute', 'leg press', 'glutes'],
  ankle: ['squat', 'lunge', 'calf', 'jump', 'run', 'calves'],
  hamstring: ['deadlift', 'romanian', 'leg curl', 'good morning', 'hamstrings', 'sprint'],
};

export const PART_NAME: Record<BodyPart, [string, string]> = {
  lower_back: ['lower back', 'поперек'],
  knee: ['knee', 'коліно'],
  shoulder: ['shoulder', 'плече'],
  elbow: ['elbow', 'лікоть'],
  wrist: ['wrist', 'зап’ястя'],
  neck: ['neck', 'шия'],
  hip: ['hip', 'кульшовий суглоб'],
  ankle: ['ankle', 'гомілкостоп'],
  hamstring: ['hamstring', 'задня поверхня стегна'],
};

export function findPart(words: string[], phrase: string): BodyPart | null {
  for (const [part, kws] of PART_WORDS) if (groupMatches(words, phrase, kws)) return part;
  return null;
}

/** Sore parts still remembered now. */
export function soreParts(mem: AtlasMemory | undefined, now: number): BodyPart[] {
  return (Object.entries(mem?.sore ?? {}) as [BodyPart, number][])
    .filter(([, at]) => now - at < SORE_DAYS * DAY_MS)
    .map(([p]) => p);
}

/** Sore parts that this lift / muscle loads. */
export function soreFor(mem: AtlasMemory | undefined, now: number, text: string): BodyPart[] {
  const t = text.toLowerCase();
  return soreParts(mem, now).filter((p) => PART_LOADS[p].some((k) => t.includes(k)));
}

// ---- learning from what you say --------------------------------------------------

const PAIN = [
  'pain*',
  'hurt*',
  'injur*',
  'ache*',
  'sore',
  'болить',
  'болять',
  'біль',
  'болі*',
  'травм*',
  'потягн*',
  'защем*',
  'ниє',
  'болит',
  'боль',
  'boli',
  'skauda',
  'valutab',
  'valus',
];
const FINE = [
  'fine',
  'better',
  'healed',
  'ok now',
  'okay now',
  'recovered',
  'гаразд',
  'краще',
  'пройшло',
  'пройшов',
  'зажило',
  'вже не',
  'уже не',
  'не болить',
  'в нормі',
  'нормально',
  'прошло',
  'lepiej',
  'geriau',
  'parem',
];
const WANT = [
  'want',
  'goal',
  'aim',
  'trying',
  'хочу',
  'мета',
  'ціль',
  'метою',
  'намагаюсь',
  'хочется',
  'цель',
  'chcę',
  'noriu',
  'tahaksin',
  'eesmärk',
];
const GOALS: [Goal, string[]][] = [
  [
    'fat_loss',
    [
      'lose fat',
      'lose weight',
      'cut',
      'cutting',
      'lean',
      'схуднути',
      'худнути',
      'скинути',
      'сушк*',
      'схуднення',
      'похудеть',
      'схуднуть',
      'schudnąć',
      'numesti',
      'kaalust alla',
    ],
  ],
  [
    'muscle',
    [
      'build muscle',
      'gain muscle',
      'bulk',
      'bulking',
      'mass',
      'bigger',
      'масу',
      'набрати',
      'маса',
      'м’язи',
      'мязи',
      'накачатися',
      'накачаться',
      'masę',
      'masės',
      'massi',
    ],
  ],
  [
    'strength',
    [
      'stronger',
      'strength',
      'strong',
      'сильніш*',
      'сила',
      'силу',
      'сильнее',
      'silniejszy',
      'stipres*',
      'tugevam',
    ],
  ],
  [
    'fitness',
    [
      'fitness',
      'healthy',
      'health',
      'shape',
      'форм*',
      'здоров*',
      'витривал*',
      'kondycj*',
      'sveikat*',
      'vorm*',
    ],
  ],
];
const HATE = [
  'hate',
  "don't like",
  'dont like',
  'do not like',
  "can't do",
  'cant do',
  'cannot do',
  'ненавиджу',
  'не люблю',
  'не можу робити',
  'ненавижу',
  'не могу',
  'nienawidzę',
  'nie lubię',
  'nekenčiu',
  'nemėgstu',
  'vihkan',
  'ei meeldi',
];
const MINUTE = [
  'min',
  'mins',
  'minute*',
  'хв',
  'хвилин*',
  'мин',
  'минут*',
  'minut*',
  'minuč*',
  'minutit',
];
const HAVE = [
  'have',
  'only',
  'got',
  'маю',
  'лише',
  'тільки',
  'є',
  'у мене',
  'есть',
  'только',
  'mam',
  'tylko',
  'turiu',
  'tik',
  'mul on',
  'ainult',
];
const DAYS = [
  'day*',
  'дн*',
  'дні',
  'днів',
  'рази',
  'разів',
  'раз',
  'dni',
  'razy',
  'dien*',
  'kart*',
  'päev*',
  'korda',
];
const WEEKLY = [
  'a week',
  'per week',
  'weekly',
  'на тиждень',
  'в тиждень',
  'тиждень',
  'в неделю',
  'неделю',
  'w tygodniu',
  'per savaitę',
  'savaitę',
  'nädalas',
];
const CAN = ['can', 'able', 'могу', 'можу', 'могу', 'mogę', 'galiu', 'saan'];
const HOME = [
  'at home',
  'home gym',
  'вдома',
  'дома',
  'удома',
  'w domu',
  'namuose',
  'kodus',
  'kodus treen*',
];
const BEGIN = [
  'beginner',
  'new to',
  'just started',
  'first time',
  'новачок',
  'новенький',
  'тільки почав',
  'початківець',
  'новичок',
  'początkujący',
  'pradedantis',
  'algaja',
];
const ADV = [
  'advanced',
  'experienced',
  'years of training',
  'досвідчений',
  'багато років',
  'опытный',
  'zaawansowany',
  'pažengęs',
  'kogenud',
];
const AGE = [
  'years old',
  'yo',
  'років',
  'роки',
  'рік',
  'лет',
  'года',
  'lat',
  'metų',
  'aastane',
  'age',
  'вік',
  'мені',
  'мне',
];

export interface Learned {
  patch: AtlasMemory;
  /** What Atlas says back ("Noted: …"). */
  note: [string, string] | null;
}

const num = (phrase: string) =>
  (phrase.match(/\d+(?:[.,]\d+)?/g) ?? []).map((x) => Number(x.replace(',', '.')));

/**
 * Pull facts out of a message. Returns a patch to merge into memory and a
 * short acknowledgement. Never guesses: each fact needs its own clear words.
 */
export function learn(
  words: string[],
  phrase: string,
  mem: AtlasMemory | undefined,
  now: number,
  exercise: string | null,
  fmtEx: (n: string) => string,
): Learned {
  const patch: AtlasMemory = {};
  const notes: [string, string][] = [];
  const part = findPart(words, phrase);

  // A sore part — or "it's fine now".
  if (part) {
    const pain = groupMatches(words, phrase, PAIN);
    const fine = groupMatches(words, phrase, FINE) || (pain && negated(words, PAIN));
    if (fine && mem?.sore?.[part]) {
      patch.sore = { ...(mem.sore ?? {}) };
      delete patch.sore[part];
      notes.push([
        `Good — ${PART_NAME[part][0]} is off my watch list.`,
        `Добре — ${PART_NAME[part][1]} знімаю з уваги.`,
      ]);
    } else if (pain && !fine) {
      patch.sore = { ...(mem?.sore ?? {}), [part]: now };
      notes.push([
        `Noted: ${PART_NAME[part][0]}. For two weeks I’ll plan those muscles 20% lighter — tell me when it’s fine.`,
        `Запам’ятав: ${PART_NAME[part][1]}. Два тижні ці м’язи в плані на 20% легші — скажи, коли мине.`,
      ]);
    }
  }

  // Goal.
  if (groupMatches(words, phrase, WANT)) {
    const g = GOALS.find(([, kws]) => groupMatches(words, phrase, kws))?.[0];
    if (g && mem?.goal?.v !== g) {
      patch.goal = { v: g, at: now };
      const name: Record<Goal, [string, string]> = {
        fat_loss: ['fat loss', 'схуднення'],
        muscle: ['muscle', 'м’язи'],
        strength: ['strength', 'сила'],
        fitness: ['fitness', 'форма й здоров’я'],
      };
      notes.push([`Goal noted: ${name[g][0]}.`, `Мету запам’ятав: ${name[g][1]}.`]);
    }
  }

  // A lift you don't want.
  if (exercise && groupMatches(words, phrase, HATE) && !(mem?.avoid ?? []).includes(exercise)) {
    patch.avoid = [...(mem?.avoid ?? []), exercise];
    notes.push([
      `Noted — no more ${fmtEx(exercise)} from me.`,
      `Зрозумів — ${fmtEx(exercise)} більше не пропоную.`,
    ]);
  }

  const n = num(phrase);
  // Time per session.
  if (groupMatches(words, phrase, MINUTE) && groupMatches(words, phrase, HAVE)) {
    const m = n.find((x) => x >= 10 && x <= 240);
    if (m && mem?.minutes?.v !== m) {
      patch.minutes = { v: m, at: now };
      notes.push([
        `Noted: about ${m} min per session.`,
        `Запам’ятав: близько ${m} хв на тренування.`,
      ]);
    }
  }
  // Days a week.
  if (
    groupMatches(words, phrase, DAYS) &&
    groupMatches(words, phrase, WEEKLY) &&
    (groupMatches(words, phrase, CAN) || groupMatches(words, phrase, HAVE))
  ) {
    const d = n.find((x) => x >= 1 && x <= 7);
    if (d && mem?.days?.v !== d) {
      patch.days = { v: d, at: now };
      notes.push([`Noted: ${d} days a week.`, `Запам’ятав: ${d} дн. на тиждень.`]);
    }
  }
  if (groupMatches(words, phrase, HOME) && !mem?.home) {
    patch.home = true;
    notes.push(['Noted: you train at home.', 'Запам’ятав: тренуєшся вдома.']);
  }
  if (groupMatches(words, phrase, BEGIN) && mem?.level !== 'beginner') {
    patch.level = 'beginner';
    notes.push([
      'Noted: you’re new to this. I’ll keep it simple.',
      'Запам’ятав: ти новачок. Буду простіше.',
    ]);
  } else if (groupMatches(words, phrase, ADV) && mem?.level !== 'advanced') {
    patch.level = 'advanced';
    notes.push(['Noted: experienced lifter.', 'Запам’ятав: досвідчений.']);
  }
  if (groupMatches(words, phrase, AGE)) {
    const a = n.find((x) => x >= 13 && x <= 90);
    if (a && mem?.age !== a && !groupMatches(words, phrase, MINUTE) && !/kg|кг|lb/.test(phrase)) {
      patch.age = a;
      notes.push([`Noted: ${a}.`, `Запам’ятав: ${a}.`]);
    }
  }

  return {
    patch,
    note: notes.length
      ? [notes.map((x) => x[0]).join(' '), notes.map((x) => x[1]).join(' ')]
      : null,
  };
}

export function mergeMemory(a: AtlasMemory | undefined, b: AtlasMemory): AtlasMemory {
  return { ...(a ?? {}), ...b };
}

/** Everything Atlas remembers, as one line (for "what do you know about me"). */
export function describeMemory(
  mem: AtlasMemory | undefined,
  now: number,
  L: Tr,
  fmtEx: (n: string) => string,
): string[] {
  if (!mem) return [];
  const out: string[] = [];
  const sore = soreParts(mem, now);
  if (sore.length)
    out.push(
      L(
        `sore: ${sore.map((p) => PART_NAME[p][0]).join(', ')}`,
        `болить: ${sore.map((p) => PART_NAME[p][1]).join(', ')}`,
      ),
    );
  if (mem.goal) {
    const g: Record<Goal, [string, string]> = {
      fat_loss: ['fat loss', 'схуднення'],
      muscle: ['muscle', 'м’язи'],
      strength: ['strength', 'сила'],
      fitness: ['fitness', 'форма'],
    };
    out.push(L(`goal: ${g[mem.goal.v][0]}`, `мета: ${g[mem.goal.v][1]}`));
  }
  if (mem.avoid?.length)
    out.push(L(`no ${mem.avoid.map(fmtEx).join(', ')}`, `без ${mem.avoid.map(fmtEx).join(', ')}`));
  if (mem.prefer?.length)
    out.push(mem.prefer.map((x) => `${fmtEx(x.from)} → ${fmtEx(x.to)}`).join(', '));
  if (mem.minutes)
    out.push(L(`~${mem.minutes.v} min a session`, `~${mem.minutes.v} хв на тренування`));
  if (mem.days) out.push(L(`${mem.days.v} days a week`, `${mem.days.v} дн. на тиждень`));
  if (mem.home) out.push(L('trains at home', 'тренуєшся вдома'));
  if (mem.level)
    out.push(
      L(
        mem.level,
        mem.level === 'beginner'
          ? 'новачок'
          : mem.level === 'advanced'
            ? 'досвідчений'
            : 'середній рівень',
      ),
    );
  if (mem.age) out.push(L(`${mem.age} y.o.`, `${mem.age} р.`));
  return out;
}

// ---- consistency ----------------------------------------------------------------

/** Key of a topic: the same question about the same lift/muscle/window. */
export const saidKey = (
  intent: string,
  exercise?: string | null,
  muscle?: string | null,
  range?: number | null,
) => `${intent}|${exercise ?? ''}|${muscle ?? ''}|${range ?? ''}`;

/**
 * Keep answers consistent with what was said before.
 *  - same data, same day → the earlier text (a rephrase would read as a flip);
 *  - asked again soon, same text → "As I said";
 *  - the data changed and so did the answer → say what changed.
 */
export function consistent(
  prev: SaidRec | undefined,
  core: string,
  stamp: string,
  now: number,
  L: Tr,
): { text: string; keep: string } {
  if (!prev || now - prev.at > 3 * DAY_MS) return { text: core, keep: core };
  const sameDay = Math.floor(prev.at / DAY_MS) === Math.floor(now / DAY_MS);
  if (prev.stamp === stamp) {
    if (prev.text === core || sameDay) {
      const recent = now - prev.at < 6 * 3_600_000;
      return {
        text: recent ? L(`As I said: ${prev.text}`, `Як я вже казав: ${prev.text}`) : prev.text,
        keep: prev.text,
      };
    }
    return { text: core, keep: core };
  }
  if (prev.text === core) return { text: core, keep: core };
  return {
    text: L(
      `You’ve logged something since I last answered, so this changed: ${core}`,
      `Відтоді як я відповідав, ти дещо записав — тож тепер так: ${core}`,
    ),
    keep: core,
  };
}

// ---- device storage for "said" ------------------------------------------------------

const SAID_KEY = 'spotter.atlasSaid';
const SAID_MAX = 80;

export function loadSaid(): SaidRec[] {
  try {
    return JSON.parse(localStorage.getItem(SAID_KEY) ?? '[]') as SaidRec[];
  } catch {
    return [];
  }
}
export function rememberSaid(rec: SaidRec): SaidRec[] {
  const next = [rec, ...loadSaid().filter((r) => r.key !== rec.key)].slice(0, SAID_MAX);
  try {
    localStorage.setItem(SAID_KEY, JSON.stringify(next));
  } catch {
    /* private mode — consistency holds for this visit only */
  }
  return next;
}
export function clearSaid(): void {
  try {
    localStorage.removeItem(SAID_KEY);
  } catch {
    /* ignore */
  }
}
