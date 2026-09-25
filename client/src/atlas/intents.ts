/**
 * Atlas's own answer base — the first responder in chat. Each intent is a set
 * of keyword groups (all must match, typo-tolerant, en + uk) and an answer
 * built from YOUR data (history, plan, readiness, sleep). Only when nothing
 * here fits does the question go to Gemini. More intents: intentsMore.ts.
 */
import { consistencyStreak, est1rm, latestWeight, setTopWeight, setTypeOf, topSet } from '../store';
import { muscleReadiness } from '../recovery';
import { nextTarget, topHistory } from '../progression';
import { LANDMARKS, VOLUME_MUSCLES, weeklyMuscleSets } from '../volume';
import { finishedNights, nightDurationMin } from '../sleep';
import { activeInjuries } from '../injury';
import { blockWeek, isDeloadWeek, planDayFor } from './plan';
import {
  findCatalogExercise,
  findExercise,
  findExercises,
  findMuscle,
  groupMatches,
  hasCyrillic,
  matchedWords,
  negated,
  normalize,
  tokens,
  translitToUk,
} from './nlu';
import { DEPTH, DEFAULT_NEXT } from './depth';
import { INTENTS_FOURTH } from './intentsFourth';
import { CHARTS, INTENTS_FIFTH } from './intentsFifth';
import { INTENTS_SIXTH, MORES } from './intentsSixth';
import { emojiReply, INTENTS_SMALL, SMALLTALK_IDS, SMALL_OVERRIDES } from './smalltalk';

const SMALL_NEW = new Set(INTENTS_SMALL.map((i) => i.id));
import { parseRange, parseWeekdays } from './when';
import { SORE_CAP } from './memoryPlan';
import { ASKS } from './asks';
import { KB, type Facet } from './kb';
import { retrieve } from './retrieve';
import { FACET_CHIP, isPersonal, questionType } from './qtype';
import { toKnownLanguage } from './lexicon';
import {
  consistent,
  learn,
  mergeMemory,
  PART_NAME,
  saidKey,
  soreFor,
  type AtlasMemory,
  type SaidRec,
} from './memory';
import { BUILT_IN_CATALOG } from '../data/exercises';
import type { MuscleGroup } from '../data/exercises';
import { usualSessionsPerWeek } from './facts';
import { hashId } from './voice';
import type { Temper } from './types';
import {
  DAY,
  WEEK,
  date,
  finishedOf,
  loggedLifts,
  todayLine,
  wd,
  type AskCtx,
  type AtlasAction,
  type Chart,
  type Intent,
  type Parsed,
  type Tr,
} from './intentKit';
import { INTENTS_MORE } from './intentsMore';
import { INTENTS_THIRD } from './intentsThird';

export type { AskCtx } from './intentKit';

// ---- the base ---------------------------------------------------------------

const HOW_MUCH = ['how much', 'how many', 'how long', 'скільки', 'скока', 'скилки', 'сколько'];
const WHY = ['why', 'чому', 'нащо', 'навіщо', 'почему', 'зачем'];
const WORKOUT = [
  'workout*',
  'session*',
  'training',
  'train',
  'gym',
  'тренуван*',
  'трен*',
  'заняття',
  'зал',
  'залі',
];

/** Words for pain / injury (also used to detect "no pain"). */
export const PAIN_WORDS = [
  'pain*',
  'hurt*',
  'injur*',
  'ache*',
  'болить',
  'болять',
  'біль',
  'болі*',
  'травм*',
  'потягн*',
  'защем*',
  'ниє',
];

/** Body-part specifics for pain (safe, general; the Injury screen does the rest). */
const BODY_PAIN: [string[], string, string][] = [
  [
    ['lower back', 'back', 'поперек*', 'спина', 'спині', 'спину'],
    'Lower back: skip deadlifts, good mornings and heavy rows for now; walking and gentle movement usually help more than bed rest.',
    'Поперек: поки без станової, нахилів і важких тяг у нахилі; ходьба й легкий рух зазвичай допомагають більше, ніж лежання.',
  ],
  [
    ['knee*', 'коліно', 'коліна', 'колін*'],
    'Knee: keep squats shallow and pain-free, try leg press or box squats, avoid deep lunges until it settles.',
    'Коліно: присідай неглибоко й без болю, спробуй жим ногами чи присід на лаву, глибокі випади — поки ні.',
  ],
  [
    ['shoulder*', 'плеч*'],
    'Shoulder: no overhead pressing or dips for now; neutral-grip dumbbell presses and cable rows are usually tolerated.',
    'Плече: поки без жимів над головою й брусів; жим гантелей нейтральним хватом і тяги на блоці зазвичай переносяться.',
  ],
  [
    ['elbow*', 'лікоть', 'лікт*'],
    'Elbow: ease off heavy curls, skull-crushers and chin-ups; switch to neutral grips and lighter, slower reps.',
    'Лікоть: менше важких згинань, французького жиму й підтягувань зворотним хватом; нейтральний хват, легше й повільніше.',
  ],
  [
    ['wrist*', 'зап’яст*', 'запяст*', 'кист*'],
    'Wrist: use wrist wraps, a thumbless or neutral grip, dumbbells instead of a straight bar.',
    'Зап’ястя: бинти, нейтральний хват, гантелі замість прямого грифа.',
  ],
  [
    ['hip', 'hips', 'кульш*', 'стегно'],
    'Hip: shallower squats and a narrower stance for now; glute bridges and side-lying raises are usually fine.',
    'Кульшовий: поки мілкіший присід і вужча стійка; сідничний міст і відведення ноги лежачи зазвичай можна.',
  ],
  [
    ['ankle*', 'гомілк*', 'щиколот*', 'голеностоп*'],
    'Ankle: seated and machine work, no jumps or running until you can walk it off.',
    'Гомілкостоп: вправи сидячи й на тренажерах, без стрибків і бігу, поки не ходиш вільно.',
  ],
  [
    ['hamstring*', 'задн* поверхн*'],
    'Hamstring: no sprints or heavy RDLs; light bridges and pain-free holds.',
    'Задня поверхня: без спринтів і важкої румунської тяги; легкий міст і утримання без болю.',
  ],
  [
    ['neck', 'шия', 'шиї', 'шию'],
    'Neck: no shrugs or heavy overhead work; keep your chin tucked and the head neutral.',
    'Шия: без шрагів і важких жимів над головою; підборіддя трохи прибране, голова нейтрально.',
  ],
];

export const INTENTS: Intent[] = [
  {
    id: 'pain',
    all: [PAIN_WORDS],
    neutral: true,
    priority: true,
    negatable: true,
    answer: (c, p, L) => {
      const where = p.muscle ? ` (${c.fmt.muscle(p.muscle)})` : '';
      const part = BODY_PAIN.find(([kws]) => groupMatches(p.words, p.phrase, kws));
      const base = L(
        `Pain${where} is not something to push through. Stop the lift that hurts and log it in Injury — I’ll plan around it and ease you back. Sharp, swelling or getting worse: see a doctor.`,
        `Біль${where} не терплять. Зупини вправу, від якої болить, і запиши це в «Травми» — я сплануюся довкола й поверну тебе поступово. Гострий біль, набряк чи гіршає — до лікаря.`,
      );
      return part ? `${L(part[1], part[2])} ${base}` : base;
    },
  },
  {
    id: 'rest',
    all: [
      ['rest*', 'break', 'pause', 'відпоч*', 'отдых*', 'пауз*', 'перерв*', 'рест'],
      [
        ...HOW_MUCH,
        ...WHY,
        'between',
        'між',
        'треба',
        'маю',
        'optimal',
        'оптимальн*',
        'should',
        'need',
        'long',
        'довго',
      ],
    ],
    answer: (c, p, L) => {
      const rule = L(
        'Heavy compounds 2:30, everything else 1:30, 1:00 after a warm-up set — longer when a muscle is tired, you slept badly or you’re ill.',
        'Важкі базові — 2:30, решта — 1:30, після розминкового — 1:00. Довше, коли м’яз утомлений, ти погано спав чи хворієш.',
      );
      const own = p.exercise ? c.s.exerciseRest?.[p.exercise.trim().toLowerCase()] : undefined;
      const mine = own
        ? L(
            ` For ${c.fmt.exercise(p.exercise!)} you set ${c.fmt.mmss(own)}.`,
            ` Для ${c.fmt.exercise(p.exercise!)} ти поставив ${c.fmt.mmss(own)}.`,
          )
        : '';
      const why = L(
        ' Short rest costs reps on the last sets — and reps are what grow you.',
        ' Короткий відпочинок з’їдає повтори в останніх сетах — а ростеш ти саме від них.',
      );
      return rule + mine + why;
    },
  },
  {
    id: 'next_weight',
    all: [
      [
        'weight',
        'kg',
        'kilo*',
        'load',
        'ваг*',
        'кг',
        'кіло*',
        'навантаж*',
        'ставит*',
        'поставит*',
        'брати',
        'взяти',
      ],
      [
        'next',
        'today',
        'should',
        'наступн*',
        'сьогодні',
        'далі',
        'яку',
        'скільки',
        'яка',
        'додав*',
        'додат*',
      ],
    ],
    needs: 'exercise',
    answer: (c, p, L) => {
      const ex = p.exercise!;
      const tg = nextTarget(topHistory(finishedOf(c), ex, c.now), {});
      const name = c.fmt.exercise(ex);
      if (tg.state === 'first' || tg.weight == null)
        return L(
          `No ${name} logged yet. Start light, ${tg.repLow}–${tg.repHigh} clean reps, and I’ll take it from there.`,
          `${name} ще не записано. Почни легко, ${tg.repLow}–${tg.repHigh} чистих повторів — далі поведу я.`,
        );
      const last = tg.prevWeight != null ? `${c.fmt.kg(tg.prevWeight)} × ${tg.prevReps}` : '—';
      if (tg.deltaKg < 0)
        return L(
          `${name}: last ${last}. Stuck there — back off to ${c.fmt.kg(tg.weight)} × ${tg.reps} and build up again.`,
          `${name}: минулого разу ${last}. Застряг — скинь до ${c.fmt.kg(tg.weight)} × ${tg.reps} і набирай знову.`,
        );
      return tg.deltaKg > 0
        ? L(
            `${name}: last ${last}. Next: ${c.fmt.kg(tg.weight)} × ${tg.reps}.`,
            `${name}: минулого разу ${last}. Далі: ${c.fmt.kg(tg.weight)} × ${tg.reps}.`,
          )
        : L(
            `${name}: last ${last}. Stay at ${c.fmt.kg(tg.weight)} and get ${tg.reps} reps before adding weight.`,
            `${name}: минулого разу ${last}. Лишайся на ${c.fmt.kg(tg.weight)} і добий до ${tg.reps} повторів — тоді додамо.`,
          );
    },
  },
  {
    id: 'best',
    all: [
      ['best', 'record', 'pr', 'max', 'maximum', '1rm', 'рекорд*', 'максим*', 'найкращ*', 'макс'],
    ],
    answer: (c, p, L) => {
      const finished = finishedOf(c);
      const names = p.exercise
        ? [p.exercise]
        : loggedLifts(c)
            .sort((a, b) => b.count - a.count)
            .slice(0, 3)
            .map((x) => x.name);
      if (!names.length)
        return L('No records yet — nothing logged.', 'Рекордів ще нема — нічого не записано.');
      const parts = names
        .map((n) => {
          let best: { w: number; r: number } | null = null;
          for (const w of finished) {
            const ex = w.exercises.find((e) => e.name === n);
            const t = ex ? topSet(ex.sets) : undefined;
            if (t && (!best || setTopWeight(t) > best.w)) best = { w: setTopWeight(t), r: t.reps };
          }
          return best
            ? `${c.fmt.exercise(n)} ${c.fmt.kg(best.w)} × ${best.r} (~${c.fmt.kg(Math.round(est1rm(best.w, best.r)))} 1RM)`
            : null;
        })
        .filter(Boolean);
      return parts.length
        ? L(`Your best: ${parts.join('; ')}.`, `Твій найкращий результат: ${parts.join('; ')}.`)
        : null;
    },
  },
  {
    id: 'progress_lift',
    all: [
      [
        'progress*',
        'improv*',
        'going',
        'stuck',
        'прогрес*',
        'росте',
        'зроста*',
        'динамік*',
        'застря*',
        'стоїть',
        'як іде',
        'як справи',
      ],
    ],
    needs: 'exercise',
    answer: (c, p, L) => {
      const hist = topHistory(finishedOf(c), p.exercise!, c.now).filter((x) => x.weight != null);
      const name = c.fmt.exercise(p.exercise!);
      if (hist.length < 2)
        return L(
          `Too little ${name} history to judge. Log a few more sessions.`,
          `Замало історії ${name}, щоб судити. Запиши ще кілька тренувань.`,
        );
      const newest = hist[hist.length - 1];
      const old = hist.find((x) => newest.ts - x.ts <= 8 * WEEK) ?? hist[0];
      const ow = old.weight ?? 0;
      const nw = newest.weight ?? 0;
      const pct = Math.round(((nw - ow) / Math.max(1, ow)) * 100);
      return pct > 0
        ? L(
            `${name}: ${c.fmt.kg(ow)} → ${c.fmt.kg(nw)} (+${pct}%) since ${date(c, old.ts)}.`,
            `${name}: ${c.fmt.kg(ow)} → ${c.fmt.kg(nw)} (+${pct}%) з ${date(c, old.ts)}.`,
          )
        : L(
            `${name} is flat at ${c.fmt.kg(nw)}. Same weight, one more rep each session until it moves.`,
            `${name} стоїть на ${c.fmt.kg(nw)}. Та сама вага, +1 повтор щотренування, доки не зрушить.`,
          );
    },
  },
  {
    id: 'volume_muscle',
    all: [['sets', 'set', 'volume', 'сет*', 'підход*', 'подход*', 'обсяг*', 'обєм*', 'объем*']],
    needs: 'muscle',
    answer: (c, p, L) => {
      const m = p.muscle!;
      const n = Math.round((weeklyMuscleSets(finishedOf(c), c.now).get(m) ?? 0) * 10) / 10;
      const lm = LANDMARKS[m];
      const tail = lm
        ? L(
            ` Productive range: ${lm.mev}–${lm.mav} a week.`,
            ` Робочий діапазон: ${lm.mev}–${lm.mav} на тиждень.`,
          )
        : '';
      return L(
        `${c.fmt.muscle(m)}: ${n} sets in the last 7 days.${tail}`,
        `${c.fmt.muscle(m)}: ${n} сетів за останні 7 днів.${tail}`,
      );
    },
  },
  {
    id: 'weak',
    all: [
      [
        'neglect*',
        'behind',
        'weak*',
        'lagging',
        'balance*',
        'imbalance*',
        'відста*',
        'слабк*',
        'недотрен*',
        'забув*',
        'пропуска*',
        'дисбаланс*',
        'перекіс*',
      ],
    ],
    answer: (c, _p, L) => {
      const f = finishedOf(c);
      const recent = weeklyMuscleSets(f, c.now, 28);
      const week = weeklyMuscleSets(f, c.now, 7);
      const pool = VOLUME_MUSCLES.filter((m) => (recent.get(m) ?? 0) > 0);
      if (pool.length < 2)
        return L(
          'Not enough training yet to see a gap.',
          'Ще замало тренувань, щоб побачити перекіс.',
        );
      const low = [...pool]
        .sort((a, b) => (week.get(a) ?? 0) - (week.get(b) ?? 0))
        .slice(0, 2)
        .map((m) => `${c.fmt.muscle(m)} (${Math.round(week.get(m) ?? 0)})`)
        .join(', ');
      return L(
        `Behind this week (sets): ${low}. They go first next session.`,
        `Цього тижня відстають (сетів): ${low}. Наступного тренування — першими.`,
      );
    },
  },
  {
    id: 'recovery',
    all: [
      [
        'recover*',
        'sore*',
        'ready',
        'fresh',
        'doms',
        'відновив*',
        'відновл*',
        'крепатур*',
        'готов*',
        'свіж*',
        'забит*',
      ],
    ],
    answer: (c, p, L) => {
      const ready = muscleReadiness(finishedOf(c), c.now);
      const list = p.muscle
        ? [p.muscle]
        : VOLUME_MUSCLES.filter(
            (m) => ready.get(m)?.state === 'recovering' || ready.get(m)?.state === 'nearly',
          );
      if (!list.length)
        return L(
          'Everything you trained is recovered. No excuse there.',
          'Усе, що ти тренував, відновилося. Тут відмовки не буде.',
        );
      const parts = list
        .slice(0, 4)
        .map((m) => `${c.fmt.muscle(m)} ${Math.round((ready.get(m)?.readiness ?? 1) * 100)}%`)
        .join(', ');
      return L(
        `Recovery: ${parts}. Under ~85% — train something else today.`,
        `Відновлення: ${parts}. Нижче ~85% — сьогодні тренуй інше.`,
      );
    },
  },
  {
    id: 'today',
    all: [
      ['today', 'now', 'сьогодні', 'седня', 'зараз'],
      [
        'train*',
        'do',
        'workout',
        'plan',
        'lift',
        'тренув*',
        'робит*',
        'качат*',
        'займат*',
        'план',
        'що',
        'what',
      ],
    ],
    answer: (c, _p, L) => todayLine(c, L, c.now),
  },
  {
    id: 'tomorrow',
    all: [['tomorrow', 'завтра']],
    answer: (c, _p, L) => L('Tomorrow: ', 'Завтра: ') + todayLine(c, L, c.now + DAY),
  },
  {
    id: 'next_session',
    all: [['next', 'наступн*', 'коли'], WORKOUT],
    answer: (c, _p, L) => {
      const plan = c.s.coach.plan;
      if (!plan || !c.s.coach.enabled)
        return L('Whenever you show up. Preferably today.', 'Коли прийдеш. Бажано сьогодні.');
      for (let i = 0; i < 7; i++) {
        const d = planDayFor(plan, c.now + i * DAY);
        if (d)
          return `${i === 0 ? L('Today', 'Сьогодні') : wd(c, d.weekday)}: ${d.name ?? d.split}.`;
      }
      return null;
    },
  },
  {
    id: 'last_session',
    all: [
      ['last', 'previous', 'yesterday', 'останн*', 'минул*', 'попередн*', 'вчора', 'учора'],
      WORKOUT,
    ],
    answer: (c, _p, L) => {
      const w = finishedOf(c)[0];
      if (!w)
        return L(
          'There is no last session. That’s the problem.',
          'Останнього тренування нема. У цьому й проблема.',
        );
      const sets = w.exercises.flatMap((e) =>
        e.sets.filter((x) => setTypeOf(x) !== 'warmup'),
      ).length;
      const mins = Math.round(((w.finishedAt ?? w.startedAt) - w.startedAt) / 60000);
      const lifts = w.exercises
        .slice(0, 4)
        .map((e) => c.fmt.exercise(e.name))
        .join(', ');
      return L(
        `${date(c, w.startedAt)}: ${sets} sets in ${mins} min — ${lifts}.`,
        `${date(c, w.startedAt)}: ${sets} сетів за ${mins} хв — ${lifts}.`,
      );
    },
  },
  {
    id: 'week',
    all: [['week', 'weekly', 'тижд*', 'тижн*', 'тиждень', 'недел*']],
    answer: (c, _p, L) => {
      const f = finishedOf(c);
      const n = f.filter((w) => c.now - w.startedAt < WEEK).length;
      const usual = usualSessionsPerWeek(f, c.now - WEEK) || n;
      const sets = Math.round([...weeklyMuscleSets(f, c.now).values()].reduce((a, b) => a + b, 0));
      return L(
        `Last 7 days: ${n} sessions (usual ${usual}), ${sets} hard sets.`,
        `Останні 7 днів: ${n} тренувань (зазвичай ${usual}), ${sets} робочих сетів.`,
      );
    },
  },
  {
    id: 'streak',
    all: [['streak', 'in a row', 'серія', 'серію', 'поспіль', 'підряд']],
    answer: (_c, _p, L) => {
      const d = consistencyStreak();
      return L(`${d}-day streak.`, `Серія: ${d} днів.`);
    },
  },
  {
    id: 'total',
    all: [
      ['total', 'all time', 'altogether', 'всього', 'усього', 'загалом'],
      [...WORKOUT, 'sessions'],
    ],
    answer: (c, _p, L) => {
      const f = finishedOf(c);
      const since = f.length ? date(c, f[f.length - 1].startedAt) : '—';
      return L(
        `${f.length} sessions logged since ${since}.`,
        `${f.length} тренувань записано з ${since}.`,
      );
    },
  },
  {
    id: 'sleep',
    all: [['sleep*', 'slept', 'сон', 'сну', 'спав', 'спала', 'поспав*', 'виспав*', 'выспал*']],
    answer: (c, _p, L) => {
      const nights = finishedNights(c.s.sleeps, c.now).slice(0, 7);
      if (!nights.length)
        return L(
          'No sleep logged. I can’t judge what I can’t see.',
          'Сну не записано. Не можу судити те, чого не бачу.',
        );
      const h = (min: number) => Math.round((min / 60) * 10) / 10;
      const last = h(nightDurationMin(nights[0], c.now));
      const avg = h(nights.reduce((a, n) => a + nightDurationMin(n, c.now), 0) / nights.length);
      return L(
        `Last night ${last} h, 7-night average ${avg} h. Aim for 7+ — recovery happens there, not in the gym.`,
        `Минулої ночі ${last} год, середнє за 7 ночей ${avg} год. Ціль — 7+: відновлення відбувається уві сні, а не в залі.`,
      );
    },
  },
  {
    id: 'deload',
    all: [
      [
        'deload',
        'lighter week',
        'easy week',
        'розвантаж*',
        'легк* тиждень',
        'легш* тиждень',
        'дилоад',
      ],
    ],
    answer: (c, _p, L) => {
      const plan = c.s.coach.plan;
      if (!plan)
        return L(
          'Without a programme I deload you when the numbers drop. Ask me to write one.',
          'Без програми я розвантажую, коли падають цифри. Попроси — напишу програму.',
        );
      return isDeloadWeek(plan, c.now)
        ? L(
            'This is the lighter week. Fewer sets, same weights. Recover.',
            'Це легший тиждень. Менше сетів, ті самі ваги. Відновлюйся.',
          )
        : L(
            `Week ${blockWeek(plan, c.now)} of ${plan.weeks}. The lighter week is week ${plan.weeks}.`,
            `Тиждень ${blockWeek(plan, c.now)} з ${plan.weeks}. Легший — ${plan.weeks}-й.`,
          );
    },
  },
  {
    id: 'plan',
    all: [
      [
        'program*',
        'programme',
        'plan',
        'schedule',
        'split',
        'програм*',
        'план*',
        'розклад*',
        'спліт*',
      ],
    ],
    answer: (c, _p, L) => {
      const plan = c.s.coach.plan;
      if (!plan)
        return L(
          'No programme yet. Tap “Write my programme” above and I’ll build it from your history.',
          'Програми ще нема. Натисни «Написати програму» вгорі — зберу її з твоєї історії.',
        );
      const days = plan.days.map((d) => `${wd(c, d.weekday)} — ${d.name ?? d.split}`).join('; ');
      return L(
        `Week ${blockWeek(plan, c.now)} of ${plan.weeks}: ${days}. ~${plan.lengthMin} min each.`,
        `Тиждень ${blockWeek(plan, c.now)} з ${plan.weeks}: ${days}. ~${plan.lengthMin} хв кожне.`,
      );
    },
  },
  {
    id: 'skip',
    all: [['skip', 'miss', 'day off', 'пропуст*', 'прогуля*', 'не піду', 'вихідн*', 'можна не']],
    answer: (c, _p, L) =>
      activeInjuries(c.s.injuries).length > 0
        ? L(
            'You’re injured — a lighter day or a rest day is the right call.',
            'Ти травмований — легкий день чи відпочинок тут правильні.',
          )
        : L(
            'Skip if you’re ill or slept under 5 h. Otherwise a short session beats none. 30 minutes.',
            'Пропускай, якщо хворий чи спав менше 5 год. Інакше коротке тренування краще за жодне. 30 хвилин.',
          ),
  },
  {
    id: 'motivation',
    all: [
      [
        'lazy',
        'dont want',
        'no motivation',
        'unmotivated',
        'tired',
        'exhausted',
        'лінь',
        'лінуюсь',
        'ліньки',
        'не хочу',
        'нема сил',
        'немає сил',
        'мотивац*',
        'втомив*',
        'втомлен*',
      ],
    ],
    answer: (_c, _p, L) =>
      L(
        'Nobody wants to. Pack the bag, do the warm-up, then decide. You won’t leave.',
        'Ніхто не хоче. Збери сумку, зроби розминку — тоді вирішуй. Не підеш.',
      ),
  },
  {
    id: 'warmup',
    all: [['warm*', 'warmup', 'розмин*', 'разминк*', 'розігр*']],
    answer: (_c, _p, L) =>
      L(
        '5 minutes of easy cardio, then 2–3 ramp-up sets on your first lift (~50%, 70%, 85%). The app adds them for you.',
        '5 хвилин легкого кардіо, потім 2–3 підвідні сети на першій вправі (~50%, 70%, 85%). Додаток додає їх сам.',
      ),
  },
  {
    id: 'cooldown',
    all: [['cooldown', 'cool down', 'stretch*', 'заминк*', 'розтяжк*', 'розтягув*']],
    answer: (_c, _p, L) =>
      L(
        '5–10 minutes: easy walk or bike, then stretch what you trained. Start the cool-down block and rest stops counting.',
        '5–10 хвилин: легка ходьба чи велосипед, потім розтягни те, що тренував. Запусти блок заминки — відпочинок перестане рахуватись.',
      ),
  },
  {
    id: 'cardio',
    all: [
      [
        'cardio',
        'running',
        'run',
        'bike',
        'treadmill',
        'кардіо',
        'кардио',
        'біг*',
        'доріжк*',
        'велосипед*',
        'вело',
      ],
    ],
    answer: (_c, _p, L) =>
      L(
        'Cardio after lifting, not before: 10–20 min easy on lifting days, longer sessions on separate days. It helps recovery if it stays easy.',
        'Кардіо після силового, не до: 10–20 хв легко в силові дні, довші сесії — окремими днями. Допомагає відновленню, якщо лишається легким.',
      ),
  },
  {
    id: 'reps',
    all: [['reps', 'rep range', 'repetition*', 'повтор*', 'разів', 'повторен*']],
    answer: (c, _p, L) => {
      const intent = c.s.coach.plan?.intent ?? 'muscle';
      const r = intent === 'strength' ? '3–6' : intent === 'endurance' ? '12–20' : '6–12';
      return L(
        `Your focus is ${intent}: ${r} reps, last 1–2 hard. Hit the top of the range on every set — then the weight goes up.`,
        `Твій фокус — ${intent}: ${r} повторів, останні 1–2 важкі. Дійшов до верху діапазону на всіх сетах — вага вгору.`,
      );
    },
  },
  {
    id: 'failure',
    all: [['failure', 'to fail*', 'відмов*', 'отказ*', 'до відказ*']],
    answer: (_c, _p, L) =>
      L(
        'Leave 1–2 reps in the tank on compounds; take isolation lifts to failure on the last set. Failure every set just digs a hole.',
        'На базових лишай 1–2 повтори в запасі; ізолюючі — до відмови на останньому сеті. Відмова щосету лише копає яму.',
      ),
  },
  {
    id: 'bodyweight',
    all: [
      [
        'bodyweight',
        'body weight',
        'my weight',
        'weigh in',
        'вага тіла',
        'моя вага',
        'скільки важу',
        'зважу*',
        'зважув*',
      ],
    ],
    neutral: true,
    answer: (c, _p, L) => {
      const w = latestWeight(c.s.bodyMetrics);
      return w
        ? L(
            `Last weigh-in: ${c.fmt.kg(w.weight)} on ${date(c, w.at)}.`,
            `Останнє зважування: ${c.fmt.kg(w.weight)}, ${date(c, w.at)}.`,
          )
        : L('No weigh-ins logged.', 'Зважувань не записано.');
    },
  },
  {
    id: 'session_length',
    all: [['how long', 'duration', 'скільки часу', 'тривал*', 'довго'], WORKOUT],
    answer: (c, _p, L) => {
      const f = finishedOf(c).slice(0, 10);
      const avg = f.length
        ? Math.round(
            f.reduce((a, w) => a + ((w.finishedAt ?? w.startedAt) - w.startedAt), 0) /
              f.length /
              60000,
          )
        : 0;
      const planned = c.s.coach.plan?.lengthMin ?? 60;
      return L(
        `Plan: ~${planned} min. Your last ${f.length} sessions averaged ${avg} min.`,
        `За планом ~${planned} хв. Останні ${f.length} тренувань — у середньому ${avg} хв.`,
      );
    },
  },
  {
    id: 'swap',
    all: [
      [
        'swap',
        'replace',
        'alternative*',
        'instead',
        'substitut*',
        'замін*',
        'альтернатив*',
        'замість',
        'заменит*',
      ],
    ],
    answer: (c, p, L) => {
      const name = p.exercise ? c.fmt.exercise(p.exercise) : L('a lift', 'вправу');
      return L(
        `To swap ${name}: in the session, tap it → Swap. I only offer lifts for the same muscle that your gym has.`,
        `Щоб замінити ${name}: у тренуванні тапни її → «Замінити». Я пропоную лише вправи на той самий м’яз, які є у твоєму залі.`,
      );
    },
  },
  {
    id: 'technique',
    all: [
      [
        'technique',
        'form',
        'how to do',
        'how do i do',
        'техні*',
        'як правильно',
        'як робити',
        'как делать',
      ],
    ],
    answer: (c, p, L) => {
      const name = p.exercise ? c.fmt.exercise(p.exercise) : L('any lift', 'будь-якої вправи');
      return L(
        `Open ${name} in the exercise library — photos, cues and the Learn videos are there. Film one set from the side and compare.`,
        `Відкрий ${name} у бібліотеці вправ — там фото, підказки й відео з Learn. Зніми один сет збоку й порівняй.`,
      );
    },
  },
  {
    id: 'protein',
    all: [
      [
        'protein',
        'diet',
        'eat',
        'eating',
        'food',
        'nutrition',
        'білок',
        'білк*',
        'протеїн*',
        'дієт*',
        'їжа',
        'їсти',
        'харчув*',
      ],
    ],
    answer: (_c, _p, L) =>
      L(
        'The evidence says ~1.6–2.2 g of protein per kg a day over 3–5 meals, and enough total food to recover. The rest is the Nutrition app’s job, not mine.',
        'За дослідженнями ~1,6–2,2 г білка на кг на день на 3–5 прийомів і достатньо їжі загалом, щоб відновлюватися. Решта — робота Nutrition, не моя.',
      ),
  },
  {
    id: 'supplements',
    all: [
      [
        'creatine',
        'supplement*',
        'preworkout',
        'pre workout',
        'креатин*',
        'добавк*',
        'спортпит*',
        'передтрен*',
      ],
    ],
    answer: (_c, _p, L) =>
      L(
        'Creatine monohydrate, 3–5 g a day, any time — the one supplement with solid evidence. The rest is mostly marketing. Kidney issues: ask a doctor first.',
        'Креатин моногідрат, 3–5 г на день, будь-коли — єдина добавка з міцними доказами. Решта здебільшого маркетинг. Проблеми з нирками — спершу до лікаря.',
      ),
  },
  {
    id: 'temper',
    all: [
      [
        'nicer',
        'be nice',
        'kinder',
        'rude',
        'harsh',
        'мякше',
        'добріше',
        'грубий',
        'грубо',
        'жорстк*',
        'злий',
      ],
    ],
    answer: (_c, _p, L) =>
      L(
        'Don’t like my tone? Gear icon, top right → Temper. I won’t take it personally. Much.',
        'Не подобається тон? Шестірня вгорі праворуч → «Характер». Я не ображуся. Сильно.',
      ),
  },
  {
    id: 'who',
    all: [
      [
        'who are you',
        'what can you do',
        'what do you do',
        'help',
        'хто ти',
        'що ти вмієш',
        'що вмієш',
        'допоможи',
        'кто ты',
      ],
    ],
    answer: (_c, _p, L) =>
      L(
        'Atlas. I read every set you log. Ask me: what to train today, rest times, next weight on a lift, your records, recovery, sleep, your programme.',
        'Atlas. Я читаю кожен твій сет. Питай: що тренувати сьогодні, скільки відпочивати, яку вагу далі, твої рекорди, відновлення, сон, програму.',
      ),
  },
  {
    id: 'thanks',
    all: [['thanks', 'thank*', 'thx', 'дякую', 'дяки', 'спасиб*']],
    maxWords: 5,
    answer: (_c, _p, L) => L('Thank me with a logged session.', 'Подякуй записаним тренуванням.'),
  },
  {
    id: 'greeting',
    all: [
      [
        'hi',
        'hello',
        'hey',
        'привіт',
        'привет',
        'вітаю',
        'здоров*',
        'хай',
        'добрий ранок',
        'добрий день',
        'добрий вечір',
      ],
    ],
    maxWords: 4,
    answer: (c, _p, L) => L('Here. ', 'Я тут. ') + todayLine(c, L, c.now),
  },
  {
    id: 'ack',
    all: [
      ['ok', 'okay', 'fine', 'got it', 'sure', 'добре', 'ок', 'окей', 'гаразд', 'зрозумів', 'ясно'],
    ],
    maxWords: 3,
    answer: (_c, _p, L) => L('Good. Now go.', 'Добре. Тепер іди.'),
  },
];

// ---- temper flavour ---------------------------------------------------------

// Openers and closers per temper — rotated with the conversation so replies
// don't all start alike. Content never changes, only the framing.
const OPEN: Record<Temper, [string[], string[]]> = {
  1: [
    ['', 'Great question! ', 'Love that you asked. ', 'Good one! '],
    ['', 'Гарне питання! ', 'Клас, що питаєш. ', 'О, слушно! '],
  ],
  2: [
    ['', 'OK. ', 'Right — ', ''],
    ['', 'Гаразд. ', 'Отже, ', ''],
  ],
  3: [
    ['', 'Straight: ', '', 'Plainly: '],
    ['', 'Прямо: ', '', 'Коротко: '],
  ],
  4: [
    ['', 'Listen. ', 'Eyes up. ', 'Pay attention. '],
    ['', 'Слухай. ', 'Дивись сюди. ', 'Уважно. '],
  ],
  5: [
    ['', 'Obviously. ', 'Since you ask. ', 'Must I? Fine. '],
    ['', 'Очевидно. ', 'Раз уже питаєш. ', 'Мушу? Гаразд. '],
  ],
};
const CLOSE: Record<Temper, [string[], string[]]> = {
  1: [
    ['', ' You’ve got this!', ' Proud of you.', ''],
    ['', ' У тебе вийде!', ' Пишаюся тобою.', ''],
  ],
  2: [[''], ['']],
  3: [
    ['', '', ' That’s it.'],
    ['', '', ' От і все.'],
  ],
  4: [
    [' Now move.', ' No excuses.', ' Go.'],
    [' А тепер рухайся.', ' Без відмовок.', ' Вперед.'],
  ],
  5: [
    ['', ' Try to keep up.', ' Don’t disappoint me. More than usual.', ' I’ll be watching.'],
    ['', ' Спробуй встигати.', ' Не розчаруй мене. Більше, ніж зазвичай.', ' Я стежитиму.'],
  ],
};

export interface LocalAnswer {
  intent: string;
  text: string;
  /** Follow-up questions to offer as chips. */
  chips?: string[];
  /** The base has nothing deeper — hand the thread to Gemini if allowed. */
  escalate?: boolean;
  /** Conversation state to carry into the next message. */
  convo: Convo;
  /** A chart to draw under the text. */
  chart?: Chart;
  /** Something to do — shown as Confirm / Cancel. */
  action?: AtlasAction;
  /** New facts to remember (merge into coach.memory). */
  learned?: AtlasMemory;
  /** The answer to remember for consistency. */
  said?: SaidRec;
}

/** What the conversation is about right now (for follow-ups). */
export interface Convo {
  intent?: string;
  exercise?: string | null;
  muscle?: MuscleGroup | null;
  /** How many "more" layers of this topic were already told. */
  depth?: number;
  /** A question waiting for a lift/muscle ("Which lift?"). */
  pending?: boolean;
  /** How many answers so far (rotates the phrasing). */
  turn?: number;
  /** The question that opened this topic ("my knee hurts") — for follow-ups. */
  q?: string;
  /** Sides of the topic already told (why / how / when…). */
  told?: Facet[];
}

const MORE = [
  'more',
  'tell me more',
  'go on',
  'continue',
  'details',
  'detail',
  'elaborate',
  'explain',
  'and',
  'then',
  'what else',
  'ще',
  'детальніше',
  'докладніше',
  'розкажи більше',
  'поясни',
  'продовжуй',
  'далі',
  'і',
  'а далі',
  'що ще',
  'як саме',
  'how exactly',
  'how so',
];
const ASK_WHY = [
  'why',
  'how come',
  'why so',
  'чому',
  'чого',
  'навіщо',
  'з чого',
  'звідки',
  'чому так',
];
const FOLLOW_LEAD = [
  'and',
  'what about',
  'how about',
  'same for',
  'а',
  'і',
  'а як',
  'а що',
  'а для',
  'а на',
  'а про',
  'і на',
];

export const ALL_INTENTS = (): Intent[] => [
  ...INTENTS,
  ...INTENTS_MORE,
  ...INTENTS_THIRD,
  ...INTENTS_FOURTH,
  ...INTENTS_FIFTH,
  ...INTENTS_SIXTH,
  ...INTENTS_SMALL,
];
// Charts and "more" layers for topics from the earlier parts.
for (const it of ALL_INTENTS()) {
  if (CHARTS[it.id]) it.chart ??= CHARTS[it.id];
  if (MORES[it.id]) it.more ??= MORES[it.id];
  if (SMALL_OVERRIDES[it.id]) it.answer = SMALL_OVERRIDES[it.id].answer;
}
const byId = (id: string | undefined) => (id ? ALL_INTENTS().find((i) => i.id === id) : undefined);

function flavour(text: string, c: AskCtx, seedStr: string, turn = 0): string {
  const i = c.locale === 'uk' ? 1 : 0;
  // Rotate with the conversation, so two answers in a row don't open alike.
  const seed = hashId(seedStr) + turn * 7;
  const o = OPEN[c.temper][i];
  const e = CLOSE[c.temper][i];
  return `${o[seed % o.length]}${text}${e[(seed >>> 3) % e.length]}`;
}

function chipsFor(id: string, L: Tr): string[] {
  const d = DEPTH[id];
  const own = byId(id)?.suggest?.(L);
  if (own?.length) return own.slice(0, 3);
  return (d?.next ?? DEFAULT_NEXT).map(([en, uk]) => L(en, uk)).slice(0, 3);
}

function parse(question: string, c: AskCtx): Parsed {
  const words = tokens(question);
  const phrase = normalize(question);
  const logged = loggedLifts(c);
  return {
    words,
    phrase,
    exercise:
      findExercise(words, phrase, logged) ?? findCatalogExercise(words, phrase, CATALOG_NAMES()),
    muscle: findMuscle(words, phrase),
    exercises: findExercises(words, logged, CATALOG_NAMES()),
    range: parseRange(phrase, c.now),
    weekdays: parseWeekdays(words),
  };
}

/** Does the question carry what the intent needs? */
function hasNeeds(it: Intent, p: Parsed): boolean {
  if (!it.needs) return true;
  if (it.needs === 'exercise') return !!p.exercise;
  if (it.needs === 'muscle') return !!p.muscle;
  if (it.needs === 'range') return !!p.range;
  return (p.exercises?.length ?? 0) >= 2;
}

/** The data an answer is built from — changes when you log something. */
export function stampOf(c: AskCtx): string {
  const f = finishedOf(c);
  const w = c.s.bodyMetrics.weights ?? [];
  return `${f.length}:${f[0]?.id ?? ''}:${w.length}:${c.s.injuries.length}:${c.s.coach.plan?.createdAt ?? 0}`;
}

const LOAD_INTENTS = new Set([
  'next_weight',
  'add_weight',
  'today',
  'tomorrow',
  'next_session',
  'warmup_lift',
  'percent_max',
  'reps_at_weight',
  'sets_for_lift',
  'plateau',
  'failure',
  'alternatives',
  'plan',
  'technique',
  'why_weight',
  'why_today',
  'range_lift',
]);
const TIME_INTENTS = new Set([
  'today',
  'next_session',
  'plan',
  'session_length',
  'exercises_per_session',
  'tomorrow',
]);

/**
 * What Atlas remembers, woven into the answer — so advice never ignores a
 * sore knee, a lift you banned, your goal or your time.
 */
function memoryLine(id: string, p: Parsed, c: AskCtx, core: string, L: Tr): string | null {
  const mem = c.mem;
  if (!mem) return null;
  const out: string[] = [];
  if (LOAD_INTENTS.has(id)) {
    const sore = soreFor(mem, c.now, `${p.exercise ?? ''} ${p.muscle ?? ''} ${core}`);
    const tg =
      p.exercise && ['next_weight', 'add_weight', 'why_weight'].includes(id)
        ? nextTarget(topHistory(finishedOf(c), p.exercise, c.now), {})
        : null;
    if (sore.length && tg?.weight) {
      // Same number the plan uses — never "stay at 100" and "go lighter" at once.
      const names = sore.map((x) => L(PART_NAME[x][0], PART_NAME[x][1])).join(', ');
      const w = Math.max(2.5, Math.round((tg.weight * SORE_CAP) / 2.5) * 2.5);
      out.push(
        L(
          `But your ${names} comes first: take ${c.fmt.kg(w)} instead (20% lighter), pain-free, until you tell me it’s fine — your plan uses the same.`,
          `Але спершу ${names}: бери ${c.fmt.kg(w)} (на 20% легше), без болю, доки не скажеш, що минуло, — у плані так само.`,
        ),
      );
    } else if (sore.length) {
      const names = sore.map((x) => L(PART_NAME[x][0], PART_NAME[x][1])).join(', ');
      out.push(
        L(
          `Your ${names} is still on my list: keep this pain-free and 20% lighter until you tell me it’s fine.`,
          `Пам’ятаю про ${names}: без болю й на 20% легше, доки не скажеш, що минуло.`,
        ),
      );
    }
  }
  const banned = (mem.avoid ?? []).filter(
    (x) => core.includes(c.fmt.exercise(x)) || core.includes(x),
  );
  if (banned.length) {
    const b = banned[0];
    const to = mem.prefer?.find((x) => x.from === b)?.to;
    out.push(
      to
        ? L(
            `You swapped ${c.fmt.exercise(b)} for ${c.fmt.exercise(to)} — do that instead.`,
            `Ти замінив ${c.fmt.exercise(b)} на ${c.fmt.exercise(to)} — роби її.`,
          )
        : L(
            `You told me to skip ${c.fmt.exercise(b)} — take another lift for the same muscle.`,
            `Ти просив без ${c.fmt.exercise(b)} — візьми іншу вправу на той самий м’яз.`,
          ),
    );
  }
  const g = mem.goal?.v;
  if (g === 'fat_loss' && ['muscle_gain_rate', 'grow_muscle', 'arms', 'bulk'].includes(id))
    out.push(
      L(
        'You’re cutting, though — expect slow growth; heavy lifting and high protein keep what you have.',
        'Але ти на схудненні — ріст буде повільним; важкі ваги й білок збережуть м’язи.',
      ),
    );
  if (g === 'muscle' && ['fat_loss', 'cut_deficit', 'cardio'].includes(id))
    out.push(
      L(
        'Your goal is muscle, so keep any deficit small and cardio moderate.',
        'Твоя мета — м’язи, тож дефіцит мінімальний, кардіо помірне.',
      ),
    );
  if (g === 'strength' && ['reps', 'strength_vs_size'].includes(id))
    out.push(
      L(
        'For your strength goal: the big lifts in 3–6 reps come first.',
        'Для твоєї мети — сили: базові вправи в 3–6 повторах першими.',
      ),
    );
  if (mem.minutes && TIME_INTENTS.has(id))
    out.push(
      L(
        `You have ~${mem.minutes.v} min: do the first lifts properly, superset the rest.`,
        `У тебе ~${mem.minutes.v} хв: перші вправи — як слід, решту суперсетами.`,
      ),
    );
  if (
    mem.level === 'beginner' &&
    ['next_weight', 'add_weight', 'failure', 'rpe', 'plateau'].includes(id)
  )
    out.push(
      L(
        'As a beginner you can add weight almost every session while form holds.',
        'Як новачок, додавай вагу майже кожне тренування, поки техніка тримається.',
      ),
    );
  if (
    (mem.age ?? 0) >= 50 &&
    ['warmup', 'recovery', 'deload', 'rest_day', 'overtraining'].includes(id)
  )
    out.push(
      L(
        `At ${mem.age}, a longer warm-up and an extra rest day pay off.`,
        `У ${mem.age} довша розминка й зайвий день відпочинку окупаються.`,
      ),
    );
  if (mem.home && ['alternatives', 'swap', 'today'].includes(id))
    out.push(
      L(
        'At home: dumbbells, bands and bodyweight versions work fine.',
        'Вдома: гантелі, резинки й вправи з власною вагою — цілком.',
      ),
    );
  return out.length ? out.join(' ') : null;
}

let catalogNames: string[] | null = null;
const CATALOG_NAMES = () => (catalogNames ??= BUILT_IN_CATALOG.map((e) => e.names[0]));

/** Build a full answer for an intent: flavour, memory, consistency, extras. */
/** Other sides of the topic as chips ("Why?", "When?") — first two not yet told. */
function withFacetChips(id: string, told: Facet[], rest: string[], L: Tr): string[] {
  const f = KB[id]?.facets ?? {};
  const order: Facet[] = ['why', 'how', 'when', 'howMuch', 'should', 'what', 'who', 'where'];
  const sides = order
    .filter((x) => f[x] && !told.includes(x))
    .slice(0, 2)
    .map((x) => L(...FACET_CHIP[x]));
  return [...sides, ...rest].slice(0, 3);
}

/**
 * Answer the side of the topic the question asks for. A general question
 * ("why rest longer?") gets the facet; a personal one ("why is MY bench
 * stuck?") keeps your numbers and adds the reason.
 */
function faceted(
  id: string,
  core: string,
  question: string,
  L: Tr,
): { text: string; facet?: Facet } {
  const qt = questionType(question);
  const f = qt ? KB[id]?.facets?.[qt] : undefined;
  if (!qt || !f) return { text: core };
  const ft = L(f[0], f[1]);
  // Numbers in the answer = it was computed for you (your lifts, the plates
  // for 100 kg…). Keep that; only a "why" adds the reason next to it.
  const computed = /\d/.test(core);
  if (computed || isPersonal(question))
    return qt === 'why' ? { text: `${core} ${ft}`, facet: qt } : { text: core };
  return { text: ft, facet: qt };
}

function build(
  it: Intent,
  core: string,
  c: AskCtx,
  p: Parsed,
  question: string,
  L: Tr,
  convo: Convo,
  q = question,
  facet?: Facet,
): LocalAnswer {
  const turn = (convo.turn ?? 0) + 1;
  // Small talk speaks for itself: no "As I said", no memory notes, no opener.
  if (SMALLTALK_IDS.has(it.id))
    return {
      intent: it.id,
      text: core,
      chips: chipsFor(it.id, L),
      convo: { intent: it.id, depth: 0, turn, q },
    };
  // Consistency: the same topic on the same data gets the same answer.
  const key = saidKey(
    facet ? `${it.id}:${facet}` : it.id,
    p.exercise,
    p.muscle,
    p.range?.from ?? null,
  );
  const stamp = stampOf(c);
  const prev = c.said?.find((r) => r.key === key);
  const kept = consistent(prev, core, stamp, c.now, L);
  const extra = memoryLine(it.id, p, c, kept.keep, L);
  const body = extra ? `${kept.text} ${extra}` : kept.text;
  const action = it.action?.(c, p) ?? undefined;
  return {
    intent: it.id,
    // "As I said…" / "this changed…" already frame the reply — no extra opener.
    text:
      it.neutral || action || kept.text !== kept.keep
        ? body
        : flavour(body, c, question + it.id, turn),
    chips: action ? undefined : withFacetChips(it.id, facet ? [facet] : [], chipsFor(it.id, L), L),
    chart: it.chart?.(c, p, L) ?? undefined,
    action,
    said: { key, text: kept.keep, stamp, at: c.now },
    convo: {
      intent: it.id,
      exercise: p.exercise,
      muscle: p.muscle,
      depth: 0,
      turn,
      q,
      told: facet ? [facet] : [],
    },
  };
}

/** One message → one answer (no splitting). */
function answerOne(question: string, c: AskCtx, convo: Convo): LocalAnswer | null {
  const p = parse(question, c);
  const { words, phrase } = p;
  if (!words.length) return null;
  const L: Tr = (en, uk) => (c.locale === 'uk' ? uk : en);
  const short = words.length <= 5;
  const turn = (convo.turn ?? 0) + 1;

  // ---- follow-ups on the current topic ----
  const cur = byId(convo.intent);
  if (cur && short) {
    const base = convo.q ? parse(convo.q, c) : p;
    const topic: Parsed = {
      ...base,
      exercise: convo.exercise ?? base.exercise,
      muscle: convo.muscle ?? base.muscle,
    };
    // A pending "which lift?" answered with just the lift/muscle — or
    // "and deadlift?" carrying the topic (and its time window) over.
    const entityOnly =
      (p.exercise || p.muscle) &&
      (convo.pending || groupMatches(words, phrase, FOLLOW_LEAD) || words.length <= 3);
    const carried: Parsed = { ...p, range: p.range ?? base.range };
    // Only topics about a lift/muscle carry over — and never when the message
    // is a question of its own ("squat technique", "bench vs squat").
    const ownQuestion = ALL_INTENTS().some(
      (it) =>
        it.id !== cur.id &&
        it.all.length > 0 &&
        it.all.every((g) => groupMatches(words, phrase, g)) &&
        hasNeeds(it, p),
    );
    if (entityOnly && cur.needs && (convo.pending || !ownQuestion) && hasNeeds(cur, carried)) {
      const core = cur.answer(c, carried, L);
      if (core) return build(cur, core, c, carried, question, L, convo, convo.q ?? question);
    }
    // "Why?" / "How?" / "When?"… on the current topic → that side of it.
    const fq = questionType(question);
    // The topic's own "why" (e.g. the lift-specific reason) beats the general one.
    const ownWhy = fq === 'why' && words.length <= 4 ? cur.why?.(c, topic, L) : null;
    const side =
      fq && words.length <= 4 && !ownQuestion && !ownWhy ? KB[cur.id]?.facets?.[fq] : undefined;
    if (fq && side) {
      const told = [...(convo.told ?? []), fq];
      return {
        intent: cur.id,
        text: L(side[0], side[1]),
        chips: withFacetChips(cur.id, told, chipsFor(cur.id, L), L),
        convo: { ...convo, told, turn },
      };
    }
    if (words.length <= 3 && groupMatches(words, phrase, ASK_WHY)) {
      const d = DEPTH[cur.id];
      const cp = topic;
      const why = cur.why?.(c, cp, L) ?? (d?.why ? L(d.why[0], d.why[1]) : null);
      if (why)
        return { intent: cur.id, text: why, chips: chipsFor(cur.id, L), convo: { ...convo, turn } };
      return {
        intent: cur.id,
        text: L(
          'That part is past what I know by heart.',
          'Тут я вже за межами того, що знаю напам’ять.',
        ),
        escalate: true,
        convo: { ...convo, turn },
      };
    }
    if (
      groupMatches(words, phrase, MORE) &&
      !ALL_INTENTS().some(
        (it) =>
          it.id !== cur.id &&
          it.all.every((g) => groupMatches(words, phrase, g)) &&
          it.all.length > 0 &&
          matchedWords(words, it.all) >= 2,
      )
    ) {
      const d = DEPTH[cur.id];
      const depth = convo.depth ?? 0;
      const cp = topic;
      const own = cur.more?.(c, cp, L, depth) ?? null;
      const layer = own ?? (d?.more[depth] ? L(d.more[depth][0], d.more[depth][1]) : null);
      if (layer)
        return {
          intent: cur.id,
          text: layer,
          chips: withFacetChips(cur.id, convo.told ?? [], chipsFor(cur.id, L), L),
          convo: { ...convo, depth: depth + 1, turn },
        };
      // Out of layers → the sides of the topic not told yet.
      const order: Facet[] = ['why', 'how', 'when', 'howMuch', 'should', 'what', 'who', 'where'];
      const next = order.find((x) => KB[cur.id]?.facets?.[x] && !(convo.told ?? []).includes(x));
      if (next) {
        const f = KB[cur.id]!.facets![next]!;
        const told = [...(convo.told ?? []), next];
        return {
          intent: cur.id,
          text: L(f[0], f[1]),
          chips: withFacetChips(cur.id, told, chipsFor(cur.id, L), L),
          convo: { ...convo, told, depth: depth + 1, turn },
        };
      }
      return {
        intent: cur.id,
        text: L(
          'That’s the core of it. Pick where to go next — or ask me something specific.',
          'Це суть. Обери, куди далі, — або спитай щось конкретне.',
        ),
        chips: chipsFor(cur.id, L),
        escalate: true,
        convo: { ...convo, depth: depth + 1, turn },
      };
    }
  }

  // ---- what you just told me (a sore knee, your goal, a lift you hate…) ----
  const learned = learn(words, phrase, c.mem, c.now, p.exercise, c.fmt.exercise);
  const hasLearned = Object.keys(learned.patch).length > 0;
  const cm: AskCtx = hasLearned ? { ...c, mem: mergeMemory(c.mem, learned.patch) } : c;
  const withLearned = (a: LocalAnswer | null): LocalAnswer | null => {
    if (!hasLearned) return a;
    const note = learned.note ? L(learned.note[0], learned.note[1]) : '';
    if (!a)
      return {
        intent: 'memory_note',
        text: note,
        learned: learned.patch,
        chips: [
          L('What do you know about me?', 'Що ти про мене знаєш?'),
          L('What should I train today?', 'Що тренувати сьогодні?'),
        ],
        convo: { intent: 'memory_note', depth: 0, turn },
      };
    return { ...a, text: note ? `${a.text}\n\n${note}` : a.text, learned: learned.patch };
  };

  // ---- a fresh question ----
  const negatedPain = negated(words, [...PAIN_WORDS, 'sick', 'ill', 'хвор*', 'захвор*']);
  const weight = (it: Intent) =>
    matchedWords(words, it.all) +
    (it.needs ? (it.needs === 'range' || it.needs === 'twoLifts' ? 4 : 2) : 0) +
    (it.action ? 3 : 0) +
    (it.id.startsWith('why_') ? 3 : 0) +
    (SMALL_NEW.has(it.id) ? 2 : 0) +
    (it.priority ? 100 : 0);
  const matchesGroups = (it: Intent) =>
    (!it.maxWords || words.length <= it.maxWords) &&
    !(it.negatable && negatedPain) &&
    it.all.every((g) => groupMatches(words, phrase, g));
  const candidates = ALL_INTENTS().filter(matchesGroups);
  const ranked = candidates.filter((it) => hasNeeds(it, p)).sort((a, b) => weight(b) - weight(a));

  // Understanding by example: the closest topic among ~7,000 real phrasings.
  // It leads when keywords found nothing, or only a weak, single-word hit.
  const allowed = (it: Intent) =>
    (!it.maxWords || words.length <= it.maxWords + 3) && !(it.negatable && negatedPain);
  const hits = retrieve(question).filter((h) => {
    const it = byId(h.id);
    return it && allowed(it);
  });
  const top = hits[0];
  const second = hits[1];
  const margin = top ? top.score - (second?.score ?? 0) : 0;
  const confident = !!top && top.score >= RET_MIN && margin >= RET_MARGIN;
  const byExample = confident ? byId(top.id) : undefined;
  const kwTop = ranked[0];
  const kwStrong =
    !!kwTop &&
    (!!kwTop.priority ||
      !!kwTop.action ||
      kwTop.needs === 'range' ||
      kwTop.needs === 'twoLifts' ||
      (POLICY.mode === 'mix' && matchedWords(words, kwTop.all) >= 2));
  // Understood by example → that topic leads. Unsure → only a strong keyword
  // hit may answer; otherwise we ask "did you mean…" instead of guessing.
  let order: Intent[] = [];
  // A keyword command with all its details ("move legs to thursday") still wins;
  // so does a "why…" topic for a why-question, and a solid keyword hit that the
  // examples also rank near the top.
  const qt = questionType(question);
  const commandReady = !!kwTop?.action && kwTop !== byExample && !!kwTop.action(cm, p);
  const whyTopic = qt === 'why' && !!kwTop?.id.startsWith('why_');
  // Near-tie between the two closest topics → the keyword hit breaks it.
  const agreed = !!kwTop && hits[1]?.id === kwTop.id && margin < 0.05;
  const lead =
    byExample && SPECIALIZE[byExample.id]?.(p) ? byId(SPECIALIZE[byExample.id]!(p)!) : byExample;
  if (lead && hasNeeds(lead, p) && !commandReady && !whyTopic && !(agreed && kwTop !== lead))
    order = [lead, ...ranked.filter((x) => x !== lead)];
  else if (kwStrong || POLICY.mode === 'kw' || (POLICY.mode === 'mix' && !byExample))
    order = ranked;
  else if (byExample) order = ranked;
  for (const it of order) {
    const core = it.answer(cm, p, L);
    if (!core) continue;
    const f = SMALLTALK_IDS.has(it.id) ? { text: core } : faceted(it.id, core, question, L);
    return withLearned(build(it, f.text, cm, p, question, L, convo, question, f.facet));
  }
  // Understood by example but misses the lift/muscle → ask for it.
  if (
    byExample &&
    !hasNeeds(byExample, p) &&
    (byExample.needs === 'exercise' || byExample.needs === 'muscle')
  )
    candidates.unshift(byExample);
  // Knows the topic, misses the lift/muscle → ask, with your lifts as chips.
  const needy = candidates
    .filter((it) => it.needs === 'exercise' || it.needs === 'muscle')
    .sort((a, b) => weight(b) - weight(a))[0];
  if (needy && !hasLearned) {
    const chips =
      needy.needs === 'exercise'
        ? loggedLifts(c)
            .sort((a, b) => b.count - a.count)
            .slice(0, 4)
            .map((x) => c.fmt.exercise(x.name))
        : (['chest', 'lats', 'shoulders', 'quads'] as MuscleGroup[]).map((m) => c.fmt.muscle(m));
    return {
      intent: needy.id,
      text:
        needy.needs === 'exercise'
          ? L('Which lift?', 'Яка вправа?')
          : L('Which muscle?', 'Який м’яз?'),
      chips,
      convo: { intent: needy.id, pending: true, depth: 0, turn },
    };
  }
  // Close, but not sure enough to answer → offer the closest topics.
  if (!hasLearned && top && top.score >= RET_NEAR) {
    const near = hits.filter((h) => h.score >= RET_NEAR * 0.8 && ASKS[h.id]).slice(0, 3);
    if (near.length)
      return {
        intent: 'did_you_mean',
        text: L(
          'Not sure I got that. Did you mean:',
          'Не впевнений, що зрозумів. Ти мав на увазі:',
        ),
        chips: near.map((h) => L(ASKS[h.id][0], ASKS[h.id][1])),
        escalate: true,
        convo: { ...convo, turn },
      };
  }
  return withLearned(null);
}

/** A general topic that has a sharper sibling when the question names a lift. */
const SPECIALIZE: Record<string, (p: Parsed) => string | null> = {
  technique: (p) => (p.exercise ? 'technique_lift' : null),
  squat_form: (p) => (p.exercise && !/squat|присід/i.test(p.exercise) ? 'technique_lift' : null),
};

/** Retrieval thresholds (0..1). */
let RET_MIN = 0.3;
let RET_MARGIN = 0.035;
let RET_NEAR = 0.2;
export const POLICY: { mode: 'mix' | 'ret' | 'kw' } = { mode: 'mix' };
export function __tune(t: { min?: number; margin?: number; near?: number }) {
  RET_MIN = t.min ?? RET_MIN;
  RET_MARGIN = t.margin ?? RET_MARGIN;
  RET_NEAR = t.near ?? RET_NEAR;
}

const SPLIT_RE = /\?+\s*|\s+(?:and also|also|а ще|і ще|плюс)\s+/i;

/**
 * "Did you mean…": the closest topics when nothing fits for sure — scored by
 * how many keyword groups match (partially) and how specific the words are.
 */
export function didYouMean(question: string, c: AskCtx): { id: string; ask: string }[] {
  const words = tokens(question);
  const phrase = normalize(question);
  if (!words.length) return [];
  const L: Tr = (en, uk) => (c.locale === 'uk' ? uk : en);
  // Closest by example first; keyword overlap fills in.
  const near = retrieve(question, 6).filter(
    (h) => h.score >= 0.2 && ASKS[h.id] && !byId(h.id)?.maxWords,
  );
  if (near.length)
    return near.slice(0, 3).map((h) => ({ id: h.id, ask: L(ASKS[h.id][0], ASKS[h.id][1]) }));
  const scored: { id: string; score: number }[] = [];
  for (const it of ALL_INTENTS()) {
    const ask = ASKS[it.id];
    if (!ask || it.maxWords) continue;
    const hit = it.all.filter((g) => groupMatches(words, phrase, g)).length;
    if (!hit) continue;
    const mw = matchedWords(words, it.all);
    scored.push({ id: it.id, score: hit / it.all.length + mw * 0.3 });
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => ({ id: x.id, ask: L(ASKS[x.id][0], ASKS[x.id][1]) }));
}

/**
 * Answer from Atlas's own base, following the conversation. Null → nothing
 * fits: hand over to Gemini (or say so). Two questions in one message get two
 * answers; Latin-typed Ukrainian gets a second try in Cyrillic; Polish,
 * Lithuanian, Estonian and Russian are mapped onto known words first.
 */
export function answerLocally(question: string, c: AskCtx, convo: Convo = {}): LocalAnswer | null {
  const L: Tr = (en, uk) => (c.locale === 'uk' ? uk : en);
  const emoji = emojiReply(c, question, L);
  if (emoji)
    return { intent: 'emoji', text: emoji, convo: { ...convo, turn: (convo.turn ?? 0) + 1 } };
  const parts = question
    .split(SPLIT_RE)
    .map((x) => x.trim())
    .filter((x) => tokens(x).length >= 2);
  if (parts.length >= 2) {
    let state = convo;
    const got: LocalAnswer[] = [];
    for (const part of parts.slice(0, 3)) {
      const a = answerOne(part, c, state);
      if (a) {
        got.push(a);
        state = a.convo;
      }
    }
    if (got.length >= 2) {
      const last = got[got.length - 1];
      const learned = got.reduce<AtlasMemory | undefined>(
        (m, g) => (g.learned ? mergeMemory(m, g.learned) : m),
        undefined,
      );
      return {
        ...last,
        text: got.map((g) => g.text).join('\n\n'),
        escalate: false,
        learned,
        action: got.find((g) => g.action)?.action,
        chart: got.find((g) => g.chart)?.chart,
      };
    }
  }
  const direct = answerOne(question, c, convo);
  if (direct) return direct;
  const known = toKnownLanguage(question);
  if (known && known !== question) {
    const a = answerOne(known, c, convo);
    if (a) return a;
  }
  if (!hasCyrillic(question) && /[a-z]/i.test(question)) {
    const uk = answerOne(translitToUk(question), { ...c, locale: c.locale }, convo);
    if (uk) return uk;
  }
  return null;
}
