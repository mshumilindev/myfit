/**
 * SPO-35 P20 — opinions, lifestyle and app questions the third long conversation found: "what do you think about crossfit",
 * "i have a desk job", "my girlfriend says I spend too much time at the gym", "what is the best exercise ever", "where are my achievements".
 * New topics answer from here; extra phrasings for topics that already exist ride in `P20_MORE`
 * (concatenated with theirs in kb/index.ts). General training guidance only — no numbers about the person.
 */
import type { Intent, Tr } from './intentKit';

interface Topic {
  id: string;
  keys: string[][];
  answer: [string, string];
  maxWords?: number;
  ex: string[];
  exUk: string[];
  suggest?: [string[], string[]];
}

const SUG: [string[], string[]] = [
  ['What should I train today?', 'How is my progress?'],
  ['Що тренувати сьогодні?', 'Як мій прогрес?'],
];

const TOPICS: Topic[] = [
  {
    id: 'crossfit',
    keys: [['crossfit', 'кросфіт', 'кроссфит']],
    answer: [
      'CrossFit mixes lifting, gymnastics and conditioning at high intensity. It builds fitness fast, but the constant variety makes steady strength progress hard to track, and injury risk grows when speed beats technique. If you love it, keep a couple of heavy lifting days and scale the rest.',
      'CrossFit поєднує підйом ваги, гімнастику й кондиційні вправи на високій інтенсивності. Він швидко розвиває форму, але постійна різноманітність ускладнює стабільний ріст сили, а ризик травм росте, коли швидкість важить більше за техніку. Якщо тобі подобається — лиши пару важких силових днів, а решту масштабуй.',
    ],
    ex: [
      'what do you think about crossfit',
      'is crossfit good',
      'is crossfit bad for you',
      'crossfit or lifting',
      'should i do crossfit',
      'crossfit vs bodybuilding',
    ],
    exUk: ['що думаєш про кросфіт', 'кросфіт корисний', 'кросфіт чи силові'],
    suggest: SUG,
  },
  {
    id: 'desk_job',
    keys: [
      [
        'desk job',
        'office job',
        'sedentary',
        'sit all day',
        'sitting all day',
        'сидяча робота',
        'офісна робота',
      ],
    ],
    answer: [
      'A desk job mostly costs you movement. Stand up and walk a few minutes every hour, add rows and face pulls for the upper back, and some mobility for hips and neck. Train as usual — sitting is not a reason to train less.',
      'Офісна робота здебільшого коштує тобі руху. Вставай і ходи кілька хвилин щогодини, додай тяги й face pull для верху спини та трохи мобільності для стегон і шиї. Тренуйся як звичайно — сидіння не привід тренуватись менше.',
    ],
    ex: [
      'i have a desk job',
      'i sit all day at work',
      'i have an office job what should i do',
      'sitting all day is it bad for me',
      'sedentary job how to train',
    ],
    exUk: ['у мене офісна робота', 'сидяча робота як тренуватись'],
    suggest: SUG,
  },
  {
    id: 'gym_too_much',
    keys: [
      ['too much', 'too long', 'too many hours', 'забагато', 'занадто довго'],
      ['gym', 'залі', 'залу', 'в залі'],
    ],
    answer: [
      'There is no magic number, but a session that drags well past an hour is mostly padding. Hard sets, enough rest and energy left for the rest of your life beat more hours. If it costs you relationships, shorter and tighter sessions are a fair trade.',
      'Чарівного числа немає, але тренування, що тягнеться значно довше години, здебільшого — вода. Важкі підходи, достатній відпочинок і сили на решту життя цінніші за більше годин. Якщо це коштує стосунків — коротші й чіткіші тренування чесний обмін.',
    ],
    ex: [
      'my girlfriend says i spend too much time at the gym',
      'am i spending too much time at the gym',
      'do i train too long',
    ],
    exUk: [
      'дівчина каже я забагато часу в залі',
      'я занадто довго тренуюсь',
      'чи 2 години в залі забагато',
    ],
    suggest: SUG,
  },
  {
    id: 'best_exercise',
    keys: [
      [
        'best exercise',
        'best exercises',
        'best lift',
        'best lifts',
        'найкраща вправа',
        'найкращі вправи',
      ],
    ],
    answer: [
      'There is no single best exercise. The best ones are big compound lifts you can do safely and progress on: squat, deadlift, bench or overhead press, rows and pull-ups. Pick the variation that suits your body and stick with it.',
      'Єдиної найкращої вправи немає. Найкращі — великі базові рухи, які ти можеш робити безпечно й прогресувати в них: присід, станова, жим лежачи чи стоячи, тяги й підтягування. Обери варіант, що пасує твоєму тілу, і тримайся його.',
    ],
    ex: [
      'what is the best exercise ever',
      'what is the best exercise',
      'which exercise is the best',
    ],
    exUk: ['яка найкраща вправа', 'яка вправа найкраща в світі', 'якби робити лише одну вправу'],
    suggest: SUG,
  },
  {
    id: 'spotter_need',
    keys: [['spotter']],
    answer: [
      'For heavy bench or squats close to failure, yes if you can: a spotter, or safety pins in the rack. On easy sets you do not need one.',
      'Для важкого жиму чи присіду біля відмови — так, якщо є можливість: страхувальник або запобіжні упори в стійці. На легких підходах він не потрібен.',
    ],
    ex: [],
    exUk: [],
    suggest: SUG,
  },
  {
    id: 'stop_cutting',
    keys: [['stop cutting']],
    answer: [
      'Stop when you reach your goal, or earlier if strength, sleep and mood keep sliding for a couple of weeks. Then eat at maintenance for a while (a diet break) rather than cutting forever.',
      'Зупиняйся, коли досягнеш цілі, або раніше, якщо сила, сон і настрій кілька тижнів поспіль падають. Потім побудь на підтримці (перерва від дієти), а не сушись без кінця.',
    ],
    ex: [],
    exUk: [],
    suggest: SUG,
  },
  {
    id: 'whey_daily',
    keys: [['whey']],
    answer: [
      'Yes, whey is just protein from milk, so it is fine every day if it helps you reach your daily protein. If it upsets your stomach, try whey isolate or a plant protein.',
      'Так, вей — це просто білок із молока, тож щодня можна, якщо він допомагає добрати білок за день. Якщо шлунок бунтує, спробуй ізолят або рослинний протеїн.',
    ],
    ex: [],
    exUk: [],
    suggest: SUG,
  },
  {
    id: 'app_awards',
    keys: [
      [
        'achievements',
        'achievement',
        'awards',
        'badges',
        'trophies',
        'нагороди',
        'досягнення',
        'бейджі',
      ],
      ['where', 'how', 'find', 'see', 'show', 'де', 'як', 'побачити'],
    ],
    answer: [
      'Open Apps → Apex → “Awards”: it lists the achievements you have unlocked. The bell there opens your milestones feed.',
      'Відкрий Додатки → Apex → «Нагороди»: там список розблокованих досягнень. Дзвіночок там відкриває стрічку віх.',
    ],
    ex: [
      'where are my achievements',
      'where can i see my badges',
      'how do i see my awards',
      'show my trophies',
      'where do i find achievements',
    ],
    exUk: ['де мої досягнення', 'де побачити мої нагороди', 'де мої бейджі'],
    suggest: SUG,
  },
];

export const INTENTS_P20: Intent[] = TOPICS.map((t) => ({
  id: t.id,
  all: t.keys,
  neutral: true,
  maxWords: t.maxWords,
  answer: (_c, _p, L) => L(t.answer[0], t.answer[1]),
  suggest: t.suggest ? (L) => t.suggest![0].map((en, i) => L(en, t.suggest![1][i])) : undefined,
}));

/** New topics: phrasings for the understanding index. */

const REPS_RE =
  /(?<!\p{L})(how many|how few|what|which)( \w+)? reps?( \w+){0,3} (for|to build|to get|when training for)( \w+)? (strength|size|muscle( growth| mass)?|hypertrophy|endurance|stamina)(?!\p{L})/iu;
const REPS_FOLLOW_RE =
  /^\s*(and|so|what about|how about)\s+(for\s+)?(strength|size|muscle( growth| mass)?|hypertrophy|endurance|stamina)\s*\??\s*$/iu;

/** "how many reps for strength" / "and for size": the rep range of the goal named. */
export function repsGoal(
  question: string,
  intent: string | undefined,
  L: Tr,
): { intent: string; text: string } | null {
  const m =
    REPS_RE.exec(question) ?? (intent === 'reps_goal' ? REPS_FOLLOW_RE.exec(question) : null);
  if (!m) return null;
  const goal = (m[m.length - 3] ?? m[3] ?? '').toLowerCase();
  const g = /strength/.test(question.toLowerCase())
    ? 'strength'
    : /endur|stamina/.test(question.toLowerCase())
      ? 'endurance'
      : 'size';
  void goal;
  if (g === 'strength')
    return {
      intent: 'reps_goal',
      text: L(
        'For strength: 3–6 reps a set with heavy weight and full rest, every rep still clean.',
        'Для сили: 3–6 повторів у підході з важкою вагою й повним відпочинком, кожен повтор чистий.',
      ),
    };
  if (g === 'endurance')
    return {
      intent: 'reps_goal',
      text: L(
        'For endurance: 12–20 reps a set with shorter rest.',
        'Для витривалості: 12–20 повторів у підході з коротшим відпочинком.',
      ),
    };
  return {
    intent: 'reps_goal',
    text: L(
      'For size: 6–12 reps a set, the last 1–2 hard. Add weight or a rep over time.',
      'Для розміру: 6–12 повторів у підході, останні 1–2 важкі. З часом додавай вагу чи повтор.',
    ),
  };
}

const U = (re: string) => new RegExp(re, 'iu');
const ROUTES_P20: [string, RegExp, RegExp | null][] = [
  ['spotter_need', U('(do|should) i need a spotter|чи потрібен (мені )?страхувальник'), null],
  [
    'stop_cutting',
    U(
      'when (should|do) i (stop|end|finish) (cutting|my cut|dieting)|коли (припиняти|закінчувати) (сушку|дієту)',
    ),
    null,
  ],
  [
    'whey_daily',
    U(
      '(?<!\\p{L})is (whey|protein powder|protein shakes?)( protein)? (every ?day |daily )?(ok|safe|fine|bad|okay)(?!\\p{L})',
    ),
    null,
  ],
  ['crossfit', U('(?<!\\p{L})(crossfit|кросфіт|кроссфит)(?!\\p{L})'), null],
  [
    'desk_job',
    U(
      '(?<!\\p{L})(desk job|office job|sedentary (job|work)|sit(ting)? all day|сидяч\\p{L}* робот|офісн\\p{L}* робот)',
    ),
    null,
  ],
  [
    'gym_too_much',
    U('(too (much|long|many hours)|забагато|занадто довго)'),
    U('(?<!\\p{L})(gym|залі|залу)(?!\\p{L})'),
  ],
  [
    'best_exercise',
    U('(?<!\\p{L})(best|найкращ\\p{L}*) (exercise|exercises|lift|lifts|вправ\\p{L}*)(?! for)'),
    null,
  ],
  [
    'app_awards',
    U('(achievements?|badges?|awards?|trophies|досягнен|нагород|бейдж)'),
    U('(?<!\\p{L})(where|how|find|see|show|де|як|побач\\p{L}*)(?!\\p{L})'),
  ],
];

/** A narrower question ("best exercises for core", "stretches for sitting all day") is not these topics. */
const NARROW_RE =
  /(?<!\p{L})(for|на|для|stretch\p{L}*|help\p{L}*|tight|hip|розтяж\p{L}*)(?!\p{L})/iu;

/** Opinions, lifestyle and app pointers — explicit routes (the base is at its limit). */
export function p20Topic(question: string, L: Tr): { intent: string; text: string } | null {
  if (
    /(?<!\p{L})(my|мій|моя|мої|мою)(?!\p{L})/iu.test(question) &&
    !/achievements|badges|awards|trophies|досягнен|нагород|бейдж|girlfriend|wife/iu.test(question)
  )
    return null;
  for (const [id, re, also] of ROUTES_P20) {
    if (!re.test(question) || (also && !also.test(question))) continue;
    if ((id === 'best_exercise' || id === 'desk_job') && NARROW_RE.test(question)) continue;
    const t = TOPICS.find((x) => x.id === id);
    if (t) return { intent: id, text: L(t.answer[0], t.answer[1]) };
  }
  return null;
}
