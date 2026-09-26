/**
 * A message taken apart: not "which of 300 topics is this" but its pieces —
 * what's asked (build a plan, compare, what-if…), how many days and minutes,
 * which kit is wanted or ruled out, which part hurts, the goal. Topics still
 * decide most answers; the frame lets Atlas answer questions no single topic
 * was written for ("a 3-day plan without a barbell, my knee hurts").
 */
import type { EquipmentId } from '../data/equipment';
import { findPart, learn, type AtlasMemory, type BodyPart, type Goal } from './memory';
import { normalize, tokens } from './nlu';

export type Kit = EquipmentId | 'home';

export interface Frame {
  /** Asked to build a programme / a plan / a split. */
  wantsPlan: boolean;
  /** "X or Y", "X vs Y", "which is better". */
  compares: boolean;
  /** "What if…", "what happens if…", "а якщо…". */
  whatIf: boolean;
  /** Training days (a week) named: "3 days", "4 рази на тиждень". */
  days: number | null;
  /** Minutes per session named: "45 хв", "an hour". */
  minutes: number | null;
  /** Kit named as wanted ("with dumbbells", "at home"). */
  kit: Kit[];
  /** "Only dumbbells", "just bodyweight" — nothing else allowed. */
  only: boolean;
  /** Kit ruled out ("without a barbell", "no machines"). */
  without: EquipmentId[];
  /** A body part that hurts, named in this message. */
  sore: BodyPart | null;
  goal: Goal | null;
  /** A pull-up bar is at hand ("турнік", "pull-up bar"). */
  bar: boolean;
}

const KIT_WORDS: [EquipmentId | 'home', RegExp][] = [
  [
    'dumbbell',
    /(гантел\S*|гантэл\S*|dumbbells?|dbs?\b|hantl\S*|hantel\S*|hanteli\S*|käsikang\S*)/u,
  ],
  ['barbell', /(штанг\S*|барбел\S*|barbells?|sztang\S*|štang\S*|kang\S*\b)/u],
  ['machine', /(тренажер\S*|тренажёр\S*|machines?|maszyn\S*|treniruokl\S*|masin\S*)/u],
  ['cable', /(блок\S*|кросовер\S*|кроссовер\S*|cables?|wyciąg\S*|trosas|trossi\S*)/u],
  ['kettlebell', /(гир\S*|kettlebells?|kettl\S*|girj\S*|sangpomm\S*)/u],
  ['bands', /(резин\S*|еспандер\S*|эспандер\S*|bands?\b|gum\S*\b|guma|juost\S*|kumm\S*)/u],
  [
    'body',
    /(без (обладнання|інвентар\S*|залізa|заліза|железа)|власн\S* ваг\S*|своєю вагою|свою вагу|собственн\S* вес\S*|bodyweight|body weight|no equipment|calisthenics|калістенік\S*|masą ciała|be inventoriaus|kehakaal\S*)/u,
  ],
  ['home', /(вдома|удома|дома\b|at home|home gym|w domu|namuose|kodus)/u],
];
const WITHOUT_RE = /(без|without|no|bez|be|ilma)\s+(\S+)/gu;
const ONLY_RE = /(тільки|лише|только|just|only|tylko|tik|ainult)\s/u;

const PLAN_RE =
  /(склад|напиш|зроб|розпиш|підбер|дай|скинь|сделай|составь|распиши|make|build|write|create|design|give me|put together|need|хочу|ułóż|zrób|napisz|sudaryk|padaryk|koosta)\S*\s+(\S+\s+){0,4}(програм\S*|план\S*|спліт\S*|сплит\S*|розклад\S*|program\S*|plan\b|plans\b|split\b|routine\S*|schedule\b|trenin\S*plan\S*|treniruoč\S*|kava\b)|(склад|напиш|зроб|розпиш|підбер|дай|скинь|сделай|составь|распиши|make|build|write|create|design|give me|put together|need|хочу|ułóż|zrób|napisz|sudaryk|padaryk|koosta)\S*\s+(\S+\s+){0,4}(тренуван\S*|тренировк\S*|workouts?\b|trening\S*|treniruot\S*|trenn\S*)\s+(\S+\s+){0,2}(на|for|per|\d)|\d+\s*-?\s*(денн\S*|day)\s*(програм\S*|план\S*|спліт\S*|сплит\S*|розклад\S*|program\S*|plan\b|plans\b|split\b|routine\S*|schedule\b|trenin\S*plan\S*|treniruoč\S*|kava\b)/u;
const COMPARE_RE =
  /(\svs\.?\s|\sversus\s|\sчи\s|\sили\s|\sor\s|\scz?y\s|\sar\s|\svõi\s|що краще|що ефективніше|что лучше|which is better|what.?s better|better for|краще для|lepsze|geriau|parem)/u;
const WHATIF_RE =
  /(що буде,? якщо|що станеться,? якщо|а якщо|що якщо|якщо я буду|якщо буду|что будет,? если|а если|what if|what happens if|what would happen|co jeśli|co będzie jeśli|a jeśli|kas bus jei|o jei|mis juhtub kui|aga kui)/u;

const NUM_WORD: Record<string, number> = {
  один: 1,
  одна: 1,
  одне: 1,
  два: 2,
  дві: 2,
  двічі: 2,
  три: 3,
  трічі: 3,
  тричі: 3,
  чотири: 4,
  пять: 5,
  пʼять: 5,
  "п'ять": 5,
  шість: 6,
  раз: 1,
  once: 1,
  twice: 2,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  jeden: 1,
  dwa: 2,
  trzy: 3,
  cztery: 4,
  pięć: 5,
  vienas: 1,
  du: 2,
  trys: 3,
  keturi: 4,
  penki: 5,
  üks: 1,
  kaks: 2,
  kolm: 3,
  neli: 4,
  viis: 5,
};
const numAt = (s: string): number | null => (/^\d+$/.test(s) ? Number(s) : (NUM_WORD[s] ?? null));

function daysOf(phrase: string): number | null {
  // "3 дні", "3 рази на тиждень", "3x a week", "3-day", "three days a week"
  const re =
    /(^|\s)(\S+?)\s*-?\s*(дн\S*|день|дня|days?|разів|рази|раз|x|х|times|razy|dni|dien\S*|kart\S*|päev\S*|korda)(?=\s|$)/gu;
  for (const m of phrase.matchAll(re)) {
    const n = numAt(m[2]);
    if (n !== null && n >= 1 && n <= 7) return n;
  }
  return null;
}

const BAR_RE =
  /(турнік\S*|турник\S*|перекладин\S*|pull.?up bar|chin.?up bar|drąż\S*|skersini\S*|lõuatõmbe\S*)/u;
const TIMES_RE =
  /(^|\s)(once|twice|один раз|двічі|двiчi|тричі|дважды|трижды)\s+(a|per|на|в|у)\s+(week|тиждень|неделю)/u;

function minutesOf(phrase: string): number | null {
  const m = /(\d{2,3})\s*(хв\S*|мин\S*|min\S*|minut\S*|minuč\S*|min\b)/u.exec(phrase);
  if (m) return Number(m[1]);
  if (/(година|годину|часу|час\b|an hour|one hour|1 hour|godzin\S*|valand\S*|tund\b)/u.test(phrase))
    return 60;
  if (
    /(півгодини|пів години|полчаса|half an hour|pół godziny|pusvaland\S*|pool tundi)/u.test(phrase)
  )
    return 30;
  return null;
}

function timesOf(phrase: string): number | null {
  const m = TIMES_RE.exec(phrase);
  if (!m) return null;
  return /once|один/u.test(m[2]) ? 1 : /twice|двічі|двiчi|дважды/u.test(m[2]) ? 2 : 3;
}

export function parseFrame(question: string, mem?: AtlasMemory, now = Date.now()): Frame {
  const phrase = ` ${normalize(question)} `;
  const words = tokens(question);
  const without: EquipmentId[] = [];
  for (const m of phrase.matchAll(WITHOUT_RE)) {
    const hit = KIT_WORDS.find(([k, re]) => k !== 'home' && k !== 'body' && re.test(m[2]));
    if (hit) without.push(hit[0] as EquipmentId);
  }
  const kit: Kit[] = BAR_RE.test(phrase) ? ['body'] : [];
  for (const [k, re] of KIT_WORDS) {
    if (kit.includes(k)) continue;
    if (!re.test(phrase)) continue;
    if (k !== 'home' && k !== 'body' && without.includes(k)) continue;
    kit.push(k);
  }
  const learned = learn(words, phrase.trim(), mem, now, null, (x) => x).patch;
  return {
    wantsPlan: PLAN_RE.test(phrase),
    compares: COMPARE_RE.test(phrase),
    whatIf: WHATIF_RE.test(phrase),
    days: daysOf(phrase.trim()) ?? timesOf(phrase),
    minutes: minutesOf(phrase),
    kit,
    only: ONLY_RE.test(phrase) && kit.length > 0,
    without,
    sore: findPart(words, phrase.trim()),
    goal: learned.goal?.v ?? null,
    bar: BAR_RE.test(phrase),
  };
}

/** Kit the person can use, from the frame and what Atlas remembers. Null = anything. */
export function allowedKit(f: Frame, mem?: AtlasMemory): Set<EquipmentId> | null {
  const home = f.kit.includes('home') || (!f.kit.length && !!mem?.home);
  const named = f.kit.filter((k): k is EquipmentId => k !== 'home');
  let set: Set<EquipmentId> | null = null;
  if (f.only && named.length) set = new Set<EquipmentId>([...named, 'body']);
  else if (home)
    set = new Set<EquipmentId>([
      'body',
      'bands',
      ...named,
      ...(named.length ? [] : (['dumbbell'] as EquipmentId[])),
    ]);
  else if (named.includes('body') && named.length === 1)
    set = new Set<EquipmentId>(['body', 'bands']);
  if (!f.without.length) return set;
  const all: EquipmentId[] = [
    'barbell',
    'dumbbell',
    'cable',
    'machine',
    'body',
    'kettlebell',
    'bands',
    'ezBar',
    'other',
    'exerciseBall',
    'medicineBall',
    'suspension',
  ];
  const base = set ?? new Set(all);
  for (const w of f.without) {
    base.delete(w);
    if (w === 'barbell') base.delete('ezBar');
  }
  return base;
}
