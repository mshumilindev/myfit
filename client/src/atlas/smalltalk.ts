/**
 * Small talk — so Atlas reads like someone, not a lookup table. Every line
 * comes in three tones (soft = Warm/Steady, blunt, hard = Drill/Merciless),
 * rotates so repeats don't read alike, knows the time of day and, where it
 * helps, glances at your log (last session, streak, a lift to beat).
 * Small talk never goes through the "As I said" consistency layer.
 */
import { est1rm, setTopWeight, setTypeOf } from '../store';
import { hashId } from './voice';
import {
  DAY,
  finishedOf,
  loggedLifts,
  todayLine,
  type AskCtx,
  type Intent,
  type Tr,
} from './intentKit';

type Line = [string, string];
type Toned = { soft: Line[]; blunt: Line[]; hard: Line[] };

const tone = (c: AskCtx): keyof Toned =>
  c.temper <= 2 ? 'soft' : c.temper === 3 ? 'blunt' : 'hard';

/** Pick a line: changes minute to minute, never random within a render. */
function pick(c: AskCtx, id: string, lines: Line[], L: Tr): string {
  const seed = hashId(`${id}:${Math.floor(c.now / 60_000)}`);
  const x = lines[seed % lines.length];
  return L(x[0], x[1]);
}
const say = (c: AskCtx, id: string, t: Toned, L: Tr) => pick(c, id, t[tone(c)], L);

function partOfDay(c: AskCtx): 'morning' | 'day' | 'evening' | 'night' {
  const h = new Date(c.now).getHours();
  return h < 5 ? 'night' : h < 12 ? 'morning' : h < 18 ? 'day' : h < 23 ? 'evening' : 'night';
}

function daysSinceLast(c: AskCtx): number | null {
  const last = finishedOf(c)[0];
  return last ? Math.floor((c.now - (last.finishedAt ?? last.startedAt)) / DAY) : null;
}

/** Your most-done lift and its best recent set — something concrete to beat. */
function liftToBeat(c: AskCtx): { name: string; kg: number; reps: number } | null {
  const top = loggedLifts(c).sort((a, b) => b.count - a.count)[0];
  if (!top) return null;
  for (const w of finishedOf(c)) {
    const ex = w.exercises.find((e) => e.name === top.name);
    const sets = (ex?.sets ?? []).filter((s) => setTypeOf(s) !== 'warmup' && (s.weight ?? 0) > 0);
    if (!sets.length) continue;
    const best = sets.sort(
      (a, b) => est1rm(setTopWeight(b), b.reps) - est1rm(setTopWeight(a), a.reps),
    )[0];
    return { name: top.name, kg: setTopWeight(best), reps: best.reps };
  }
  return null;
}

// ---- greetings --------------------------------------------------------------------

const HELLO: Record<'morning' | 'day' | 'evening' | 'night', Toned> = {
  morning: {
    soft: [
      ['Morning! Slept well?', 'Доброго ранку! Виспався?'],
      ['Good morning — ready for a good day?', 'Доброго ранку — готовий до гарного дня?'],
    ],
    blunt: [
      ['Morning.', 'Ранок.'],
      ['Morning. Coffee first, then we talk.', 'Ранок. Спершу кава, потім розмова.'],
    ],
    hard: [
      ['Up already? Good. Stay that way.', 'Вже встав? Добре. Так і тримай.'],
      ['Morning. The bar doesn’t care how you slept.', 'Ранок. Штанзі байдуже, як ти спав.'],
    ],
  },
  day: {
    soft: [
      ['Hey! Good to see you.', 'Привіт! Радий тебе бачити.'],
      ['Hi there!', 'Привіт-привіт!'],
    ],
    blunt: [
      ['Hey.', 'Привіт.'],
      ['Here.', 'Я тут.'],
    ],
    hard: [
      ['You rang.', 'Кликав?'],
      ['Finally. I was getting bored of your log.', 'Нарешті. Твій журнал мені вже набрид.'],
    ],
  },
  evening: {
    soft: [
      ['Evening! How was your day?', 'Добрий вечір! Як минув день?'],
      ['Hey — winding down?', 'Привіт — вже відпочиваєш?'],
    ],
    blunt: [
      ['Evening.', 'Вечір.'],
      ['Hey. Late one?', 'Привіт. Пізно сьогодні?'],
    ],
    hard: [
      ['Evening. Did you earn it today?', 'Вечір. Ти сьогодні його заслужив?'],
      ['Oh, it’s you. At this hour.', 'О, це ти. О такій порі.'],
    ],
  },
  night: {
    soft: [
      ['Up late? Sleep is where the gains happen.', 'Не спиш? Прогрес росте уві сні.'],
      ['Hey night owl — don’t forget to sleep.', 'Привіт, сово — не забудь поспати.'],
    ],
    blunt: [
      ['It’s late. Sleep.', 'Пізно. Спати.'],
      ['Still up? Your recovery says no.', 'Ще не спиш? Твоє відновлення проти.'],
    ],
    hard: [
      ['Why are you awake. Bed. Now.', 'Чого не спиш. В ліжко. Зараз.'],
      [
        'Midnight chat instead of sleep. Bold. Stupid, but bold.',
        'Опівнічний чат замість сну. Сміливо. Дурнувато, але сміливо.',
      ],
    ],
  },
};

function greet(c: AskCtx, L: Tr): string {
  const hello = say(c, 'hello', HELLO[partOfDay(c)], L);
  const d = daysSinceLast(c);
  const hook =
    d === null
      ? L(
          'Log your first workout and I’ll have plenty to say.',
          'Запиши перше тренування — і мені буде що сказати.',
        )
      : d >= 5
        ? say(
            c,
            'hello-gap',
            {
              soft: [
                [
                  `It’s been ${d} days — shall we get back to it?`,
                  `Минуло ${d} дн. — повернемося?`,
                ],
              ],
              blunt: [
                [`${d} days since your last session.`, `${d} дн. від останнього тренування.`],
              ],
              hard: [[`${d} days. I counted. Every one.`, `${d} дн. Я рахував. Кожен.`]],
            },
            L,
          )
        : d === 0
          ? say(
              c,
              'hello-done',
              {
                soft: [['Nice work today!', 'Гарна робота сьогодні!']],
                blunt: [['You trained today. Good.', 'Сьогодні тренувався. Добре.']],
                hard: [
                  [
                    'You trained today. Don’t get comfortable.',
                    'Сьогодні тренувався. Не розслабляйся.',
                  ],
                ],
              },
              L,
            )
          : say(
              c,
              'hello-ask',
              {
                soft: [
                  ['What are we doing today?', 'Що робимо сьогодні?'],
                  ['Want today’s plan?', 'Показати план на сьогодні?'],
                ],
                blunt: [['Training today?', 'Сьогодні тренуєшся?']],
                hard: [
                  ['Training today, or just chatting?', 'Сьогодні тренуєшся чи тільки балакаєш?'],
                ],
              },
              L,
            );
  return `${hello} ${hook}`;
}

// ---- facts, challenges, quotes ------------------------------------------------------

const FACTS: Line[] = [
  [
    'Strength shows up before size: the first weeks are mostly your nervous system learning.',
    'Сила з’являється раніше за масу: перші тижні — це переважно нервова система вчиться.',
  ],
  [
    'Muscle protein synthesis stays up for ~24–48 h after a hard session — that’s why twice a week per muscle works.',
    'Синтез м’язового білка тримається ~24–48 год після важкого тренування — тому двічі на тиждень на м’яз працює.',
  ],
  [
    'One bad night can cut your reps by a few; a week of short sleep costs far more than any supplement adds.',
    'Одна погана ніч може забрати кілька повторів; тиждень недосипу коштує більше, ніж дасть будь-яка добавка.',
  ],
  [
    'Creatine is one of the most studied supplements in sport — and it’s cheap.',
    'Креатин — одна з найбільш досліджених добавок у спорті, і він дешевий.',
  ],
  [
    'Sets taken to 1–3 reps short of failure grow muscle almost as well as sets to failure — with less fatigue.',
    'Сети за 1–3 повтори до відмови ростять м’язи майже так само, як до відмови, — з меншою втомою.',
  ],
  [
    'You can’t spot-reduce fat — crunches build abs, the deficit shows them.',
    'Локально жир не спалиш: скручування будують прес, а показує його дефіцит.',
  ],
  [
    'Walking counts: 8–10k steps a day helps recovery and fat loss more than people think.',
    'Ходьба рахується: 8–10 тис. кроків на день допомагають і відновленню, і схудненню більше, ніж здається.',
  ],
  [
    'Your grip often fails before your back does — straps are a tool, not cheating.',
    'Хват часто здається раніше за спину — лямки це інструмент, а не чит.',
  ],
  [
    'Heavy lifting strengthens bones too — not just muscles.',
    'Важкі ваги зміцнюють ще й кістки, а не лише м’язи.',
  ],
  [
    'Muscle memory is real: regaining lost size is much faster than building it the first time.',
    'М’язова пам’ять існує: повернути втрачене набагато швидше, ніж набрати вперше.',
  ],
  [
    'Stretching before lifting doesn’t prevent injury much — a proper warm-up does.',
    'Розтяжка перед вагами мало захищає від травм — захищає нормальна розминка.',
  ],
  [
    'Most people rest too little between heavy sets and lose reps because of it.',
    'Більшість відпочиває між важкими сетами замало й через це втрачає повтори.',
  ],
];

const QUOTES: Toned = {
  soft: [
    ['Small plates add up. So do small wins.', 'Маленькі млинці додаються. Маленькі перемоги теж.'],
    [
      'You don’t need to feel ready. You need to show up.',
      'Не треба почуватися готовим. Треба прийти.',
    ],
    ['Progress is quiet. Keep going.', 'Прогрес тихий. Продовжуй.'],
  ],
  blunt: [
    [
      'Consistency beats intensity you can’t repeat.',
      'Регулярність перемагає інтенсивність, яку не повториш.',
    ],
    ['The log doesn’t lie.', 'Журнал не бреше.'],
    ['Do the boring work. It’s the work.', 'Роби нудну роботу. Вона і є робота.'],
  ],
  hard: [
    [
      'Motivation is for people who skip. You have a schedule.',
      'Мотивація — для тих, хто пропускає. У тебе є розклад.',
    ],
    [
      'The weight doesn’t care about your excuses. Neither do I.',
      'Вазі байдуже на твої відмовки. Мені теж.',
    ],
    [
      'Pain of discipline or pain of regret. Pick one. Quickly.',
      'Біль дисципліни або біль жалю. Обирай. Швидко.',
    ],
  ],
};

// ---- the intents -------------------------------------------------------------------

export const INTENTS_SMALL: Intent[] = [
  {
    id: 'whats_up',
    all: [
      [
        'whats up',
        'what s up',
        'sup',
        'wassup',
        'what s new',
        'whats new',
        'що нового',
        'як воно',
        'шо там',
        'що там',
        'як життя',
        'что нового',
        'как жизнь',
      ],
    ],
    maxWords: 5,
    answer: (c, _p, L) => {
      const d = daysSinceLast(c);
      const tail =
        d === null
          ? L('Nothing logged yet, so not much.', 'Нічого не записано — тож небагато.')
          : d === 0
            ? L(
                'You trained today — I’m still reading it.',
                'Ти сьогодні тренувався — ще перечитую.',
              )
            : L(
                `Last session was ${d} day${d === 1 ? '' : 's'} ago.`,
                `Останнє тренування — ${d} дн. тому.`,
              );
      return `${say(
        c,
        'sup',
        {
          soft: [['Not much — watching your progress!', 'Та нічого — стежу за твоїм прогресом!']],
          blunt: [['Reading your log.', 'Читаю твій журнал.']],
          hard: [
            [
              'Waiting for you to do something worth commenting on.',
              'Чекаю, коли ти зробиш щось варте коментаря.',
            ],
          ],
        },
        L,
      )} ${tail}`;
    },
  },
  {
    id: 'good_night',
    all: [
      [
        'good night',
        'goodnight',
        'night night',
        'на добраніч',
        'добраніч',
        'спокійної ночі',
        'на добранич',
        'спокойной ночи',
        'иду спать',
        'йду спати',
        'going to bed',
        'off to bed',
      ],
    ],
    maxWords: 5,
    answer: (c, _p, L) =>
      say(
        c,
        'gn',
        {
          soft: [
            [
              'Good night! 7–9 hours — that’s where the growing happens.',
              'На добраніч! 7–9 годин — саме тоді все й росте.',
            ],
            ['Sleep well — proud of today.', 'Добре виспись — сьогодні було добре.'],
          ],
          blunt: [
            ['Night. Phone away.', 'Добраніч. Телефон геть.'],
            ['Good. 8 hours.', 'Добре. 8 годин.'],
          ],
          hard: [
            ['Finally, a good decision. Go.', 'Нарешті правильне рішення. Йди.'],
            [
              'Sleep. I’ll be judging your log in the morning.',
              'Спи. Зранку буду судити твій журнал.',
            ],
          ],
        },
        L,
      ),
  },
  {
    id: 'tired',
    all: [
      [
        'tired',
        'exhausted',
        'no energy',
        'drained',
        'втомився',
        'втомилась',
        'втома',
        'нема сил',
        'немає сил',
        'сонний',
        'устал',
        'нет сил',
        'виснаж*',
      ],
    ],
    maxWords: 8,
    answer: (c, _p, L) => {
      const night = [...(c.s.sleeps ?? [])]
        .filter((s) => s.wake)
        .sort((a, b) => (b.wake ?? 0) - (a.wake ?? 0))[0];
      const hint =
        night && c.now - (night.wake ?? 0) < DAY
          ? L(
              ' Your sleep log agrees — go lighter today.',
              ' Твій сон це підтверджує — сьогодні легше.',
            )
          : '';
      return (
        say(
          c,
          'tired',
          {
            soft: [
              [
                'Then go easy: warm up and see how the first sets feel. Some days a short session is the win.',
                'Тоді легше: розімнись і подивись, як ідуть перші сети. Інколи коротке тренування — це вже перемога.',
              ],
            ],
            blunt: [
              [
                'Warm up first. If the first work set is slow, cut the session short — not the warm-up.',
                'Спершу розминка. Якщо перший робочий сет повільний — скороти тренування, не розминку.',
              ],
            ],
            hard: [
              [
                'Tired is a feeling. The warm-up is a fact. Do it, then decide.',
                'Втома — це відчуття. Розминка — це факт. Зроби її, тоді вирішуй.',
              ],
            ],
          },
          L,
        ) + hint
      );
    },
  },
  {
    id: 'bored',
    all: [['bored', 'boring', 'нудно', 'нудьга', 'скучно', 'скука']],
    maxWords: 6,
    answer: (c, _p, L) => {
      const t = liftToBeat(c);
      const dare = t
        ? L(
            `Beat ${c.fmt.exercise(t.name)}: ${c.fmt.kg(t.kg)} × ${t.reps + 1} next time. One rep more.`,
            `Побий ${c.fmt.exercise(t.name)}: ${c.fmt.kg(t.kg)} × ${t.reps + 1} наступного разу. На один повтор більше.`,
          )
        : L(
            'Log a session and I’ll give you something to beat.',
            'Запиши тренування — дам, що побити.',
          );
      return `${say(
        c,
        'bored',
        {
          soft: [['Let’s fix that!', 'Зараз виправимо!']],
          blunt: [['Here’s something.', 'Ось тобі.']],
          hard: [['Bored? Good. Here’s work.', 'Нудно? Чудово. Ось робота.']],
        },
        L,
      )} ${dare}`;
    },
  },
  {
    id: 'challenge',
    all: [['challenge', 'dare me', 'челендж', 'виклик', 'кинь виклик', 'челлендж', 'вызов']],
    answer: (c, _p, L) => {
      const t = liftToBeat(c);
      const opts: Line[] = [
        [
          'This week: every session, one more rep than last time on your first lift.',
          'Цього тижня: у кожному тренуванні на перший вправі — на повтор більше, ніж минулого разу.',
        ],
        [
          '10,000 steps every day this week. Log them.',
          '10 000 кроків щодня цього тижня. Записуй.',
        ],
        [
          'Rest exactly what I give you. No phone between sets. One week.',
          'Відпочивай рівно стільки, скільки я даю. Без телефона між сетами. Тиждень.',
        ],
      ];
      if (t)
        opts.unshift([
          `${c.fmt.exercise(t.name)}: ${c.fmt.kg(t.kg)} × ${t.reps + 2} within two weeks.`,
          `${c.fmt.exercise(t.name)}: ${c.fmt.kg(t.kg)} × ${t.reps + 2} за два тижні.`,
        ]);
      return `${say(
        c,
        'ch',
        {
          soft: [['You’ve got this:', 'Ти впораєшся:']],
          blunt: [['Challenge:', 'Виклик:']],
          hard: [['Accept or leave:', 'Приймай або йди:']],
        },
        L,
      )} ${pick(c, 'chx', opts, L)}`;
    },
  },
  {
    id: 'fun_fact',
    all: [
      [
        'fact',
        'fun fact',
        'tell me something',
        'something interesting',
        'did you know',
        'факт',
        'цікав*',
        'розкажи щось',
        'интересн*',
        'расскажи что-нибудь',
      ],
    ],
    answer: (c, _p, L) => pick(c, 'fact', FACTS, L),
  },
  {
    id: 'quote',
    all: [
      ['quote', 'wisdom', 'inspire me', 'inspiration', 'цитат*', 'мудр*', 'надихни', 'вдохнови'],
    ],
    answer: (c, _p, L) => say(c, 'quote', QUOTES, L),
  },
  {
    id: 'laugh',
    all: [['lol', 'haha', 'hahaha', 'lmao', 'хаха', 'ахах', 'ахаха', 'хахаха', 'ржу', 'кек']],
    maxWords: 3,
    answer: (c, _p, L) =>
      say(
        c,
        'lol',
        {
          soft: [['Glad I made you smile!', 'Радий, що ти всміхнувся!']],
          blunt: [['Funny. Now train.', 'Смішно. Тепер тренуйся.']],
          hard: [
            ['Laugh between sets, not instead of them.', 'Смійся між сетами, а не замість них.'],
            ['Don’t laugh. Lift.', 'Не смійся. Тягай.'],
          ],
        },
        L,
      ),
  },
  {
    id: 'mood_down',
    all: [
      [
        'sad',
        'depressed',
        'bad day',
        'awful',
        'upset',
        'сумно',
        'погано',
        'поганий день',
        'кепсько',
        'грустно',
        'плохо',
        'хреново',
        'пригнічен*',
      ],
    ],
    maxWords: 10,
    neutral: true,
    answer: (_c, _p, L) =>
      L(
        'Sorry to hear that. A walk or an easy session often helps a bit — but it’s fine to just rest today. If it’s been heavy for a while, talking to someone you trust helps more than any workout.',
        'Шкода це чути. Прогулянка чи легке тренування часто трохи допомагають — але можна й просто відпочити. Якщо важко вже давно, розмова з кимось, кому довіряєш, допоможе більше за будь-яке тренування.',
      ),
  },
  {
    id: 'mood_up',
    all: [
      [
        'great day',
        'feel great',
        'feeling great',
        'awesome',
        'amazing',
        'happy',
        'чудово',
        'супер',
        'кайф',
        'круто',
        'щасливий',
        'класно',
        'отлично',
        'прекрасно',
      ],
    ],
    maxWords: 6,
    answer: (c, _p, L) =>
      say(
        c,
        'up',
        {
          soft: [
            [
              'Love that! Use it — good days are for good sets.',
              'Клас! Використай це — гарні дні для гарних сетів.',
            ],
          ],
          blunt: [
            ['Good. Put it into the first work set.', 'Добре. Вклади це в перший робочий сет.'],
          ],
          hard: [
            [
              'Feeling great is not a PR. Go make one.',
              'Гарний настрій — ще не рекорд. Іди зроби рекорд.',
            ],
          ],
        },
        L,
      ),
  },
  {
    id: 'lets_go',
    all: [['lets go', 'let s go', 'lesgo', 'погнали', 'поїхали', 'вперед', 'го', 'go go']],
    maxWords: 3,
    answer: (c, _p, L) =>
      say(
        c,
        'go',
        {
          soft: [['Let’s go! Warm-up first.', 'Погнали! Спершу розминка.']],
          blunt: [['Go. Warm-up first.', 'Вперед. Спершу розминка.']],
          hard: [['Stop typing. Start lifting.', 'Досить писати. Почни тягати.']],
        },
        L,
      ),
  },
  {
    id: 'nothing',
    all: [
      [
        'nothing',
        'never mind',
        'nevermind',
        'just because',
        'no reason',
        'нічого',
        'просто так',
        'та нічо',
        'неважливо',
        'ничего',
        'просто',
      ],
    ],
    maxWords: 3,
    answer: (c, _p, L) =>
      say(
        c,
        'nothing',
        {
          soft: [
            ['No worries — I’m here when you need me.', 'Без проблем — я тут, коли знадоблюсь.'],
          ],
          blunt: [['OK.', 'Гаразд.']],
          hard: [['Then stop wasting my time. Go lift.', 'Тоді не марнуй мій час. Іди тягай.']],
        },
        L,
      ),
  },
  {
    id: 'rival_ai',
    all: [['chatgpt', 'gpt', 'gemini', 'siri', 'alexa', 'claude', 'copilot', 'гпт', 'чатжпт']],
    answer: (c, _p, L) =>
      say(
        c,
        'rival',
        {
          soft: [
            [
              'They know everything. I know your log — that’s more useful in a gym.',
              'Вони знають усе. Я знаю твій журнал — у залі це корисніше.',
            ],
          ],
          blunt: [['They don’t read your sets. I do.', 'Вони не читають твоїх сетів. Я читаю.']],
          hard: [
            [
              'Ask them to spot your bench. I’ll wait.',
              'Попроси їх пострахувати твій жим. Я почекаю.',
            ],
          ],
        },
        L,
      ),
  },
  {
    id: 'atlas_age',
    all: [
      ['how old are you', 'your age', 'скільки тобі років', 'скільки тобі', 'сколько тебе лет'],
    ],
    answer: (c, _p, L) =>
      say(
        c,
        'age',
        {
          soft: [
            [
              'Young enough to learn, old enough to read your log carefully.',
              'Достатньо молодий, щоб учитися, і досить дорослий, щоб уважно читати твій журнал.',
            ],
          ],
          blunt: [
            [
              'As old as your first logged workout.',
              'Такий старий, як твоє перше записане тренування.',
            ],
          ],
          hard: [['Older than your excuses. Barely.', 'Старший за твої відмовки. Ледь-ледь.']],
        },
        L,
      ),
  },
  {
    id: 'atlas_sleep',
    all: [['do you sleep', 'you ever sleep', 'ти спиш', 'ти коли спиш', 'ты спишь']],
    answer: (c, _p, L) =>
      say(
        c,
        'aslp',
        {
          soft: [
            [
              'Never — so you can. Go get your 8 hours.',
              'Ніколи — щоб спав ти. Іди по свої 8 годин.',
            ],
          ],
          blunt: [['No. You should.', 'Ні. А тобі варто.']],
          hard: [
            [
              'Sleep is for athletes who recover. Which reminds me — go to bed.',
              'Сон — для тих, хто відновлюється. До речі — в ліжко.',
            ],
          ],
        },
        L,
      ),
  },
  {
    id: 'atlas_eat',
    all: [['what do you eat', 'do you eat', 'your diet', 'що ти їси', 'ти їси', 'что ты ешь']],
    answer: (c, _p, L) =>
      say(
        c,
        'aeat',
        {
          soft: [['Data! Your sets are my protein.', 'Дані! Твої сети — мій білок.']],
          blunt: [['Your logs. 2 g per kg.', 'Твої журнали. 2 г на кг.']],
          hard: [['Excuses. Yours mostly.', 'Відмовки. Здебільшого твої.']],
        },
        L,
      ),
  },
  {
    id: 'sing_poem',
    all: [
      [
        'sing',
        'song',
        'poem',
        'rap',
        'dance',
        'заспівай',
        'пісн*',
        'вірш*',
        'реп',
        'танцюй',
        'спой',
        'стих*',
      ],
    ],
    answer: (c, _p, L) =>
      say(
        c,
        'sing',
        {
          soft: [
            [
              'Roses are red, the bar’s loaded too — one more clean rep, and I’m proud of you.',
              'Троянди червоні, штанга важка — ще один чистий повтор, і ти вже зірка.',
            ],
          ],
          blunt: [
            [
              'Sets, reps, sleep, repeat. That’s the whole song.',
              'Сети, повтори, сон, повтор. Ось і вся пісня.',
            ],
          ],
          hard: [
            [
              'I don’t sing. I count. One. Two. Keep going.',
              'Я не співаю. Я рахую. Раз. Два. Далі.',
            ],
          ],
        },
        L,
      ),
  },
  {
    id: 'clock',
    all: [
      ['what time', 'time is it', 'котра година', 'скільки часу', 'который час', 'сколько времени'],
    ],
    maxWords: 5,
    answer: (c, _p, L) => {
      const t = new Intl.DateTimeFormat(c.locale, { hour: '2-digit', minute: '2-digit' }).format(
        c.now,
      );
      return (
        L(`${t}. `, `${t}. `) +
        say(
          c,
          'clock',
          {
            soft: [['Good time for a walk, at least.', 'Принаймні гарний час для прогулянки.']],
            blunt: [['Time to train, probably.', 'Мабуть, час тренуватися.']],
            hard: [['Time you were lifting.', 'Час, коли ти вже мав би тягати.']],
          },
          L,
        )
      );
    },
  },
  {
    id: 'which_day',
    all: [
      [
        'what day',
        'what s the date',
        'what date',
        'який сьогодні день',
        'яке сьогодні число',
        'яке число',
        'какой сегодня день',
        'какое число',
      ],
    ],
    maxWords: 5,
    answer: (c, _p, L) => {
      const d = new Intl.DateTimeFormat(c.locale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }).format(c.now);
      return `${d}. ${todayLine(c, L, c.now)}`;
    },
  },
  {
    id: 'you_dumb',
    all: [
      [
        'dumb',
        'stupid',
        'useless',
        'didn t understand',
        'you don t get',
        'wrong answer',
        'not what i asked',
        'тупий',
        'дурний',
        'не зрозумів',
        'не те',
        'не про те',
        'не то',
        'тупой',
        'бесполезн*',
      ],
    ],
    maxWords: 8,
    answer: (c, _p, L) =>
      say(
        c,
        'dumb',
        {
          soft: [
            [
              'Sorry — I missed that one. Try asking a bit differently, or tap a suggestion below.',
              'Вибач — не влучив. Спробуй сформулювати трохи інакше або тапни підказку нижче.',
            ],
          ],
          blunt: [
            [
              'Fair. Rephrase it and I’ll try again.',
              'Справедливо. Переформулюй — спробую ще раз.',
            ],
          ],
          hard: [
            [
              'Possible. Or your question was. Rephrase.',
              'Можливо. Або твоє питання. Переформулюй.',
            ],
          ],
        },
        L,
      ),
    suggest: (L) => [
      L('What can I ask you?', 'Що в тебе можна спитати?'),
      L('What should I train today?', 'Що тренувати сьогодні?'),
    ],
  },
];

/** Replies for existing chit-chat topics — varied, timed and toned. */
export const SMALL_OVERRIDES: Record<string, Pick<Intent, 'answer'>> = {
  greeting: { answer: (c, _p, L) => greet(c, L) },
  how_are_you: {
    answer: (c, _p, L) =>
      say(
        c,
        'hru',
        {
          soft: [
            [
              'Great, thanks for asking! More importantly — how are YOU feeling today?',
              'Чудово, дякую! Важливіше — як ТИ сьогодні почуваєшся?',
            ],
            ['All good here. How’s the body today?', 'У мене все добре. Як тіло сьогодні?'],
          ],
          blunt: [
            ['Fine. You?', 'Нормально. Ти?'],
            ['Working. How are you feeling?', 'Працюю. Як ти?'],
          ],
          hard: [
            ['Better than your consistency. You?', 'Краще за твою регулярність. А ти?'],
            [
              'I don’t have feelings. You have a workout.',
              'У мене нема почуттів. У тебе є тренування.',
            ],
          ],
        },
        L,
      ),
  },
  ack: {
    answer: (c, _p, L) =>
      say(
        c,
        'ack',
        {
          soft: [
            ['Great!', 'Супер!'],
            ['Perfect.', 'Чудово.'],
          ],
          blunt: [
            ['Good.', 'Добре.'],
            ['OK.', 'Ок.'],
          ],
          hard: [
            ['Good. Now go.', 'Добре. Тепер іди.'],
            ['Don’t just say it. Do it.', 'Не кажи. Роби.'],
          ],
        },
        L,
      ),
  },
};

/** Emoji-only messages. */
export function emojiReply(c: AskCtx, text: string, L: Tr): string | null {
  if (/\p{L}/u.test(text) || !/\p{Extended_Pictographic}/u.test(text)) return null;
  if (/[💪🏋🔥]/u.test(text))
    return say(
      c,
      'emo-flex',
      {
        soft: [['💪 That’s the spirit!', '💪 Оце настрій!']],
        blunt: [['Flexing is not a set.', 'Позування — не підхід.']],
        hard: [['Emojis don’t lift. You do. Allegedly.', 'Емодзі не тягають. Тягаєш ти. Нібито.']],
      },
      L,
    );
  if (/[😂🤣😅😄😆]/u.test(text))
    return say(
      c,
      'lol',
      {
        soft: [['😄', '😄']],
        blunt: [['Funny. Now train.', 'Смішно. Тепер тренуйся.']],
        hard: [
          ['Laugh between sets, not instead of them.', 'Смійся між сетами, а не замість них.'],
        ],
      },
      L,
    );
  if (/[😢😭😞😔]/u.test(text))
    return L(
      'Rough day? Take it easy — an easy walk still counts.',
      'Важкий день? Не жени — легка прогулянка теж рахується.',
    );
  if (/[❤😍🥰]/u.test(text))
    return say(
      c,
      'love',
      {
        soft: [['❤️ Right back at you.', '❤️ Взаємно.']],
        blunt: [['Noted.', 'Прийнято.']],
        hard: [['Save it for the bar.', 'Збережи це для штанги.']],
      },
      L,
    );
  return say(
    c,
    'emo',
    {
      soft: [['🙂', '🙂']],
      blunt: [['Use words.', 'Словами, будь ласка.']],
      hard: [['Hieroglyphs. Great. Use words.', 'Ієрогліфи. Чудово. Словами.']],
    },
    L,
  );
}

export const SMALLTALK_IDS = new Set([
  ...INTENTS_SMALL.map((i) => i.id),
  ...Object.keys(SMALL_OVERRIDES),
  'thanks',
  'bye',
  'joke',
  'insult',
  'compliment',
  'sorry',
  'motivate',
  'done',
  'do_you_lift',
  'are_you_ai',
  'who_made',
  'who',
]);
