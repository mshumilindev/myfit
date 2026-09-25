/**
 * Free questions about your log, answered by computing — not by a hand-written
 * topic each. A question becomes a small query:
 *
 *   WHAT   metric   sessions · duration · volume · sets · reps · weight · max
 *   HOW    agg      total · average · best · lowest · count · change
 *   OF     subject  a lift, a muscle, or everything
 *   WHEN   range    "in August", "last 3 months", "this year" (default: all)
 *   BY     group    week · month · weekday · lift · muscle
 *   RANK   which    "which lift improved most", "top 3 muscles by sets"
 *
 * …and is run over your sets and sessions. One engine instead of hundreds of
 * special cases: "average reps on bench in August", "which lift grew most",
 * "how many tonnes this year", "sets per week for chest", "which day do I
 * train most", "longest workout", "least trained muscle this month".
 */
import type { MuscleGroup } from '../data/exercises';
import { est1rm, exerciseVolumeKg, resolveMuscles, setTopWeight, setTypeOf } from '../store';
import type { Exercise } from '../types';
import {
  DAY,
  WEEK,
  finishedOf,
  wd,
  type AskCtx,
  type Chart,
  type Parsed,
  type Range,
  type Tr,
} from './intentKit';
import { isBodyweightLift, liftPoints } from './liftStats';
import { normalize } from './nlu';
import { questionType } from './qtype';

export type Metric = 'sessions' | 'duration' | 'volume' | 'sets' | 'reps' | 'weight' | 'e1rm';
export type Agg = 'sum' | 'avg' | 'max' | 'min' | 'count' | 'change';
export type Group = 'week' | 'month' | 'weekday' | 'lift' | 'muscle';

export interface Query {
  metric: Metric;
  agg: Agg;
  exercise: string | null;
  muscle: MuscleGroup | null;
  range: Range | null;
  group: Group | null;
  /** "which lift…" — rank the groups instead of listing them in time order. */
  rank: boolean;
  top: number;
  /** Clearly an analytic question (vs. just a metric word in passing). */
  strong: boolean;
  /** "Which lift dropped most" — rank the other way. */
  down: boolean;
  /**
   * How specific the question is (measure, aggregate, breakdown, window,
   * subject, top-N). A specific question beats a loosely matching topic whose
   * canned answer would ignore half of what was asked.
   */
  signals: number;
  /** Which parts were said, not defaulted (for follow-ups that change one). */
  said: { metric: boolean; agg: boolean; group: boolean };
}

// ---- understanding ----------------------------------------------------------

const w = (s: string) => new RegExp(`(^|\\s)(${s})(?=\\s|$)`, 'u');

const AGG: [Agg, RegExp][] = [
  [
    'change',
    w(
      'improv\\S*|progress\\S*|grew|grow\\S*|gain\\S*|went up|go up|increas\\S*|drop\\S*|declin\\S*|decreas\\S*|fell|went down|stall\\S*|змін\\S*|вирос\\S*|виріс|зрос\\S*|прогрес\\S*|покращ\\S*|погірш\\S*|впа\\S*|просі\\S*|вырос\\S*|улучш\\S*|упал\\S*|ухудш\\S*|снизил\\S*|підріс',
    ),
  ],
  [
    'avg',
    w(
      'average|avg|mean|typical\\S*|typically|usually|normally|per session|per workout|середн\\S*|зазвичай|за тренування|в середньому|средн\\S*|обычно|за тренировку|в среднем',
    ),
  ],
  [
    'sum',
    w(
      'total|in total|overall|altogether|combined|sum of|сумарн\\S*|загалом|загальн\\S*|всього|усього|разом|сума|в сумі|итого|всего|суммарн\\S*|общ\\S*|в сумме',
    ),
  ],
  [
    'min',
    w(
      'least|lowest|lightest|minimum|min|smallest|fewest|shortest|worst|weakest|rarest|rarely|найменш\\S*|мінім\\S*|найлегш\\S*|найкоротш\\S*|найгірш\\S*|найслабш\\S*|найрідш\\S*|рідше|рідко|наименьш\\S*|минимал\\S*|самый легк\\S*|самая легк\\S*|кратчайш\\S*|худш\\S*|реже|редко',
    ),
  ],
  [
    'max',
    w(
      'most|max|maximum|best|heaviest|highest|biggest|largest|longest|top|record|strongest|often\\S*|frequent\\S*|найбільш\\S*|найбільше|максим\\S*|найкращ\\S*|найважч\\S*|найдовш\\S*|найсильн\\S*|найчаст\\S*|частіше|рекорд\\S*|наибольш\\S*|больше всего|лучш\\S*|самый тяжел\\S*|самая тяжел\\S*|тяжелейш\\S*|сам\\S* длинн\\S*|сильнейш\\S*|чаще',
    ),
  ],
  [
    'count',
    w('how many|how often|number of|count|скільки|як часто|кількість|сколько|как часто|количество'),
  ],
];

const METRIC: [Metric, RegExp][] = [
  [
    'volume',
    w(
      'volume|tonnage|tons|tonnes|tonne|ton|total weight|total load|kg lifted|об[ʼ]?єм\\S*|обєм\\S*|тоннаж\\S*|тонн\\S*|перетягав|объ?ем\\S*|обьем\\S*',
    ),
  ],
  [
    'e1rm',
    w(
      '1rm|1 rep max|one rep max|max for one rep|one rep|orm|estimated max|e1rm|strength|stronger|strongest|pr|prs|1пм|на раз|розрахунков\\S*|сил\\S*|сильн\\S*|найсильн\\S*|сильнейш\\S*',
    ),
  ],
  ['sets', w('sets|set|сет\\S*|підхід|підход\\S*|подход\\S*')],
  ['reps', w('reps|rep|repetitions|repetition|повтор\\S*|повт')],
  [
    'duration',
    w(
      'how long|duration|minutes|mins|hours|long|longest|shortest|тривал\\S*|довго|довш\\S*|найдовш\\S*|найкоротш\\S*|хвилин\\S*|годин\\S*|длительн\\S*|долго|минут\\S*|часов|часа',
    ),
  ],
  [
    'weight',
    w(
      'weight|weights|kg|kilos|heavy|heavier|heaviest|load|lightest|вага|ваги|вагу|вагою|кг|кіло|важк\\S*|найважч\\S*|найлегш\\S*|вес|веса|весом|тяжел\\S*|тяжелейш\\S*|легк\\S*',
    ),
  ],
  [
    'sessions',
    w(
      'workouts|workout|sessions|session|trained|train|training|times|went|gym|тренуван\\S*|тренув\\S*|тренуюсь|тренувався|тренувалась|разів|рази|раз|ходив|ходила|зал|тренир\\S*|занят\\S*|ходил\\S*',
    ),
  ],
];

const GROUP: [Group, RegExp][] = [
  [
    'weekday',
    w(
      'day of (the )?week|weekday|weekdays|which day|what day|день тижня|дні тижня|днях тижня|який день|в який день|які дні|день недели|какой день|в какой день|по дням недели',
    ),
  ],
  [
    'week',
    w(
      'per week|each week|every week|by week|a week|weekly|week by week|по тижнях|на тиждень|щотижн\\S*|кожного тижня|кожен тиждень|за тиждень|в неделю|по неделям|каждую неделю|за неделю|еженедельн\\S*',
    ),
  ],
  [
    'month',
    w(
      'per month|each month|every month|by month|a month|monthly|month by month|по місяцях|на місяць|щомісяц\\S*|кожного місяця|кожен місяць|в месяц|по месяцам|каждый месяц|помесячно|ежемесячн\\S*',
    ),
  ],
  [
    'muscle',
    w(
      'muscle|muscles|muscle group|muscle groups|body part|body parts|м[ʼ]?яз\\S*|мяз\\S*|частин\\S* тіла|груп\\S* м\\S*|мышц\\S*|групп\\S* мышц|част\\S* тела',
    ),
  ],
  [
    'lift',
    // "lift" alone is usually the verb ("how much did I lift") — only the
    // plural or "which/each/heaviest lift" means a breakdown by lift.
    w(
      'lifts|exercises|movements|(which|what|each|every|per|by|heaviest|best|strongest|weakest|biggest|favourite|favorite) (lift|exercise|movement)|вправ\\S*|упражнен\\S*',
    ),
  ],
];

const DOWN = w(
  'drop\\S*|declin\\S*|decreas\\S*|fell|went down|stall\\S*|worse|weaker|впа\\S*|погірш\\S*|просі\\S*|слабш\\S*|упал\\S*|ухудш\\S*|снизил\\S*|слабее',
);
const WHICH = w(
  'which|what|who|яка|який|яке|які|котр\\S*|що|какая|какой|какое|какие|котор\\S*|что|рейтинг|ranking|rank|top|топ',
);
const TOP_N = /(?:top|топ|перші|первые|first)\s+(\d{1,2})/u;

/**
 * A query from the question, or null when there's nothing to compute.
 * `strong` = clearly analytic (an aggregate, a breakdown or a ranking).
 */
const FUTURE = w('again|next|tomorrow|upcoming|знову|наступн\\S*|завтра|ще раз|снова|следующ\\S*');
const COMMAND =
  /^\s(set|change|make|move|swap|replace|start|begin|mute|turn|switch|add|remove|log|постав\S*|встанов\S*|зміни|змініть|перенес\S*|заміни|почни|почнімо|додай|прибери|вимкни|увімкни|запиши|поставь|установи|измени|перенеси|замени|начни|добавь|убери|выключи|включи|запиши)\s/u;
const AGO = w('ago|тому|назад|last time|востаннє|последний раз');
const SESSION_WORD = w(
  'workouts?|sessions?|training|train|gym|тренуван\\S*|тренуюсь|тренуєшся|зал\\S*|тренир\\S*|занят\\S*',
);

export function parseQuery(question: string, p: Parsed): Query | null {
  const ph = ` ${normalize(question)} `;
  // Not a question about totals: a calculator ("reps at 120 kg"), a day
  // ("what did I do Wednesday"), the future ("which day do I train again").
  if (/(^|\s)(\d{2,4})(\s|$)/.test(ph) && !p.range && !TOP_N.test(ph)) {
    const n = Number(/(^|\s)(\d{2,4})(\s|$)/.exec(ph)![2]);
    if (n >= 20) return null;
  }
  if (FUTURE.test(ph)) return null;
  // Commands ("set rest for bench to 3 min", "постав відпочинок…") are actions.
  if (COMMAND.test(ph)) return null;
  let metricHit = METRIC.find(([, re]) => re.test(ph))?.[0] ?? null;
  // Workout length only when it's about workouts ("how long ago…" is a date,
  // "how many hours did I sleep" is sleep).
  if (metricHit === 'duration' && (!SESSION_WORD.test(ph) || AGO.test(ph)))
    metricHit =
      METRIC.slice(METRIC.findIndex(([m]) => m === 'duration') + 1).find(([, re]) =>
        re.test(ph),
      )?.[0] ?? null;
  const aggHit = AGG.find(([, re]) => re.test(ph))?.[0] ?? null;
  // A named day ("what did I do Wednesday") is a day lookup — unless it's
  // clearly an aggregate ("середня" also reads as "середа").
  if (p.weekdays?.length && (!aggHit || aggHit === 'count')) return null;
  let group = GROUP.find(([, re]) => re.test(ph))?.[0] ?? null;
  // "which bench…" names the lift itself — no lift breakdown.
  if (group === 'lift' && p.exercise) group = null;
  if (group === 'muscle' && p.muscle) group = null;
  // "Which muscles does the squat build" is about the lift, not your log.
  if (group === 'muscle' && p.exercise) return null;
  // "which lift / яка вправа / what day" — the question word right before
  // the breakdown word (not "what do I do when a muscle cramps").
  const gm = group ? GROUP.find(([g]) => g === group)![1].exec(ph) : null;
  const before = gm
    ? ph
        .slice(0, gm.index + 1)
        .trim()
        .split(' ')
        .slice(-3)
        .join(' ')
    : '';
  const which = !!gm && (WHICH.test(` ${before} `) || WHICH.test(` ${gm[0].trim()} `));
  const ranked = aggHit === 'max' || aggHit === 'min' || aggHit === 'change';
  const rank =
    !!group &&
    (group === 'lift' || group === 'muscle' || group === 'weekday') &&
    (ranked || (which && !!metricHit && ME.test(ph)));
  if (!metricHit && !group) return null;
  // "Which day do I usually train?" — your routine, a topic of its own.
  if (group === 'weekday' && which && !ranked) return null;
  // "What weekday is it?" — a breakdown word with nothing to measure or rank.
  if (!metricHit && !aggHit) return null;

  let metric: Metric =
    metricHit ?? (aggHit === 'change' ? 'e1rm' : group === 'muscle' ? 'sets' : 'sessions');
  // "how much did I lift this year" — kilos moved, not a count of sessions.
  if (
    (!metricHit || metricHit === 'sessions') &&
    /(^|\s)(lifted|moved|підняв|підняла|підняли|піднято|поднял\S*|перетягав)(\s|$)/u.test(ph) &&
    /(^|\s)(how much|скільки|сколько|total|усього|всього)(\s|$)/u.test(ph)
  )
    metric = 'volume';
  // "most" + a lift breakdown with no measure → how often you do it.
  // "heaviest"/"strongest" say it already; "best lift" → strength.
  if (!metricHit && group === 'lift' && aggHit === 'max' && /best|найкращ|лучш/u.test(ph))
    metric = 'e1rm';
  let agg: Agg = aggHit ?? defaultAgg(metric, !!group);
  // "total load / kilos moved" is tonnage.
  if (metric === 'weight' && aggHit === 'sum') metric = 'volume';
  // "how many reps/sets/kg" is a total; "how many times" is a count.
  if (agg === 'count' && metric !== 'sessions') agg = 'sum';
  if (agg === 'count' && metric === 'sessions') agg = 'sum';
  // "most improved" is a change, even if "most" was found first.
  if (aggHit !== 'change' && AGG[0][1].test(ph)) agg = 'change';

  const top = Math.min(10, Number(TOP_N.exec(ph)?.[1] ?? 0)) || 3;
  const strong =
    // "which day do I usually train" is a topic of its own; "which day do I
    // train MOST / least" is a ranking.
    (!!group && !(group === 'weekday' && !ranked)) ||
    rank ||
    (agg === 'change' && metric !== 'e1rm' && metric !== 'weight') ||
    agg === 'avg' ||
    agg === 'min' ||
    (agg === 'sum' && !!aggHit && aggHit !== 'count') ||
    ((metric === 'volume' || metric === 'reps' || metric === 'duration') && !!aggHit);
  return {
    metric,
    agg,
    exercise: p.exercise,
    muscle: p.muscle,
    range: p.range ?? null,
    group,
    rank,
    top,
    strong,
    down: DOWN.test(ph),
    said: { metric: !!metricHit, agg: !!aggHit && aggHit !== 'count', group: !!group },
    signals:
      (metricHit ? 1 : 0) +
      (aggHit && aggHit !== 'count' ? 1 : 0) +
      (group ? (group === 'week' || group === 'month' ? 2 : 1) : 0) +
      (rank ? 1 : 0) +
      (p.range ? 1 : 0) +
      (p.exercise || p.muscle ? 1 : 0) +
      (TOP_N.test(ph) ? 1 : 0),
  };
}

const ADVICE = w(
  'reason|reasons|причин\\S*|should|shall|ought|need to|do i need|can i|could i|will i|will my|would|build muscle|builds?|builds more|будує|краще для|лучше для|чи можна|чи зможу|можна|можно ли|смогу|recommend\\S*|ideal|optimal|optimum|best way|good|enough|too much|too many|normal|healthy|safe|for hypertrophy|for strength|for beginners|варто|треба|потрібно|слід|рекоменд\\S*|оптимальн\\S*|ідеальн\\S*|достатньо|забагато|нормально|норма|безпечно|для гіпертрофії|для сили|для новачк\\S*|стоит|нужно|надо|следует|оптимальн\\S*|идеальн\\S*|достаточно|слишком|для роста|для силы|для новичк\\S*',
);
const BEST_FOR =
  /(^|\s)(best|good|top|найкращ\S*|кращ\S*|добр\S*|лучш\S*|хорош\S*)(\s\S+){0,2}\s(for|to|для|щоб|чтобы)\s/u;
const ME = w(
  'i|my|me|mine|i ve|ive|did i|do i|have i|am i|я|мій|моя|моє|мої|мого|моїх|мене|мені|мною|мой|мое|мои|моих|меня|мне|мною|у мене|у меня',
);

/**
 * Is this about YOUR log (vs. general advice)? "How many sets per week should
 * I do" is advice; "how many sets per week do I do" / "sets per week in
 * August" / "bench volume" are your data.
 */
export function aboutMyLog(question: string, q: Query, logged: boolean): boolean {
  const ph = ` ${normalize(question)} `;
  if (ADVICE.test(ph) || BEST_FOR.test(ph) || questionType(question) === 'why') return false;
  return (
    ME.test(ph) ||
    !!q.range ||
    logged ||
    (q.rank && !!q.group && q.agg !== 'sum') ||
    q.group === 'month' ||
    q.group === 'weekday' ||
    q.metric === 'volume'
  );
}

function defaultAgg(m: Metric, grouped: boolean): Agg {
  if (m === 'weight' || m === 'e1rm') return 'max';
  if (m === 'duration') return grouped ? 'avg' : 'avg';
  return 'sum';
}

// ---- the data ---------------------------------------------------------------

interface SetRow {
  ts: number;
  wid: string;
  lift: string;
  muscles: MuscleGroup[];
  kg: number;
  reps: number;
  e1: number;
  vol: number;
}
interface SessRow {
  ts: number;
  wid: string;
  min: number;
  lifts: Set<string>;
  muscles: Set<MuscleGroup>;
}

function rowsOf(c: AskCtx): { sets: SetRow[]; sessions: SessRow[] } {
  const sets: SetRow[] = [];
  const sessions: SessRow[] = [];
  for (const wk of finishedOf(c)) {
    const lifts = new Set<string>();
    const muscles = new Set<MuscleGroup>();
    for (const ex of wk.exercises) {
      const work = ex.sets.filter((s) => setTypeOf(s) !== 'warmup' && s.reps > 0);
      if (!work.length) continue;
      const ms = primaryOf(ex);
      lifts.add(ex.name);
      for (const m of ms) muscles.add(m);
      // Tonnage per set, with the per-hand factor of the whole exercise.
      const exVol = exerciseVolumeKg(ex);
      const raw = ex.sets.reduce((v, s) => v + (s.weight ?? 0) * s.reps, 0);
      const factor = raw > 0 ? exVol / raw : 1;
      for (const s of work) {
        const kg = setTopWeight(s);
        sets.push({
          ts: wk.startedAt,
          wid: wk.id,
          lift: ex.name,
          muscles: ms,
          kg,
          reps: s.reps,
          e1: kg > 0 ? est1rm(kg, Math.min(12, s.reps)) : 0,
          vol: (s.weight ?? 0) * s.reps * factor,
        });
      }
    }
    if (!lifts.size) continue;
    sessions.push({
      ts: wk.startedAt,
      wid: wk.id,
      min: Math.round(((wk.finishedAt ?? wk.startedAt) - wk.startedAt) / 60000),
      lifts,
      muscles,
    });
  }
  return { sets, sessions };
}

function primaryOf(ex: Exercise): MuscleGroup[] {
  try {
    const p = resolveMuscles(ex).primary;
    return (Array.isArray(p) ? p : [p]).filter(Boolean) as MuscleGroup[];
  } catch {
    return [];
  }
}

/** Your "back" includes lats/traps/lower back — a muscle word covers its family. */
function inMuscle(ms: Iterable<MuscleGroup>, m: MuscleGroup): boolean {
  for (const x of ms) if (x === m || family(x) === m || family(m) === family(x)) return true;
  return false;
}
function family(m: MuscleGroup): MuscleGroup {
  return m === 'lats' || m === 'traps' || m === 'lower_back' ? 'back' : m;
}

// ---- computing --------------------------------------------------------------

interface Value {
  v: number;
  /** How many data points it rests on. */
  n: number;
  /** Bodyweight lift measured in reps (for weight / e1rm). */
  reps?: boolean;
}

function measure(q: Query, sets: SetRow[], sessions: SessRow[], bwLift: boolean): Value | null {
  const m = q.metric;
  if (m === 'sessions') {
    const n = new Set(sets.map((s) => s.wid)).size;
    return { v: n, n };
  }
  if (m === 'duration') {
    const ids = new Set(sets.map((s) => s.wid));
    const ss = sessions.filter((s) => ids.has(s.wid) && s.min > 0);
    if (!ss.length) return null;
    const mins = ss.map((s) => s.min);
    return { v: pick(q.agg, mins), n: ss.length };
  }
  if (!sets.length) return null;
  const perSession = <T>(f: (xs: SetRow[]) => T) => {
    const by = new Map<string, SetRow[]>();
    for (const s of sets) (by.get(s.wid) ?? by.set(s.wid, []).get(s.wid)!).push(s);
    return [...by.values()].map(f);
  };
  if (m === 'volume') {
    const per = perSession((xs) => xs.reduce((v, s) => v + s.vol, 0));
    return {
      v: q.agg === 'sum' || q.agg === 'change' ? sum(per) : pick(q.agg, per),
      n: per.length,
    };
  }
  if (m === 'sets') {
    const per = perSession((xs) => xs.length);
    return {
      v: q.agg === 'sum' || q.agg === 'change' ? sets.length : pick(q.agg, per),
      n: per.length,
    };
  }
  if (m === 'reps') {
    const reps = sets.map((s) => s.reps);
    if (q.agg === 'avg') return { v: pick('avg', reps), n: reps.length };
    if (q.agg === 'max' || q.agg === 'min') return { v: pick(q.agg, reps), n: reps.length };
    return { v: sum(reps), n: reps.length };
  }
  if (bwLift) {
    const reps = sets.map((s) => s.reps);
    return { v: pick(q.agg === 'sum' ? 'max' : q.agg, reps), n: reps.length, reps: true };
  }
  const loaded = sets.filter((s) => s.kg > 0);
  if (!loaded.length) return null;
  const xs = loaded.map((s) => (m === 'e1rm' ? s.e1 : s.kg));
  return { v: pick(q.agg === 'sum' ? 'max' : q.agg, xs), n: xs.length };
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
function pick(agg: Agg, xs: number[]): number {
  if (!xs.length) return 0;
  if (agg === 'avg') return sum(xs) / xs.length;
  if (agg === 'min') return Math.min(...xs);
  if (agg === 'sum') return sum(xs);
  return Math.max(...xs);
}

export interface QueryResult {
  text: string;
  chart?: Chart;
}

const MONTH_MS = 30.44 * DAY;

/** Run the query over your log. Null when there's nothing to say. */
export function runQuery(c: AskCtx, q: Query, L: Tr): QueryResult | null {
  const { sets: allSets, sessions } = rowsOf(c);
  if (!sessions.length)
    return {
      text: L(
        'Nothing logged yet — finish a workout and I can count anything in it.',
        'Ще нічого не записано — заверши тренування, і я порахую що завгодно.',
      ),
    };
  const r = q.range;
  const from = r?.from ?? -Infinity;
  const to = r?.to ?? Infinity;
  const subject = (s: SetRow) =>
    (!q.exercise || s.lift === q.exercise) && (!q.muscle || inMuscle(s.muscles, q.muscle));
  const sets = allSets.filter((s) => subject(s) && s.ts >= from && s.ts < to);
  const when = r ? L(r.label[0], r.label[1]) : L('all time', 'за весь час');
  const who = q.exercise ? c.fmt.exercise(q.exercise) : q.muscle ? c.fmt.muscle(q.muscle) : '';
  const head = [who, when].filter(Boolean).join(', ');
  const bwLift = !!q.exercise && isBodyweightLift(liftPoints(c, q.exercise));
  const fmtV = (v: Value) => fmtValue(c, q, v, L);

  // ---- change over time ----
  if (q.agg === 'change' && !q.group) return change(c, q, allSets, sessions, subject, L);
  if (q.agg === 'change' && (q.group === 'lift' || q.group === 'muscle'))
    return rankChange(c, q, allSets, L);

  // ---- breakdowns ----
  if (q.group) {
    const buckets = new Map<string, SetRow[]>();
    const key = (s: SetRow): string[] => {
      const d = new Date(s.ts);
      if (q.group === 'week') return [String(weekStart(s.ts))];
      if (q.group === 'month')
        return [`${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`];
      if (q.group === 'weekday') return [String(d.getDay())];
      if (q.group === 'lift') return [s.lift];
      return [...new Set(s.muscles.map(family))];
    };
    // Time breakdowns default to a readable window.
    let rows = sets;
    if (!r && q.group === 'week') rows = sets.filter((s) => s.ts >= c.now - 12 * WEEK);
    if (!r && q.group === 'month') rows = sets.filter((s) => s.ts >= c.now - 12 * MONTH_MS);
    for (const s of rows)
      for (const k of key(s)) (buckets.get(k) ?? buckets.set(k, []).get(k)!).push(s);
    if (!buckets.size) return empty(c, head, L);
    // Ranking lifts/muscles/days "by volume/sets/reps" compares totals; the
    // "most/least" only says which end to start from.
    const byTotal =
      (q.group === 'lift' || q.group === 'muscle' || q.group === 'weekday') &&
      (q.agg === 'max' || q.agg === 'min') &&
      q.metric !== 'weight' &&
      q.metric !== 'e1rm' &&
      q.metric !== 'duration';
    const mq: Query = byTotal ? { ...q, agg: 'sum' } : q;
    const vals = [...buckets]
      .map(([k, xs]) => ({
        k,
        val: measure(mq, xs, sessions, q.group === 'lift' ? isBw(c, k) : bwLift),
      }))
      .filter((x): x is { k: string; val: Value } => !!x.val && x.val.v > 0);
    if (!vals.length) return empty(c, head, L);
    const tons = Math.max(...vals.map((x) => x.val.v)) >= 10_000;
    const fmtL = (v: Value) => fmtValue(c, q, v, L, tons);
    const label = (k: string) =>
      q.group === 'weekday'
        ? wd(c, Number(k))
        : q.group === 'lift'
          ? c.fmt.exercise(k)
          : q.group === 'muscle'
            ? c.fmt.muscle(k as MuscleGroup)
            : q.group === 'week'
              ? new Date(Number(k)).toLocaleDateString(c.locale, { day: 'numeric', month: 'short' })
              : new Date(Number(k.slice(0, 4)), Number(k.slice(5))).toLocaleDateString(c.locale, {
                  month: 'short',
                  year: '2-digit',
                });
    const what = metricName(q);
    if (q.group === 'week' || q.group === 'month') {
      const series = [...vals].sort((a, b) => a.k.localeCompare(b.k, undefined, { numeric: true }));
      const pts = series.map((x) => ({
        at:
          q.group === 'week'
            ? Number(x.k)
            : new Date(Number(x.k.slice(0, 4)), Number(x.k.slice(5))).getTime(),
        v: round(x.val.v),
      }));
      const avg = sum(series.map((x) => x.val.v)) / series.length;
      const bestB = series.reduce((a, b) => (b.val.v > a.val.v ? b : a));
      const last = series
        .slice(-4)
        .map((x) => `${label(x.k)} ${fmtL(x.val)}`)
        .join(', ');
      const per = q.group === 'week' ? L('a week', 'на тиждень') : L('a month', 'на місяць');
      return {
        text: L(
          `${cap(what[0])}${head ? ` (${head})` : ''}: ~${fmtL({ ...bestB.val, v: avg })} ${per} on average; best ${label(bestB.k)} — ${fmtL(bestB.val)}. Latest: ${last}.`,
          `${cap(what[1])}${head ? ` (${head})` : ''}: у середньому ~${fmtL({ ...bestB.val, v: avg })} ${per}; найбільше ${label(bestB.k)} — ${fmtL(bestB.val)}. Останні: ${last}.`,
        ),
        chart:
          pts.length >= 2
            ? { title: cap(L(what[0], what[1])), unit: chartUnit(q, bwLift), points: pts }
            : undefined,
      };
    }
    const sorted = [...vals].sort((a, b) =>
      q.agg === 'min' ? a.val.v - b.val.v : b.val.v - a.val.v,
    );
    // Muscles you never trained in the window are the true "least".
    const list = sorted
      .slice(0, q.top)
      .map((x, i) => `${i + 1}. ${label(x.k)} — ${fmtL(x.val)}`)
      .join('; ');
    const lead = sorted[0];
    const dir = q.agg === 'min' ? L('least', 'найменше') : L('most', 'найбільше');
    return {
      text: L(
        `By ${what[0]}${head ? ` (${head})` : ''}, ${dir}: ${label(lead.k)} (${fmtL(lead.val)}). ${sorted.length > 1 ? `Top ${Math.min(q.top, sorted.length)}: ${list}.` : ''}`.trim(),
        `За ${what[2]}${head ? ` (${head})` : ''} ${dir}: ${label(lead.k)} (${fmtL(lead.val)}). ${sorted.length > 1 ? `Топ ${Math.min(q.top, sorted.length)}: ${list}.` : ''}`.trim(),
      ),
    };
  }

  // ---- one number ----
  const val = measure(q, sets, sessions, bwLift);
  if (!val || (!val.v && q.metric !== 'sessions')) return empty(c, head, L);
  const what = metricName(q);
  const aggW = aggWord(q);
  let extra = '';
  if ((q.agg === 'max' || q.agg === 'min') && q.metric !== 'sessions') {
    const hit = findRecord(q, sets, sessions, val.v, bwLift);
    if (hit)
      extra = L(` — ${hit.where}, ${dateOf(c, hit.ts)}`, ` — ${hit.where}, ${dateOf(c, hit.ts)}`);
    if (hit && !q.exercise && hit.lift)
      extra = ` — ${c.fmt.exercise(hit.lift)}, ${dateOf(c, hit.ts)}`;
    if (hit && !hit.lift) extra = ` — ${dateOf(c, hit.ts)}`;
  }
  const weeks = r ? Math.max(1, (Math.min(r.to, c.now) - r.from) / WEEK) : 0;
  const rate =
    q.agg === 'sum' && (q.metric === 'sessions' || q.metric === 'sets') && weeks >= 2
      ? L(` (~${round(val.v / weeks)} a week)`, ` (~${round(val.v / weeks)} на тиждень)`)
      : '';
  return {
    text: L(
      end(`${cap(aggW[0] + what[0])}${head ? `, ${head}` : ''}: ${fmtV(val)}${extra}${rate}`),
      end(
        `${cap(what[1])}${aggW[1] ? ` (${aggW[1]})` : ''}${head ? `, ${head}` : ''}: ${fmtV(val)}${extra}${rate}`,
      ),
    ),
  };
}

const isBw = (c: AskCtx, lift: string) => isBodyweightLift(liftPoints(c, lift));

function empty(c: AskCtx, head: string, L: Tr): QueryResult {
  return {
    text: L(
      `Nothing logged for that${head ? ` (${head})` : ''}.`,
      `Під це нічого не записано${head ? ` (${head})` : ''}.`,
    ),
  };
}

/** Where a max/min came from (a lift and a date). */
function findRecord(
  q: Query,
  sets: SetRow[],
  sessions: SessRow[],
  v: number,
  bwLift: boolean,
): { ts: number; lift?: string; where: string } | null {
  const eq = (a: number) => Math.abs(a - v) < 1e-6;
  if (q.metric === 'duration') {
    const s = sessions.find((x) => eq(x.min) && sets.some((y) => y.wid === x.wid));
    return s ? { ts: s.ts, where: '' } : null;
  }
  if (q.metric === 'volume' || q.metric === 'sets') {
    const by = new Map<string, { ts: number; v: number }>();
    for (const s of sets) {
      const b = by.get(s.wid) ?? { ts: s.ts, v: 0 };
      b.v += q.metric === 'volume' ? s.vol : 1;
      by.set(s.wid, b);
    }
    const hit = [...by.values()].find((b) => eq(b.v));
    return hit ? { ts: hit.ts, where: '' } : null;
  }
  const s = sets.find((x) =>
    eq(q.metric === 'reps' || bwLift ? x.reps : q.metric === 'e1rm' ? x.e1 : x.kg),
  );
  return s ? { ts: s.ts, lift: s.lift, where: s.lift } : null;
}

/** "Did X grow?" — this window vs the one before it (or first vs last). */
function change(
  c: AskCtx,
  q: Query,
  all: SetRow[],
  sessions: SessRow[],
  subject: (s: SetRow) => boolean,
  L: Tr,
): QueryResult | null {
  const mine = all.filter(subject);
  if (!mine.length) return null;
  const r = q.range ?? {
    from: c.now - 4 * WEEK,
    to: c.now,
    label: ['the last 4 weeks', 'останні 4 тижні'] as [string, string],
  };
  const span = Math.min(r.to, c.now) - r.from;
  const bwLift = !!q.exercise && isBw(c, q.exercise);
  const per = {
    ...q,
    agg: q.metric === 'weight' || q.metric === 'e1rm' ? ('max' as Agg) : ('sum' as Agg),
  };
  const now = measure(
    per,
    mine.filter((s) => s.ts >= r.from && s.ts < r.to),
    sessions,
    bwLift,
  );
  const before = measure(
    per,
    mine.filter((s) => s.ts >= r.from - span && s.ts < r.from),
    sessions,
    bwLift,
  );
  const what = metricName(q);
  const who = q.exercise ? c.fmt.exercise(q.exercise) : q.muscle ? c.fmt.muscle(q.muscle) : '';
  if (!now) return empty(c, who, L);
  const tn = Math.max(now.v, before?.v ?? 0) >= 10_000;
  if (!before)
    return {
      text: L(
        `${cap(what[0])}${who ? ` (${who})` : ''}, ${r.label[0]}: ${fmtValue(c, per, now, L, tn)} — nothing in the period before to compare with.`,
        `${cap(what[1])}${who ? ` (${who})` : ''}, ${r.label[1]}: ${fmtValue(c, per, now, L, tn)} — за попередній такий самий період даних немає, порівнювати нема з чим.`,
      ),
    };
  const pct = Math.round(((now.v - before.v) / Math.max(1e-9, before.v)) * 100);
  const verdict =
    pct >= 3
      ? L('up', 'більше')
      : pct <= -3
        ? L('down', 'менше')
        : L('about the same', 'приблизно так само');
  return {
    text: L(
      `${cap(what[0])}${who ? ` (${who})` : ''}: ${fmtValue(c, per, now, L, tn)} ${r.label[0]} vs ${fmtValue(c, per, before, L, tn)} the period before — ${verdict} (${pct > 0 ? '+' : ''}${pct}%).`,
      `${cap(what[1])}${who ? ` (${who})` : ''}: ${fmtValue(c, per, now, L, tn)} ${za(r.label[1])} проти ${fmtValue(c, per, before, L, tn)} за попередній період — ${verdict} (${pct > 0 ? '+' : ''}${pct}%).`,
    ),
  };
}

/** "Which lift improved most?" — first vs last estimated max (or reps) per lift. */
function rankChange(c: AskCtx, q: Query, all: SetRow[], L: Tr): QueryResult | null {
  const tryWindow = (from: number, to: number) => {
    const names = [...new Set(all.filter((s) => s.ts >= from && s.ts < to).map((s) => s.lift))];
    const out: { lift: string; pct: number; txt: string }[] = [];
    for (const n of names) {
      if (q.muscle && !all.some((s) => s.lift === n && inMuscle(s.muscles, q.muscle!))) continue;
      const pts = liftPoints(c, n).filter((p) => p.ts >= from && p.ts < to);
      const bw = isBodyweightLift(pts);
      const same = pts.filter((p) => p.bw === bw);
      if (same.length < 2) continue;
      const a = same[0].score;
      const b = same[same.length - 1].score;
      const pct = Math.round(((b - a) / Math.max(1, a)) * 100);
      const txt = bw
        ? L(`${a} → ${b} reps`, `${a} → ${b} повт.`)
        : `${c.fmt.kg(Math.round(a))} → ${c.fmt.kg(Math.round(b))}`;
      out.push({ lift: n, pct, txt });
    }
    return out;
  };
  let label: [string, string] = q.range?.label ?? ['the last 12 weeks', 'останні 12 тижнів'];
  let rows = tryWindow(q.range?.from ?? c.now - 12 * WEEK, q.range?.to ?? Infinity);
  if (!q.range && (rows.length < 2 || rows.every((r) => r.pct <= 0))) {
    rows = tryWindow(-Infinity, Infinity);
    label = ['all time', 'за весь час'];
  }
  if (!rows.length)
    return {
      text: L(
        'Not enough repeat sessions of any lift to compare yet.',
        'Поки замало повторних тренувань однієї вправи, щоб порівняти.',
      ),
    };
  const down = q.down || q.agg === 'min';
  rows.sort((a, b) => (down ? a.pct - b.pct : b.pct - a.pct));
  const list = rows
    .slice(0, q.top)
    .map(
      (x, i) => `${i + 1}. ${c.fmt.exercise(x.lift)} ${x.pct > 0 ? '+' : ''}${x.pct}% (${x.txt})`,
    )
    .join('; ');
  const lead0 = rows[0];
  if (!down && lead0.pct <= 0)
    return {
      text: L(
        `Nothing grew, ${label[0]} — best held: ${c.fmt.exercise(lead0.lift)} (${lead0.txt}). Time for a push: +1 rep a session on your main lifts.`,
        `${cap(za(label[1]))} нічого не виросло — найкраще тримається ${c.fmt.exercise(lead0.lift)} (${lead0.txt}). Час підтиснути: +1 повтор щотренування в основних вправах.`,
      ),
    };
  const lead = rows[0];
  const worst = rows[rows.length - 1];
  if (down && lead.pct >= 0)
    return {
      text: L(
        `Nothing dropped, ${label[0]} — every lift held or grew. Slowest: ${c.fmt.exercise(lead.lift)} (${lead.pct > 0 ? '+' : ''}${lead.pct}%, ${lead.txt}).`,
        `${cap(za(label[1]))} нічого не просіло — усе трималось або росло. Найповільніше: ${c.fmt.exercise(lead.lift)} (${lead.pct > 0 ? '+' : ''}${lead.pct}%, ${lead.txt}).`,
      ),
    };
  const tail =
    rows.length > q.top && worst.pct < 0
      ? L(
          ` Slipping: ${c.fmt.exercise(worst.lift)} ${worst.pct}%.`,
          ` Просідає: ${c.fmt.exercise(worst.lift)} ${worst.pct}%.`,
        )
      : '';
  return {
    text: L(
      `${down ? 'Dropped most' : 'Most improved'}, ${label[0]}: ${c.fmt.exercise(lead.lift)} (${lead.pct > 0 ? '+' : ''}${lead.pct}%). ${list}.${tail}`,
      `${down ? 'Найбільше просіла' : 'Найбільше виросла'} ${za(label[1])}: ${c.fmt.exercise(lead.lift)} (${lead.pct > 0 ? '+' : ''}${lead.pct}%). ${list}.${tail}`,
    ),
  };
}

// ---- words ------------------------------------------------------------------

/** [en, uk (nominative), uk ("за …" — by what)] */
function metricName(q: Query): [string, string, string] {
  switch (q.metric) {
    case 'sessions':
      return ['workouts', 'тренувань', 'кількістю тренувань'];
    case 'duration':
      return ['workout length', 'тривалість тренування', 'тривалістю'];
    case 'volume':
      return ['volume', 'обʼєм', 'обʼємом'];
    case 'sets':
      return ['working sets', 'робочих сетів', 'кількістю сетів'];
    case 'reps':
      return q.agg === 'avg'
        ? ['reps per set', 'повторів за сет', 'повторами']
        : ['reps', 'повторів', 'повторами'];
    case 'weight':
      return ['working weight', 'робоча вага', 'вагою'];
    case 'e1rm':
      return ['estimated max', 'розрахунковий максимум', 'розрахунковим максимумом'];
  }
}

/** [en prefix, uk tag] — "average reps per set" / "повторів за сет (у середньому)". */
function aggWord(q: Query): [string, string] {
  const m = q.metric;
  if (q.agg === 'avg') return m === 'reps' ? ['', 'у середньому'] : ['average ', 'у середньому'];
  if (q.agg === 'max')
    return m === 'sessions'
      ? ['', '']
      : m === 'duration'
        ? ['longest ', 'найдовше']
        : ['best ', 'максимум'];
  if (q.agg === 'min')
    return m === 'duration' ? ['shortest ', 'найкоротше'] : ['lowest ', 'мінімум'];
  if (q.agg === 'sum')
    return m === 'sessions' || m === 'reps' || m === 'sets' ? ['', 'усього'] : ['total ', 'усього'];
  return ['', ''];
}

/** `tons`: one unit for a whole list (no "12.7 t, 7372 kg" side by side). */
function fmtValue(c: AskCtx, q: Query, v: Value, L: Tr, tons?: boolean): string {
  const x = v.v;
  switch (q.metric) {
    case 'sessions':
      return String(Math.round(x));
    case 'duration':
      return L(`${Math.round(x)} min`, `${Math.round(x)} хв`);
    case 'volume':
      return (tons ?? x >= 10_000)
        ? L(`${round(x / 1000)} t`, `${round(x / 1000)} т`)
        : c.fmt.kg(Math.round(x));
    case 'sets':
      return String(round(x));
    case 'reps':
      return String(round(x));
    case 'weight':
    case 'e1rm':
      return v.reps ? L(`${round(x)} reps`, `${round(x)} повт.`) : c.fmt.kg(Math.round(x * 2) / 2);
  }
}

function chartUnit(q: Query, bw: boolean): string {
  if (q.metric === 'volume' || ((q.metric === 'weight' || q.metric === 'e1rm') && !bw)) return 'kg';
  if (q.metric === 'duration') return 'min';
  return '';
}

const round = (x: number) => (Math.abs(x) >= 100 ? Math.round(x) : Math.round(x * 10) / 10);
/** "за останні 4 тижні", but "у серпні" / "з червня" / "за весь час" stay as they are. */
const za = (l: string) =>
  /^(за|у|в|з|із|від|до|цього|минулого|останн\S*)\s/u.test(l) && !/^останн/u.test(l)
    ? l
    : `за ${l}`;
const end = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`);
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const dateOf = (c: AskCtx, ts: number) =>
  new Date(ts).toLocaleDateString(c.locale, {
    day: 'numeric',
    month: 'short',
    ...(new Date(ts).getFullYear() !== new Date(c.now).getFullYear()
      ? { year: 'numeric' as const }
      : {}),
  });
function weekStart(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime() - ((d.getDay() + 6) % 7) * DAY;
}

/** Next questions worth asking about the same data. */
export function queryChips(q: Query, L: Tr): string[] {
  const out: [string, string][] = [];
  if (q.group !== 'week' && q.group !== 'month') out.push(['By week', 'По тижнях']);
  if (q.group === 'week') out.push(['By month', 'По місяцях']);
  if (!q.range) out.push(['This month', 'Цього місяця']);
  else out.push(['Last month', 'Минулого місяця']);
  if (q.agg !== 'change' || q.group !== 'lift')
    out.push(['Which lift improved most?', 'Яка вправа виросла найбільше?']);
  if (q.group !== 'muscle') out.push(['Sets by muscle this month', 'Сети по мʼязах цього місяця']);
  if (q.group !== 'weekday')
    out.push(['Which day do I train most?', 'В який день я тренуюсь найчастіше?']);
  return out.slice(0, 3).map(([en, uk]) => L(en, uk));
}

const LEAD =
  /^\s(and|what about|how about|same for|also|а|і|й|та|и|а як|а що|а якщо|а для|а в|а у|а за|а на)\s/u;
const ALL_TIME = w('all time|ever|overall|за весь час|за всі часи|за все время|всего времени');

/**
 * A short follow-up that changes one part of the last query: "and last
 * month?", "а присід?", "by week", "and sets?", "а найменше?".
 * Returns the new query, or null when the message isn't such a follow-up.
 */
export function followQuery(prev: Query, question: string, p: Parsed): Query | null {
  const ph = ` ${normalize(question)} `;
  if (ph.trim().split(' ').length > 7 || ADVICE.test(ph)) return null;
  const next = parseQuery(question, p);
  // A full question of its own ("which lift improved most", "how many tonnes
  // did I lift last month") isn't a follow-up; "and sets?", "а в липні?" is.
  const n = ph.trim().split(' ').length;
  if (next && next.signals >= 3 && next.said.metric && (next.said.group || next.said.agg))
    return null;
  if (next?.said.metric && n > 3 && !LEAD.test(ph)) return null;
  if (next && (next.rank || (next.said.group && next.said.agg)) && n > 2 && !LEAD.test(ph))
    return null;
  const q: Query = { ...prev };
  let changed = false;
  if (p.range) {
    q.range = p.range;
    changed = true;
  } else if (ALL_TIME.test(ph)) {
    q.range = null;
    changed = true;
  }
  if (p.exercise && p.exercise !== prev.exercise) {
    q.exercise = p.exercise;
    q.muscle = null;
    if (q.group === 'lift') q.group = null;
    changed = true;
  } else if (p.muscle && p.muscle !== prev.muscle) {
    q.muscle = p.muscle;
    q.exercise = null;
    if (q.group === 'muscle') q.group = null;
    changed = true;
  }
  if (next?.said.metric && next.metric !== prev.metric) {
    q.metric = next.metric;
    changed = true;
  }
  if (next?.said.agg && next.agg !== prev.agg) {
    q.agg = next.agg;
    q.down = next.down;
    changed = true;
  }
  // "by week" alone has nothing to measure — it still names a breakdown.
  const g = next?.said.group ? next.group : (GROUP.find(([, re]) => re.test(ph))?.[0] ?? null);
  if (g && g !== prev.group) {
    q.group = g;
    q.rank = g === 'lift' || g === 'muscle' || g === 'weekday';
    if (q.agg === 'change' && q.rank === false) q.agg = defaultAgg(q.metric, true);
    changed = true;
  }
  if (!changed) return null;
  q.strong = true;
  return q;
}
