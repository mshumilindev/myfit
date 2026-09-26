/**
 * Atlas's voice constructor. An answer's facts never change with the temper —
 * how they're said does. Every answer is dressed in the temper's manner:
 *
 *   [tic] [opener, with a way of addressing you] ANSWER
 *   [reaction to good / bad news] [joke — topical, or "your mom" in red when
 *   allowed] [closer, or a swear in red when allowed]
 *
 * Each language is written in its own words — Ukrainian lines are not
 * translations of English ones and vice versa, so the lists don't line up.
 * Choices are seeded by the question and the turn. Pain, injuries and the
 * body stay plain — no jokes there; red mocks effort, never the body.
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
  /** May joke in two answers running. */
  jokesInARow?: boolean;
}

const V: Record<Temper, Voice> = {
  // ---- green: your gym bro ---------------------------------------------------
  1: {
    open: [
      [
        'Yo {a}! ',
        'Dude. ',
        'Ayy, {a}! ',
        'Okay {a}, check it: ',
        'Ooh, good one! ',
        'Alright {a}, ',
        'Sup {a}. ',
        'Bro, listen: ',
      ],
      [
        'Йоу, {a}! ',
        'Хей, {a}! ',
        'О, {a}, ',
        'Слухай, {a}, ',
        'Ооо, кайфове питання! ',
        'Так-так, {a}, дивись: ',
        'Ну що, {a}, ',
        'Братан, лови: ',
      ],
    ],
    addr: [
      ['bro', 'dude', 'man', 'champ', 'my guy', 'beast'],
      ['бро', 'братан', 'брате', 'чемпіоне', 'друже', 'машино'],
    ],
    tic: [
      ['Yo! ', 'Ha! ', 'Sick! ', 'Ooh! '],
      ['Йоу! ', 'Ха! ', 'Кайф! ', 'О-о-о! '],
    ],
    good: [
      [
        'Big W, bro! 💪',
        "You're a machine!",
        "That's straight fire.",
        'Beast mode, fr.',
        'Look at you go!',
      ],
      ['Ну ти машина! 💪', 'Красава, реально!', 'Оце мощно, бро!', 'Топчик!', 'Бро, я аж пишаюсь!'],
    ],
    bad: [
      [
        "No stress, bro — we'll get it moving.",
        "All good, it's just a dip.",
        'Chill, we got this 🤙',
        'Happens to the best. We go again.',
      ],
      [
        'Спокуха, бро, розкачаємо.',
        'Не парся, це просто просадка.',
        'Все норм, прорвемось 🤙',
        "Буває з кожним. Наступного разу доб'ємо.",
      ],
    ],
    joke: [
      [
        'Squats are just sitting down with ambition.',
        'Leg day: when the stairs become a boss fight.',
        'Protein shakes are basically coffee for your muscles.',
        "Muscles grow while you sleep, so naps are technically training. You're welcome.",
        'Gym rule #1: never trust the guy who "only did cardio today".',
      ],
      [
        'Присід — це просто сісти, але з амбіціями.',
        'День ніг — це коли сходи стають квестом.',
        'Протеїн — це як кава, тільки для мʼязів.',
        'Мʼязи ростуть, поки спиш. Тож поспати вдень — теж тренування. Жиза.',
        'Правило залу номер один: не вір тому, хто «сьогодні тільки кардіо».',
      ],
    ],
    close: [
      [" Let's go, bro!", ' You got this 🤙', ' Stay strong, man!', ' Catch you at the gym!', ''],
      [' Го, бро!', ' Ти зможеш 🤙', ' Тримай кулак!', ' На звʼязку!', ''],
    ],
    rate: { open: 0.85, tic: 0.2, mood: 0.9, joke: 0.3, close: 0.65 },
  },
  // ---- yellow: straight talk -------------------------------------------------
  3: {
    open: [
      [
        'Straight up: ',
        'Look. ',
        'Real talk: ',
        'Bottom line: ',
        'Short version: ',
        'Here it is: ',
        'Okay. ',
      ],
      [
        'Коротко: ',
        'Слухай. ',
        'Без соплів: ',
        'По суті: ',
        'Так, дивись. ',
        'Власне, ',
        'Ну, короче. ',
      ],
    ],
    addr: [
      ['mate', 'pal', 'boss'],
      ['друже', 'шефе', 'брате'],
    ],
    tic: [
      ['Hm. ', 'Yeah. ', 'Pff. '],
      ['Хм. ', 'Ага. ', 'Пф. '],
    ],
    good: [
      [
        'Not bad. Genuinely.',
        "Fine, that's progress. Don't get cocky.",
        'Good. Keep doing exactly that.',
      ],
      ['Непогано. Без жартів.', 'Окей, це прогрес. Не зазнавайся.', 'Добре. Роби рівно те саме.'],
    ],
    bad: [
      [
        "That's a plateau. It won't fix itself.",
        'Stuck. Change something.',
        "Numbers don't lie — it's not moving.",
      ],
      ['Це плато. Саме не мине.', 'Застряг. Міняй щось.', 'Цифри не брешуть — воно стоїть.'],
    ],
    joke: [
      [
        "The weights won't lift themselves. I checked.",
        'Scrolling between sets is not cardio.',
        '"I\'ll start Monday" — the most popular program on earth.',
        "A mirror selfie isn't a set.",
      ],
      [
        'Гантелі самі себе не піднімуть. Я перевіряв.',
        'Гортати стрічку між підходами — не кардіо.',
        '«З понеділка почну» — найпопулярніша програма в країні.',
        'Селфі в дзеркалі — це не підхід.',
      ],
    ],
    close: [
      ['', " That's it.", ' Done.', ' Next.'],
      ['', ' От і все.', ' Крапка.', ' Далі.'],
    ],
    rate: { open: 0.7, tic: 0.15, mood: 0.8, joke: 0.3, close: 0.4 },
  },
  // ---- red: merciless — roasts the effort, never the body ---------------------
  5: {
    open: [
      [
        'Oh. You again. ',
        "Go on, ask. It's not like I have better things to do. ",
        '*heavy sigh* ',
        'Listen up, {a}. ',
        "I'll say it slowly, just for you: ",
        "Honestly don't know whether to laugh or cry. ",
        'Seriously? Fine. ',
        'Wow, a question. From you. ',
      ],
      [
        'О. Знову ти. ',
        'Ну питай, питай, мені ж нема чим зайнятись. ',
        '*важко зітхає* ',
        'Слухай сюди, {a}. ',
        'Поясню повільно, спеціально для тебе: ',
        'Навіть не знаю, сміятись чи плакати. ',
        'Серйозно? Ну добре. ',
        'Ого, питання. Від тебе. ',
      ],
    ],
    addr: [
      ['couch warrior', 'gym tourist', 'cupcake', 'buttercup', 'snowflake', 'champ'],
      ['диванний воїне', 'туристе', 'пиріжечку', 'сонечко', 'лінивцю', 'чемпіоне з лежання'],
    ],
    tic: [
      ['*eye roll* ', 'Ha. ', 'Tsk. ', '*slow clap* '],
      ['*закочує очі* ', 'Ха. ', 'Тц. ', '*повільно плескає* '],
    ],
    good: [
      [
        'Even a broken clock is right twice a day.',
        "Don't get used to it. It was an accident.",
        'Finally. Congratulations… to me, for my patience.',
      ],
      [
        'Раз на рік і палка стріляє.',
        'Не звикай. Це випадковість.',
        'Нарешті. Вітаю… себе, з витримкою.',
      ],
    ],
    bad: [
      [
        'As expected. From you.',
        "I'd be surprised, but no.",
        "Sad. Even for me, and I don't care.",
      ],
      [
        'Як і очікувалось. Від тебе.',
        'Я б здивувався, але ні.',
        'Сумно. Навіть мені, а мені байдуже.',
      ],
    ],
    joke: [
      [
        "If excuses were a lift, you'd hold the world record.",
        "You don't skip leg day. You skip leg month.",
        'You rest with the occasional set in between.',
        'Even your fitness tracker asked for a transfer.',
        "I've seen more intensity from a screensaver.",
        'Your warm-up is my cool-down. On a lazy day.',
      ],
      [
        'Якби відмовки були вправою, ти б тримав світовий рекорд.',
        'Ти не пропускаєш день ніг. Ти пропускаєш місяць ніг.',
        'У тебе не відпочинок між підходами, а підходи між відпочинком.',
        'Навіть твій фітнес-браслет попросив перевести його до когось іншого.',
        'Я бачив більше запалу в заставки на екрані.',
        'Твоя розминка — моя заминка. У лінивий день.',
      ],
    ],
    close: [
      [
        '',
        " Now go. You're exhausting.",
        " Dismissed. Don't embarrass me.",
        ' And no whining.',
        " I'm watching. Always.",
      ],
      [
        '',
        ' Все, іди. Ти мене втомив.',
        ' Вільний. Не ганьби мене.',
        ' І не скигли.',
        ' Я стежу. Завжди.',
      ],
    ],
    rate: { open: 0.95, tic: 0.3, mood: 0.95, joke: 0.6, close: 0.8 },
    jokesInARow: true,
  },
};

/** "Your mom…" — about effort, never about looks. Red only, when switched on. */
const MOM: Pair = [
  [
    'Your mom warms up with that weight.',
    'Your mom rests less between sets. I checked.',
    'Your mom called — she wants her kettlebell back.',
    "Your mom's deadlift has a better lockout. Just saying.",
    'Your mom does this at 6 a.m. before her coffee.',
  ],
  [
    'Твоя мама на цій вазі розминається.',
    'Твоя мама між підходами відпочиває менше. Я засікав.',
    'Дзвонила твоя мама — просить повернути її гирю.',
    'Твоя мама в становій дотискає краще. Просто факт.',
    'Твоя мама це робить о шостій ранку, ще до кави.',
  ],
];

/** Swearing — red only, and only when it's switched on. */
const SWEAR_OPEN: Pair = [
  ['Damn. ', 'Oh, hell. ', 'Bloody hell. ', 'Crap. ', 'For crying out loud. ', 'Freaking hell. '],
  [
    'Блін. ',
    'Бляха. ',
    'Твою ж дивізію. ',
    'Трясця. ',
    'Якого біса. ',
    'Капець. ',
    'Хай йому грець. ',
  ],
];
const SWEAR_CLOSE: Pair = [
  [
    ' Damn it.',
    ' Now move your lazy ass.',
    " And quit whining, for hell's sake.",
    ' Crap, just do it.',
  ],
  [
    ' Дідько.',
    ' А тепер ворушись, лінива дупо.',
    ' І не скигли, хай тобі грець.',
    ' Бляха, просто зроби це.',
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
        'Справжні друзі не дають пропускати день ніг.',
      ],
    ],
  ],
  [
    /cardio|run|steps|кардіо|біг|кроки/iu,
    [
      [
        'Cardio: pretending the treadmill is chasing you.',
        'Running is lifting, except the barbell is you.',
      ],
      [
        'Кардіо — це коли тікаєш від доріжки, а вона не відстає.',
        'Біг — та сама штанга, тільки штанга — це ти.',
      ],
    ],
  ],
  [
    /sleep|rest|recover|сон|відпоч|віднов/iu,
    [
      ['Sleep: the only supplement with zero side effects.', 'Muscles grow on the couch. Legally.'],
      ['Сон — єдина добавка без побічок.', 'Мʼязи ростуть на дивані. Цілком законно.'],
    ],
  ],
  [
    /protein|food|carb|eat|meal|білок|їж|вуглев|харч/iu,
    [
      [
        'Abs are made in the kitchen. Apparently biceps too.',
        'Chicken, rice, repeat. The gym haiku.',
      ],
      ['Прес робиться на кухні. Біцепс, схоже, теж.', 'Курка, рис, і знову курка. Меню чемпіона.'],
    ],
  ],
  [
    /bench|chest|жим|груд/iu,
    [
      [
        'International chest day is every Monday. Unofficially.',
        "At the gym, 'how much do you bench' counts as hello.",
      ],
      [
        'Всесвітній день грудей — щопонеділка. Неофіційно.',
        'У залі «скільки жмеш?» — це замість «привіт».',
      ],
    ],
  ],
  [
    /arm|bicep|curl|біцепс|рук/iu,
    [
      [
        'Curls in the squat rack are a crime in 40 countries.',
        'The gun show needs a ticket office.',
      ],
      [
        'Біцепс у стійці для присідань — злочин у сорока країнах.',
        'На такі «гармати» скоро квитки продаватимуть.',
      ],
    ],
  ],
];

const NO_JOKE =
  /pain|injur|hurt|sick|ill|numb|pregnan|period|cycle|bodyweight|weight_loss|fat_loss|eating|mental|stress|sleep_bad|med|doctor|cramp|dizzy|blood|heart|^app_|^safety|find_exercise|^calc$|off_topic|did_you_mean|memory/i;
/** Answers that found nothing — no joke on top of "I have no data". */
const EMPTY_ANSWER =
  /(nothing logged|no data|not logged|haven.?t logged|no (working )?sets|nothing (yet|found)|not enough|нічого не записано|немає даних|даних (ще )?немає|ще не записав|не знайшов|замало|недостатньо|сетів .*немає|записів нуль|поки (що )?нічого)/iu;

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
  /** Joked in the previous answer — most tempers don't do it twice in a row. */
  jokedLast?: boolean;
}

export interface Styled {
  text: string;
  joked: boolean;
}

/** Good or bad news in this answer? Read from the answer itself. */
export function moodOf(text: string): 'good' | 'bad' | null {
  // "records: 0", "no new records" — that's not a win.
  if (
    /((рекордів|records?|prs?)\s*:\s*0(?!\d)|нових рекордів нема|рекордів нема|no new (records|prs))/iu.test(
      text,
    )
  )
    return 'bad';
  // "didn't grow", "не виріс" — a negated win is not a win.
  if (
    /(not|didn.?t|hasn.?t|haven.?t|no|не|ні)\s+(\S+\s+)?(grow|grew|improv\S*|up|виріс|виросла|виросли|зрос\S*|покращ\S*|рекорд\S*|record)/iu.test(
      text,
    )
  )
    return 'bad';
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
  const quiet = NO_JOKE.test(s.topic) || EMPTY_ANSWER.test(text);
  const swear = s.swearing && s.temper === 5 && !quiet;
  const mom = s.yoMama && s.temper === 5 && !quiet;

  let head = '';
  // One opener at most — "Yo! Yo bro!" reads like a stutter.
  if (swear && r() < 0.45) head += pick(SWEAR_OPEN[li]);
  else if (r() < v.rate.tic) head += pick(v.tic[li]);
  else if (r() < v.rate.open) head += fill(pick(v.open[li]));
  // An opener ending in ", " / ": " flows into the answer — lower its first
  // letter unless it's a name ("Barbell…", "Жим…" stay).
  let body = text;
  if (/[,:—] $/.test(head) && /^\p{Lu}\p{Ll}+\s\p{Ll}/u.test(body) && !/^(I|Atlas)\b/.test(body))
    body = body[0].toLowerCase() + body.slice(1);

  const tail: string[] = [];
  const mood = moodOf(text);
  if (mood && !quiet && r() < v.rate.mood) tail.push(pick(v[mood][li]));

  let joked = false;
  // A reaction ("Not bad. No jokes.") and a joke on top contradict each other — one of them.
  if (
    !quiet &&
    !tail.some((x) => /без жартів|no jokes|not joking|не жартую/iu.test(x)) &&
    (!s.jokedLast || v.jokesInARow) &&
    r() < v.rate.joke
  ) {
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
    ["Wait, bro, didn't quite catch that. One of these?", 'Hmm, lost you there, dude. You mean:'],
    ['Стоп, бро, не допер. Ти про щось із цього?', 'Братан, щось я не вкурив. Ти мав на увазі:'],
  ],
  3: [
    ["Didn't catch that. Pick one:", 'Unclear. Which of these?'],
    ['Не зрозумів. Обирай:', 'Незрозуміло. Що з цього?'],
  ],
  5: [
    [
      '*sigh* Words. In order. Try it. Did you mean:',
      "I'm a coach, not a mind reader. One of these?",
      'That was English? Pick one, genius:',
    ],
    [
      '*зітхає* Слова. По порядку. Спробуй. Ти про це:',
      'Я тренер, а не екстрасенс. Щось із цього?',
      'Це була мова? Обирай, генію:',
    ],
  ],
};

export function unsureLine(temper: Temper, locale: string, seed: string): string {
  const r = rng(seed);
  const xs = UNSURE[temper][locale === 'uk' ? 1 : 0];
  return xs[Math.floor(r() * xs.length) % xs.length];
}

/**
 * Every English persona line (openers with each way of addressing you, tics,
 * closers, jokes, reactions) — the translated chat looks these up separately
 * from the answer they wrap.
 */
export function personaLinesEn(): string[] {
  const out = new Set<string>();
  const addFill = (t: string, addrs: string[]) => {
    if (!t.includes('{a}')) return void out.add(t);
    for (const a of addrs.filter(Boolean)) out.add(t.replace(/\{a\}/g, a));
    out.add(t.replace(/,? ?\{a\}/g, '').replace(/ {2,}/g, ' '));
  };
  for (const v of Object.values(V)) {
    const addrs = v.addr[0];
    for (const k of ['open', 'tic', 'close', 'joke', 'good', 'bad'] as const)
      for (const t of (v[k] as Pair)[0]) addFill(t, addrs);
  }
  for (const t of [
    ...MOM[0],
    ...SWEAR_OPEN[0],
    ...SWEAR_CLOSE[0],
    ...TOPIC_JOKES.flatMap(([, p]) => p[0]),
  ])
    out.add(t);
  return [...out].map((x) => x.trim()).filter(Boolean);
}
