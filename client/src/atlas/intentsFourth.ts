/**
 * Atlas's answer base, part four: calculators (plates, reps at a weight, % of
 * max, warm-up ramp for YOUR working weight), exercise knowledge from the
 * catalog (muscles worked, alternatives your gym has), your log by day and
 * week-vs-week, time-pressed training, health and safety edges (conditions,
 * PEDs, cycle, pregnancy), conditioning (heart-rate zones, HIIT, running,
 * steps), posture, other sports, home equipment, and "what can I ask".
 */
import { muscleSetsInWorkout, resolveMuscles, setTopWeight, setTypeOf, topSet } from '../store';
import { solvePlates } from '../plates';
import { rankExercisesForMuscle } from '../sessionBuilder';
import type { Exercise } from '../types';
import { liftPoints } from './liftStats';
import { DAY, WEEK, date, finishedOf, wd, type AskCtx, type Intent } from './intentKit';

/** Numbers mentioned in the question ("100 kg", "80%", "5 reps"). */
function numbers(phrase: string): number[] {
  return (phrase.match(/\d+(?:[.,]\d+)?/g) ?? []).map((x) => Number(x.replace(',', '.')));
}

/** Best estimated max over your last 12 loaded sessions of this lift (however long ago). */
function recentBest1rm(c: AskCtx, name: string): number {
  const pts = liftPoints(c, name)
    .filter((p) => !p.bw)
    .slice(-12);
  return Math.max(0, ...pts.map((p) => p.score));
}

function lastTop(c: AskCtx, name: string): { kg: number; reps: number } | null {
  for (const w of finishedOf(c)) {
    const ex = w.exercises.find((e) => e.name === name);
    const t = ex ? topSet(ex.sets) : undefined;
    if (t) return { kg: setTopWeight(t), reps: t.reps };
  }
  return null;
}

const round25 = (kg: number) => Math.round(kg / 2.5) * 2.5;

const WEEKDAYS: [number, string[]][] = [
  [1, ['monday', 'понеділ*']],
  [2, ['tuesday', 'вівтор*']],
  [3, ['wednesday', 'серед*']],
  [4, ['thursday', 'четвер*']],
  [5, ['friday', 'п’ятниц*', 'пятниц*']],
  [6, ['saturday', 'субот*']],
  [0, ['sunday', 'неділ*']],
];

export const INTENTS_FOURTH: Intent[] = [
  // ---- calculators ----
  {
    id: 'plate_math',
    all: [
      [
        'plates',
        'plate',
        'load the bar',
        'load',
        'loading',
        'млинц*',
        'блин*',
        'навісити',
        'повісити',
      ],
    ],
    answer: (c, p, L) => {
      const kg = numbers(p.phrase).find((n) => n >= 20 && n <= 500);
      if (!kg)
        return L(
          'Tell me the total, e.g. “plates for 100 kg”.',
          'Скажи загальну вагу, напр. «млинці на 100 кг».',
        );
      const sol = solvePlates(kg, { barKg: 20, unit: 'kg' });
      const per = sol.perSide.length ? sol.perSide.join(' + ') : '—';
      return L(
        `${c.fmt.kg(kg)} on a 20 kg bar: per side ${per}${sol.exact ? '' : ` (closest: ${c.fmt.kg(sol.achievedKg)})`}.`,
        `${c.fmt.kg(kg)} на грифі 20 кг: з кожного боку ${per}${sol.exact ? '' : ` (найближче: ${c.fmt.kg(sol.achievedKg)})`}.`,
      );
    },
  },
  {
    id: 'reps_at_weight',
    all: [
      [
        'how many reps',
        'reps at',
        'reps with',
        'скільки повторів',
        'скільки разів',
        'на скільки повторів',
      ],
    ],
    needs: 'exercise',
    answer: (c, p, L) => {
      const kg = numbers(p.phrase).find((n) => n >= 5);
      const e1 = recentBest1rm(c, p.exercise!);
      if (!kg || !e1) return null;
      const reps = Math.max(0, Math.floor(30 * (e1 / kg - 1)));
      const name = c.fmt.exercise(p.exercise!);
      return reps < 1
        ? L(
            `${name} at ${c.fmt.kg(kg)}: above your estimated max (~${c.fmt.kg(Math.round(e1))}). Not today.`,
            `${name} з ${c.fmt.kg(kg)}: понад твій розрахунковий максимум (~${c.fmt.kg(Math.round(e1))}). Не сьогодні.`,
          )
        : L(
            `${name} at ${c.fmt.kg(kg)}: about ${Math.min(reps, 30)} reps to failure, going by your recent sets.`,
            `${name} з ${c.fmt.kg(kg)}: приблизно ${Math.min(reps, 30)} повторів до відмови, судячи з останніх сетів.`,
          );
    },
  },
  {
    id: 'percent_max',
    all: [['%', 'percent', 'відсот*', 'процент*']],
    needs: 'exercise',
    answer: (c, p, L) => {
      const pct = numbers(p.phrase).find((n) => n > 0 && n <= 100);
      const e1 = recentBest1rm(c, p.exercise!);
      if (!pct || !e1) return null;
      return L(
        `${pct}% of your estimated ${c.fmt.exercise(p.exercise!)} max (~${c.fmt.kg(Math.round(e1))}) is ${c.fmt.kg(round25((e1 * pct) / 100))}.`,
        `${pct}% від розрахункового максимуму в ${c.fmt.exercise(p.exercise!)} (~${c.fmt.kg(Math.round(e1))}) — це ${c.fmt.kg(round25((e1 * pct) / 100))}.`,
      );
    },
  },
  {
    id: 'warmup_lift',
    all: [['warm up', 'warmup', 'warm-up', 'ramp', 'розмин*', 'підвідн*']],
    needs: 'exercise',
    answer: (c, p, L) => {
      const t = lastTop(c, p.exercise!);
      if (!t || t.kg < 30) return null;
      const steps = [0.5, 0.7, 0.85].map((f) => c.fmt.kg(Math.max(20, round25(t.kg * f))));
      return L(
        `${c.fmt.exercise(p.exercise!)} (working ~${c.fmt.kg(t.kg)}): bar × 10, ${steps[0]} × 5, ${steps[1]} × 3, ${steps[2]} × 1, then work.`,
        `${c.fmt.exercise(p.exercise!)} (робоча ~${c.fmt.kg(t.kg)}): гриф × 10, ${steps[0]} × 5, ${steps[1]} × 3, ${steps[2]} × 1, далі робочі.`,
      );
    },
  },

  // ---- exercise knowledge ----
  {
    id: 'exercise_muscles',
    all: [
      [
        'what muscles',
        'which muscles',
        'what does',
        'works',
        'target*',
        'які м’язи',
        'які мязи',
        'що працює',
        'на що',
        'що качає',
      ],
    ],
    needs: 'exercise',
    answer: (c, p, L) => {
      const r = resolveMuscles({ name: p.exercise!, kind: 'strength' } as Exercise);
      if (!r.primary) return null;
      const sec = r.secondary.map((m) => c.fmt.muscle(m)).join(', ');
      return L(
        `${c.fmt.exercise(p.exercise!)}: mainly ${c.fmt.muscle(r.primary)}${sec ? `, also ${sec}` : ''}.`,
        `${c.fmt.exercise(p.exercise!)}: головно ${c.fmt.muscle(r.primary)}${sec ? `, також ${sec}` : ''}.`,
      );
    },
  },
  {
    id: 'alternatives',
    all: [
      [
        'alternative*',
        'instead of',
        'replace',
        'swap',
        'substitut*',
        'альтернатив*',
        'замість',
        'замінит*',
        'чим замінити',
      ],
    ],
    needs: 'exercise',
    answer: (c, p, L) => {
      const r = resolveMuscles({ name: p.exercise!, kind: 'strength' } as Exercise);
      if (!r.primary) return null;
      const gyms = c.s.gyms ?? [];
      const counts = new Map<string, number>();
      for (const w of finishedOf(c))
        if (w.gymId) counts.set(w.gymId, (counts.get(w.gymId) ?? 0) + 1);
      const gymId = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
      const gym = gyms.find((g) => g.id === gymId) ?? null;
      const alts = rankExercisesForMuscle(r.primary, gym)
        .filter((x) => x.name !== p.exercise)
        .slice(0, 3)
        .map((x) => c.fmt.exercise(x.name));
      return alts.length
        ? L(
            `Instead of ${c.fmt.exercise(p.exercise!)} (${c.fmt.muscle(r.primary)}): ${alts.join(', ')}${gym ? ` — all available at ${gym.name}` : ''}.`,
            `Замість ${c.fmt.exercise(p.exercise!)} (${c.fmt.muscle(r.primary)}): ${alts.join(', ')}${gym ? ` — усе є в ${gym.name}` : ''}.`,
          )
        : null;
    },
  },
  {
    id: 'sets_for_lift',
    all: [['how many sets', 'sets of', 'скільки сетів', 'скільки підходів']],
    needs: 'exercise',
    answer: (c, p, L) => {
      const counts = finishedOf(c)
        .slice(0, 10)
        .map(
          (w) =>
            w.exercises
              .find((e) => e.name === p.exercise)
              ?.sets.filter((s) => setTypeOf(s) !== 'warmup').length ?? 0,
        )
        .filter((n) => n > 0);
      const usual = counts.length
        ? Math.round(counts.reduce((a, b) => a + b, 0) / counts.length)
        : null;
      return L(
        `${c.fmt.exercise(p.exercise!)}: 3–4 hard sets is the sweet spot${usual ? `; you usually do ${usual}` : ''}.`,
        `${c.fmt.exercise(p.exercise!)}: 3–4 робочі сети — оптимум${usual ? `; ти зазвичай робиш ${usual}` : ''}.`,
      );
    },
  },

  // ---- your log by day ----
  {
    id: 'day_lookup',
    all: [
      [
        'what did i do',
        'what did i train',
        'on monday',
        'on tuesday',
        'on wednesday',
        'on thursday',
        'on friday',
        'on saturday',
        'on sunday',
        'що я робив',
        'що я тренував',
        'в понеділок',
        'у понеділок',
        'у вівторок',
        'в середу',
        'у середу',
        'в четвер',
        'у четвер',
        'в пятницю',
        'у пятницю',
        'в суботу',
        'у суботу',
        'в неділю',
        'у неділю',
      ],
    ],
    answer: (c, p, L) => {
      const day = WEEKDAYS.find(([, kws]) =>
        kws.some((k) => p.words.some((w) => w.startsWith(k.replace('*', '')))),
      );
      if (!day) return null;
      const w = finishedOf(c).find(
        (x) => new Date(x.startedAt).getDay() === day[0] && c.now - x.startedAt < WEEK + DAY,
      );
      if (!w)
        return L(
          `Nothing logged last ${wd(c, day[0])}.`,
          `Минулого разу в ${wd(c, day[0])} нічого не записано.`,
        );
      const lifts = w.exercises
        .filter((e) => e.sets.some((s) => setTypeOf(s) !== 'warmup'))
        .map((e) => {
          const t = topSet(e.sets);
          return t
            ? `${c.fmt.exercise(e.name)} ${c.fmt.kg(setTopWeight(t))}×${t.reps}`
            : c.fmt.exercise(e.name);
        })
        .slice(0, 5)
        .join(', ');
      return L(
        `${wd(c, day[0])} (${date(c, w.startedAt)}): ${lifts}.`,
        `${wd(c, day[0])} (${date(c, w.startedAt)}): ${lifts}.`,
      );
    },
  },
  {
    id: 'compare_weeks',
    all: [
      [
        'last week',
        'previous week',
        'week before',
        'минулого тижня',
        'минулим тижнем',
        'попереднім тижнем',
      ],
      ['compare', 'vs', 'versus', 'than', 'порівня*', 'ніж', 'проти'],
    ],
    answer: (c, _p, L) => {
      const f = finishedOf(c);
      const count = (from: number, to: number) =>
        f.filter((w) => w.startedAt >= from && w.startedAt < to);
      const a = count(c.now - WEEK, c.now + 1);
      const b = count(c.now - 2 * WEEK, c.now - WEEK);
      const sets = (ws: typeof f) =>
        ws.reduce((n, w) => n + [...muscleSetsInWorkout(w).values()].reduce((x, y) => x + y, 0), 0);
      return L(
        `This week: ${a.length} sessions, ${Math.round(sets(a))} sets. Last week: ${b.length} sessions, ${Math.round(sets(b))} sets.`,
        `Цей тиждень: ${a.length} тренувань, ${Math.round(sets(a))} сетів. Минулий: ${b.length} тренувань, ${Math.round(sets(b))} сетів.`,
      );
    },
  },

  // ---- time-pressed ----
  {
    id: 'short_on_time',
    all: [
      [
        'only',
        'no time',
        'short on time',
        'quick',
        'minutes',
        'тільки',
        'нема часу',
        'немає часу',
        'мало часу',
        'швидко',
        'хвилин*',
      ],
    ],
    answer: (_c, p, L) => {
      const m = numbers(p.phrase).find((n) => n >= 10 && n <= 90);
      if (
        !m &&
        !p.phrase.match(/no time|нема часу|немає часу|мало часу|short on time|quick|швидко/)
      )
        return null;
      return L(
        `${m ? `${m} minutes` : 'Short on time'}: 3 big lifts, 3 hard sets each, pair them as supersets, 60–90 s rest. Skip isolation. Done beats perfect.`,
        `${m ? `${m} хвилин` : 'Мало часу'}: 3 базові вправи по 3 робочі сети, у суперсети, відпочинок 60–90 с. Ізолюючі — пропусти. Зроблене краще за ідеальне.`,
      );
    },
  },
  {
    id: 'two_days_row',
    all: [
      [
        'two days in a row',
        'back to back',
        'every day',
        'consecutive',
        'два дні поспіль',
        'два дні підряд',
        'кожен день',
        'щодня',
      ],
    ],
    answer: (_c, _p, L) =>
      L(
        'Same muscle two days in a row: fine if it’s light or the first day was easy. Hard sessions for the same muscle want ~48 h apart. Different muscles — train daily if you recover.',
        'Той самий м’яз два дні поспіль — ок, якщо легко або перший день був легким. Важкі тренування одного м’яза — з інтервалом ~48 год. Різні м’язи — можна щодня, якщо відновлюєшся.',
      ),
  },
  {
    id: 'two_a_day',
    all: [
      [
        'twice a day',
        'two a day',
        'two sessions a day',
        'двічі на день',
        'два рази на день',
        'два тренування на день',
      ],
    ],
    answer: (_c, _p, L) =>
      L(
        'Twice a day works if you split it (e.g. lifting morning, easy cardio evening) and sleep enough. Two hard lifting sessions a day is rarely worth it.',
        'Двічі на день працює, якщо розділити (напр. силове вранці, легке кардіо ввечері) і висипатися. Два важкі силові на день — рідко виправдано.',
      ),
  },

  // ---- health & safety edges ----
  {
    id: 'health_conditions',
    all: [
      [
        'blood pressure',
        'hypertension',
        'diabetes',
        'asthma',
        'heart condition',
        'heart disease',
        'arrhythm*',
        'тиск*',
        'гіпертон*',
        'діабет*',
        'астм*',
        'серц*',
        'аритм*',
      ],
    ],
    neutral: true,
    answer: (_c, _p, L) =>
      L(
        "With a medical condition, get your doctor's OK first and tell them what you do. Lifting usually helps: breathe through reps (no long breath-holds), build up gradually, skip all-out grinders. High blood pressure: don't train on a day it's very high (around 180/110 or more). Diabetes on insulin or tablets that can cause lows: check your sugar before and carry fast carbs. Asthma: inhaler within reach. Stop with chest pain, dizziness or unusual breathlessness.",
        'З хронічним станом — спершу погодь із лікарем і розкажи, що саме робиш. Силові зазвичай допомагають: дихай під час повторів (без довгих затримок), навантаження — поступово, без граничних «дотискань». Високий тиск: не тренуйся в день, коли він дуже високий (близько 180/110 і вище). Діабет на інсуліні чи таблетках, що можуть давати гіпоглікемію: перевір цукор перед тренуванням і май при собі швидкі вуглеводи. Астма: інгалятор під рукою. Зупиняйся при болю в грудях, запамороченні чи незвичній задишці.',
      ),
  },
  {
    id: 'peds',
    all: [
      [
        'steroid*',
        'sarm*',
        'testosterone',
        'trt',
        'peds',
        'anabolic*',
        'стероїд*',
        'анабол*',
        'тестостерон*',
        'хімі*',
        'фарма',
      ],
    ],
    neutral: true,
    answer: (_c, _p, L) =>
      L(
        "I don't coach drugs. They carry real risks (heart, liver, hormones, fertility) and belong only under a doctor. If you're already using, don't hide it from a doctor — get your blood pressure and bloodwork checked. Everything you need to progress for years is in training, food and sleep.",
        'Препарати я не веду. Реальні ризики (серце, печінка, гормони, фертильність), і лише під наглядом лікаря. Якщо вже вживаєш — не приховуй від лікаря, перевір тиск і аналізи крові. Все, що треба для прогресу роками, — тренування, їжа й сон.',
      ),
  },
  {
    id: 'cycle',
    all: [
      [
        'menstrua*',
        'pms',
        'місячн*',
        'менстру*',
        'менструальн* цикл',
        'my period',
        'on my period',
        'під час місячних',
        'месячн*',
      ],
    ],
    neutral: true,
    answer: (_c, _p, L) =>
      L(
        'Train through the cycle and adjust by feel: on heavy-symptom days go lighter or swap in easy cardio. Strength differences between phases are small — consistency matters more. If your periods stop or turn irregular while you train hard or eat little, or pain or bleeding is severe — see a doctor; lost periods are often a sign of eating too little for your training.',
        'Тренуйся протягом усього циклу й орієнтуйся на самопочуття: у дні з сильними симптомами — легше або легке кардіо. Різниця в силі між фазами мала — важливіша регулярність. Якщо місячні зникли чи збилися на тлі важких тренувань або малої кількості їжі, чи біль або кровотеча дуже сильні, — до лікаря: часто це ознака, що їжі замало для твого навантаження.',
      ),
  },
  {
    id: 'pregnancy',
    all: [['pregnan*', 'postpartum', 'вагітн*', 'після пологів', 'післяполог*']],
    neutral: true,
    answer: (_c, _p, L) =>
      L(
        'Pregnancy and postpartum: training is generally encouraged, but your doctor or midwife sets the limits. Later on, avoid long spells lying flat on your back, heavy breath-holding, overheating, fall or contact risks, and anything that causes pain or pressure. Stop and call your doctor with bleeding, leaking fluid, regular painful contractions, dizziness, chest pain, a bad headache or a swollen calf. After birth, get cleared first and rebuild the core and pelvic floor gradually.',
        'Вагітність і після пологів: тренування зазвичай рекомендують, але межі визначає лікар чи акушерка. На пізніх термінах — без тривалого лежання на спині, затримок дихання під вагою, перегріву, ризику падіння чи ударів і всього, що дає біль чи тиск. Зупинись і зателефонуй лікарю, якщо є кровотеча, підтікання рідини, регулярні болючі перейми, запаморочення, біль у грудях, сильний головний біль чи набрякла литка. Після пологів — спершу дозвіл лікаря, прес і тазове дно відновлюй поступово.',
      ),
  },

  // ---- conditioning ----
  {
    id: 'hr_zones',
    all: [['heart rate', 'zone 2', 'zone two', 'hr zone*', 'пульс*', 'зона 2', 'пульсов* зон*']],
    answer: (_c, _p, L) =>
      L(
        'Zone 2 ≈ you can still talk in full sentences (~60–70% of max HR). Most cardio for lifters belongs there; a little high-intensity on top builds fitness fast.',
        'Зона 2 — можеш говорити повними реченнями (~60–70% макс. пульсу). Більшість кардіо для силовиків — там; трохи інтенсиву зверху швидко підтягує форму.',
      ),
  },
  {
    id: 'hiit',
    all: [['hiit', 'intervals', 'interval training', 'tabata', 'інтервал*', 'табата']],
    answer: (_c, _p, L) =>
      L(
        'HIIT: 20–30 s hard, 60–90 s easy, 6–10 rounds, 1–2× a week. Bike or rower spare your legs; keep it away from heavy leg days.',
        'HIIT: 20–30 с важко, 60–90 с легко, 6–10 раундів, 1–2 рази на тиждень. Велотренажер чи гребний бережуть ноги; подалі від важкого дня ніг.',
      ),
  },
  {
    id: 'running',
    all: [
      ['run', 'running', 'jog*', '5k', '10k', 'marathon', 'біг*', 'бігат*', 'пробіжк*', 'марафон*'],
    ],
    answer: (_c, _p, L) =>
      L(
        'Running alongside lifting: mostly easy pace, add 10% distance a week at most, one quality session. Lift legs on a different day or before the run.',
        'Біг разом із силовими: здебільшого легкий темп, +10% дистанції на тиждень максимум, одне якісне тренування. Ноги — в інший день або перед бігом.',
      ),
  },
  {
    id: 'steps',
    all: [['steps', 'step count', '10000', 'walking', 'кроки', 'кроків', 'ходьба', 'ходити']],
    answer: (_c, _p, L) =>
      L(
        '7–10k steps a day covers most of the health benefit and helps fat loss more than you’d think. Walks also speed up recovery.',
        '7–10 тис. кроків на день дають більшість користі для здоров’я й допомагають схуднути більше, ніж здається. Прогулянки ще й пришвидшують відновлення.',
      ),
  },
  {
    id: 'posture',
    all: [['posture', 'rounded shoulders', 'hunch*', 'kyphosis', 'постав*', 'сутул*', 'горб*']],
    answer: (_c, _p, L) =>
      L(
        'Posture: more pulling than pushing (rows, face pulls, rear delts), strong upper back, and moving often. No single “correct” posture — the best one is the next one.',
        'Постава: тяг більше, ніж жимів (тяги, face pull, задня дельта), сильний верх спини й частіше рухатись. Єдиної «правильної» пози нема — найкраща та, що наступна.',
      ),
  },
  {
    id: 'other_sport',
    all: [
      [
        'football',
        'soccer',
        'boxing',
        'bjj',
        'mma',
        'tennis',
        'basketball',
        'climbing',
        'cycling',
        'swimming',
        'футбол*',
        'бокс*',
        'єдиноборств*',
        'теніс*',
        'баскетбол*',
        'скелелаз*',
        'плаван*',
        'вело',
      ],
      ['lift*', 'gym', 'strength', 'weights', 'train*', 'силов*', 'зал*', 'тренув*', 'кача*'],
    ],
    answer: (_c, _p, L) =>
      L(
        'Lifting for another sport: 2 sessions a week, big lifts, moderate volume, far from your hardest sport days. The sport comes first; the gym makes you harder to break.',
        'Силові для іншого спорту: 2 тренування на тиждень, базові вправи, помірний обсяг, подалі від найважчих спортивних днів. Спорт — першим; зал робить тебе міцнішим.',
      ),
  },
  {
    id: 'home_equipment',
    all: [
      [
        'home gym',
        'what to buy',
        'buy equipment',
        'dumbbells for home',
        'домашн* зал',
        'що купити',
        'купити гантел*',
        'обладнання для дому',
      ],
    ],
    answer: (_c, _p, L) =>
      L(
        'Home gym by value: adjustable dumbbells → a bench → a pull-up bar → bands. Later: rack, barbell, plates. That first set covers 90% of exercises.',
        'Домашній зал за цінністю: розбірні гантелі → лава → турнік → резинки. Далі: рама, штанга, млинці. Перший набір покриває 90% вправ.',
      ),
  },

  // ---- meta ----
  {
    id: 'what_can_i_ask',
    all: [
      [
        'what can i ask',
        'examples',
        'what to ask',
        'що можна спитати',
        'що питати',
        'приклади питань',
      ],
    ],
    answer: (_c, _p, L) =>
      L(
        'Anything about your training: “what should I train today”, “what weight next time on bench”, “am I recovered”, “how am I doing”, “plates for 100 kg”, “70% of my squat”, “alternative to leg press”. Then ask “why?” or “more”.',
        'Будь-що про тренування: «що тренувати сьогодні», «яку вагу на жим наступного разу», «я відновився?», «як мій прогрес», «млинці на 100 кг», «70% від присіду», «чим замінити жим ногами». Потім питай «чому?» чи «детальніше».',
      ),
    suggest: (L) => [
      L('What should I train today?', 'Що тренувати сьогодні?'),
      L('How am I doing?', 'Як мій прогрес?'),
      L('Plates for 100 kg', 'Млинці на 100 кг'),
    ],
  },
  {
    id: 'reminder',
    all: [['remind me', 'reminder', 'set an alarm', 'нагадай', 'нагадування', 'будильник']],
    answer: (_c, _p, L) =>
      L(
        'I remind you by myself when you skip a usual day and on Sunday evening — turn on notifications. Custom reminders aren’t something I can set yet.',
        'Я сам нагадую, коли пропускаєш звичний день, і в неділю ввечері — увімкни нотифікації. Власні нагадування поки не вмію ставити.',
      ),
  },
];
