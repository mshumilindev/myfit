/**
 * SPO-35 P12 — small talk and chaos the second long conversation found: "can you help me get stronger",
 * "i wanna get jacked", "idk", "what should I start with", "set a timer for 90 seconds".
 * New topics answer from here; extra phrasings for topics that already exist ride in `P12_MORE`
 * (concatenated with theirs in kb/index.ts). General training guidance only — no numbers about the person.
 */
import type { Intent } from './intentKit';

interface Topic {
  id: string;
  keys: string[][];
  answer: [string, string];
  maxWords?: number;
  ex: string[];
  exUk: string[];
  suggest?: [string[], string[]];
}

const TOPICS: Topic[] = [
  {
    id: 'get_jacked',
    keys: [['jacked', 'ripped', 'swole', 'shredded', 'здоровилом', 'накачаним', 'нашпигованим']],
    answer: [
      'Jacked is mostly consistency: 3–4 sessions a week, 8–12 reps close to failure, add weight or a rep over time, enough protein, a small calorie surplus and sleep. The log shows the progress before the mirror does. Want a plan for it?',
      'Накачаний — це здебільшого регулярність: 3–4 тренування на тиждень, 8–12 повторів майже до відмови, поступово додавай вагу чи повтор, достатньо білка, невеликий профіцит калорій і сон. Журнал покаже прогрес раніше за дзеркало. Скласти план?',
    ],
    ex: [
      'i wanna get jacked',
      'i want to get jacked',
      'how do i get jacked',
      'i want to look ripped',
      'how to get swole',
    ],
    exUk: ['хочу стати накачаним', 'як стати накачаним', 'хочу бути здоровилом', 'хочу накачатись'],
    suggest: [
      ['Make me a 4 day plan', 'How much protein do I need?'],
      ['Склади план на 4 дні', 'Скільки білка мені треба?'],
    ],
  },
  {
    id: 'idk',
    keys: [
      [
        'idk',
        'dunno',
        'i dont know',
        'i do not know',
        'dont know',
        'no idea',
        'не знаю',
        'без поняття',
      ],
    ],
    maxWords: 3,
    answer: [
      'No rush. If you are not sure what to ask: what to train today, the next weight on a lift, or how you are progressing. Pick one or just say what is on your mind.',
      'Не поспішай. Якщо не знаєш, що спитати: що тренувати сьогодні, яка наступна вага у вправі або як іде прогрес. Обери одне чи просто скажи, що в голові.',
    ],
    ex: [
      'idk',
      'i dont know',
      'i do not know',
      'i do not know what to ask',
      'do not know',
      'dunno',
      'not sure what to ask',
      'no idea',
    ],
    exUk: ['не знаю', 'без поняття', 'не знаю що спитати'],
    suggest: [
      ['What should I train today?', 'How is my progress?'],
      ['Що тренувати сьогодні?', 'Як мій прогрес?'],
    ],
  },
];

export const INTENTS_P12: Intent[] = TOPICS.map((t) => ({
  id: t.id,
  all: t.keys,
  neutral: true,
  maxWords: t.maxWords,
  answer: (_c, _p, L) => L(t.answer[0], t.answer[1]),
  suggest: t.suggest ? (L) => t.suggest![0].map((en, i) => L(en, t.suggest![1][i])) : undefined,
}));

/** New topics: phrasings for the understanding index. */
export const P12_EX: Record<string, { ex: string[]; exUk: string[] }> = Object.fromEntries(
  TOPICS.map((t) => [t.id, { ex: t.ex, exUk: t.exUk }]),
);

/** Extra phrasings for topics that already exist (beginner, app_rest_timer). */
export const P12_MORE: Record<string, { ex: string[]; exUk: string[] }> = {
  beginner: {
    ex: ['what should i start with', 'where do i even start', 'what do i begin with'],
    exUk: ['з чого мені почати', 'з чого починати'],
  },
  app_rest_timer: {
    ex: ['set a timer for 90 seconds', 'start a timer for 2 minutes', 'can you set a rest timer'],
    exUk: ['постав таймер на 90 секунд', 'постав таймер на 2 хвилини'],
  },
};
