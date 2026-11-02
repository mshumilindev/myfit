/**
 * SPO-35 P9 — gaps the second long conversation found: small definitions ("what is a rep"),
 * "a good back day", a few app how-tos (theme, where the program is, where my data is, glitches),
 * gym prices and "but I paid for the gym". Labels are the app's own (i18n en/uk), so Atlas
 * never invents a button. Understood by example: `P9_EX` rides into the understanding index.
 */
import type { Intent } from './intentKit';

interface Topic {
  id: string;
  keys: string[][];
  answer: [string, string];
  ex: string[];
  exUk: string[];
}

const DAY = (
  id: string,
  keys: string[],
  en: string,
  uk: string,
  ex: string[],
  exUk: string[],
): Topic => ({
  id,
  keys: [
    keys,
    ['day', 'workout', 'день', 'тренування'],
    [
      'good',
      'best',
      'idea',
      'ideas',
      'suggest',
      'give',
      'хороший',
      'хороше',
      'найкращий',
      'ідеї',
      'підбери',
      'що робити',
    ],
  ],
  answer: [en, uk],
  ex,
  exUk,
});

const TOPICS: Topic[] = [
  {
    id: 'def_rep',
    keys: [
      ['rep', 'reps', 'repetition', 'повтор', 'повторення'],
      ['what', 'meaning', 'define', 'що таке', 'що означає'],
    ],
    answer: [
      'A rep is one full lift of a movement: down and up once. A set is a run of reps without putting the weight down — “3 × 8” means three sets of eight reps.',
      'Повтор — один повний рух: вниз і вгору. Підхід (сет) — серія повторів без паузи; «3 × 8» — три підходи по вісім повторів.',
    ],
    ex: [
      'what is a rep',
      'what does rep mean',
      'what is a repetition',
      'define rep',
      'whats a rep in the gym',
      'meaning of reps',
    ],
    exUk: [
      'що таке повтор',
      'що таке повторення',
      'що означає повтор',
      'поясни що таке повтор у залі',
    ],
  },
  {
    id: 'def_set',
    keys: [
      ['set', 'sets', 'підхід', 'сет'],
      ['what is a set', 'what does set mean', 'що таке підхід', 'що таке сет'],
    ],
    answer: [
      'A set is a group of reps done in a row, then a rest. A working set is one that is hard (the last reps close to failure); warm-up sets are lighter and don’t count.',
      'Підхід (сет) — кілька повторів поспіль, потім відпочинок. Робочий підхід — важкий (останні повтори біля відмови); розминкові легші й не рахуються.',
    ],
    ex: [
      'what is a set',
      'what does set mean in the gym',
      'what is a working set',
      'define set',
      'whats a warm up set',
    ],
    exUk: ['що таке підхід', 'що таке сет', 'що таке робочий підхід', 'що означає сет'],
  },
  DAY(
    'sug_back_day',
    ['back', 'спина', 'спини', 'спину'],
    'A back day: a vertical pull (pull-ups or lat pulldown) 3 × 6–10, a row (barbell, cable or dumbbell) 3 × 8–12, a second row or a rear-delt move 2–3 × 10–15, then biceps. Start with the heaviest lift.',
    'День спини: вертикальна тяга (підтягування чи верхній блок) 3 × 6–10, тяга в нахилі (штанга, блок чи гантель) 3 × 8–12, ще одна тяга чи задня дельта 2–3 × 10–15, потім біцепс. Починай з найважчого.',
    ['whats a good back workout', 'suggest a back workout', 'give me a back workout'],
    ['підбери тренування на спину', 'хороше тренування на спину'],
  ),
  DAY(
    'sug_chest_day',
    ['chest', 'груди', 'грудей'],
    'A chest day: a press (bench or dumbbell) 3–4 × 6–10, an incline press 3 × 8–12, a fly or cable cross 2–3 × 12–15, then triceps. Start with the heaviest press.',
    'День грудей: жим (штанга чи гантелі) 3–4 × 6–10, жим на похилій 3 × 8–12, розведення чи кросовер 2–3 × 12–15, потім тріцепс. Починай з найважчого жиму.',
    ['whats a good chest workout', 'suggest a chest workout', 'give me a chest workout'],
    ['підбери тренування на груди', 'хороше тренування на груди'],
  ),
  DAY(
    'sug_leg_day',
    ['leg', 'legs', 'ноги', 'ніг'],
    'A leg day: a squat or leg press 3–4 × 6–10, a hip hinge (Romanian deadlift) 3 × 8–10, a lunge or split squat 2–3 × 10 per leg, a hamstring curl and calves 2–3 × 10–15.',
    'День ніг: присід чи жим ногами 3–4 × 6–10, тяга на прямих (румунська) 3 × 8–10, випади чи болгарський присід 2–3 × 10 на ногу, згинання ніг і литки 2–3 × 10–15.',
    ['whats a good leg workout', 'suggest a leg workout', 'give me a leg workout'],
    ['підбери тренування на ноги', 'хороше тренування на ноги'],
  ),
  {
    id: 'app_theme',
    keys: [
      ['theme', 'themes', 'тема', 'тему', 'теми', 'темі'],
      ['change', 'switch', 'set', 'pick', 'dark', 'змінити', 'поміняти', 'обрати', 'де'],
    ],
    answer: [
      'Open Today and tap “Themes”, pick a look and tap “Apply”.',
      'Відкрий «Сьогодні» і натисни «Теми», обери вигляд і натисни «Застосувати».',
    ],
    ex: [
      'how do i change the theme',
      'where are the themes',
      'change app theme',
      'how to switch theme',
      'how to get dark mode',
      'can i change the look of the app',
    ],
    exUk: [
      'як змінити тему',
      'де теми',
      'змінити тему додатку',
      'як поміняти тему',
      'як змінити оформлення',
      'як увімкнути темну тему',
    ],
  },
  {
    id: 'app_program_where',
    keys: [
      ['program', 'programs', 'програма', 'програму', 'програми'],
      ['where', 'find', 'де', 'знайти'],
    ],
    answer: [
      'Your program is in Overview → Programs; on Today the card “Today in program” starts the day it planned.',
      'Твоя програма — в «Огляд» → «Програми»; на «Сьогодні» картка «Сьогодні за програмою» запускає запланований день.',
    ],
    ex: ['where do i find my program'],
    exUk: ['де знайти мою програму'],
  },
  {
    id: 'app_where_data',
    keys: [
      ['my data', 'мої дані', 'моїх даних'],
      ['where', 'find', 'де', 'знайти'],
    ],
    answer: [
      'Your sessions are on Today (“See all history”); records and progress are in Overview. Everything syncs to every device you sign in on.',
      'Твої тренування — на «Сьогодні» («Уся історія»); рекорди й прогрес — в «Огляд». Усе синхронізується на кожен пристрій, де ти входиш.',
    ],
    ex: ['where is my data'],
    exUk: ['де мої дані'],
  },
  {
    id: 'app_glitch',
    keys: [
      [
        'glitch',
        'glitchy',
        'bug',
        'buggy',
        'broken',
        'crashes',
        'глючить',
        'глюк',
        'лагає',
        'тупить',
        'зависає',
      ],
      ['app', 'spotter', 'додаток', 'застосунок'],
    ],
    answer: [
      'Sorry about that. Check the sync status at the top of Today — if it says Offline, changes wait and are sent when the network is back. Reload the page or reopen the app. If it still misbehaves, tell your admin or trainer what you did and what you saw — I can’t file a bug report myself.',
      'Вибач за це. Глянь на статус синку вгорі «Сьогодні» — якщо «Офлайн», зміни чекають і відправляться, коли з’явиться мережа. Перезавантаж сторінку чи відкрий застосунок заново. Якщо не минає — розкажи адміну чи тренеру, що робив і що побачив: звіт про помилку я надіслати не можу.',
    ],
    ex: [
      'the app is glitchy',
      'the app keeps crashing',
      'app is not working',
      'something is broken in the app',
      'the app is laggy',
    ],
    exUk: [
      'застосунок глючить',
      'додаток глючить',
      'додаток лагає',
      'апка зависає',
      'щось зламалось у додатку',
    ],
  },
  {
    id: 'gym_price',
    keys: [
      ['membership', 'абонемент', 'абонементу'],
      ['cost', 'price', 'how much', 'коштує', 'ціна', 'вартість'],
    ],
    answer: [
      'Prices are set by your gym — I can’t see them. Ask the front desk; I’m here for what happens under the bar.',
      'Ціни встановлює твій зал — я їх не бачу. Спитай на рецепції; я за те, що відбувається під штангою.',
    ],
    ex: [
      'how much is a gym membership',
      'how much does the gym cost',
      'gym price',
      'what is the price of a membership',
    ],
    exUk: [
      'скільки коштує абонемент',
      'скільки коштує зал',
      'яка ціна абонемента',
      'вартість абонемента в зал',
    ],
  },
  {
    id: 'paid_gym',
    keys: [
      ['paid', 'заплатив', 'заплатила', 'оплатив'],
      ['gym', 'зал', 'абонемент'],
    ],
    answer: [
      'Then you already did the hard part. Go in, warm up, do just the first big lift — 10 minutes — and decide after. The money is spent either way; the session is the only thing you still control.',
      'Тоді найважче вже зроблено. Зайди, розімнись, зроби першу велику вправу — 10 хвилин — і тоді вирішуй. Гроші витрачені так чи так; керувати лишилося тільки тренуванням.',
    ],
    ex: [
      'but i paid for the gym',
      'i already paid for my membership',
      'i paid for the gym but dont want to go',
    ],
    exUk: ['але я заплатив за зал', 'я ж заплатив за абонемент', 'заплатив за зал а йти не хочу'],
  },
];

export const INTENTS_P9: Intent[] = TOPICS.map((t) => ({
  id: t.id,
  all: t.keys,
  neutral: true,
  answer: (_c, _p, L) => L(t.answer[0], t.answer[1]),
}));

export const P9_EX: Record<string, { ex: string[]; exUk: string[] }> = Object.fromEntries(
  TOPICS.map((t) => [t.id, { ex: t.ex, exUk: t.exUk }]),
);
