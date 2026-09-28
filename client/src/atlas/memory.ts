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
import { groupMatches, normalize } from './nlu';
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
export const PART_LOADS: Record<BodyPart, string[]> = {
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
      'get big',
      'more muscle',
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

export interface LearnOpts {
  /** The message as typed (its "?" tell a question from a statement). */
  raw?: string;
  /**
   * Facts only from statements about the speaker (default). Off for reading
   * a request's pieces (a plan's goal), where nothing is remembered.
   */
  gate?: boolean;
}

/** One clause of the message and whether it states something about you. */
interface Clause {
  words: string[];
  phrase: string;
  /** Not a question, not "if…", not about somebody else. */
  states: boolean;
  /** Says "I / me / my…" (or a first-person verb form). */
  me: boolean;
}

/** Clause openers that make it a question ("how…", "чи…", "можно ли…"). */
const Q_HEAD = new Set(
  (
    'how what whats when which should shall can could is are am do does did will would why where who whom any ' +
    'скільки як коли чи що шо який яка які яке чому навіщо нащо де куди можна треба варто ' +
    'сколько как когда что какой какая какие можно нужно стоит почему зачем где'
  ).split(' '),
);
/** Leading words that don't change what a clause is ("and how…", "so what…"). */
const LEAD = new Set('and so but ok okay well а і и й так ну то та але'.split(' '));
const IF_RE = /(^| )(if|unless|якщо|якби|коли б|если|бы)( |$)/u;
const ME_RE =
  /(^| )(i|im|ive|id|me|my|mine|myself|we|я|мені|мене|мій|моя|моє|мої|собі|у мене|в мене|мне|меня|мой|мои|у меня|можу|маю|хочу|могу|хочу)( |$)|(^| )\S+(юсь|уся|юся|ую|аю|яю|ію|юю)( |$)/u;
const NEG = new Set([
  'not',
  'no',
  'never',
  'dont',
  'isnt',
  'arent',
  'aint',
  'wasnt',
  'не',
  'ні',
  'ни',
  'нет',
  'ніколи',
  'никогда',
]);
/** Somebody else's facts ("my dad is 65", "my friend is a beginner"). */
const OTHER_RE =
  /(^| )(my|for my|his|her|he|she|мій|моя|мого|моєї|моєму|моїй|мой|моего|моей|для|він|вона|он|она)\s+(friend|dad|father|mom|mum|mother|brother|sister|wife|husband|boyfriend|girlfriend|partner|son|daughter|kid|child|client|coworker|colleague|grandma|grandpa|друг\S*|подруг\S*|батьк\S*|тат\S*|мам\S*|брат\S*|сестр\S*|дружин\S*|чолові\S*|хлоп\S*|дівчин\S*|син\S*|донь\S*|доч\S*|клієнт\S*|колег\S*|бабус\S*|дідус\S*|дитин\S*|жен\S*|муж\S*|отц\S*|отец|is|was|has|є|має|був)( |$)/u;

function clausesOf(raw: string): Clause[] {
  const out: Clause[] = [];
  for (const sentence of raw.split(/(?<=[.!?;\n…])/u)) {
    const asked = /\?\s*$/u.test(sentence);
    const bits = sentence
      .split(/,|—|–|\s+-\s+|\s+(?:but|але|однак|проте|and|і|та|и|а|so|тому|бо|because)\s+/iu)
      .map((x) => x.trim())
      .filter(Boolean);
    bits.forEach((b, k) => {
      const phrase = normalize(b);
      const words = phrase.split(' ').filter(Boolean);
      if (!words.length) return;
      const head = words.find((w) => !LEAD.has(w)) ?? '';
      const question = Q_HEAD.has(head) || (asked && k === bits.length - 1);
      out.push({
        words,
        phrase,
        states: !question && !IF_RE.test(phrase) && !OTHER_RE.test(` ${phrase} `),
        me: ME_RE.test(` ${phrase} `),
      });
    });
  }
  return out;
}

/** The first word of a keyword match in the clause, or -1 (exact words / stems only). */
function matchAt(words: string[], group: string[]): number {
  for (const kw of group) {
    const k = normalize(kw.replace(/\*/g, ' ')).trim().split(' ');
    const stems = kw
      .split(' ')
      .map((x) => x.endsWith('*'))
      .slice(0, k.length);
    for (let i = 0; i + k.length <= words.length; i++)
      if (k.every((p, j) => (stems[j] ? words[i + j].startsWith(p) : words[i + j] === p))) return i;
  }
  return -1;
}

/** The keyword is there and not negated ("not a beginner", "не новачок"). */
function saysIn(cl: Clause, group: string[]): boolean {
  const i = matchAt(cl.words, group);
  if (i < 0) return false;
  for (let j = Math.max(0, i - 2); j < i; j++) if (NEG.has(cl.words[j])) return false;
  return true;
}
const hasIn = (cl: Clause, group: string[]) => matchAt(cl.words, group) >= 0;

/** Level words that are about the speaker on their own ("first time", "just started"). */
const SELF_EVIDENT = /\s/;

/**
 * Pull facts out of a message. Returns a patch to merge into memory and a
 * short acknowledgement. Never guesses: each fact needs its own clear words —
 * exact words or stems, never a typo-tolerant guess ("danced" ≠ "advanced") —
 * said as a statement about you: not in a question ("what should a beginner
 * do?"), not negated ("I'm not a beginner"), not about somebody else.
 */
export function learn(
  words: string[],
  phrase: string,
  mem: AtlasMemory | undefined,
  now: number,
  exercise: string | null,
  fmtEx: (n: string) => string,
  opts: LearnOpts = {},
): Learned {
  const patch: AtlasMemory = {};
  const notes: [string, string][] = [];
  const gate = opts.gate ?? true;
  const all = clausesOf(opts.raw ?? phrase);
  if (!all.length) all.push({ words, phrase, states: true, me: true });
  /** Clauses a fact may come from. */
  const facts = gate ? all.filter((c) => c.states) : all.map((c) => ({ ...c, me: true }));
  const says = (group: string[], needMe = false) =>
    facts.some((c) => (!needMe || c.me) && saysIn(c, group));

  // A sore part — or "it's fine now" (the part and the words in one clause).
  const partIn = (cl: Clause) => PART_WORDS.find(([, kws]) => hasIn(cl, kws))?.[0] ?? null;
  for (const cl of all) {
    const part = partIn(cl);
    if (!part || IF_RE.test(cl.phrase) || OTHER_RE.test(` ${cl.phrase} `)) continue;
    const pain = hasIn(cl, PAIN);
    const fine = hasIn(cl, FINE) || (pain && !saysIn(cl, PAIN));
    if (fine && mem?.sore?.[part]) {
      patch.sore = { ...(patch.sore ?? mem.sore ?? {}) };
      delete patch.sore[part];
      notes.push([
        `Good — ${PART_NAME[part][0]} is off my watch list.`,
        `Добре — ${PART_NAME[part][1]} знімаю з уваги.`,
      ]);
    } else if (pain && !fine) {
      patch.sore = { ...(patch.sore ?? mem?.sore ?? {}), [part]: now };
      notes.push([
        `Noted: ${PART_NAME[part][0]}. For two weeks I’ll plan those muscles 20% lighter — tell me when it’s fine.`,
        `Запам’ятав: ${PART_NAME[part][1]}. Два тижні ці м’язи в плані на 20% легші — скажи, коли мине.`,
      ]);
    }
    break;
  }

  // Goal: "I want to lose fat" (a negated goal is not the goal).
  for (const cl of facts) {
    if (!saysIn(cl, WANT)) continue;
    const kept = ` ${cl.phrase} `
      .replace(
        /(^|\s)(не хочу|не хочеться|не хочется|не треба|не надо|don.?t want( to)?|do not want( to)?|not)\s+\S+/gu,
        ' ',
      )
      .trim();
    const keptCl: Clause = { ...cl, words: kept.split(/\s+/).filter(Boolean), phrase: kept };
    const g = GOALS.find(([, kws]) => saysIn(keptCl, kws))?.[0];
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
    if (g) break;
  }

  // A lift you don't want.
  if (exercise && says(HATE) && !(mem?.avoid ?? []).includes(exercise)) {
    patch.avoid = [...(mem?.avoid ?? []), exercise];
    notes.push([
      `Noted — no more ${fmtEx(exercise)} from me.`,
      `Зрозумів — ${fmtEx(exercise)} більше не пропоную.`,
    ]);
  }

  // Numbers come from the clause that states the fact.
  const numIn = (group: string[], extra: string[][], ok: (x: number) => boolean) => {
    for (const cl of facts)
      if (saysIn(cl, group) && extra.every((g) => hasIn(cl, g))) {
        const x = num(cl.phrase).find(ok);
        if (x !== undefined) return x;
      }
    return undefined;
  };
  // Time per session.
  const m = numIn(MINUTE, [HAVE], (x) => x >= 10 && x <= 240);
  if (m && mem?.minutes?.v !== m) {
    patch.minutes = { v: m, at: now };
    notes.push([
      `Noted: about ${m} min per session.`,
      `Запам’ятав: близько ${m} хв на тренування.`,
    ]);
  }
  // Days a week.
  const d =
    numIn(DAYS, [WEEKLY, CAN], (x) => x >= 1 && x <= 7) ??
    numIn(DAYS, [WEEKLY, HAVE], (x) => x >= 1 && x <= 7);
  if (d && mem?.days?.v !== d) {
    patch.days = { v: d, at: now };
    notes.push([`Noted: ${d} days a week.`, `Запам’ятав: ${d} дн. на тиждень.`]);
  }
  if (says(HOME, true) && !mem?.home) {
    patch.home = true;
    notes.push(['Noted: you train at home.', 'Запам’ятав: тренуєшся вдома.']);
  }
  // Level: a phrase ("just started") speaks for itself; a lone word
  // ("beginner") only with "I / я" — "beginner program pls" is not about you.
  const level = (group: string[]) =>
    says(group.filter((k) => SELF_EVIDENT.test(k))) ||
    says(
      group.filter((k) => !SELF_EVIDENT.test(k)),
      true,
    );
  if (level(BEGIN) && mem?.level !== 'beginner') {
    patch.level = 'beginner';
    notes.push([
      'Noted: you’re new to this. I’ll keep it simple.',
      'Запам’ятав: ти новачок. Буду простіше.',
    ]);
  } else if (level(ADV) && mem?.level !== 'advanced') {
    patch.level = 'advanced';
    notes.push(['Noted: experienced lifter.', 'Запам’ятав: досвідчений.']);
  }
  for (const cl of facts) {
    if (!cl.me || !saysIn(cl, AGE) || hasIn(cl, MINUTE) || /kg|кг|lb/.test(cl.phrase)) continue;
    const a = num(cl.phrase).find((x) => x >= 13 && x <= 90);
    if (a && mem?.age !== a) {
      patch.age = a;
      notes.push([`Noted: ${a}.`, `Запам’ятав: ${a}.`]);
    }
    if (a) break;
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
