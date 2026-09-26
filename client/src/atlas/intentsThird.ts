/**
 * Atlas's answer base, part three: more of your own numbers (heaviest lift,
 * favourite exercise, consistency, rest you actually take, cardio and
 * activities, gym, goal, bodyweight trend, strength ratios), growing each
 * muscle, progression mechanics, recovery tools, safety, age, gym nerves, the
 * app's corners — and a bit more small talk.
 */
import {
  latestWeight,
  restBeforeSetInWorkout,
  setTopWeight,
  setTypeOf,
  topSet,
  warmupHabit,
} from '../store';
import type { MuscleGroup } from '../data/exercises';
import {
  DAY,
  WEEK,
  date,
  finishedOf,
  loggedLifts,
  wd,
  type AskCtx,
  type Intent,
} from './intentKit';
import { moody } from './intentsMore';

const WORKOUT = ['workout*', 'session*', 'training', 'gym', 'тренуван*', 'заняття'];
const GROW = [
  'grow*',
  'bigger',
  'build',
  'bring up',
  'not growing',
  'рост*',
  'зрост*',
  'більш*',
  'накачат*',
  'збільш*',
  'не ростуть',
  'не росте',
  'підтягнут*',
];

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function bestTop(c: AskCtx, name: string): { kg: number; reps: number } | null {
  let best: { kg: number; reps: number } | null = null;
  for (const w of finishedOf(c)) {
    const ex = w.exercises.find((e) => e.name === name);
    const t = ex ? topSet(ex.sets) : undefined;
    if (t && (!best || setTopWeight(t) > best.kg)) best = { kg: setTopWeight(t), reps: t.reps };
  }
  return best;
}

/** Growth advice per muscle (evidence-based rules of thumb). */
const GROW_TIPS: Partial<Record<MuscleGroup, [string, string]>> = {
  chest: [
    'Chest: flat and incline presses, a fly in the stretched position, 10–16 hard sets a week over 2 sessions. Lower the bar all the way.',
    'Груди: жим лежачи й на похилій, розведення в розтягнутій позиції, 10–16 робочих сетів на тиждень за 2 тренування. Опускай гриф до кінця.',
  ],
  lats: [
    'Back width: pull-ups or pulldowns with a full stretch at the top, rows for thickness. 12–18 sets a week; pull with the elbows.',
    'Ширина спини: підтягування чи тяга верхнього блока з повним розтягненням угорі, тяги в нахилі — для товщини. 12–18 сетів на тиждень; тягни ліктями.',
  ],
  shoulders: [
    'Delts: lateral raises most days you train — 12–20 reps, controlled, little swing. Presses cover the front already.',
    'Дельти: махи в сторони майже щотренування — 12–20 повторів, під контролем, без розгойдування. Передню дельту вже вантажать жими.',
  ],
  biceps: [
    'Biceps: curls through full range, incline curls for the stretch, 8–14 sets a week. Rows help, but don’t replace curls.',
    'Біцепс: згинання в повній амплітуді, на похилій лаві — для розтягнення, 8–14 сетів на тиждень. Тяги допомагають, але не замінюють.',
  ],
  triceps: [
    'Triceps: overhead extensions for the long head, pushdowns, close-grip presses. It’s two-thirds of your arm — train it like it.',
    'Трицепс: розгинання з-за голови для довгої головки, розгинання на блоці, вузький жим. Це дві третини руки — тренуй відповідно.',
  ],
  quads: [
    'Quads: squats or leg press deep, plus leg extensions. 10–16 sets a week. Knees forward is fine.',
    'Квадрицепс: глибокі присіди чи жим ногами плюс розгинання ніг. 10–16 сетів на тиждень. Коліна вперед — нормально.',
  ],
  hamstrings: [
    'Hamstrings: Romanian deadlifts for the stretch plus a leg curl. Seated curls beat lying ones. 8–12 sets a week.',
    'Задня поверхня: румунська тяга для розтягнення плюс згинання ніг. Сидячи — краще, ніж лежачи. 8–12 сетів на тиждень.',
  ],
  glutes: [
    'Glutes: hip thrusts, deep squats, lunges, RDLs. Pause at the top of thrusts. 10–16 sets a week.',
    'Сідниці: ягодичний міст, глибокі присіди, випади, румунська тяга. Пауза вгорі мосту. 10–16 сетів на тиждень.',
  ],
  calves: [
    'Calves: slow reps, a full pause in the stretch at the bottom, 10–20 reps, 3–4×/week. They respond — you just have to be patient.',
    'Литки: повільно, повна пауза в розтягнутій позиції внизу, 10–20 повторів, 3–4 рази на тиждень. Ростуть — лише терпіння.',
  ],
  traps: [
    'Traps: heavy rows and deadlifts do most of it; add shrugs, 10–15 reps, hold at the top.',
    'Трапеції: основне дають важкі тяги й станова; додай шраги, 10–15 повторів, затримка вгорі.',
  ],
  core: [
    'Core: weighted cable crunches, hanging leg raises, planks you can’t hold past 60 s without load. 2–3×/week.',
    'Кор: скручування на блоці з вагою, підйоми ніг у висі, планка — з обтяженням, якщо тримаєш понад 60 с. 2–3 рази на тиждень.',
  ],
  forearms: [
    'Forearms: heavy holds, wrist curls and reverse curls, 12–20 reps. Grip work shows up in every pull.',
    'Передпліччя: важкі утримання, згинання й розгинання кистей, 12–20 повторів. Хват відгукнеться в кожній тязі.',
  ],
};

export const INTENTS_THIRD: Intent[] = [
  // ---- more of your numbers ----
  {
    id: 'heaviest',
    all: [
      ['heaviest', 'most weight', 'biggest lift', 'найважч*', 'найбільша вага', 'найбільше підняв'],
    ],
    answer: (c, _p, L) => {
      let best: { name: string; kg: number; reps: number } | null = null;
      for (const x of loggedLifts(c)) {
        const b = bestTop(c, x.name);
        if (b && (!best || b.kg > best.kg)) best = { name: x.name, ...b };
      }
      return best
        ? L(
            `Heaviest: ${c.fmt.exercise(best.name)} ${c.fmt.kg(best.kg)} × ${best.reps}.`,
            `Найважче: ${c.fmt.exercise(best.name)} ${c.fmt.kg(best.kg)} × ${best.reps}.`,
          )
        : null;
    },
  },
  {
    id: 'favourite_lift',
    all: [
      [
        'favourite',
        'favorite',
        'most done',
        'most often',
        'улюблен*',
        'найчастіш*',
        'найбільше роблю',
      ],
    ],
    answer: (c, _p, L) => {
      const top = loggedLifts(c)
        .sort((a, b) => b.count - a.count)
        .slice(0, 3)
        .map((x) => `${c.fmt.exercise(x.name)} (${x.count})`)
        .join(', ');
      return top ? L(`Most logged: ${top}.`, `Найчастіше в журналі: ${top}.`) : null;
    },
  },
  {
    id: 'consistency',
    all: [
      [
        'consistent',
        'consistency',
        'regular',
        'discipline',
        'регулярн*',
        'стабільн*',
        'дисципл*',
        'постійн*',
      ],
    ],
    answer: (c, _p, L) => {
      const f = finishedOf(c);
      let good = 0;
      for (let i = 0; i < 8; i++) {
        const end = c.now - i * WEEK;
        const n = f.filter((w) => w.startedAt < end && w.startedAt >= end - WEEK).length;
        if (n >= 2) good++;
      }
      return L(
        `${good} of the last 8 weeks had 2+ sessions. ${good >= 7 ? 'That’s consistency.' : 'That’s the thing to fix first.'}`,
        `${good} з останніх 8 тижнів мали 2+ тренування. ${good >= 7 ? 'Це і є регулярність.' : 'Це треба виправити першим.'}`,
      );
    },
  },
  {
    id: 'best_weekday',
    all: [['which day', 'what day', 'best day', 'який день', 'в які дні', 'коли я зазвичай']],
    answer: (c, _p, L) => {
      const counts = new Array(7).fill(0) as number[];
      for (const w of finishedOf(c))
        if (c.now - w.startedAt < 12 * WEEK) counts[new Date(w.startedAt).getDay()]++;
      const top = counts
        .map((n, d) => [d, n] as const)
        .filter(([, n]) => n > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([d]) => wd(c, d));
      return top.length
        ? L(`You train most on ${top.join(', ')}.`, `Найчастіше тренуєшся: ${top.join(', ')}.`)
        : null;
    },
  },
  {
    id: 'rest_actual',
    all: [
      ['rest', 'відпоч*'],
      [
        'actually',
        'really',
        'on average',
        'average',
        'how long do i',
        'насправді',
        'в середньому',
        'середн*',
        'скільки я',
      ],
    ],
    answer: (c, _p, L) => {
      const w = finishedOf(c)[0];
      const none = L(
        'Log sets live during the session and I’ll measure the rest you really take.',
        'Записуй сети наживо під час тренування — і я поміряю, скільки ти насправді відпочиваєш.',
      );
      if (!w) return none;
      const rests = w.exercises
        .flatMap((e) => e.sets.filter((s) => setTypeOf(s) !== 'warmup'))
        .map((s) => restBeforeSetInWorkout(w, s))
        .filter((x): x is number => x != null && x > 0 && x < 900);
      if (!rests.length) return none;
      return L(
        `Last session you rested ${c.fmt.mmss(Math.round(median(rests)))} between sets (median).`,
        `Минулого тренування ти відпочивав ${c.fmt.mmss(Math.round(median(rests)))} між сетами (медіана).`,
      );
    },
  },
  {
    id: 'warmup_habit',
    all: [
      ['warm*', 'розмин*'],
      ['do i', 'enough', 'always', 'чи я', 'достатньо', 'завжди', 'роблю'],
    ],
    answer: (c, _p, L) =>
      warmupHabit(finishedOf(c).slice(0, 10))
        ? L(
            'You usually open with a warm-up. Keep it.',
            'Ти зазвичай починаєш з розминки. Так і тримай.',
          )
        : L(
            'You mostly skip the warm-up. 5 minutes — it’s cheaper than an injury.',
            'Ти здебільшого пропускаєш розминку. 5 хвилин — дешевше за травму.',
          ),
  },
  {
    id: 'cardio_done',
    all: [
      [
        'cardio',
        'activity',
        'activities',
        'steps',
        'walk*',
        'кардіо',
        'активніст*',
        'прогулян*',
        'кроки',
      ],
      ['week', 'this week', 'how much', 'тиждень', 'тижня', 'скільки'],
    ],
    answer: (c, _p, L) => {
      const acts = (c.s.activities ?? []).filter((a) => a.finishedAt && c.now - a.startedAt < WEEK);
      const mins = Math.round(acts.reduce((a, x) => a + (x.durationMin || 0), 0));
      return L(
        `${acts.length} activities this week, ${mins} min in total. 150 min of moderate movement a week is the health baseline.`,
        `${acts.length} активностей цього тижня, разом ${mins} хв. 150 хв помірного руху на тиждень — базова норма для здоров’я.`,
      );
    },
  },
  {
    id: 'my_gym',
    all: [['my gym', 'which gym', 'gyms', 'мій зал', 'який зал', 'зали', 'в якому залі']],
    answer: (c, _p, L) => {
      const gyms = c.s.gyms ?? [];
      const counts = new Map<string, number>();
      for (const w of finishedOf(c))
        if (w.gymId) counts.set(w.gymId, (counts.get(w.gymId) ?? 0) + 1);
      const topId = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
      const top = gyms.find((g) => g.id === topId);
      return top
        ? L(
            `Mostly ${top.name} (${counts.get(top.id)} sessions). ${gyms.length} gyms saved.`,
            `Здебільшого ${top.name} (${counts.get(top.id)} тренувань). Збережено залів: ${gyms.length}.`,
          )
        : L(
            `${gyms.length} gyms saved; sessions aren’t tied to one yet.`,
            `Збережено залів: ${gyms.length}; тренування ще не прив’язані до залу.`,
          );
    },
  },
  {
    id: 'my_goal',
    all: [['my goal', 'goal', 'target', 'моя ціль', 'ціль', 'мета', 'цілі']],
    answer: (c, _p, L) => {
      const g = c.s.goals?.physique;
      return g
        ? L(
            `Your physique goal: ${g.archetype}, set ${date(c, g.setAt)}. Change it in Goals.`,
            `Твоя ціль: ${g.archetype}, з ${date(c, g.setAt)}. Змінити — у «Цілях».`,
          )
        : L(
            'No goal set. Pick one in Goals — it steers which muscles get more work.',
            'Ціль не задана. Обери в «Цілях» — від неї залежить, які м’язи отримують більше роботи.',
          );
    },
  },
  {
    id: 'bw_trend',
    all: [
      [
        'gaining',
        'losing',
        'weight trend',
        'bodyweight trend',
        'набираю',
        'худну',
        'скидаю',
        'динаміка ваги',
        'вага росте',
        'вага падає',
      ],
    ],
    neutral: true,
    answer: (c, _p, L) => {
      const ws = [...(c.s.bodyMetrics.weights ?? [])].sort((a, b) => b.at - a.at);
      if (ws.length < 2) return L('Log a few weigh-ins first.', 'Спершу запиши кілька зважувань.');
      const last = ws[0];
      const base = ws.find((x) => last.at - x.at >= 25 * DAY) ?? ws[ws.length - 1];
      const d = Math.round((last.weight - base.weight) * 10) / 10;
      const days = Math.max(1, Math.round((last.at - base.at) / DAY));
      return L(
        `${d > 0 ? '+' : ''}${d} kg over ${days} days (${c.fmt.kg(base.weight)} → ${c.fmt.kg(last.weight)}).`,
        `${d > 0 ? '+' : ''}${d} кг за ${days} дн. (${c.fmt.kg(base.weight)} → ${c.fmt.kg(last.weight)}).`,
      );
    },
  },
  {
    id: 'strength_ratio',
    all: [
      [
        'strong',
        'good',
        'decent',
        'heavy',
        'impressive',
        'сильн*',
        'добр*',
        'нормальн*',
        'багато',
        'мало',
      ],
      ['is my', 'is it', 'is that', 'чи', 'це'],
    ],
    needs: 'exercise',
    answer: (c, p, L) => {
      const b = bestTop(c, p.exercise!);
      const bw = latestWeight(c.s.bodyMetrics)?.weight;
      if (!b) return null;
      const ratio = bw ? Math.round((b.kg / bw) * 100) / 100 : null;
      return L(
        `${c.fmt.exercise(p.exercise!)} ${c.fmt.kg(b.kg)} × ${b.reps}${ratio ? ` — ${ratio}× bodyweight` : ''}. Standards (Progress → Standards) show your level per lift.`,
        `${c.fmt.exercise(p.exercise!)} ${c.fmt.kg(b.kg)} × ${b.reps}${ratio ? ` — ${ratio}× від ваги тіла` : ''}. Рівень по кожній вправі — у Progress → Standards.`,
      );
    },
  },
  {
    id: 'month',
    all: [['month', 'monthly', 'this month', 'місяць', 'місяця', 'за місяць', 'в цьому місяці']],
    answer: (c, _p, L) => {
      const d = new Date(c.now);
      const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
      const f = finishedOf(c).filter((w) => w.startedAt >= start);
      const sets = f.reduce(
        (a, w) =>
          a + w.exercises.flatMap((e) => e.sets.filter((s) => setTypeOf(s) !== 'warmup')).length,
        0,
      );
      return L(
        `This month: ${f.length} sessions, ${sets} hard sets.`,
        `Цього місяця: ${f.length} тренувань, ${sets} робочих сетів.`,
      );
    },
  },
  {
    id: 'longest_session',
    all: [['longest', 'shortest', 'найдовш*', 'найкоротш*'], WORKOUT],
    answer: (c, _p, L) => {
      const f = finishedOf(c);
      if (!f.length) return null;
      const dur = (w: (typeof f)[number]) =>
        Math.round(((w.finishedAt ?? w.startedAt) - w.startedAt) / 60000);
      const long = f.reduce((a, b) => (dur(b) > dur(a) ? b : a));
      const short = f.reduce((a, b) => (dur(b) < dur(a) ? b : a));
      return L(
        `Longest: ${dur(long)} min (${date(c, long.startedAt)}). Shortest: ${dur(short)} min (${date(c, short.startedAt)}).`,
        `Найдовше: ${dur(long)} хв (${date(c, long.startedAt)}). Найкоротше: ${dur(short)} хв (${date(c, short.startedAt)}).`,
      );
    },
  },

  // ---- growing each muscle ----
  {
    id: 'grow_muscle',
    all: [GROW],
    needs: 'muscle',
    answer: (c, p, L) => {
      const tip = GROW_TIPS[p.muscle!];
      return tip ? L(tip[0], tip[1]) : null;
    },
  },
  {
    id: 'arms',
    all: [['arms', 'arm', 'руки', 'рук'], GROW],
    answer: (_c, _p, L) =>
      L(
        'Arms: biceps and triceps 2–3×/week, 8–14 sets each, full range, overhead triceps work. And eat — arms grow last when you’re not.',
        'Руки: біцепс і трицепс 2–3 рази на тиждень, по 8–14 сетів, повна амплітуда, трицепс з-за голови. І їж — без цього руки ростуть останніми.',
      ),
  },

  // ---- progression mechanics ----
  {
    id: 'add_weight',
    all: [
      [
        'how much to add',
        'increase weight',
        'add weight',
        'when to add',
        'increment',
        'скільки додавати',
        'коли додавати',
        'додати вагу',
        'підвищувати вагу',
        'крок ваги',
      ],
    ],
    answer: (_c, _p, L) =>
      L(
        'Add weight when every set hits the top of your rep range: +2.5 kg on upper-body lifts, +5 kg on squats and deadlifts, +1–2 kg on dumbbells and isolation.',
        'Додавай, коли на всіх сетах дійшов до верху діапазону: +2,5 кг на верх тіла, +5 кг на присід і станову, +1–2 кг на гантелі й ізолюючі.',
      ),
  },
  {
    id: 'strength_vs_size',
    all: [
      [
        'strength or',
        'size or',
        'strength vs',
        'hypertrophy',
        'сила чи',
        'маса чи',
        'гіпертроф*',
        'на силу',
        'на масу чи',
      ],
    ],
    answer: (_c, _p, L) =>
      L(
        'Strength: 3–6 reps, long rest, the lift itself practised often. Size: 6–15 reps close to failure, more total sets. Anything from 5 to 30 reps builds muscle if it’s hard.',
        'Сила: 3–6 повторів, довгий відпочинок, часто тренуєш саму вправу. Маса: 6–15 повторів близько до відмови, більше сетів. М’язи росте від 5 до 30 повторів, якщо важко.',
      ),
  },
  {
    id: 'periodization',
    all: [
      ['periodiz*', 'block*', 'mesocycle', 'wave*', 'періодиз*', 'мезоцикл*', 'блок*', 'цикл*'],
    ],
    answer: (c, _p, L) =>
      L(
        `Blocks of 4–8 weeks: volume or load climbs, then a lighter week. Your plan: ${c.s.coach.plan ? `${c.s.coach.plan.weeks} weeks, last one lighter` : 'not written yet'}.`,
        `Блоки по 4–8 тижнів: обсяг чи вага ростуть, потім легший тиждень. Твій план: ${c.s.coach.plan ? `${c.s.coach.plan.weeks} тижнів, останній легший` : 'ще не написаний'}.`,
      ),
  },
  {
    id: 'unilateral',
    all: [
      [
        'unilateral',
        'one arm',
        'one leg',
        'single leg',
        'imbalance between sides',
        'одна рука',
        'одна нога',
        'однією',
        'різниця між сторонами',
        'ліва права',
      ],
    ],
    answer: (_c, _p, L) =>
      L(
        'Start one-sided work with the weaker side, match its reps with the stronger one. Split squats, one-arm rows, single-arm presses fix most side gaps.',
        'Однобічні вправи починай зі слабшої сторони й роби сильною стільки ж. Болгарські присіди, тяга однією рукою, жим однією вирівнюють більшість перекосів.',
      ),
  },
  {
    id: 'pullup_zero',
    all: [
      [
        'can t do pull',
        'cant do pull',
        'no pull ups',
        'first pull up',
        'не можу підтягнут*',
        'не підтягуюсь',
        'жодного підтягування',
        'навчитис* підтяг*',
      ],
    ],
    answer: (_c, _p, L) =>
      L(
        'From zero: slow negatives (jump up, lower in 5 s), band-assisted sets, pulldowns and rows. 2–3×/week — most people get the first one in 4–8 weeks.',
        'З нуля: повільні негативи (застрибнув — опускайся 5 с), з резинкою, тяга верхнього блока й тяги. 2–3 рази на тиждень — перше підтягування за 4–8 тижнів.',
      ),
  },
  {
    id: 'squat_vs_press',
    all: [
      [
        'squat or leg press',
        'leg press or squat',
        'присід чи жим ногами',
        'жим ногами чи присід',
        'squat vs',
      ],
    ],
    answer: (_c, _p, L) =>
      L(
        'Both grow legs. Squats train more (back, bracing, balance); the leg press lets you push quads harder with less fatigue. Do the one you progress on — or both.',
        'Ноги ростуть від обох. Присід вантажить більше (спина, корпус, баланс); жим ногами дозволяє дотиснути квадрицепс з меншою втомою. Роби той, на якому прогресуєш, — або обидва.',
      ),
  },
  {
    id: 'incline_flat',
    all: [
      [
        'incline or flat',
        'flat or incline',
        'upper chest',
        'похилій чи',
        'верх груд*',
        'верхня частина груд*',
      ],
    ],
    answer: (_c, _p, L) =>
      L(
        'Flat for overall chest and strength, incline (~30°) for the upper chest. A good week has both.',
        'Горизонтальний — для грудей загалом і сили, похилий (~30°) — для верху грудей. Добрий тиждень має обидва.',
      ),
  },

  // ---- recovery tools ----
  {
    id: 'foam_roll',
    all: [['foam roll*', 'massage', 'roller', 'масаж*', 'ролик*', 'мфр']],
    answer: (_c, _p, L) =>
      L(
        'Foam rolling and massage feel good and ease stiffness for a while. They don’t replace sleep and food — nothing does.',
        'МФР і масаж приємні й на час знімають скутість. Сон і їжу вони не замінюють — нічого не замінює.',
      ),
  },
  {
    id: 'sauna_cold',
    all: [
      [
        'sauna',
        'cold plunge',
        'ice bath',
        'cold shower',
        'сауна',
        'баня',
        'лазня',
        'крижан*',
        'холодн* душ',
      ],
    ],
    answer: (_c, _p, L) =>
      L(
        'Sauna: fine any time, drink water. Ice baths right after lifting can blunt muscle growth — keep them for other days or skip.',
        'Сауна — будь-коли, пий воду. Крижана ванна одразу після силового може гальмувати ріст м’язів — у інші дні або зовсім без неї.',
      ),
  },
  {
    id: 'nap',
    all: [['nap', 'short sleep before', 'денний сон', 'поспати вдень', 'подрімати']],
    answer: (_c, _p, L) =>
      L(
        'A 20–30 min nap helps after a short night. Keep it before ~3 pm so it doesn’t cost you the night.',
        'Денний сон 20–30 хв допомагає після короткої ночі. До ~15:00 — щоб не зіпсувати ніч.',
      ),
  },
  {
    id: 'stress',
    all: [
      [
        'stress*',
        'anxious',
        'bad day',
        'depressed',
        'burned out',
        'стрес*',
        'тривож*',
        'поганий день',
        'нерви',
        'важкий день',
      ],
    ],
    answer: (_c, _p, L) =>
      L(
        'Hard day: train anyway, but lighter — it helps the head more than the muscles. If it’s been weeks, talk to someone; that matters more than any programme.',
        'Важкий день — тренуйся, але легше: голові це допомагає більше, ніж м’язам. Якщо так уже тижнями — поговори з кимось; це важливіше за будь-яку програму.',
      ),
  },

  // ---- safety, age, nerves ----
  {
    id: 'bench_alone',
    all: [
      [
        'alone',
        'no spotter',
        'without spotter',
        'safety',
        'fail a rep',
        'сам',
        'без страхув*',
        'безпек*',
        'не дожав',
        'застряг під',
      ],
    ],
    answer: (_c, _p, L) =>
      L(
        'Alone: bench in a rack with safety pins, no collars (so you can tip the plates), or use dumbbells. Squat with safeties set just below your bottom position.',
        'Сам: жим у рамі з обмежувачами, без замків (щоб скинути млинці), або гантелі. Присід — з обмежувачами трохи нижче нижньої точки.',
      ),
  },
  {
    id: 'age',
    all: [
      [
        'too old',
        'after 40',
        'after 50',
        'older',
        'age',
        'старий',
        'після 40',
        'після 50',
        'вік',
        'пізно почин*',
      ],
    ],
    answer: (_c, _p, L) =>
      L(
        'Never too late — strength training matters more with age, not less. Longer warm-ups, a bit more recovery, same principles.',
        'Ніколи не пізно — з віком силові важать більше, не менше. Довша розминка, трохи більше відновлення, ті самі принципи.',
      ),
  },
  {
    id: 'gym_anxiety',
    all: [
      [
        'embarrass*',
        'scared',
        'nervous',
        'everyone looks',
        'judge',
        'соромно',
        'страшно',
        'боюся',
        'всі дивляться',
        'засуджу*',
        'ніяково',
      ],
    ],
    answer: (_c, _p, L) =>
      L(
        'Nobody is watching you — they’re watching themselves in the mirror. Go at a quiet hour, have the plan open, headphones in. Week three it’s normal.',
        'На тебе ніхто не дивиться — всі дивляться на себе в дзеркало. Приходь у тиху годину, план відкритий, навушники. На третій тиждень — звично.',
      ),
  },

  // ---- the app's corners ----
  {
    id: 'app_backfill',
    all: [
      [
        'past',
        'forgot to log',
        'add old',
        'backfill',
        'минул*',
        'забув записати',
        'додати старе',
        'заднім числом',
      ],
    ],
    answer: (_c, _p, L) =>
      L(
        'Today → the ⟲ button in the bottom pill → log a past session with its date and time.',
        'Сьогодні → кнопка ⟲ у нижній панелі → записати минуле тренування з датою й часом.',
      ),
  },
  {
    id: 'app_units',
    all: [['pounds', 'lbs', 'lb', 'units', 'kilograms', 'фунт*', 'одиниц*', 'кілограм*']],
    answer: (_c, _p, L) =>
      L(
        'Profile → Settings → “Units” → kg or lb. It applies everywhere in the app.',
        'Профіль → Налаштування → «Одиниці» → кг або lb. Діє для всього додатка.',
      ),
  },
  {
    id: 'app_language',
    all: [['language', 'english', 'ukrainian', 'мова', 'мову', 'англійськ*', 'українськ*']],
    answer: (_c, _p, L) =>
      L(
        'The flag in the top-right corner switches the language. I follow it.',
        'Прапорець у правому верхньому куті перемикає мову. Я підлаштуюся.',
      ),
  },
  {
    id: 'app_delete',
    all: [
      ['delete', 'remove', 'undo', 'видалит*', 'прибрат*', 'скасуват*'],
      ['session', 'workout', 'set', 'exercise', 'тренуван*', 'сет*', 'вправ*'],
    ],
    answer: (_c, _p, L) =>
      L(
        "In a session: tap a set → “Delete set”; the exercise menu has “Delete exercise”. A whole workout: open it from History → the bin icon at the top → confirm. Deleting a workout can't be undone.",
        'У тренуванні: тапни підхід → «Видалити підхід»; у меню вправи — «Видалити вправу». Усе тренування: відкрий з Історії → кошик угорі → підтвердь. Видалення тренування не можна скасувати.',
      ),
  },
  {
    id: 'app_playbook',
    all: [['playbook', 'templates', 'routines', 'плейбук', 'шаблон*', 'рутин*']],
    answer: (_c, _p, L) =>
      L(
        'Playbook = your usual days, learned from what you log. Start one and the lifts load in your order.',
        'Playbook — твої звичні дні, вивчені з журналу. Запусти один — вправи підтягнуться в твоєму порядку.',
      ),
  },
  {
    id: 'app_streak_rules',
    all: [
      ['streak', 'серія', 'серію'],
      ['how', 'rules', 'count', 'break', 'rest day', 'як', 'рахується', 'ламається', 'вихідн*'],
    ],
    answer: (_c, _p, L) =>
      L(
        'The streak counts days you trained or logged an activity; planned rest periods and illness don’t break it.',
        'Серія рахує дні з тренуванням або активністю; заплановані періоди відпочинку й хвороба її не ламають.',
      ),
  },
  {
    id: 'app_sleep_tracking',
    all: [
      ['sleep', 'сон', 'сну'],
      ['track', 'log', 'record', 'automatic', 'записувати', 'відстежув*', 'автоматичн*'],
    ],
    answer: (_c, _p, L) =>
      L(
        'Sleep: set a schedule and turn on auto-log — nights start and end by themselves; fix any night from History.',
        'Сон: задай розклад і ввімкни автозапис — ночі починаються й закінчуються самі; будь-яку ніч можна виправити в Історії.',
      ),
  },

  // ---- more small talk ----
  {
    id: 'do_you_lift',
    all: [['do you lift', 'do you train', 'can you lift', 'ти качаєшся', 'ти тренуєшся', 'а ти']],
    maxWords: 5,
    answer: (c, _p, L) =>
      moody(c, L, {
        g: [
          [
            'Haha, bro, I carry your whole log! Heavier than it looks 💪',
            'Ха, бро, я тягаю весь твій журнал! Він важчий, ніж здається 💪',
          ],
          [
            'Dude, I lift your stats every single day. We’re a team 🤙',
            'Братан, я щодня тягаю твою статистику. Ми ж команда 🤙',
          ],
        ],
        y: [
          ['I carry your log. Heavier than it looks.', 'Я ношу твій журнал. Важчий, ніж здається.'],
          ['Every set you log. Daily.', 'Кожен твій записаний підхід. Щодня.'],
        ],
        r: [
          [
            'I carry your log. Honestly? Suspiciously light.',
            'Я ношу твій журнал. Чесно? Підозріло легкий.',
          ],
          ['More often than you, apparently.', 'Частіше за тебе, як бачу.'],
          [
            '*sigh* I lift your excuses every day. Heaviest thing in here.',
            '*зітхає* Щодня тягаю твої відмазки. Найважче, що тут є.',
          ],
        ],
      }),
  },
  {
    id: 'compliment',
    all: [
      [
        'you re the best',
        'love you',
        'great coach',
        'awesome',
        'ти найкращ*',
        'люблю тебе',
        'класний',
        'дякую тренер',
        'крутий',
      ],
    ],
    answer: (c, _p, L) =>
      moody(c, L, {
        g: [
          [
            'Aww, bro, you’re the best too! 🤙 Now let’s go prove it in the gym.',
            'Ой, бро, та ти сам красава! 🤙 Го доводити це в залі.',
          ],
          [
            'Big W, dude, appreciate it! Same energy under the bar, deal?',
            'Дякую, братан, аж приємно! Таку ж енергію — під штангу, домовились?',
          ],
          ['Let’s gooo! Team us 💪', 'Кайф! Ми з тобою — команда 💪'],
        ],
        y: [
          ['Noted. Now earn it back in the gym.', 'Прийнято. А тепер відпрацюй у залі.'],
          ['Flattery won’t add plates to the bar.', 'Лестощами млинці на гриф не почепиш.'],
          ['I know. Your turn.', 'Знаю. Тепер твоя черга.'],
        ],
        r: [
          [
            'Flattery. Classic move from someone who skipped their last session.',
            'Лестощі. Класичний прийом того, хто пропустив останнє тренування.',
          ],
          [
            'Sweet. Now show that enthusiasm in your log, gym tourist.',
            'Зворушливо. А тепер покажи такий самий ентузіазм у журналі, туристе.',
          ],
          [
            'Nice try. Sucking up to the coach won’t get you out of leg day.',
            'Гарна спроба. Підлизуванням день ніг не відкосиш.',
          ],
        ],
      }),
  },
  {
    id: 'sorry',
    all: [['sorry', 'my bad', 'apologize', 'вибач*', 'пробач*', 'сорі', 'перепрошую']],
    maxWords: 6,
    answer: (c, _p, L) =>
      moody(c, L, {
        g: [
          [
            'No stress, man, all good 🤙 Just show up next time.',
            'Та не парся, бро, все норм 🤙 Просто приходь наступного разу.',
          ],
          [
            'Bro, nothing to forgive. We go again tomorrow 💪',
            'Братан, нема за що вибачатись. Завтра надолужимо 💪',
          ],
          [
            'All good, dude. Life happens — the gym’s not going anywhere.',
            'Спокуха, буває. Зал нікуди не дінеться.',
          ],
        ],
        y: [
          ['Don’t apologise. Show up.', 'Не вибачайся. Приходь.'],
          [
            'Apology accepted. Attendance preferred.',
            'Вибачення прийняті. Тренування було б краще.',
          ],
        ],
        r: [
          [
            '“Sorry” doesn’t lift anything, couch warrior.',
            '«Вибач» штангу не підніме, диванний воїне.',
          ],
          [
            '*sigh* Save it. I’ve heard more apologies from you than I’ve seen sets.',
            '*зітхає* Облиш. Вибачень від тебе я чув більше, ніж бачив підходів.',
          ],
          [
            'An apology. How original, gym tourist. Just show up.',
            'Знову вибачення. Оригінально, туристе. Краще просто прийди.',
          ],
        ],
      }),
  },
];
