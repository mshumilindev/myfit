/**
 * Atlas's voice constructor. An answer's facts never change with the temper —
 * how they're said does. Every answer is dressed by the temper's own manner:
 *
 *   [tic] [opener with a filler and a way of addressing you] ANSWER
 *   [reaction to good / bad news] [joke — topical, or "your mom" in Drill/
 *   Merciless when allowed] [closer, with a mild swear in Merciless when allowed]
 *
 * Choices are seeded by the question and the turn: the same question in the
 * same place reads the same (tests, consistency), two answers in a row don't
 * open alike. Pain, injuries and the body stay plain — no jokes there.
 */
import { lineAllowed } from './guard';
import type { Temper } from './types';

type Pair = [string[], string[]];

interface Voice {
  /** Openers; "{a}" = a way of addressing you. */
  open: Pair;
  /** How he calls you. */
  addr: Pair;
  /** Signature mannerisms at the very start. */
  tic: Pair;
  /** Said after good news (a record, growth). */
  good: Pair;
  /** Said after bad news (a stall, a drop, nothing logged). */
  bad: Pair;
  /** Jokes that fit the temper, any topic. */
  joke: Pair;
  close: Pair;
  /** How often each part shows up (0..1). */
  rate: { open: number; tic: number; mood: number; joke: number; close: number };
}

const V: Record<Temper, Voice> = {
  // ---- 1 · Warm: a friend who's genuinely happy you showed up -------------
  1: {
    open: [
      [
        'Oh, good one! ',
        'Ooh, I love this question. ',
        'So, {a}, ',
        'Okay, {a}! ',
        'Aw, you asked! ',
        'Right, {a} — ',
        'Honestly? Great question. ',
        "Let's see, {a}… ",
      ],
      [
        'О, класне питання! ',
        'Ох, люблю такі питання. ',
        'Так, {a}, дивись. ',
        'Ну що, {a}! ',
        'Ой, як добре, що спитав! ',
        'Дивись, {a} — ',
        'Слухай, чудове питання. ',
        'Зараз глянемо, {a}… ',
      ],
    ],
    addr: [
      ['friend', 'champ', 'buddy', 'star', 'legend'],
      ['друже', 'чемпіоне', 'сонце', 'зірко', 'легендо', 'золотце'],
    ],
    tic: [
      ['Hehe. ', 'Yay! ', 'Mm-hm! '],
      ['Хе-хе. ', 'Ура! ', 'Ага-ага! '],
    ],
    good: [
      [
        'Look at you go! 💪',
        "That's proper progress — I'm grinning.",
        'You should be proud of this one.',
        'See? Showing up pays off.',
      ],
      [
        'Та ти ж молодчина! 💪',
        'Оце прогрес — я аж усміхаюся.',
        'Можеш цим пишатися, серйозно.',
        'Бачиш? Те, що ти приходиш, працює.',
      ],
    ],
    bad: [
      [
        "Hey, it happens — we'll nudge it together.",
        "Don't sweat it, bodies have slow weeks.",
        "Small dip, big picture's fine. 🙂",
      ],
      [
        'Буває — підтягнемо разом.',
        'Не переймайся, в тіла бувають повільні тижні.',
        'Маленький провал, а загалом усе добре. 🙂',
      ],
    ],
    joke: [
      [
        'Fun fact: squats are just sitting down with ambition.',
        'Rest days are when your muscles do the growing and you do the snacking.',
        "Your muscles don't know it's Monday. Lucky them.",
        'Leg day: the only day stairs become a group project.',
        'Protein shakes: because chewing chicken all day gets old.',
      ],
      [
        'Цікавий факт: присід — це просто сісти, але з амбіціями.',
        'У день відпочинку мʼязи ростуть, а ти — перекушуєш. Чесний розподіл.',
        'Мʼязи не знають, що сьогодні понеділок. Щасливчики.',
        'День ніг — єдиний день, коли сходи стають командним проєктом.',
        'Протеїновий шейк — бо жувати курку цілий день набридає.',
      ],
    ],
    close: [
      [" You've got this!", ' Proud of you.', ' Keep it up, {a}!', ' One rep at a time. 🙂', ''],
      [' У тебе все вийде!', ' Пишаюся тобою.', ' Так тримати, {a}!', ' По одному повтору. 🙂', ''],
    ],
    rate: { open: 0.8, tic: 0.15, mood: 0.85, joke: 0.3, close: 0.6 },
  },
  // ---- 2 · Steady: calm, a little dry, like a good physio ------------------
  2: {
    open: [
      [
        'So. ',
        'Right. ',
        "Okay, here's the thing: ",
        "Let's look. ",
        'Well, ',
        'Short version: ',
        'Alright. ',
        'Mm. ',
      ],
      [
        'Отже. ',
        'Так. ',
        'Дивись, як є: ',
        'Глянемо. ',
        'Ну, ',
        'Якщо коротко: ',
        'Гаразд. ',
        'Мгм. ',
      ],
    ],
    addr: [
      ['', ''],
      ['', ''],
    ],
    tic: [
      ['Let me check. ', 'One sec. '],
      ['Секунду, гляну. ', 'Зараз. '],
    ],
    good: [
      ["That's a good trend.", 'Solid. Keep the same plan.', 'Numbers are moving the right way.'],
      ['Хороша тенденція.', 'Добре. План не міняємо.', 'Цифри рухаються куди треба.'],
    ],
    bad: [
      [
        'Not a crisis — adjust one thing and watch it for two weeks.',
        'Normal plateau territory.',
        'Worth a small change, nothing dramatic.',
      ],
      [
        'Не криза — поміняй одне й подивись два тижні.',
        'Звичайне плато.',
        'Варто змінити дрібницю, без драми.',
      ],
    ],
    joke: [
      [
        'As they say: the best program is the one you actually do.',
        "The barbell doesn't care about your mood. Useful, sometimes.",
        "Consistency is boring. That's why it works.",
        'No magic here, just reps. Sorry.',
      ],
      [
        'Як кажуть, найкраща програма — та, яку ти реально робиш.',
        'Штанзі байдуже на твій настрій. Іноді це навіть корисно.',
        'Регулярність нудна. Тому й працює.',
        'Магії нема, тільки повтори. Вибач.',
      ],
    ],
    close: [
      ['', '', " That's it.", ' Any questions — ask.'],
      ['', '', ' От і все.', ' Питання — питай.'],
    ],
    rate: { open: 0.55, tic: 0.06, mood: 0.6, joke: 0.12, close: 0.3 },
  },
  // ---- 3 · Blunt: no fluff, a bit of a smirk -------------------------------
  3: {
    open: [
      [
        'Straight: ',
        'Look. ',
        'Short answer: ',
        'No sugar-coating: ',
        'Right, so. ',
        'Basically, ',
        'Plainly: ',
        'Here it is: ',
      ],
      [
        'Прямо: ',
        'Слухай. ',
        'Коротко: ',
        'Без цукру: ',
        'Ну, короче. ',
        'Власне, ',
        'По ділу: ',
        'Ось як є: ',
      ],
    ],
    addr: [
      ['mate', 'pal', 'boss'],
      ['брате', 'друже', 'шефе'],
    ],
    tic: [
      ['Hm. ', 'Yeah. ', 'Pff. '],
      ['Хм. ', 'Ага. ', 'Пф. '],
    ],
    good: [
      [
        'Not bad. Genuinely not bad.',
        "Fine, that's progress. Don't get cocky.",
        'Good. Now keep doing exactly that.',
      ],
      [
        'Непогано. Реально непогано.',
        'Окей, це прогрес. Тільки не зазнавайся.',
        'Добре. Тепер роби рівно те саме.',
      ],
    ],
    bad: [
      [
        "That's a plateau. They don't fix themselves.",
        'Stuck. Change something.',
        "Numbers don't lie — this isn't moving.",
      ],
      ['Це плато. Само не пройде.', 'Застряг. Міняй щось.', 'Цифри не брешуть — воно стоїть.'],
    ],
    joke: [
      [
        "The weights won't lift themselves. I checked.",
        'Your excuses have better form than your squat.',
        "Scrolling between sets isn't cardio.",
        "'I'll start Monday' — the most popular program in the world.",
        "Mirror selfies don't count as a set.",
      ],
      [
        'Гантелі самі не піднімуться. Я перевіряв.',
        'Твої відмовки мають кращу техніку, ніж твій присід.',
        'Скролити стрічку між підходами — не кардіо.',
        '«З понеділка почну» — найпопулярніша програма у світі.',
        'Селфі в дзеркалі — це не підхід.',
      ],
    ],
    close: [
      ['', " That's it.", ' Done.', ' Next question.'],
      ['', ' От і все.', ' Крапка.', ' Наступне питання.'],
    ],
    rate: { open: 0.75, tic: 0.15, mood: 0.8, joke: 0.35, close: 0.4 },
  },
  // ---- 4 · Drill: a sergeant with a whistle ---------------------------------
  4: {
    open: [
      [
        'Listen up, {a}! ',
        'Eyes on me. ',
        'Attention! ',
        "Alright, {a}, here's the order: ",
        'Stand straight, {a}. ',
        'Hear this. ',
        'On my whistle: ',
        'Report, {a}: ',
      ],
      [
        'Слухай сюди, {a}! ',
        'Очі на мене. ',
        'Струнко! ',
        'Так, {a}, наказ такий: ',
        'Рівняйсь, {a}. ',
        'Запамʼятай. ',
        'За моїм свистком: ',
        'Доповідаю, {a}: ',
      ],
    ],
    addr: [
      ['recruit', 'private', 'soldier', 'rookie', 'cadet'],
      ['рекрут', 'боєць', 'салага', 'курсант', 'солдате'],
    ],
    tic: [
      ['*whistle* ', 'HUP! ', 'One-two! '],
      ['*свисток* ', 'Раз-два! ', 'ХОП! '],
    ],
    good: [
      [
        "OUTSTANDING. Don't let it go to your head.",
        "That's what I like to see. Again!",
        'Good. Now double down.',
      ],
      [
        'ВІДМІННО. Тільки не розслабляйся.',
        'Оце я розумію. Ще раз!',
        'Добре. Тепер удвічі старанніше.',
      ],
    ],
    bad: [
      [
        'UNACCEPTABLE. We fix this. Today.',
        'Stalled? Then you work harder, not whine louder.',
        "That's a retreat, soldier. We don't retreat.",
      ],
      [
        'НЕПРИЙНЯТНО. Виправляємо. Сьогодні.',
        'Стоїть? Значить, працюєш більше, а не ниєш голосніше.',
        'Це відступ, бійцю. Ми не відступаємо.',
      ],
    ],
    joke: [
      [
        'Pain is weakness leaving the body. Soreness is it filing a complaint.',
        'Drop and give me twenty — thoughts about your form.',
        'In my army, rest days are a rumour.',
        "The only thing you'll skip is dessert.",
        "Leg day isn't optional. It's a lifestyle.",
      ],
      [
        'Біль — це слабкість, що виходить із тіла. Крепатура — вона ж пише скаргу.',
        'Упор лежачи і двадцять… думок про свою техніку.',
        'У моїй армії день відпочинку — це чутки.',
        'Єдине, що ти пропустиш, — це десерт.',
        'День ніг — не опція. Це спосіб життя.',
      ],
    ],
    close: [
      [' NOW MOVE!', ' No excuses.', ' Dismissed.', ' GO, {a}!', " Understood? I CAN'T HEAR YOU."],
      [' А ТЕПЕР РУХАЙСЯ!', ' Без відмовок.', ' Вільно.', ' ВПЕРЕД, {a}!', ' Зрозумів? НЕ ЧУЮ.'],
    ],
    rate: { open: 0.85, tic: 0.25, mood: 0.85, joke: 0.45, close: 0.75 },
  },
  // ---- 5 · Merciless: bored, sardonic, secretly invested --------------------
  5: {
    open: [
      [
        'Oh. You again. ',
        'Wow, a question. ',
        '*sigh* Fine. ',
        'Since you insist, {a}: ',
        'Must I? Ugh. ',
        'Listen, {a}. ',
        'Look, {a}, ',
        'Brace yourself. ',
      ],
      [
        'О. Знову ти. ',
        'Ого, питання. ',
        '*зітхає* Гаразд. ',
        'Раз ти наполягаєш, {a}: ',
        'Мушу? Ех. ',
        'Слухай, {a}. ',
        'Дивись, {a}, ',
        'Тримайся. ',
      ],
    ],
    addr: [
      ['slacker', 'couch champion', 'cupcake', 'rookie', 'sunshine', 'hero'],
      ['лінивцю', 'чемпіоне дивана', 'булочко', 'новачку', 'сонечко', 'героє'],
    ],
    tic: [
      ['*eye roll* ', 'Hah. ', 'Tsk. '],
      ['*закочує очі* ', 'Ха. ', 'Тц. '],
    ],
    good: [
      [
        'Huh. Almost impressive. Almost.',
        "Look at that, you did a thing. Don't expect applause.",
        'Progress. From you. Noted with mild surprise.',
      ],
      [
        'Хм. Майже вражає. Майже.',
        'Гляди, щось вийшло. Оплесків не чекай.',
        'Прогрес. Від тебе. Відзначаю з легким подивом.',
      ],
    ],
    bad: [
      [
        'Predictable.',
        'Shocking. Truly nobody saw that coming.',
        'Stalled. Like your motivation.',
        "Well, that's tragic. Fix it.",
      ],
      [
        'Передбачувано.',
        'Шок. Ніхто такого не очікував. Ніхто.',
        'Стоїть. Як і твоя мотивація.',
        'Ну, трагедія. Виправляй.',
      ],
    ],
    joke: [
      [
        'Your warm-up is my working set. On a bad day.',
        "I've seen more tension in a wet noodle.",
        "Those aren't 'light weights', that's just your ceiling.",
        'Your rest times have their own rest times.',
        'Even your shadow skips leg day.',
      ],
      [
        'Твоя розминка — мій робочий підхід. У поганий день.',
        'Я бачив більше напруги в розвареній макаронині.',
        'Це не «легка вага», це твоя стеля.',
        'У твоїх пауз між підходами є власні паузи.',
        'Навіть твоя тінь пропускає день ніг.',
      ],
    ],
    close: [
      [
        '',
        ' Try to keep up.',
        " Don't disappoint me. More than usual.",
        " I'll be watching.",
        ' Go on, then.',
      ],
      [
        '',
        ' Спробуй встигати.',
        ' Не розчаруй мене. Більше, ніж зазвичай.',
        ' Я стежитиму.',
        ' Ну, вперед.',
      ],
    ],
    rate: { open: 0.9, tic: 0.25, mood: 0.9, joke: 0.55, close: 0.7 },
  },
};

/** "Your mom…" — about effort, never about looks. Drill and Merciless, when on. */
const MOM: Pair = [
  [
    'Your mom warms up with that weight.',
    'Your mom rests less between sets. I checked.',
    'Your mom called — she wants her kettlebell back.',
    "Your mom's deadlift has better lockout. Just saying.",
    'Your mom does this at 6 a.m. before coffee.',
  ],
  [
    'Твоя мама на цій вазі розминається.',
    'Твоя мама відпочиває між підходами менше. Я перевіряв.',
    'Дзвонила твоя мама — просить повернути її гирю.',
    'У твоєї мами в становій краще дотискання. Просто кажу.',
    'Твоя мама робить це о шостій ранку, ще до кави.',
  ],
];

/** Mild swearing — Merciless only, and only when it's switched on. */
const SWEAR_OPEN: Pair = [
  ['Damn. ', 'Hell, ', 'Bloody hell. ', 'Crap. ', 'Oh, for crying out loud. '],
  ['Блін. ', 'Чорт, ', 'Бляха-муха. ', 'Трясця. ', 'Хрін там. ', 'Ну капець. '],
];
const SWEAR_CLOSE: Pair = [
  [' Damn it.', ' Now bloody move.', " And don't whine, hell.", ' Crap, just do it.'],
  [
    ' Чорт забирай.',
    ' А тепер рухай своїм, блін, задом.',
    ' І не скигли, трясця.',
    ' Бляха, просто зроби.',
  ],
];

/** Topic jokes: by answer topic (intent id / words). */
const TOPIC_JOKES: [RegExp, Pair][] = [
  [
    /leg|squat|присід|ноги|lunge/iu,
    [
      ['Leg day: the day stairs become your enemy.', "Friends don't let friends skip leg day."],
      [
        'День ніг — день, коли сходи стають ворогами.',
        'Друзі не дають друзям пропускати день ніг.',
      ],
    ],
  ],
  [
    /cardio|run|steps|кардіо|біг|кроки/iu,
    [
      [
        'Cardio: the part where you pretend the treadmill is chasing you.',
        'Running: like lifting, but the barbell is you.',
      ],
      [
        'Кардіо — це коли вдаєш, що доріжка за тобою женеться.',
        'Біг — як тяга, тільки штанга — це ти.',
      ],
    ],
  ],
  [
    /sleep|rest|recover|сон|відпоч|віднов/iu,
    [
      ['Sleep: the only supplement with zero side effects.', 'Muscles grow on the couch. Legally.'],
      ['Сон — єдина добавка без побічок.', 'Мʼязи ростуть на дивані. Легально.'],
    ],
  ],
  [
    /protein|food|carb|eat|meal|білок|їж|вуглев|харч/iu,
    [
      [
        'Abs are made in the kitchen. Biceps too, apparently.',
        'Chicken, rice, repeat. The gym diet haiku.',
      ],
      ['Прес роблять на кухні. Біцепс, схоже, теж.', 'Курка, рис, повтор. Хайку спортзалу.'],
    ],
  ],
  [
    /bench|chest|жим|груд/iu,
    [
      [
        'International bench day is every Monday. Unofficially.',
        "Ask anyone at the gym: 'how much do you bench' is a greeting.",
      ],
      [
        'Міжнародний день жиму — щопонеділка. Неофіційно.',
        'У залі «скільки жмеш?» — це привітання.',
      ],
    ],
  ],
  [
    /arm|bicep|curl|біцепс|рук/iu,
    [
      [
        'Curls in the squat rack: a crime in 40 countries.',
        'Biceps: the gun show needs a ticket office.',
      ],
      [
        'Згинання в стійці для присідань — злочин у 40 країнах.',
        'Біцепс: гарматному шоу потрібна каса.',
      ],
    ],
  ],
];

/** Topics where jokes and swearing never go (pain, health, the body). */
const NO_JOKE =
  /pain|injur|hurt|sick|ill|numb|pregnan|period|cycle|bodyweight|weight_loss|fat_loss|eating|mental|stress|sleep_bad|med|doctor|cramp|dizzy|blood|heart/i;

export interface StyleCtx {
  temper: Temper;
  locale: string;
  /** "Your mom" lines switched on (and the temper allows them). */
  yoMama: boolean;
  /** Mild swearing switched on (and the temper allows it). */
  swearing: boolean;
  /** The topic (intent id) — for topical jokes and no-joke zones. */
  topic: string;
  /** Spoken plainly: pain, injuries, the body. */
  neutral?: boolean;
  /** Seed: the question + turn. */
  seed: string;
  /** Joked in the previous answer — don't do it twice in a row. */
  jokedLast?: boolean;
}

export interface Styled {
  text: string;
  joked: boolean;
}

/** Good or bad news in this answer? Read from the answer itself. */
export function moodOf(text: string): 'good' | 'bad' | null {
  if (
    /(\(\+\d|\+\d+ ?%|\+\d+\)|record|рекорд|виросла|виріс|grew|improved|up \(\+|більше \(\+)/iu.test(
      text,
    )
  )
    return 'good';
  if (
    /(−\d|\(-\d|-\d+%|flat\b|стоїть|просіл|dropped|down \(|менше \(|nothing (grew|logged)|нічого не|stall|застій|пропуст|skipped|behind)/iu.test(
      text,
    )
  )
    return 'bad';
  return null;
}

/** Tiny seeded random (mulberry32). */
function rng(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Dress an answer in the temper's manner. Facts stay exactly as they are. */
export function styled(text: string, s: StyleCtx): Styled {
  if (s.neutral || !text) return { text, joked: false };
  const v = V[s.temper];
  const li = s.locale === 'uk' ? 1 : 0;
  const r = rng(s.seed);
  const pick = <T>(xs: T[]) => xs[Math.floor(r() * xs.length) % xs.length];
  const addr = () => {
    const xs = v.addr[li].filter(Boolean);
    return xs.length ? pick(xs) : '';
  };
  const fill = (t: string) => {
    const a = addr();
    // No way to address you in this temper → drop the "{a}" and its comma.
    return a ? t.replace(/\{a\}/g, a) : t.replace(/,? ?\{a\}/g, '').replace(/ {2,}/g, ' ');
  };
  const quiet = NO_JOKE.test(s.topic);
  const swear = s.swearing && s.temper === 5 && !quiet;
  const mom = s.yoMama && s.temper >= 4 && !quiet;

  let head = '';
  if (r() < v.rate.tic) head += pick(v.tic[li]);
  if (swear && r() < 0.45) head += pick(SWEAR_OPEN[li]);
  else if (r() < v.rate.open) head += fill(pick(v.open[li]));
  // An opener ending in ", " / ": " flows into the answer — lower its first
  // letter unless it's a name ("Barbell…", "Жим…" stay).
  let body = text;
  if (/[,:—] $/.test(head) && /^\p{Lu}\p{Ll}+\s\p{Ll}/u.test(body) && !/^(I|Atlas)\b/.test(body))
    body = body[0].toLowerCase() + body.slice(1);

  const tail: string[] = [];
  const mood = moodOf(text);
  if (mood && r() < v.rate.mood) tail.push(pick(v[mood][li]));

  let joked = false;
  if (!quiet && !s.jokedLast && r() < v.rate.joke) {
    const topical = TOPIC_JOKES.find(([re]) => re.test(s.topic) || re.test(text))?.[1];
    const j =
      mom && r() < 0.4
        ? pick(MOM[li])
        : topical && r() < 0.6
          ? pick(topical[li])
          : pick(v.joke[li]);
    tail.push(j);
    joked = true;
  }

  let end = '';
  if (swear && r() < 0.35) end = pick(SWEAR_CLOSE[li]);
  else if (r() < v.rate.close) end = fill(pick(v.close[li]));

  const main = `${head}${body}`.replace(/\s+$/, '');
  const extra = tail.length ? ` ${tail.join(' ')}` : '';
  const out = `${main}${extra}${end}`.replace(/ {2,}/g, ' ');
  // The same line the free chat must pass: hard tempers never touch the body.
  return lineAllowed(out, s.temper) ? { text: out, joked } : { text, joked: false };
}

/** "Not sure what you meant" — in the temper's own words. */
const UNSURE: Record<Temper, Pair> = {
  1: [
    [
      'Hmm, I want to get this right for you — did you mean:',
      'Ooh, not sure I caught that! Was it one of these?',
    ],
    [
      'Хм, хочу відповісти точно — ти мав на увазі:',
      'Ой, не впевнений, що зрозумів! Може, щось із цього?',
    ],
  ],
  2: [
    ['Not sure I got that. Did you mean:', 'Let me check I understood. One of these?'],
    [
      'Не впевнений, що зрозумів. Ти мав на увазі:',
      'Уточню, чи правильно зрозумів. Щось із цього?',
    ],
  ],
  3: [
    ["Didn't catch that. Pick one:", 'Unclear. Which of these?'],
    ['Не зрозумів. Обирай:', 'Незрозуміло. Що з цього?'],
  ],
  4: [
    ['SAY AGAIN, recruit? Pick one:', "Mumbling won't cut it. Which is it:"],
    ['ПОВТОРИ, бійцю! Обирай:', 'Не мимри. Що з цього:'],
  ],
  5: [
    [
      '*sigh* Words, please. In order. Did you mean:',
      "I'm a coach, not a mind reader. One of these?",
    ],
    [
      '*зітхає* Слова, будь ласка. По порядку. Ти мав на увазі:',
      'Я тренер, а не телепат. Щось із цього?',
    ],
  ],
};

export function unsureLine(temper: Temper, locale: string, seed: string): string {
  const r = rng(seed);
  const xs = UNSURE[temper][locale === 'uk' ? 1 : 0];
  return xs[Math.floor(r() * xs.length) % xs.length];
}
