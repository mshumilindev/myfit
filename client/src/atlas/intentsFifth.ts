/**
 * Atlas's answer base, part five — the "AI chat" layer:
 *  - memory: what he knows about you, forgetting on request;
 *  - actions (confirmed with a tap): rest, swap, drop a lift, move a day,
 *    start a workout, change temper, mute, log bodyweight;
 *  - time windows: "last 3 months", "since June", "last week";
 *  - comparisons: lift vs lift, then vs now;
 *  - charts under answers;
 *  - reasons behind the plan: why today, why this weight, why this split.
 */
import { est1rm, muscleSetsInWorkout, setTopWeight, setTypeOf } from '../store';
import type { Workout } from '../types';
import { nextTarget, topHistory } from '../progression';
import { muscleReadiness } from '../recovery';
import { computePlaybook, playForWeekday } from '../playbook';
import { usualSessionsPerWeek } from './facts';
import { isDeloadWeek, planDayFor } from './plan';
import { describeMemory, soreFor } from './memory';
import { isBodyweightLift, liftPoints } from './liftStats';
import { SORE_CAP } from './memoryPlan';
import { groupMatches } from './nlu';
import { TEMPERS, type Temper } from './types';
import {
  DAY,
  WEEK,
  finishedOf,
  loggedLifts,
  wd,
  type AskCtx,
  type Chart,
  type Intent,
  type Parsed,
  type Tr,
} from './intentKit';

// ---- shared helpers -----------------------------------------------------------

const WHY = ['why', 'how come', 'чому', 'чого', 'навіщо', 'нащо', 'почему', 'зачем'];
const WORKOUT = [
  'workout*',
  'session*',
  'training',
  'trained',
  'train',
  'gym',
  'тренуван*',
  'тренувал*',
  'заняття',
  'зал',
  'тренировк*',
  'трен*',
];
const HOW_MANY = ['how much', 'how many', 'how often', 'скільки', 'сколько', 'як часто'];

const nums = (phrase: string) =>
  (phrase.match(/\d+(?:[.,]\d+)?/g) ?? []).map((x) => Number(x.replace(',', '.')));

/** Best estimated 1RM of a lift in one session (0 if none). */
function sessionE1(w: Workout, name: string): number {
  const ex = w.exercises.find((e) => e.name === name);
  let best = 0;
  for (const s of ex?.sets ?? [])
    if (setTypeOf(s) !== 'warmup' && (s.weight ?? 0) > 0 && s.reps >= 1 && s.reps <= 12)
      best = Math.max(best, est1rm(setTopWeight(s), s.reps));
  return best;
}

/** Progress per session for a lift (e1RM kg, or reps for bodyweight lifts), oldest first. */
export function e1Series(c: AskCtx, name: string, from = 0, to = Infinity) {
  const pts = liftPoints(c, name);
  const bw = isBodyweightLift(pts);
  return pts
    .filter((x) => x.bw === bw && x.ts >= from && x.ts < to)
    .map((x) => ({ at: x.ts, v: x.score }));
}

/** Chart for one lift: estimated max in kg, or reps for bodyweight lifts. */
function liftChart(c: AskCtx, name: string, points: { at: number; v: number }[], L: Tr) {
  return isBodyweightLift(liftPoints(c, name))
    ? { title: L('Best reps', 'Найбільше повторів'), unit: '', points }
    : { title: L('Estimated max', 'Розрахунковий максимум'), unit: 'kg', points };
}

/** Best e1RM of a lift in a window. */
function bestE1(c: AskCtx, name: string, from: number, to: number): number {
  return Math.max(0, ...e1Series(c, name, from, to).map((x) => x.v));
}

const topLifts = (c: AskCtx, n: number) =>
  loggedLifts(c)
    .sort((a, b) => b.count - a.count)
    .slice(0, n)
    .map((x) => x.name);

const kgs = (c: AskCtx, v: number) => c.fmt.kg(Math.round(v * 2) / 2);
const pct = (a: number, b: number) => (b > 0 ? Math.round(((a - b) / b) * 100) : 0);
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n)}`;

/** Sessions per week, for a window (chart). */
function weeklyCounts(c: AskCtx, from: number, to: number): Chart['points'] {
  const f = finishedOf(c);
  const out: Chart['points'] = [];
  for (let t = from; t < to; t += WEEK)
    out.push({ at: t, v: f.filter((w) => w.startedAt >= t && w.startedAt < t + WEEK).length });
  return out;
}

function parseSeconds(phrase: string): number | null {
  const mmss = phrase.match(/(\d{1,2}):(\d{2})/);
  if (mmss) return Number(mmss[1]) * 60 + Number(mmss[2]);
  const min = phrase.match(
    /(\d+(?:[.,]\d+)?)\s*(min|mins|minute\S*|хв\S*|мин\S*|minut\S*|minuč\S*)/,
  );
  if (min) return Math.round(Number(min[1].replace(',', '.')) * 60);
  const sec = phrase.match(/(\d+)\s*(s|sec|secs|second\S*|с|сек\S*|секунд\S*|sek\S*)\b/);
  if (sec) return Number(sec[1]);
  return null;
}
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// Plan-day words ("move legs to Thursday").
const DAY_WORDS: [string, string[]][] = [
  ['legs', ['legs', 'leg', 'ноги', 'ніг', 'ног', 'ноги', 'нижн*']],
  ['push', ['push', 'пуш', 'жимов*']],
  ['pull', ['pull', 'пул', 'тягов*']],
  ['upper', ['upper', 'верх', 'верхн*']],
  ['lower', ['lower', 'низ', 'низу']],
  ['full', ['full', 'fullbody', 'все тіло', 'фулбаді']],
];

const TEMPER_WORDS: [Temper, string[]][] = [
  [
    1,
    [
      'green',
      'зелен*',
      'warm',
      'теплий',
      'теплим',
      'добрий',
      'добрим',
      'friendly',
      'дружн*',
      'бро',
    ],
  ],
  [3, ['yellow', 'жовт*', 'blunt', 'прямий', 'прямим']],
  [5, ['red', 'червон*', 'merciless', 'нещадн*', 'безжальн*', 'злий', 'злим']],
];
const TEMPER_NAME: Record<Temper, [string, string]> = {
  1: ['Warm', 'Теплий'],
  3: ['Blunt', 'Прямий'],
  5: ['Merciless', 'Безжальний'],
};
const SOFTER = [
  'nicer',
  'kinder',
  'softer',
  'gentler',
  'milder',
  'мякше',
  'мягче',
  'добріше',
  'добрее',
  'лагідніше',
  'спокійніше',
];
const HARDER = [
  'meaner',
  'harsher',
  'tougher',
  'stricter',
  'ruder',
  'жорсткіше',
  'жестче',
  'зліше',
  'злее',
  'суворіше',
  'строже',
  'грубіше',
];

// ---- the intents -----------------------------------------------------------------

export const INTENTS_FIFTH: Intent[] = [
  // ---- memory ----
  {
    id: 'memory_show',
    all: [
      [
        'know about me',
        'remember about me',
        'what do you remember',
        'what do you know',
        'памятаєш',
        'знаєш про мене',
        'про мене знаєш',
        'что ты знаешь',
        'помнишь обо мне',
        'что знаешь обо мне',
      ],
    ],
    neutral: true,
    answer: (c, _p, L) => {
      const lines = describeMemory(c.mem, c.now, L, c.fmt.exercise);
      return lines.length
        ? L(
            `What I keep in mind: ${lines.join('; ')}. Say “forget it” to wipe it.`,
            `Що я тримаю в голові: ${lines.join('; ')}. Скажи «забудь» — зітру.`,
          )
        : L(
            'Nothing yet beyond your log. Tell me about injuries, your goal, your time per session or lifts you hate — I’ll remember.',
            'Поки що нічого, крім журналу. Розкажи про травми, мету, скільки маєш часу чи які вправи ненавидиш — запам’ятаю.',
          );
    },
  },
  {
    id: 'memory_forget',
    all: [
      [
        'forget',
        'wipe',
        'erase',
        'забудь',
        'забути',
        'зітри',
        'стерти',
        'забудь',
        'забыть',
        'сотри',
      ],
      [
        'me',
        'everything',
        'all',
        'it',
        'that',
        'все',
        'усе',
        'мене',
        'про мене',
        'обо мне',
        'это',
        'це',
      ],
    ],
    neutral: true,
    answer: (_c, _p, L) =>
      L(
        'Forget everything you told me (injuries, goal, lifts you avoid)? Your log stays.',
        'Забути все, що ти мені казав (травми, мету, вправи без яких)? Журнал лишається.',
      ),
    action: () => ({ type: 'forget' }),
  },

  // ---- actions ----
  {
    id: 'act_rest',
    all: [
      ['rest', 'відпоч*', 'пауз*', 'рест', 'отдых*', 'перерв*'],
      [
        'set',
        'make',
        'change',
        'put',
        'use',
        'постав*',
        'зроби',
        'змін*',
        'встанов*',
        'сделай',
        'поставь',
        'хочу',
      ],
    ],
    needs: 'exercise',
    answer: (c, p, L) => {
      const sec = parseSeconds(p.phrase);
      if (!sec || sec < 20 || sec > 600) return null;
      const lifts = liftsOf(p);
      const name = lifts.map((x) => c.fmt.exercise(x)).join(L(' and ', ' і '));
      return L(
        `Set rest for ${name} to ${mmss(sec)} from now on?`,
        `Ставлю відпочинок для ${name} ${mmss(sec)} — надалі так?`,
      );
    },
    action: (_c, p) => {
      const sec = parseSeconds(p.phrase);
      const lifts = liftsOf(p);
      if (!sec || !lifts.length) return null;
      const all = lifts.map((exercise) => ({ type: 'rest' as const, exercise, sec }));
      return all.length === 1 ? all[0] : { type: 'many', actions: all };
    },
  },
  {
    id: 'act_swap',
    all: [
      [
        'swap',
        'replace',
        'switch',
        'change',
        'instead',
        'заміни',
        'замінити',
        'заміню',
        'поміняй',
        'поміняти',
        'замість',
        'замени',
        'поменяй',
        'вместо',
      ],
    ],
    needs: 'twoLifts',
    answer: (c, p, L) => {
      const [from, to] = swapPair(p);
      return L(
        `From now on ${c.fmt.exercise(to)} instead of ${c.fmt.exercise(from)} in your plans?`,
        `Надалі ${c.fmt.exercise(to)} замість ${c.fmt.exercise(from)} у твоїх планах?`,
      );
    },
    action: (_c, p) => {
      const [from, to] = swapPair(p);
      return { type: 'swap', from, to };
    },
  },
  {
    id: 'act_avoid',
    all: [
      [
        'remove',
        'drop',
        'exclude',
        'never',
        'no more',
        'прибери',
        'викинь',
        'виключи',
        'прибрати',
        'убери',
        'исключи',
        'більше не',
      ],
      [
        'plan*',
        'programme',
        'program',
        'give',
        'from',
        'план*',
        'програм*',
        'давай',
        'пропонуй',
        'программ*',
        'з',
        'із',
      ],
    ],
    needs: 'exercise',
    answer: (c, p, L) => {
      const name = liftsOf(p)
        .map((x) => c.fmt.exercise(x))
        .join(L(' and ', ' і '));
      return L(`Drop ${name} from your plans for good?`, `Прибрати ${name} з планів назавжди?`);
    },
    action: (_c, p) => {
      const all = liftsOf(p).map((exercise) => ({ type: 'avoid' as const, exercise }));
      return !all.length ? null : all.length === 1 ? all[0] : { type: 'many', actions: all };
    },
  },
  {
    id: 'act_move',
    all: [
      [
        'move',
        'shift',
        'reschedule',
        'перенеси',
        'перенести',
        'пересунь',
        'перенесемо',
        'перенос*',
        'перенеси',
        'переставь',
        'перенесть',
      ],
    ],
    answer: (c, p, L) => {
      const plan = c.s.coach.plan;
      if (!plan)
        return L(
          'There’s no programme to move yet — ask me to write one.',
          'Ще нема програми, щоб переносити, — попроси, напишу.',
        );
      const mv = moveOf(c, p);
      if (!mv)
        return L(
          'Which day, and to when? E.g. “move legs to Thursday”.',
          'Який день і на коли? Напр. «перенеси ноги на четвер».',
        );
      const day = plan.days.find((d) => d.weekday === mv.from)!;
      const other = plan.days.find((d) => d.weekday === mv.to);
      const name = day.name ?? day.split;
      return other
        ? L(
            `Swap ${name} (${wd(c, mv.from)}) with ${other.name ?? other.split} (${wd(c, mv.to)})?`,
            `Поміняти ${name} (${wd(c, mv.from)}) з ${other.name ?? other.split} (${wd(c, mv.to)})?`,
          )
        : L(
            `Move ${name} from ${wd(c, mv.from)} to ${wd(c, mv.to)}?`,
            `Перенести ${name} з ${wd(c, mv.from)} на ${wd(c, mv.to)}?`,
          );
    },
    action: (c, p) => {
      const mv = c.s.coach.plan ? moveOf(c, p) : null;
      return mv ? { type: 'moveDay', from: mv.from, to: mv.to } : null;
    },
  },
  {
    id: 'act_start',
    all: [
      [
        'start',
        'begin',
        'lets go',
        'kick off',
        'почни',
        'почати',
        'починай',
        'починаємо',
        'стартуй',
        'погнали',
        'поїхали',
        'начни',
        'начать',
        'начинаем',
        'старт',
      ],
      WORKOUT,
    ],
    answer: (c, _p, L) => {
      const plan = c.s.coach.enabled && c.s.coach.role === 'main' ? c.s.coach.plan : null;
      const day = plan ? planDayFor(plan, c.now) : null;
      if (c.s.workouts.some((w) => w.finishedAt === null))
        return L('You have a workout open — open it?', 'У тебе відкрите тренування — відкрити?');
      return day
        ? L(
            `Start today’s ${day.name ?? day.split}: ${day.muscles.map(c.fmt.muscle).join(', ')}?`,
            `Почати сьогоднішнє ${day.name ?? day.split}: ${day.muscles.map(c.fmt.muscle).join(', ')}?`,
          )
        : L('Start a workout now?', 'Почати тренування зараз?');
    },
    action: () => ({ type: 'start' }),
  },
  {
    id: 'act_temper',
    all: [
      [...SOFTER, ...HARDER, ...TEMPER_WORDS.flatMap(([, w]) => w)],
      [
        'be',
        'talk',
        'speak',
        'tone',
        'switch',
        'become',
        'будь',
        'говори',
        'тон',
        'стань',
        'перейди',
        'зміни',
        'стань',
        'говори',
        'можна',
        'можешь',
        'можеш',
      ],
    ],
    answer: (c, p, L) => {
      const t = temperOf(c, p);
      if (!t || t === c.s.coach.temper) return L('That’s already me.', 'Я вже такий.');
      return L(`Switch me to ${TEMPER_NAME[t][0]}?`, `Перемкнути мене на «${TEMPER_NAME[t][1]}»?`);
    },
    action: (c, p) => {
      const t = temperOf(c, p);
      return t && t !== c.s.coach.temper ? { type: 'temper', temper: t } : null;
    },
  },
  {
    id: 'act_mute',
    all: [
      [
        'mute',
        'quiet',
        'silence',
        'shut up',
        'тихо',
        'замовкни',
        'помовч',
        'замолчи',
        'не пиши',
        'не надсилай',
        'вимкни',
        'заглуши',
      ],
      [
        'today',
        'notification*',
        'messages',
        'notes',
        'pushes',
        'сьогодні',
        'сповіщен*',
        'повідомлен*',
        'нотатк*',
        'сегодня',
        'уведомлен*',
        'пуш*',
      ],
    ],
    answer: (_c, _p, L) =>
      L(
        'Mute me until tomorrow? The chat stays open.',
        'Вимкнути мене до завтра? Чат працюватиме.',
      ),
    action: () => ({ type: 'mute' }),
  },
  {
    id: 'act_bodyweight',
    all: [
      [
        'i weigh',
        'weigh',
        'weighed',
        'my weight',
        'важу',
        'зважився',
        'зважилась',
        'моя вага',
        'вешу',
        'мой вес',
        'ważę',
        'sveriu',
        'kaalun',
      ],
    ],
    neutral: true,
    answer: (c, p, L) => {
      const kg = nums(p.phrase).find((n) => n >= 30 && n <= 300);
      if (!kg) return null;
      return L(
        `Log bodyweight ${c.fmt.kg(kg)} for today?`,
        `Записати вагу ${c.fmt.kg(kg)} на сьогодні?`,
      );
    },
    action: (_c, p) => {
      const kg = nums(p.phrase).find((n) => n >= 30 && n <= 300);
      return kg ? { type: 'bodyweight', kg } : null;
    },
  },

  // ---- time windows ----
  {
    id: 'range_count',
    all: [HOW_MANY, WORKOUT],
    needs: 'range',
    answer: (c, p, L) => {
      const r = p.range!;
      const ws = finishedOf(c).filter((w) => w.startedAt >= r.from && w.startedAt < r.to);
      const weeks = Math.max(1, (r.to - r.from) / WEEK);
      const sets = ws.reduce(
        (n, w) =>
          n +
          w.exercises.reduce(
            (m, e) => m + e.sets.filter((x) => setTypeOf(x) !== 'warmup').length,
            0,
          ),
        0,
      );
      const perWeek = Math.round((ws.length / weeks) * 10) / 10;
      return L(
        `${r.label[0][0].toUpperCase()}${r.label[0].slice(1)}: ${ws.length} sessions, ${sets} working sets${weeks >= 2 ? ` — ${perWeek} a week` : ''}.`,
        `${r.label[1][0].toUpperCase()}${r.label[1].slice(1)}: ${ws.length} тренувань, ${sets} робочих сетів${weeks >= 2 ? ` — ${perWeek} на тиждень` : ''}.`,
      );
    },
    chart: (c, p, L) => {
      const r = p.range!;
      if (r.to - r.from < 3 * WEEK) return null;
      return {
        title: L('Sessions a week', 'Тренувань на тиждень'),
        unit: '',
        points: weeklyCounts(c, r.from, r.to),
      };
    },
  },
  {
    id: 'range_summary',
    all: [
      [
        'what did i do',
        'summary',
        'recap',
        'overview',
        'how was',
        'how did',
        'report',
        'підсумок',
        'підсумки',
        'що я робив',
        'як пройшов',
        'як пройшли',
        'як минув',
        'огляд',
        'итог',
        'что я делал',
        'как прошел',
        'звіт',
      ],
    ],
    needs: 'range',
    answer: (c, p, L) => {
      const r = p.range!;
      const all = finishedOf(c);
      const ws = all.filter((w) => w.startedAt >= r.from && w.startedAt < r.to);
      if (!ws.length)
        return L(`Nothing logged ${r.label[0]}.`, `${r.label[1]} нічого не записано.`);
      const sets = ws.reduce(
        (n, w) =>
          n +
          w.exercises.reduce(
            (m, e) => m + e.sets.filter((x) => setTypeOf(x) !== 'warmup').length,
            0,
          ),
        0,
      );
      const freq = new Map<string, number>();
      for (const w of ws)
        for (const e of w.exercises) freq.set(e.name, (freq.get(e.name) ?? 0) + 1);
      const top = [...freq]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([n]) => c.fmt.exercise(n));
      const before = all.filter((w) => w.startedAt < r.from);
      const prs = [...freq.keys()].filter((n) => {
        const was = Math.max(0, ...before.map((w) => sessionE1(w, n)));
        const now = Math.max(0, ...ws.map((w) => sessionE1(w, n)));
        return was > 0 && now > was;
      });
      return L(
        `${cap(r.label[0])}: ${ws.length} sessions, ${sets} sets. Most done: ${top.join(', ')}.${prs.length ? ` New bests: ${prs.slice(0, 3).map(c.fmt.exercise).join(', ')}.` : ' No new bests.'}`,
        `${cap(r.label[1])}: ${ws.length} тренувань, ${sets} сетів. Найчастіше: ${top.join(', ')}.${prs.length ? ` Нові рекорди: ${prs.slice(0, 3).map(c.fmt.exercise).join(', ')}.` : ' Нових рекордів нема.'}`,
      );
    },
  },
  {
    id: 'range_lift',
    all: [
      [
        'progress*',
        'how',
        'best',
        'max',
        'record',
        'changed',
        'grow*',
        'going',
        'прогрес*',
        'як',
        'рекорд*',
        'максим*',
        'змін*',
        'росте',
        'зріс',
        'выро*',
        'как',
        'динамік*',
      ],
    ],
    needs: 'range',
    answer: (c, p, L) => {
      if (!p.exercise) return null;
      const r = p.range!;
      const name = c.fmt.exercise(p.exercise);
      const s = e1Series(c, p.exercise, r.from, r.to);
      if (!s.length) return L(`No ${name} ${r.label[0]}.`, `${name} ${r.label[1]} не було.`);
      const first = s[0].v;
      const last = s[s.length - 1].v;
      const best = Math.max(...s.map((x) => x.v));
      if (isBodyweightLift(liftPoints(c, p.exercise)))
        return L(
          `${name}, ${r.label[0]}: ${s.length} sessions, ${first} → ${last} reps (${signed(last - first)}), best ${best} reps.`,
          `${name}, ${r.label[1]}: ${s.length} трен., ${first} → ${last} повт. (${signed(last - first)}), найкраще ${best} повт.`,
        );
      return L(
        `${name}, ${r.label[0]}: ${s.length} sessions, estimated max ${kgs(c, first)} → ${kgs(c, last)} (${signed(pct(last, first))}%), best ${kgs(c, best)}.`,
        `${name}, ${r.label[1]}: ${s.length} трен., розрахунковий максимум ${kgs(c, first)} → ${kgs(c, last)} (${signed(pct(last, first))}%), найкраще ${kgs(c, best)}.`,
      );
    },
    chart: (c, p, L) => {
      if (!p.exercise) return null;
      const s = e1Series(c, p.exercise, p.range!.from, p.range!.to);
      return s.length >= 2 ? liftChart(c, p.exercise, s, L) : null;
    },
  },
  {
    id: 'range_muscle',
    all: [
      [
        'sets',
        'volume',
        'work',
        'сет*',
        'обсяг*',
        'підход*',
        'подход*',
        'объем*',
        'навантаж*',
        ...HOW_MANY,
      ],
    ],
    needs: 'range',
    answer: (c, p, L) => {
      if (!p.muscle || p.exercise) return null;
      const r = p.range!;
      const ws = finishedOf(c).filter((w) => w.startedAt >= r.from && w.startedAt < r.to);
      const sets = Math.round(
        ws.reduce((n, w) => n + (muscleSetsInWorkout(w).get(p.muscle!) ?? 0), 0),
      );
      const weeks = Math.max(1, (r.to - r.from) / WEEK);
      const m = c.fmt.muscle(p.muscle);
      return L(
        `${m}, ${r.label[0]}: ${sets} sets${weeks >= 2 ? ` (~${Math.round(sets / weeks)} a week)` : ''}.`,
        `${m}, ${r.label[1]}: ${sets} сетів${weeks >= 2 ? ` (~${Math.round(sets / weeks)} на тиждень)` : ''}.`,
      );
    },
  },
  {
    id: 'range_bw',
    all: [
      [
        'bodyweight',
        'weight',
        'weigh*',
        'scale',
        'вага',
        'ваги',
        'вагу',
        'важу',
        'вес',
        'зважуван*',
      ],
    ],
    needs: 'range',
    neutral: true,
    answer: (c, p, L) => {
      if (p.exercise) return null;
      const r = p.range!;
      const ws = (c.s.bodyMetrics.weights ?? [])
        .filter((w) => w.at >= r.from && w.at < r.to)
        .sort((a, b) => a.at - b.at);
      if (ws.length < 2)
        return L(`Not enough weigh-ins ${r.label[0]}.`, `${r.label[1]} замало зважувань.`);
      const d = Math.round((ws[ws.length - 1].weight - ws[0].weight) * 10) / 10;
      return L(
        `${cap(r.label[0])}: ${c.fmt.kg(ws[0].weight)} → ${c.fmt.kg(ws[ws.length - 1].weight)} (${signed(d)} kg).`,
        `${cap(r.label[1])}: ${c.fmt.kg(ws[0].weight)} → ${c.fmt.kg(ws[ws.length - 1].weight)} (${signed(d)} кг).`,
      );
    },
    chart: (c, p, L) => {
      const r = p.range!;
      const pts = (c.s.bodyMetrics.weights ?? [])
        .filter((w) => w.at >= r.from && w.at < r.to)
        .sort((a, b) => a.at - b.at)
        .map((w) => ({ at: w.at, v: w.weight }));
      return pts.length >= 2
        ? { title: L('Bodyweight', 'Вага тіла'), unit: 'kg', points: pts }
        : null;
    },
  },
  {
    id: 'then_vs_now',
    all: [
      [
        'stronger',
        'weaker',
        'compare',
        'progress*',
        'better',
        'changed',
        'сильніш*',
        'слабш*',
        'порівн*',
        'прогрес*',
        'краще',
        'сильнее',
        'сравн*',
        'змінився',
      ],
    ],
    needs: 'range',
    answer: (c, p, L) => {
      const r = p.range!;
      // "since June" on one lift is a progress question, not then-vs-now.
      if (!r.ago && p.exercise) return null;
      const then = r.from;
      const lifts = p.exercise ? [p.exercise] : topLifts(c, 3);
      const rows = lifts
        .map((n) => ({
          n,
          a: bestE1(c, n, then - 2 * WEEK, then + 2 * WEEK),
          b: bestE1(c, n, c.now - 4 * WEEK, c.now + 1),
        }))
        .filter((x) => x.a > 0 && x.b > 0);
      if (!rows.length)
        return L(
          `I don’t have your lifts from ${r.label[0]} to compare.`,
          `Нема твоїх вправ за ${r.label[1]}, щоб порівняти.`,
        );
      const txt = rows
        .map(
          (x) =>
            `${c.fmt.exercise(x.n)} ${kgs(c, x.a)} → ${kgs(c, x.b)} (${signed(pct(x.b, x.a))}%)`,
        )
        .join('; ');
      const up = rows.filter((x) => x.b > x.a).length;
      return L(
        `Then (${r.label[0]}) vs now, estimated max: ${txt}. ${up === rows.length ? 'Stronger across the board.' : up === 0 ? 'Not stronger — let’s look at why.' : 'Mixed.'}`,
        `Тоді (${r.label[1]}) і зараз, розрахунковий максимум: ${txt}. ${up === rows.length ? 'Сильніший у всьому.' : up === 0 ? 'Не сильніший — розберімося чому.' : 'По-різному.'}`,
      );
    },
  },

  // ---- comparisons ----
  {
    id: 'compare_lifts',
    all: [
      [
        'vs',
        'versus',
        'compare',
        'than',
        'ratio',
        'stronger',
        'weaker',
        'порівн*',
        'ніж',
        'проти',
        'сильніш*',
        'співвідн*',
        'сравн*',
        'відстає',
        'lag*',
        'lagging',
      ],
    ],
    needs: 'twoLifts',
    answer: (c, p, L) => {
      const [a, b] = p.exercises!;
      const ea = bestE1(c, a, c.now - 8 * WEEK, c.now + 1);
      const eb = bestE1(c, b, c.now - 8 * WEEK, c.now + 1);
      const na = c.fmt.exercise(a);
      const nb = c.fmt.exercise(b);
      if (!ea || !eb)
        return L(
          `I need both ${na} and ${nb} in the last 8 weeks to compare.`,
          `Щоб порівняти, потрібні і ${na}, і ${nb} за останні 8 тижнів.`,
        );
      const ratio = Math.round((ea / eb) * 100) / 100;
      const trend = (n: string) => {
        const s = e1Series(c, n, c.now - 8 * WEEK, c.now + 1);
        return s.length >= 2 ? pct(s[s.length - 1].v, s[0].v) : 0;
      };
      const ta = trend(a);
      const tb = trend(b);
      const lag = ta < tb ? na : nb;
      return L(
        `Estimated max: ${na} ${kgs(c, ea)}, ${nb} ${kgs(c, eb)} — ratio ${ratio}. Over 8 weeks: ${na} ${signed(ta)}%, ${nb} ${signed(tb)}%.${ta !== tb ? ` ${lag} is the one lagging.` : ''} Typical: squat ≈ 1.2–1.3× bench, deadlift ≈ 1.2× squat.`,
        `Розрахунковий максимум: ${na} ${kgs(c, ea)}, ${nb} ${kgs(c, eb)} — співвідношення ${ratio}. За 8 тижнів: ${na} ${signed(ta)}%, ${nb} ${signed(tb)}%.${ta !== tb ? ` Відстає ${lag}.` : ''} Типово: присід ≈ 1,2–1,3× жиму, станова ≈ 1,2× присіду.`,
      );
    },
  },

  // ---- reasons behind the plan ----
  {
    id: 'why_today',
    all: [WHY, ['today', 'this session', 'сьогодні', 'цей день', 'сегодня', 'сьогоднішн*']],
    answer: (c, _p, L) => {
      const plan = c.s.coach.enabled && c.s.coach.role === 'main' ? c.s.coach.plan : null;
      const finished = finishedOf(c);
      const ready = muscleReadiness(finished, c.now);
      const day = plan ? planDayFor(plan, c.now) : null;
      const muscles =
        day?.muscles ??
        playForWeekday(computePlaybook(finished, c.now).plays, new Date(c.now).getDay())
          ?.coverage.filter((x) => x.primary)
          .map((x) => x.muscle) ??
        [];
      if (!muscles.length)
        return L(
          'Nothing is set for today — your fresh muscles decide.',
          'На сьогодні нічого не заплановано — вирішують свіжі м’язи.',
        );
      const parts = muscles.slice(0, 4).map((m) => {
        const r = ready.get(m);
        const d = r?.daysSince;
        return d == null
          ? L(
              `${c.fmt.muscle(m)} (not trained lately)`,
              `${c.fmt.muscle(m)} (давно не тренувались)`,
            )
          : L(`${c.fmt.muscle(m)} (${d} d rest)`, `${c.fmt.muscle(m)} (${d} дн. відпочинку)`);
      });
      const src = day
        ? L(
            `It’s ${wd(c, day.weekday)} in your plan — ${day.name ?? day.split}.`,
            `За планом ${wd(c, day.weekday)} — ${day.name ?? day.split}.`,
          )
        : L(
            'It’s what you usually train on this weekday.',
            'Це те, що ти зазвичай тренуєш цього дня тижня.',
          );
      const deload =
        plan && isDeloadWeek(plan, c.now)
          ? L(' Lighter week: fewer sets.', ' Легший тиждень: менше сетів.')
          : '';
      return `${src} ${L('Recovered:', 'Відновились:')} ${parts.join(', ')}.${deload}`;
    },
  },
  {
    id: 'why_weight',
    all: [
      WHY,
      [
        'weight',
        'kg',
        'lighter',
        'heavier',
        'less',
        'more',
        'drop*',
        'lower',
        'ваг*',
        'кг',
        'легш*',
        'важч*',
        'менше',
        'більше',
        'скинув',
        'зменш*',
        'вес',
        'легче',
        'тяжелее',
        'меньше',
      ],
    ],
    needs: 'exercise',
    answer: (c, p, L) => {
      const hist = topHistory(finishedOf(c), p.exercise!, c.now);
      const tg = nextTarget(hist, {});
      const name = c.fmt.exercise(p.exercise!);
      const bits: string[] = [];
      if (tg.state === 'first')
        bits.push(L('No history yet, so I start light.', 'Історії ще нема, тож починаю легко.'));
      else if (tg.deltaKg < 0)
        bits.push(
          L(
            `${name} stalled at the same top weight 3 sessions running — a small back-off lets you build past it.`,
            `${name} стоїть на тій самій вазі 3 тренування поспіль — невеликий відкат дає пройти далі.`,
          ),
        );
      else if (tg.deltaKg > 0)
        bits.push(
          L(
            `You hit the top of the rep range last time (${tg.prevReps} reps), so the weight goes up.`,
            `Минулого разу ти дійшов до верху діапазону (${tg.prevReps} повт.), тож вага росте.`,
          ),
        );
      else
        bits.push(
          L(
            `Last time ${tg.prevReps} reps — not the top of the range yet, so same weight, more reps.`,
            `Минулого разу ${tg.prevReps} повт. — ще не верх діапазону, тож та сама вага, більше повторів.`,
          ),
        );
      const plan = c.s.coach.plan;
      if (plan && isDeloadWeek(plan, c.now))
        bits.push(L('It’s the lighter week: fewer sets.', 'Це легший тиждень: менше сетів.'));
      if (soreFor(c.mem, c.now, p.exercise!).length)
        bits.push(
          L(
            `You told me something’s sore — the plan is ${Math.round((1 - SORE_CAP) * 100)}% lighter there.`,
            `Ти казав, що болить, — у плані там на ${Math.round((1 - SORE_CAP) * 100)}% легше.`,
          ),
        );
      return bits.join(' ');
    },
  },
  {
    id: 'why_plan',
    all: [
      WHY,
      [
        'plan',
        'programme',
        'program',
        'split',
        'these days',
        'this schedule',
        'план*',
        'програм*',
        'спліт*',
        'розклад*',
        'программ*',
        'дні',
      ],
    ],
    answer: (c, _p, L) => {
      const plan = c.s.coach.plan;
      if (!plan)
        return L(
          'No programme yet — when I write one, it comes from how you already train.',
          'Програми ще нема — коли напишу, вона буде з того, як ти вже тренуєшся.',
        );
      const finished = finishedOf(c);
      const usual = usualSessionsPerWeek(finished, plan.createdAt);
      const days = plan.days.map((d) => wd(c, d.weekday)).join(', ');
      const intent: Record<string, [string, string]> = {
        strength: [
          'heavy (3–6 reps) — that’s how you lift',
          'важко (3–6 повт.) — так ти й тренуєшся',
        ],
        muscle: ['6–12 reps — your usual range', '6–12 повт. — твій звичний діапазон'],
        endurance: ['12+ reps — how you like it', '12+ повт. — як ти любиш'],
        power: ['explosive', 'вибухово'],
        conditioning: ['conditioning', 'кондиції'],
      };
      return L(
        `${plan.days.length} days (${days}) because you’ve averaged ~${usual || plan.days.length} a week and those are your usual days. ${plan.lengthMin} min — your typical session. Reps: ${intent[plan.intent][0]}. Every ${plan.weeks}th week is lighter so you recover.`,
        `${plan.days.length} дні (${days}), бо ти в середньому тренуєшся ~${usual || plan.days.length} рази на тиждень і саме в ці дні. ${plan.lengthMin} хв — твоє звичне тренування. Повтори: ${intent[plan.intent][1]}. Кожен ${plan.weeks}-й тиждень легший, щоб відновитися.`,
      );
    },
  },
  {
    id: 'why_lift',
    all: [
      WHY,
      [
        'exercise',
        'lift',
        'this one',
        'in my plan',
        'вправ*',
        'цю',
        'ця',
        'у плані',
        'в плані',
        'упражнен*',
        'dali',
        'дали',
      ],
    ],
    needs: 'exercise',
    answer: (c, p, L) => {
      const name = c.fmt.exercise(p.exercise!);
      const n = finishedOf(c).filter((w) => w.exercises.some((e) => e.name === p.exercise)).length;
      return n >= 3
        ? L(
            `${name} is one of your staples — you’ve done it ${n} times, so your progress on it is the easiest to track.`,
            `${name} — одна з твоїх основних: ти робив її ${n} разів, тож прогрес по ній найлегше відстежити.`,
          )
        : L(
            `${name} is the top pick for that muscle with the kit at your gym. Don’t like it? Say “swap ${name} for …”.`,
            `${name} — найкращий вибір для цього м’яза з тим, що є у твоєму залі. Не подобається? Скажи «заміни ${name} на …».`,
          );
    },
  },
];

// ---- action parsing helpers ---------------------------------------------------------

const INSTEAD = ['instead', 'замість', 'вместо', 'zamiast', 'vietoj', 'asemel'];
const LEAD_VERBS = new Set([
  'swap',
  'replace',
  'switch',
  'change',
  'give',
  'me',
  'do',
  'use',
  'i',
  'want',
  'please',
  'can',
  'you',
  'заміни',
  'дай',
  'давай',
  'роби',
  'хочу',
  'мені',
  'будь',
  'ласка',
  'поміняй',
  'замени',
  'поменяй',
  'дай',
  'мне',
]);

/** Which lift goes out, which comes in. */
/** Every lift the message names ("випади і станову"), else the one it's about. */
function liftsOf(p: Parsed): string[] {
  const many = p.exercises ?? [];
  return many.length >= 2 ? many.slice(0, 4) : p.exercise ? [p.exercise] : [];
}

function swapPair(p: Parsed): [string, string] {
  const [a, b] = p.exercises!;
  const kw = p.words.findIndex((w) => INSTEAD.includes(w));
  if (kw < 0) return [a, b];
  // The lift right after "instead of" goes out: "X instead of Y" → Y out,
  // "instead of Y give me X" → Y out.
  const lead = p.words.slice(0, kw).filter((w) => !LEAD_VERBS.has(w));
  return lead.length ? [b, a] : [a, b];
}

function moveOf(c: AskCtx, p: Parsed): { from: number; to: number } | null {
  const plan = c.s.coach.plan;
  if (!plan) return null;
  const wds = p.weekdays ?? [];
  const has = (d: number) => plan.days.some((x) => x.weekday === d);
  if (wds.length >= 2) {
    const [x, y] = wds;
    if (has(x)) return { from: x, to: y };
    if (has(y)) return { from: y, to: x };
    return null;
  }
  if (wds.length !== 1) return null;
  const to = wds[0];
  const today = new Date(c.now).getDay();
  const tomorrow = (today + 1) % 7;
  let from: number | null = null;
  if (
    groupMatches(p.words, p.phrase, ['today', 'сьогодні', 'сегодня', 'сьогоднішн*']) &&
    has(today)
  )
    from = today;
  else if (groupMatches(p.words, p.phrase, ['tomorrow', 'завтра', 'завтрашн*']) && has(tomorrow))
    from = tomorrow;
  else {
    const split = DAY_WORDS.find(([, kws]) => groupMatches(p.words, p.phrase, kws))?.[0];
    const d =
      plan.days.find(
        (x) => split && (x.split === split || (x.name ?? '').toLowerCase().includes(split)),
      ) ?? (p.muscle ? plan.days.find((x) => x.muscles.includes(p.muscle!)) : undefined);
    if (d) from = d.weekday;
  }
  return from === null || from === to ? null : { from, to };
}

function temperOf(c: AskCtx, p: Parsed): Temper | null {
  const named = TEMPER_WORDS.find(([, kws]) => groupMatches(p.words, p.phrase, kws))?.[0];
  if (named) return named;
  const cur = c.s.coach.temper;
  // One step along green → yellow → red.
  const i = TEMPERS.indexOf(cur);
  if (groupMatches(p.words, p.phrase, SOFTER)) return TEMPERS[Math.max(0, i - 1)];
  if (groupMatches(p.words, p.phrase, HARDER)) return TEMPERS[Math.min(TEMPERS.length - 1, i + 1)];
  return null;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ---- charts for older topics ----------------------------------------------------------

/** Charts attached to intents from earlier parts (by id). */
export const CHARTS: Record<string, NonNullable<Intent['chart']>> = {
  progress_lift: (c, p, L) => {
    if (!p.exercise) return null;
    const s = e1Series(c, p.exercise).slice(-12);
    return s.length >= 3 ? liftChart(c, p.exercise, s, L) : null;
  },
  e1rm: (c, p, L) => {
    if (!p.exercise) return null;
    const s = e1Series(c, p.exercise).slice(-12);
    return s.length >= 3 ? liftChart(c, p.exercise, s, L) : null;
  },
  bw_trend: (c, _p, L) => {
    const pts = [...(c.s.bodyMetrics.weights ?? [])]
      .sort((a, b) => a.at - b.at)
      .slice(-20)
      .map((w) => ({ at: w.at, v: w.weight }));
    return pts.length >= 3
      ? { title: L('Bodyweight', 'Вага тіла'), unit: 'kg', points: pts }
      : null;
  },
  consistency: (c, _p, L) => ({
    title: L('Sessions a week', 'Тренувань на тиждень'),
    unit: '',
    points: weeklyCounts(c, c.now - 12 * WEEK, c.now),
  }),
  how_am_i_doing: (c, _p, L) => ({
    title: L('Sessions a week', 'Тренувань на тиждень'),
    unit: '',
    points: weeklyCounts(c, c.now - 8 * WEEK, c.now),
  }),
};

export const __test = { parseSeconds, swapPair, DAY };
